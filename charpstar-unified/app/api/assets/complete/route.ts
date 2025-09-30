import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, status, revisionCount } = await request.json();

    console.log("API received:", {
      assetId,
      status,
      revisionCount,
      userId: user.id,
    });

    if (!assetId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: assetId, status" },
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

    console.log("User profile role:", profile?.role);

    // Enforce role on client approval - allow both clients and admins
    if (
      status === "approved_by_client" &&
      profile?.role !== "client" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get previous status for activity logging
    const { data: prevAssetRow } = await supabase
      .from("onboarding_assets")
      .select("status")
      .eq("id", assetId)
      .single();
    const prevStatus = prevAssetRow?.status || null;

    // Update the asset status
    const updateData: any = { status };
    console.log("About to update asset with:", { updateData, status });

    // Test if the status is valid by checking the database schema
    if (status === "client_revision") {
      console.log("Testing client_revision status - this is a new enum value");
    }

    // On revisions, increment revision_count immediately and log the revision action
    if (status === "revisions" || status === "client_revision") {
      // Fetch latest revision number to set on asset
      const { data: latestRev } = await supabase
        .from("revision_history")
        .select("revision_number")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false })
        .limit(1)
        .single();
      const latestNumber = latestRev?.revision_number ?? revisionCount ?? null;
      if (latestNumber !== null) updateData.revision_count = latestNumber;

      // Also create a revision history entry so QA metrics can attribute the review
      const nextRevisionNumber = (latestNumber ?? 0) + 1;
      await supabase.from("revision_history").insert({
        asset_id: assetId,
        revision_number: nextRevisionNumber,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
    } else if (revisionCount !== undefined) {
      updateData.revision_count = revisionCount;
    }

    const { error: assetError } = await supabase
      .from("onboarding_assets")
      .update(updateData)
      .eq("id", assetId);

    console.log("Database update result:", { assetError, updateData });

    if (assetError) {
      console.error("Error updating asset status:", assetError);
      console.error("Asset ID:", assetId);
      console.error("Update data:", updateData);
      return NextResponse.json(
        { error: "Failed to update asset status", details: assetError.message },
        { status: 500 }
      );
    }

    // Auto-transfer approved assets to assets table (do this before other logic)
    if (status === "approved_by_client") {
      console.log("Starting auto-transfer for asset:", assetId);
      try {
        // Get the onboarding asset for transfer
        const { data: onboardingAsset, error: fetchError } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", assetId)
          .eq("status", "approved_by_client")
          .eq("transferred", false)
          .single();

        console.log("Onboarding asset fetch result:", {
          onboardingAsset: !!onboardingAsset,
          fetchError: fetchError?.message,
        });

        if (!fetchError && onboardingAsset) {
          console.log("Onboarding asset found:", {
            id: onboardingAsset.id,
            product_name: onboardingAsset.product_name,
            article_id: onboardingAsset.article_id,
            client: onboardingAsset.client,
            transferred: onboardingAsset.transferred,
          });

          // Check if asset already exists in assets table
          const { data: existingAsset } = await supabase
            .from("assets")
            .select("id")
            .eq("article_id", onboardingAsset.article_id)
            .eq("client", onboardingAsset.client)
            .single();

          console.log("Existing asset check:", {
            existingAsset: !!existingAsset,
          });

          if (!existingAsset) {
            // Prepare data for assets table
            const assetData = {
              article_id: onboardingAsset.article_id,
              product_name: onboardingAsset.product_name,
              product_link: onboardingAsset.product_link,
              glb_link: onboardingAsset.glb_link,
              category: onboardingAsset.category,
              subcategory: onboardingAsset.subcategory,
              client: onboardingAsset.client,
              tags: onboardingAsset.tags,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              preview_image: onboardingAsset.preview_images
                ? Array.isArray(onboardingAsset.preview_images)
                  ? onboardingAsset.preview_images[0]
                  : onboardingAsset.preview_images
                : null,
              materials: null,
              colors: null,
              glb_status: "completed",
            };

            // Insert into assets table
            console.log("Inserting asset data:", assetData);
            const { data: newAsset, error: insertError } = await supabase
              .from("assets")
              .insert(assetData)
              .select()
              .single();

            console.log("Asset insert result:", {
              newAsset: !!newAsset,
              insertError: insertError?.message,
            });

            if (!insertError && newAsset) {
              // Update onboarding_assets to mark as transferred
              await supabase
                .from("onboarding_assets")
                .update({
                  transferred: true,
                })
                .eq("id", assetId);

              // Log the activity
              await logActivityServer({
                action: "asset_transferred",
                description: `Asset ${onboardingAsset.product_name} (${onboardingAsset.article_id}) automatically transferred to assets table`,
                type: "update",
                resource_type: "asset",
                resource_id: assetId,
                metadata: {
                  asset_id: assetId,
                  new_asset_id: newAsset.id,
                  product_name: onboardingAsset.product_name,
                  article_id: onboardingAsset.article_id,
                  client: onboardingAsset.client,
                },
              });

              console.log("Asset automatically transferred to assets table");
            } else {
              console.warn(
                "Failed to insert asset into assets table:",
                insertError
              );
            }
          } else {
            console.log(
              "Asset already exists in assets table, skipping transfer"
            );
          }
        }
      } catch (transferError) {
        console.error("Error auto-transferring asset:", transferError);
        // Don't fail the main request if transfer fails
      }
    }

    // Move files to appropriate folder based on new status
    try {
      const { data: files, error: filesError } = await supabase
        .from("asset_files")
        .select("id, file_type")
        .eq("asset_id", assetId);

      if (!filesError && files && files.length > 0) {
        // Move each file to the appropriate folder
        for (const file of files) {
          try {
            const moveResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL}/api/assets/move-file`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Cookie: request.headers.get("cookie") || "",
                },
                body: JSON.stringify({
                  assetId,
                  fileId: file.id,
                  newStatus: status,
                }),
              }
            );

            if (!moveResponse.ok) {
              console.warn(
                `Failed to move file ${file.id}:`,
                await moveResponse.text()
              );
            }
          } catch (moveError) {
            console.warn(`Error moving file ${file.id}:`, moveError);
          }
        }
      }
    } catch (fileMoveError) {
      console.warn("Error moving files:", fileMoveError);
      // Don't fail the entire operation if file moving fails
    }

    // Verify the update worked
    const { data: verifyAsset, error: verifyError } = await supabase
      .from("onboarding_assets")
      .select("status")
      .eq("id", assetId)
      .single();

    console.log("Verification query result:", { verifyAsset, verifyError });

    // Mark annotations as old when setting status to revisions
    // Only mark as old if the annotation has been through 2+ revision cycles since creation
    if (status === "revisions" || status === "client_revision") {
      // Get current revision count
      const { data: assetData, error: assetDataError } = await supabase
        .from("onboarding_assets")
        .select("revision_count")
        .eq("id", assetId)
        .single();

      if (!assetDataError && assetData) {
        const currentRevisionCount = assetData.revision_count;

        // Get all annotations that are not already marked as old
        const { data: annotations, error: annotationsError } = await supabase
          .from("asset_annotations")
          .select("id, created_at")
          .eq("asset_id", assetId)
          .eq("is_old_annotation", false);

        if (!annotationsError && annotations) {
          // Get revision history to determine when each revision occurred
          const { data: revisionHistory, error: revisionError } = await supabase
            .from("revision_history")
            .select("revision_number, created_at")
            .eq("asset_id", assetId)
            .order("revision_number", { ascending: true });

          if (!revisionError && revisionHistory) {
            // Create a map of revision numbers to creation dates
            const revisionMap = new Map();
            revisionHistory.forEach((rev) => {
              revisionMap.set(rev.revision_number, new Date(rev.created_at));
            });

            // Process each annotation to determine if it should be marked as old
            const annotationsToMarkOld = [];

            for (const annotation of annotations) {
              const annotationCreatedAt = new Date(annotation.created_at);

              // Find which revision this annotation was created in by comparing creation date
              let annotationRevisionCreatedIn = 0;
              for (const [
                revisionNumber,
                revisionDate,
              ] of revisionMap.entries()) {
                if (annotationCreatedAt >= revisionDate) {
                  annotationRevisionCreatedIn = revisionNumber;
                } else {
                  break;
                }
              }

              // Calculate how many revision cycles this annotation has been through
              // If annotation was created in revision X, it should be marked old at revision X+2
              const shouldBeOld =
                currentRevisionCount >= annotationRevisionCreatedIn + 2;

              if (shouldBeOld) {
                annotationsToMarkOld.push(annotation.id);
              }
            }

            // Mark the selected annotations as old
            if (annotationsToMarkOld.length > 0) {
              const { error: markOldError } = await supabase
                .from("asset_annotations")
                .update({ is_old_annotation: true })
                .in("id", annotationsToMarkOld);

              if (markOldError) {
                console.error("Error marking old annotations:", markOldError);
                // Don't fail the main request if annotation marking fails
              } else {
                console.log(
                  `Marked ${annotationsToMarkOld.length} annotations as old`
                );
              }
            }
          }
        }
      }
    }

    // Log activity for status change (used by QA metrics for approvals)
    try {
      await logActivityServer({
        action: `Updated asset status to ${status}`,
        type: "update",
        resource_type: "asset",
        resource_id: assetId,
        metadata: { prev_status: prevStatus, new_status: status },
      });
    } catch (e) {
      console.error("Error logging status update activity:", e);
    }

    // Note: Revision notifications are now handled by the calling page
    // to ensure proper reviewer identification (Client vs QA vs Admin)
    // See client-review/[id]/page.tsx for revision notification logic

    // Note: Approval notifications are now handled by the calling page
    // to ensure proper role-based messaging (QA vs Client approval)
    // See client-review/[id]/page.tsx for approval notification logic

    // Do NOT notify on client submission of revisions; production will forward later

    // Check allocation list status whenever an asset status changes
    const { data: assignments, error: assignmentError } = await supabase
      .from("asset_assignments")
      .select("allocation_list_id")
      .eq("asset_id", assetId)
      .eq("role", "modeler");

    if (assignmentError) {
      console.error("Error fetching asset assignment:", assignmentError);
      return NextResponse.json(
        { error: "Failed to fetch asset assignment" },
        { status: 500 }
      );
    }

    let allocationListId: string | null = null;

    if (assignments && assignments.length > 0) {
      // Use the first assignment if multiple exist
      const assignment = assignments[0];

      if (assignment?.allocation_list_id) {
        allocationListId = assignment.allocation_list_id;

        // Get all assets in this allocation list
        const { data: listAssets, error: listError } = await supabase
          .from("asset_assignments")
          .select(
            `
          asset_id,
          onboarding_assets!inner(
            id,
            status
          )
        `
          )
          .eq("allocation_list_id", assignment.allocation_list_id)
          .eq("role", "modeler");

        if (listError) {
          console.error("Error fetching list assets:", listError);
          return NextResponse.json(
            { error: "Failed to fetch list assets" },
            { status: 500 }
          );
        }

        // Check if all assets in the list are approved

        // Only assets with status "approved" or "approved_by_client" count for allocation list approval
        // "delivered_by_artist" and "revisions" do NOT count as approved
        const allApproved = listAssets?.every(
          (item: any) =>
            item.onboarding_assets?.status === "approved" ||
            item.onboarding_assets?.status === "approved_by_client"
        );

        // Get current allocation list status
        const { data: currentList, error: listStatusError } =
          await supabaseAdmin
            .from("allocation_lists")
            .select("status")
            .eq("id", assignment.allocation_list_id)
            .single();

        if (listStatusError) {
          console.error(
            "Error fetching allocation list status:",
            listStatusError
          );
          return NextResponse.json(
            { error: "Failed to fetch allocation list status" },
            { status: 500 }
          );
        }

        let allocationListApproved = false;

        if (allApproved && currentList?.status !== "approved") {
          // Update the allocation list status to approved
          const { error: listUpdateError } = await supabaseAdmin
            .from("allocation_lists")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
            })
            .eq("id", assignment.allocation_list_id);

          if (listUpdateError) {
            console.error(
              "Error updating allocation list status:",
              listUpdateError
            );
            return NextResponse.json(
              { error: "Failed to update allocation list status" },
              { status: 500 }
            );
          }

          allocationListApproved = true;
        } else if (!allApproved && currentList?.status === "approved") {
          // Update the allocation list status back to in_progress since not all assets are approved
          const { error: listUpdateError } = await supabaseAdmin
            .from("allocation_lists")
            .update({
              status: "in_progress",
              approved_at: null,
            })
            .eq("id", assignment.allocation_list_id);

          if (listUpdateError) {
            console.error(
              "Error updating allocation list status:",
              listUpdateError
            );
            return NextResponse.json(
              { error: "Failed to update allocation list status" },
              { status: 500 }
            );
          }

          allocationListApproved = false;
        }

        // Check for progress milestones and send client notifications
        if (currentList && status === "approved_by_client") {
          try {
            // Get all assets in this allocation list
            const { data: listAssets, error: listAssetsError } =
              await supabaseAdmin
                .from("asset_assignments")
                .select(
                  `
                onboarding_assets!inner(
                  id,
                  status,
                  client,
                  batch
                )
              `
                )
                .eq("allocation_list_id", allocationListId);

            if (!listAssetsError && listAssets) {
              const totalAssets = listAssets.length;
              const completedAssets = listAssets.filter(
                (assignment: any) =>
                  assignment.onboarding_assets.status === "approved" ||
                  assignment.onboarding_assets.status === "approved_by_client"
              ).length;

              const completionPercentage =
                totalAssets > 0
                  ? Math.round((completedAssets / totalAssets) * 100)
                  : 0;

              // Check if this is a milestone (25%, 50%, 75%, 100%)
              const milestones = [25, 50, 75, 100];
              const isMilestone = milestones.includes(completionPercentage);

              if (isMilestone) {
                // Get client information
                const firstAsset = listAssets[0] as any;
                const client =
                  firstAsset?.onboarding_assets?.client || "Unknown";
                const batch = firstAsset?.onboarding_assets?.batch || 1;

                // Find client profile
                const { data: clientProfile, error: clientError } =
                  await supabaseAdmin
                    .from("profiles")
                    .select("id, email")
                    .eq("client", client)
                    .eq("role", "client")
                    .single();

                if (!clientError && clientProfile && allocationListId) {
                  await notificationService.sendClientListProgressNotification(
                    clientProfile.id,
                    clientProfile.email,
                    allocationListId,
                    (currentList as any).name ||
                      `Allocation List #${(currentList as any).number}`,
                    completionPercentage,
                    completedAssets,
                    totalAssets,
                    client,
                    batch
                  );
                }
              }
            }
          } catch (progressError) {
            console.error(
              "Error sending progress notification:",
              progressError
            );
            // Don't fail the main request if progress notification fails
          }
        }

        // Check if the allocation list is now empty and clean it up if necessary
        if (allocationListId) {
          await cleanupSingleAllocationList(supabase, allocationListId);
        }

        return NextResponse.json({
          message: "Asset status updated successfully",
          allocationListApproved,
          allocationListId,
        });
      }
    }

    return NextResponse.json({
      message: "Asset status updated successfully",
      allocationListApproved: false,
    });
  } catch (error) {
    console.error("Error in asset completion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
