import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      product_name,
      description,
      image_url, // The render image URL
      sourceModelId, // ID of the asset this packshot was rendered from
      sourceModelUrl, // GLB URL of the source model
      client,
      render_settings, // Object with render settings (view, resolution, background, etc.)
    } = body;

    if (!image_url) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // If we have a sourceModelId, update the asset's packshot_renders array
    if (sourceModelId) {
      console.log(
        `Saving packshot to asset ${sourceModelId} (${product_name})`
      );

      // First, get the current asset to read its packshot_renders
      const { data: currentAsset, error: fetchError } = await supabaseAdmin
        .from("assets")
        .select("packshot_renders, article_id, product_name")
        .eq("id", sourceModelId)
        .single();

      if (fetchError) {
        console.error("Error fetching asset:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch source asset" },
          { status: 500 }
        );
      }

      // Create new packshot object
      const newPackshot = {
        id: `packshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        product_name: product_name || currentAsset.product_name,
        description: description || "",
        image_url: image_url,
        created_at: new Date().toISOString(),
        client: client || "Unknown Client",
        render_settings: render_settings || {},
        source_model_url: sourceModelUrl || null,
      };

      // Update the packshot_renders array
      const existingPackshots = Array.isArray(currentAsset.packshot_renders)
        ? currentAsset.packshot_renders
        : [];

      const updatedPackshots = [...existingPackshots, newPackshot];

      // Update the asset
      const { data: updatedAsset, error: updateError } = await supabaseAdmin
        .from("assets")
        .update({
          packshot_renders: updatedPackshots,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceModelId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating asset packshot_renders:", updateError);
        return NextResponse.json(
          { error: "Failed to save packshot to asset" },
          { status: 500 }
        );
      }

      console.log(
        `Packshot saved successfully to asset ${sourceModelId}. Total packshots: ${updatedPackshots.length}`
      );

      return NextResponse.json({
        success: true,
        asset: updatedAsset,
        packshot: newPackshot,
        message: "Packshot saved to asset successfully",
      });
    }

    // Fallback: If no sourceModelId provided, just return success
    // (In practice, we should always have a sourceModelId for packshots)
    return NextResponse.json(
      { error: "sourceModelId is required for packshot renders" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in save-packshot API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
