import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";

const normalizeActive = (value: unknown, fallback = true): boolean => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "inactive"].includes(normalized)) {
      return false;
    }
    if (["true", "1", "yes", "on", "active"].includes(normalized)) {
      return true;
    }
  }
  return fallback;
};

const normalizeArticleIds = (
  articleId: unknown,
  articleIds: unknown
): string[] => {
  const values = new Set<string>();

  const pushValue = (value: unknown) => {
    if (!value || typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) values.add(trimmed);
  };

  if (Array.isArray(articleIds)) {
    articleIds.forEach(pushValue);
  } else if (typeof articleIds === "string" && articleIds.trim() !== "") {
    try {
      const parsed = JSON.parse(articleIds);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushValue);
      } else {
        pushValue(articleIds);
      }
    } catch {
      articleIds.split(/[\s,;]+/).forEach(pushValue);
    }
  }

  if (typeof articleId === "string") {
    pushValue(articleId);
  }

  return Array.from(values);
};

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetIds, status, revisionCount } = await request.json();

    if (
      !assetIds ||
      !Array.isArray(assetIds) ||
      assetIds.length === 0 ||
      !status
    ) {
      return NextResponse.json(
        { error: "Missing required fields: assetIds (array), status" },
        { status: 400 }
      );
    }

    // Get user's role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Enforce role on client approval - allow both clients and admins
    if (
      status === "approved_by_client" &&
      profile?.role !== "client" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Enforce role on QA approval - allow only admins
    if (status === "approved" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Helper function to chunk array
    const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    };

    // Chunk asset IDs to avoid Supabase query limits (100 per chunk)
    const CHUNK_SIZE = 100;
    const assetIdChunks = chunkArray(assetIds, CHUNK_SIZE);

    // Get previous statuses for activity logging (in chunks)
    let prevAssets: any[] = [];
    for (const chunk of assetIdChunks) {
      const { data } = await supabaseAuth
        .from("onboarding_assets")
        .select("id, status")
        .in("id", chunk);
      if (data) {
        prevAssets = [...prevAssets, ...data];
      }
    }

    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(), // Set updated_at timestamp
    };

    // Add revision count if provided
    if (revisionCount !== undefined) {
      updateData.revision_count = revisionCount;
    }

    // Update assets in chunks using authenticated client
    for (const chunk of assetIdChunks) {
      const { error: assetError } = await supabaseAuth
        .from("onboarding_assets")
        .update(updateData)
        .in("id", chunk);

      if (assetError) {
        console.error("Error updating asset statuses:", assetError);
        console.error("Asset IDs chunk:", chunk);
        console.error("Update data:", updateData);
        return NextResponse.json(
          {
            error: "Failed to update asset statuses",
            details: assetError.message,
          },
          { status: 500 }
        );
      }
    }

    // Auto-transfer approved assets to assets table
    if (status === "approved_by_client") {
      try {
        // Get all onboarding assets for transfer (in chunks)
        let onboardingAssets: any[] = [];
        for (const chunk of assetIdChunks) {
          const { data, error: fetchError } = await supabaseAuth
            .from("onboarding_assets")
            .select("*")
            .in("id", chunk)
            .eq("status", "approved_by_client")
            .eq("transferred", false);

          if (fetchError) {
            console.error("Error fetching assets for transfer:", fetchError);
            continue;
          }

          if (data) {
            onboardingAssets = [...onboardingAssets, ...data];
          }
        }

        if (onboardingAssets.length > 0) {
          // Prepare data for assets table
          const assetsToInsert = onboardingAssets.map((asset) => {
            const normalizedArticles = normalizeArticleIds(
              asset.article_id,
              asset.article_ids
            );

            return {
              article_id: asset.article_id,
              product_name: asset.product_name,
              product_link: asset.product_link,
              glb_link: asset.glb_link,
              category: asset.category,
              subcategory: asset.subcategory,
              client: asset.client,
              tags: asset.tags,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              preview_image: asset.preview_images
                ? Array.isArray(asset.preview_images)
                  ? asset.preview_images[0]
                  : asset.preview_images
                : null,
              materials: null,
              colors: null,
              glb_status: "completed",
              active: normalizeActive(asset.active),
              article_ids: normalizedArticles,
            };
          });

          // Insert assets in chunks to avoid payload size limits
          const insertChunks = chunkArray(assetsToInsert, CHUNK_SIZE);
          for (const insertChunk of insertChunks) {
            const { data: insertedAssets, error: insertError } =
              await supabaseAuth
                .from("assets")
                .insert(insertChunk)
                .select("id, article_id, client");

            if (insertError) {
              console.error("Error inserting assets chunk:", insertError);
              return NextResponse.json(
                { error: "Failed to transfer assets to assets table" },
                { status: 500 }
              );
            }

            if (insertedAssets && insertedAssets.length > 0) {
              const activeUpdatePromises = insertedAssets.map((inserted) => {
                const source = onboardingAssets.find(
                  (asset) =>
                    asset.article_id === inserted.article_id &&
                    asset.client === inserted.client
                );

                const normalizedActiveValue = normalizeActive(source?.active);
                const normalizedArticles = normalizeArticleIds(
                  source?.article_id,
                  source?.article_ids
                );

                return supabaseAuth
                  .from("assets")
                  .update({
                    active: normalizedActiveValue,
                    article_ids: normalizedArticles,
                  })
                  .eq("id", inserted.id);
              });

              await Promise.all(activeUpdatePromises);
            }
          }

          // Copy GLB files to Android folder for approved assets
          const assetsWithGlb = onboardingAssets.filter(
            (asset) => asset.glb_link
          );
          if (assetsWithGlb.length > 0) {
            try {
              // Get BunnyCDN configuration
              const storageKey = process.env.BUNNY_STORAGE_KEY;
              const storageZone =
                process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
              const cdnBaseUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

              if (storageKey && storageZone && cdnBaseUrl) {
                console.log(
                  `🔄 Starting GLB file transfers for ${assetsWithGlb.length} assets...`
                );

                // Process GLB files in smaller batches to avoid overwhelming the server
                const glbChunks = chunkArray(assetsWithGlb, 5);

                for (const glbChunk of glbChunks) {
                  const transferPromises = glbChunk.map(async (asset) => {
                    try {
                      // Download the current GLB file
                      const glbResponse = await fetch(asset.glb_link, {
                        method: "GET",
                        headers: {
                          AccessKey: storageKey,
                        },
                      });

                      if (glbResponse.ok) {
                        const glbBuffer = await glbResponse.arrayBuffer();

                        // Create Android folder path
                        const sanitizedClientName = asset.client.replace(
                          /[^a-zA-Z0-9._-]/g,
                          "_"
                        );
                        const fileName = `${asset.article_id}.glb`;
                        const androidPath = `${sanitizedClientName}/Android/${fileName}`;
                        const androidStorageUrl = `https://se.storage.bunnycdn.com/${storageZone}/${androidPath}`;

                        // Upload to Android folder
                        const androidUploadResponse = await fetch(
                          androidStorageUrl,
                          {
                            method: "PUT",
                            headers: {
                              AccessKey: storageKey,
                              "Content-Type": "application/octet-stream",
                            },
                            body: glbBuffer,
                          }
                        );

                        if (androidUploadResponse.ok) {
                          // Update the GLB link in the assets table to point to Android folder
                          const newGlbLink = `${cdnBaseUrl}/${androidPath}`;

                          await supabaseAuth
                            .from("assets")
                            .update({ glb_link: newGlbLink })
                            .eq("article_id", asset.article_id)
                            .eq("client", asset.client);

                          console.log(
                            `✅ GLB file copied: ${asset.article_id} -> ${newGlbLink}`
                          );
                          return { success: true, assetId: asset.article_id };
                        } else {
                          console.error(
                            `❌ Failed to upload GLB for ${asset.article_id}:`,
                            androidUploadResponse.status
                          );
                          return {
                            success: false,
                            assetId: asset.article_id,
                            error: `Upload failed: ${androidUploadResponse.status}`,
                          };
                        }
                      } else {
                        console.error(
                          `❌ Failed to download GLB for ${asset.article_id}:`,
                          glbResponse.status
                        );
                        return {
                          success: false,
                          assetId: asset.article_id,
                          error: `Download failed: ${glbResponse.status}`,
                        };
                      }
                    } catch (error) {
                      console.error(
                        `❌ Error transferring GLB for ${asset.article_id}:`,
                        error
                      );
                      return {
                        success: false,
                        assetId: asset.article_id,
                        error:
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                      };
                    }
                  });

                  // Wait for this batch to complete
                  const results = await Promise.all(transferPromises);
                  const successCount = results.filter((r) => r.success).length;
                  console.log(
                    `📊 Batch completed: ${successCount}/${results.length} files transferred successfully`
                  );

                  // Small delay between batches
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                console.log(
                  `✅ GLB file transfer process completed for ${assetsWithGlb.length} assets`
                );
              } else {
                console.warn(
                  "⚠️ BunnyCDN configuration missing, skipping file transfers"
                );
              }
            } catch (error) {
              console.error("❌ Error during bulk GLB file transfer:", error);
              // Don't fail the entire operation if file transfer fails
            }
          }

          // Update onboarding_assets to mark as transferred (in chunks)
          const transferredIds = onboardingAssets.map((asset) => asset.id);
          const transferredIdChunks = chunkArray(transferredIds, CHUNK_SIZE);

          for (const chunk of transferredIdChunks) {
            const { error: updateError } = await supabaseAuth
              .from("onboarding_assets")
              .update({
                transferred: true,
              })
              .in("id", chunk);

            if (updateError) {
              console.error(
                "Error marking assets as transferred:",
                updateError
              );
              // Don't fail the request, just log the error
            }
          }
        }
      } catch (transferError) {
        console.error("Error during bulk transfer:", transferError);
        // Don't fail the request, just log the error
      }
    }

    // Note: Asset status history is automatically logged by database trigger
    // when using the authenticated Supabase client

    // Log activities for all assets
    if (prevAssets && prevAssets.length > 0) {
      const activityPromises = prevAssets.map((prevAsset) => {
        const prevStatus = prevAsset.status;
        const assetId = prevAsset.id;

        return logActivityServer({
          action: "asset_status_updated",
          description: `Asset status updated from ${prevStatus} to ${status}`,
          type: "update",
          resource_type: "asset",
          resource_id: assetId,
          metadata: {
            assetId,
            prevStatus,
            newStatus: status,
            revisionCount,
          },
        });
      });

      // Execute activity logging in parallel (don't wait for completion)
      Promise.all(activityPromises).catch((error) => {
        console.error("Error logging activities:", error);
      });
    }

    // Check and update allocation lists that are now fully completed
    if (status === "approved_by_client" || status === "approved") {
      try {
        // Get allocation list IDs for the updated assets
        const { data: assetAssignments, error: assignmentError } =
          await supabaseAuth
            .from("asset_assignments")
            .select("allocation_list_id")
            .in("asset_id", assetIds);

        if (!assignmentError && assetAssignments) {
          // Get unique allocation list IDs
          const allocationListIds = [
            ...new Set(
              assetAssignments.map((a) => a.allocation_list_id).filter(Boolean)
            ),
          ];

          // Check each allocation list to see if all assets are now approved
          for (const listId of allocationListIds) {
            const { data: allAssetsInList, error: listAssetsError } =
              await supabaseAuth
                .from("asset_assignments")
                .select(
                  `
                onboarding_assets!inner(id, status, qa_team_handles_model, pricing_option_id)
              `
                )
                .eq("allocation_list_id", listId);

            if (
              !listAssetsError &&
              allAssetsInList &&
              allAssetsInList.length > 0
            ) {
              // Filter out QA-handled models - they don't count toward completion
              const pricedAssets = allAssetsInList.filter((assignment: any) => {
                if (!assignment.onboarding_assets) return false;
                const asset = assignment.onboarding_assets;
                // Exclude QA-handled models
                return (
                  !asset.qa_team_handles_model &&
                  asset.pricing_option_id !== "qa_team_handles_model"
                );
              });

              // Check if all priced assets in the list are approved
              // If list has no priced assets (only QA-handled), it should never be marked as approved
              const allApproved =
                pricedAssets.length > 0 &&
                pricedAssets.every(
                  (assignment: any) =>
                    assignment.onboarding_assets.status ===
                      "approved_by_client" ||
                    assignment.onboarding_assets.status === "approved"
                );

              if (allApproved) {
                // Update the allocation list to mark it as approved
                const { error: updateListError } = await supabaseAuth
                  .from("allocation_lists")
                  .update({
                    approved_at: new Date().toISOString(),
                    status: "approved",
                  })
                  .eq("id", listId);

                if (updateListError) {
                  console.error(
                    `Error updating allocation list ${listId} as approved:`,
                    updateListError
                  );
                } else {
                  console.log(
                    `✅ Allocation list ${listId} marked as approved - all priced assets completed (${pricedAssets.length} priced, ${allAssetsInList.length - pricedAssets.length} QA-handled excluded)`
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(
          "Error checking allocation list completion in bulk update:",
          error
        );
      }

      const cleanupPromises = assetIds.map((assetId) =>
        cleanupSingleAllocationList(assetId, user.id).catch((error) => {
          console.error(
            `Error cleaning up allocation list for asset ${assetId}:`,
            error
          );
        })
      );

      // Execute cleanup in parallel (don't wait for completion)
      Promise.all(cleanupPromises);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${assetIds.length} asset(s)`,
      transferred: status === "approved_by_client",
    });
  } catch (error) {
    console.error("Error in bulk complete API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
