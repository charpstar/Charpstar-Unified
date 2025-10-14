import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";

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
          const assetsToInsert = onboardingAssets.map((asset) => ({
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
          }));

          // Insert assets in chunks to avoid payload size limits
          const insertChunks = chunkArray(assetsToInsert, CHUNK_SIZE);
          for (const insertChunk of insertChunks) {
            const { error: insertError } = await supabaseAuth
              .from("assets")
              .insert(insertChunk)
              .select();

            if (insertError) {
              console.error("Error inserting assets chunk:", insertError);
              return NextResponse.json(
                { error: "Failed to transfer assets to assets table" },
                { status: 500 }
              );
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

    // Clean up allocation lists for any assets that moved to completed states
    if (status === "approved_by_client") {
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
