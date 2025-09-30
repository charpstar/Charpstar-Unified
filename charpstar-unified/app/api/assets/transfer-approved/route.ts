import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
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

    const { assetId } = await request.json();

    if (!assetId) {
      return NextResponse.json(
        { error: "Missing required field: assetId" },
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

    // Only clients can transfer approved assets
    if (profile?.role !== "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the onboarding asset
    const { data: onboardingAsset, error: fetchError } = await supabase
      .from("onboarding_assets")
      .select("*")
      .eq("id", assetId)
      .eq("status", "approved_by_client")
      .eq("transferred", false)
      .single();

    if (fetchError || !onboardingAsset) {
      return NextResponse.json(
        { error: "Asset not found or not approved by client" },
        { status: 404 }
      );
    }

    // Check if asset already exists in assets table
    const { data: existingAsset } = await supabase
      .from("assets")
      .select("id")
      .eq("article_id", onboardingAsset.article_id)
      .eq("client", onboardingAsset.client)
      .single();

    if (existingAsset) {
      return NextResponse.json(
        { error: "Asset already exists in assets table" },
        { status: 409 }
      );
    }

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
      materials: null, // Will be populated later if needed
      colors: null, // Will be populated later if needed
      glb_status: "completed", // Since it's approved by client
    };

    // Insert into assets table
    const { data: newAsset, error: insertError } = await supabase
      .from("assets")
      .insert(assetData)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting asset:", insertError);
      return NextResponse.json(
        { error: "Failed to transfer asset to assets table" },
        { status: 500 }
      );
    }

    // Update onboarding_assets to mark as transferred
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({
        transferred: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating onboarding asset:", updateError);
      // Rollback the assets table insert
      await supabase.from("assets").delete().eq("id", newAsset.id);

      return NextResponse.json(
        { error: "Failed to mark asset as transferred" },
        { status: 500 }
      );
    }

    // Log the activity
    await logActivityServer({
      action: "asset_transferred",
      description: `Asset ${onboardingAsset.product_name} (${onboardingAsset.article_id}) transferred to assets table`,
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

    return NextResponse.json({
      success: true,
      message: "Asset successfully transferred to assets table",
      asset: newAsset,
    });
  } catch (error) {
    console.error("Error in transfer-approved API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
