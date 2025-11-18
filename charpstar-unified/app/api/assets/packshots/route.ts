import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("article_id");
    const modelUrl = searchParams.get("model_url");
    const assetId = searchParams.get("asset_id");

    console.log("Fetching packshots for:", { articleId, modelUrl, assetId });

    const supabase = createAdminClient();

    // At least one identifier is required
    if (!articleId && !modelUrl && !assetId) {
      return NextResponse.json(
        { error: "Either article_id, model_url, or asset_id is required" },
        { status: 400 }
      );
    }

    let modelId = assetId || null;

    // If we have article_id, get the actual model UUID from the assets table
    if (articleId && !modelId) {
      const { data: assetDataArray } = await supabase
        .from("assets")
        .select("id")
        .eq("article_id", articleId)
        .limit(1);

      if (assetDataArray && assetDataArray.length > 0) {
        modelId = assetDataArray[0].id;
        console.log("Found model ID for article_id:", modelId);
      }
    }

    // If we have modelUrl but no modelId, try to find the asset by glb_link
    if (modelUrl && !modelId) {
      const { data: assetDataArray } = await supabase
        .from("assets")
        .select("id")
        .eq("glb_link", modelUrl)
        .limit(1);

      if (assetDataArray && assetDataArray.length > 0) {
        modelId = assetDataArray[0].id;
        console.log("Found model ID for modelUrl:", modelId);
      }
    }

    if (!modelId) {
      console.log("No asset found");
      return NextResponse.json({
        success: true,
        packshots: [],
        count: 0,
      });
    }

    // Find the source asset by modelId
    const { data: sourceAsset, error } = await supabase
      .from("assets")
      .select("id, packshot_renders, article_id, product_name")
      .eq("id", modelId)
      .single();

    if (error || !sourceAsset) {
      console.log("No source asset found with packshot renders");
      return NextResponse.json({
        success: true,
        packshots: [],
        count: 0,
      });
    }

    if (
      !sourceAsset.packshot_renders ||
      !Array.isArray(sourceAsset.packshot_renders) ||
      sourceAsset.packshot_renders.length === 0
    ) {
      console.log("No packshot renders found for this asset");
      return NextResponse.json({
        success: true,
        packshots: [],
        count: 0,
      });
    }

    console.log(
      "Found source asset with",
      sourceAsset.packshot_renders.length,
      "packshot renders"
    );

    // Format the packshots from the packshot_renders array
    const packshots = sourceAsset.packshot_renders.map((packshot: any) => ({
      id: packshot.id,
      product_name: packshot.product_name || sourceAsset.product_name,
      description: packshot.description || "",
      preview_image: packshot.image_url,
      created_at: packshot.created_at,
      client: packshot.client,
      render_settings: packshot.render_settings || {},
    }));

    console.log("Found", packshots.length, "packshot renders from asset");

    return NextResponse.json({
      success: true,
      packshots: packshots,
      count: packshots.length,
    });
  } catch (error) {
    console.error("Error fetching packshot renders:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

