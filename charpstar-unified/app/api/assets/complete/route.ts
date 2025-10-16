import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";
import { AssetStatusLogger } from "@/lib/assetStatusLogger";
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

    // Get the asset from onboarding_assets table
    const { data: onboardingAsset, error: fetchError } = await supabaseAdmin
      .from("onboarding_assets")
      .select("*")
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

    // Double-check that the asset has the correct status
    if (onboardingAsset.status !== "approved_by_client") {
      return NextResponse.json(
        { error: "Asset status mismatch, cannot complete" },
        { status: 400 }
      );
    }

    // Check if asset already exists in assets table
    const { data: existingAsset } = await supabaseAdmin
      .from("assets")
      .select("id")
      .eq("id", assetId)
      .single();

    if (existingAsset) {
      return NextResponse.json(
        { error: "Asset already exists in production" },
        { status: 400 }
      );
    }

    // Insert the asset into the assets table
    const { data: newAsset, error: insertError } = await supabaseAdmin
      .from("assets")
      .insert({
        id: onboardingAsset.id,
        product_name: onboardingAsset.product_name,
        article_id: onboardingAsset.article_id,
        client: onboardingAsset.client,
        status: status,
        glb_link: onboardingAsset.glb_link,
        reference_images: onboardingAsset.reference_images,
        created_at: onboardingAsset.created_at,
        updated_at: new Date().toISOString(),
        created_by: onboardingAsset.created_by,
        revision_count: revisionCount || 0,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting asset:", insertError);
      return NextResponse.json(
        { error: "Failed to create asset" },
        { status: 500 }
      );
    }

    // Update the onboarding_assets table to mark as transferred
    const { error: updateError } = await supabaseAdmin
      .from("onboarding_assets")
      .update({ transferred: true, transferred_at: new Date().toISOString() })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating onboarding asset:", updateError);
      return NextResponse.json(
        { error: "Failed to update asset status" },
        { status: 500 }
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

    // Log to the new asset status history table
    if (status === "approved_by_client") {
      await AssetStatusLogger.clientApproved(
        assetId,
        onboardingAsset.status,
        revisionCount
      );
    } else if (status === "delivered_by_artist") {
      await AssetStatusLogger.deliveredByArtist(
        assetId,
        onboardingAsset.status
      );
    } else {
      await AssetStatusLogger.statusChanged(
        assetId,
        onboardingAsset.status,
        status
      );
    }

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
