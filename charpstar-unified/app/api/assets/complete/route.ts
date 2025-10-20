import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";

// import { notificationService } from "@/lib/notificationService"; // TEMPORARILY DISABLED

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

    // Enforce role on client approval - allow both clients and admins
    if (
      status === "approved_by_client" &&
      profile?.role !== "client" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Only clients and admins can approve assets" },
        { status: 403 }
      );
    }

    // Enforce role on QA approval - allow only admins
    if (status === "approved" && profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can approve assets for QA" },
        { status: 403 }
      );
    }

    // Enforce role on modeler actions - allow both modelers and admins
    if (
      (status === "delivered_by_artist" || status === "revision_requested") &&
      profile?.role !== "modeler" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Only modelers and admins can deliver or request revisions" },
        { status: 403 }
      );
    }

    // Get the asset from onboarding_assets table along with allocation list info
    const { data: onboardingAsset, error: fetchError } = await supabaseAdmin
      .from("onboarding_assets")
      .select(
        `
        *,
        asset_assignments!inner(allocation_list_id)
      `
      )
      .eq("id", assetId)
      .eq("transferred", false)
      .single();

    if (fetchError) {
      console.error("Error fetching onboarding asset:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    if (!onboardingAsset) {
      return NextResponse.json(
        { error: "Asset not found or already transferred" },
        { status: 404 }
      );
    }

    // For client approvals, allow any status transition to approved_by_client
    // For QA approvals, allow any status transition to approved
    // For other statuses, ensure the asset is in the correct state
    if (
      status !== "approved_by_client" &&
      status !== "approved" &&
      onboardingAsset.status !== "approved_by_client"
    ) {
      return NextResponse.json(
        { error: "Asset status mismatch, cannot complete" },
        { status: 400 }
      );
    }

    // Allow duplicates - removed duplicate check to allow multiple entries

    // Prepare data for assets table - match the schema from transfer-approved route
    const assetData = {
      article_id: onboardingAsset.article_id,
      product_name: onboardingAsset.product_name,
      product_link: onboardingAsset.product_link,
      glb_link: onboardingAsset.glb_link,
      category: onboardingAsset.category,
      subcategory: onboardingAsset.subcategory,
      client: onboardingAsset.client,
      tags: onboardingAsset.tags,
      created_at: onboardingAsset.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      preview_image: onboardingAsset.preview_images
        ? Array.isArray(onboardingAsset.preview_images)
          ? onboardingAsset.preview_images[0]
          : onboardingAsset.preview_images
        : null,
      materials: null, // Will be populated later if needed
      colors: null, // Will be populated later if needed
      glb_status: "completed", // Since it's approved by client
    };

    // Insert the asset into the assets table
    const { data: newAsset, error: insertError } = await supabaseAdmin
      .from("assets")
      .insert(assetData)
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting asset:", insertError);
      console.error("Asset data being inserted:", assetData);
      return NextResponse.json(
        { error: "Failed to create asset", details: insertError.message },
        { status: 500 }
      );
    }

    // First, log the status history with proper user information before any triggers
    try {
      const { error: statusHistoryError } = await supabaseAdmin
        .from("asset_status_history")
        .insert({
          asset_id: assetId,
          previous_status: onboardingAsset.status,
          new_status: status,
          action_type:
            status === "approved_by_client"
              ? "client_approved"
              : "status_changed",
          revision_number: revisionCount || 0,
          changed_by: user.id,
          metadata: {
            user_role: profile?.role,
            new_revision_count: revisionCount || 0,
            previous_revision_count: onboardingAsset.revision_count,
          },
        });

      if (statusHistoryError) {
        console.error("Error logging status history:", statusHistoryError);
        // Continue anyway - don't fail the operation for logging errors
      }
    } catch (historyError) {
      console.error("Error creating status history record:", historyError);
      // Continue anyway - don't fail the operation for logging errors
    }

    // Update the onboarding_assets table to mark as transferred
    // We'll avoid updating the status here to prevent trigger issues
    // since we've already logged the status change manually above
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from("onboarding_assets")
      .update({
        transferred: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId)
      .eq("transferred", false) // Ensure we only update if not already transferred
      .select();

    // Let's also update the status but handle any potential trigger errors gracefully
    if (updateResult && updateResult.length > 0) {
      try {
        const { error: statusUpdateError } = await supabaseAdmin
          .from("onboarding_assets")
          .update({
            status: status, // Set the status to approved_by_client
          })
          .eq("id", assetId);

        if (statusUpdateError) {
          console.error(
            "Error updating onboarding asset status:",
            statusUpdateError
          );
          console.log(
            "Status update failed but asset was marked as transferred - continuing"
          );
          // Continue anyway since the main transfer operation succeeded
        }
      } catch (statusError) {
        console.error("Exception during status update:", statusError);
        // Continue anyway since the main transfer operation succeeded
      }
    }

    if (updateError) {
      console.error("Error updating onboarding asset:", updateError);
      console.error("Asset ID:", assetId);
      console.error("Onboarding asset data:", onboardingAsset);
      // Rollback the assets table insert if possible
      try {
        await supabaseAdmin
          .from("assets")
          .delete()
          .eq("article_id", onboardingAsset.article_id)
          .eq("client", onboardingAsset.client);
      } catch (rollbackError) {
        console.error("Error during rollback:", rollbackError);
      }
      return NextResponse.json(
        {
          error: "Failed to update asset status",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Check if the update actually affected any rows
    if (!updateResult || updateResult.length === 0) {
      console.error(
        "No rows updated - asset may have been transferred already",
        assetId
      );
      // Rollback the assets table insert since the onboarding asset wasn't updated
      try {
        await supabaseAdmin
          .from("assets")
          .delete()
          .eq("article_id", onboardingAsset.article_id)
          .eq("client", onboardingAsset.client);
      } catch (rollbackError) {
        console.error("Error during rollback:", rollbackError);
      }
      return NextResponse.json(
        {
          error:
            "Asset has already been transferred or is not in the expected state",
        },
        { status: 409 }
      );
    }

    // Log the activity to both systems
    await logActivityServer({
      action: "asset_completed",
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        assetId: assetId,
        status: status,
        productName: onboardingAsset.product_name,
        client: onboardingAsset.client,
      },
    });

    // Copy GLB file to Android folder for approved assets
    if (status === "approved_by_client" && onboardingAsset.glb_link) {
      try {
        // Get BunnyCDN configuration
        const storageKey = process.env.BUNNY_STORAGE_KEY;
        const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
        const cdnBaseUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

        if (storageKey && storageZone && cdnBaseUrl) {
          // Download the current GLB file
          const glbResponse = await fetch(onboardingAsset.glb_link, {
            method: "GET",
            headers: {
              AccessKey: storageKey,
            },
          });

          if (glbResponse.ok) {
            const glbBuffer = await glbResponse.arrayBuffer();

            // Create Android folder path
            const sanitizedClientName = onboardingAsset.client.replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );
            const fileName = `${onboardingAsset.article_id}.glb`;
            const androidPath = `${sanitizedClientName}/Android/${fileName}`;
            const androidStorageUrl = `https://se.storage.bunnycdn.com/${storageZone}/${androidPath}`;

            // Upload to Android folder
            const androidUploadResponse = await fetch(androidStorageUrl, {
              method: "PUT",
              headers: {
                AccessKey: storageKey,
                "Content-Type": "application/octet-stream",
              },
              body: glbBuffer,
            });

            if (androidUploadResponse.ok) {
              // Update the GLB link in the assets table to point to Android folder
              const newGlbLink = `${cdnBaseUrl}/${androidPath}`;

              await supabaseAdmin
                .from("assets")
                .update({ glb_link: newGlbLink })
                .eq("id", assetId);

              console.log(
                `✅ GLB file copied to Android folder: ${newGlbLink}`
              );
            } else {
              console.error(
                "❌ Failed to upload GLB to Android folder:",
                androidUploadResponse.status
              );
            }
          } else {
            console.error(
              "❌ Failed to download GLB file:",
              glbResponse.status
            );
          }
        } else {
          console.warn(
            "⚠️ BunnyCDN configuration missing, skipping file transfer"
          );
        }
      } catch (error) {
        console.error("❌ Error during GLB file transfer:", error);
        // Don't fail the entire operation if file transfer fails
      }
    }

    // Check if all assets in the allocation list are now approved and update list accordingly
    if (
      (status === "approved_by_client" || status === "approved") &&
      onboardingAsset.asset_assignments?.[0]?.allocation_list_id
    ) {
      const allocationListId =
        onboardingAsset.asset_assignments[0].allocation_list_id;

      try {
        // Get all assets in this allocation list
        const { data: allAssetsInList, error: listAssetsError } =
          await supabaseAdmin
            .from("asset_assignments")
            .select(
              `
            onboarding_assets!inner(id, status)
          `
            )
            .eq("allocation_list_id", allocationListId);

        if (!listAssetsError && allAssetsInList && allAssetsInList.length > 0) {
          // Check if all assets in the list are approved
          const allApproved = allAssetsInList.every(
            (assignment: any) =>
              assignment.onboarding_assets.status === "approved_by_client" ||
              assignment.onboarding_assets.status === "approved"
          );

          if (allApproved) {
            // Update the allocation list to mark it as approved
            const { error: updateListError } = await supabaseAdmin
              .from("allocation_lists")
              .update({
                approved_at: new Date().toISOString(),
                status: "approved",
              })
              .eq("id", allocationListId);

            if (updateListError) {
              console.error(
                "Error updating allocation list as approved:",
                updateListError
              );
            } else {
              console.log(
                `✅ Allocation list ${allocationListId} marked as approved - all assets completed`
              );
            }
          }
        }
      } catch (error) {
        console.error("Error checking allocation list completion:", error);
      }
    }

    // Clean up allocation lists
    await cleanupSingleAllocationList(supabaseAdmin, assetId);

    // Send notification if status is delivered_by_artist
    if (status === "delivered_by_artist") {
      // TODO: Re-enable when notification service is ready
      // await notificationService.sendClientReviewReadyNotification({
      //   assetId: assetId,
      //   productName: onboardingAsset.product_name,
      //   client: onboardingAsset.client,
      // });
    }

    return NextResponse.json({
      success: true,
      message: "Asset completed successfully",
      asset: newAsset,
    });
  } catch (error) {
    console.error("Error in complete asset API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
