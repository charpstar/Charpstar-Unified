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

    console.log("Bulk API received:", {
      assetIds,
      status,
      revisionCount,
      userId: user.id,
    });

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

    console.log("User profile role:", profile?.role);

    // Enforce role on client approval - allow both clients and admins
    if (
      status === "approved_by_client" &&
      profile?.role !== "client" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get previous statuses for activity logging
    const { data: prevAssets } = await supabase
      .from("onboarding_assets")
      .select("id, status")
      .in("id", assetIds);

    // Prepare update data
    const updateData: any = {
      status,
    };

    // Add revision count if provided
    if (revisionCount !== undefined) {
      updateData.revision_count = revisionCount;
    }

    // Update all assets in one query
    const { error: assetError } = await supabase
      .from("onboarding_assets")
      .update(updateData)
      .in("id", assetIds);

    console.log("Bulk database update result:", { assetError, updateData });

    if (assetError) {
      console.error("Error updating asset statuses:", assetError);
      console.error("Asset IDs:", assetIds);
      console.error("Update data:", updateData);
      return NextResponse.json(
        {
          error: "Failed to update asset statuses",
          details: assetError.message,
        },
        { status: 500 }
      );
    }

    // Auto-transfer approved assets to assets table
    if (status === "approved_by_client") {
      console.log("Starting bulk auto-transfer for assets:", assetIds);
      try {
        // Get all onboarding assets for transfer
        const { data: onboardingAssets, error: fetchError } = await supabase
          .from("onboarding_assets")
          .select("*")
          .in("id", assetIds)
          .eq("status", "approved_by_client")
          .eq("transferred", false);

        console.log("Onboarding assets fetch result:", {
          count: onboardingAssets?.length || 0,
          fetchError: fetchError?.message,
        });

        if (!fetchError && onboardingAssets && onboardingAssets.length > 0) {
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

          // Insert all assets at once
          const { data: newAssets, error: insertError } = await supabase
            .from("assets")
            .insert(assetsToInsert)
            .select();

          if (insertError) {
            console.error("Error inserting assets:", insertError);
            return NextResponse.json(
              { error: "Failed to transfer assets to assets table" },
              { status: 500 }
            );
          }

          console.log(`Successfully inserted ${newAssets?.length || 0} assets`);

          // Update onboarding_assets to mark as transferred
          const transferredIds = onboardingAssets.map((asset) => asset.id);
          const { error: updateError } = await supabase
            .from("onboarding_assets")
            .update({
              transferred: true,
            })
            .in("id", transferredIds);

          if (updateError) {
            console.error("Error marking assets as transferred:", updateError);
            // Don't fail the request, just log the error
          }

          console.log(
            `Successfully marked ${transferredIds.length} assets as transferred`
          );
        }
      } catch (transferError) {
        console.error("Error during bulk transfer:", transferError);
        // Don't fail the request, just log the error
      }
    }

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

    console.log(`Bulk update completed for ${assetIds.length} assets`);

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
