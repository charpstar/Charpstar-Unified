import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("article_id");
    const modelUrl = searchParams.get("model_url");

    console.log("Fetching scenes for:", { articleId, modelUrl });

    const supabase = createAdminClient();

    // At least one identifier is required
    if (!articleId && !modelUrl) {
      return NextResponse.json(
        { error: "Either article_id or model_url is required" },
        { status: 400 }
      );
    }

    // If we have article_id, we need to get the actual model UUID from the assets table
    let modelId = null;
    if (articleId) {
      const { data: assetData } = await supabase
        .from("assets")
        .select("id")
        .eq("article_id", articleId)
        .single();

      if (assetData) {
        modelId = assetData.id;
        console.log("Found model ID for article_id:", modelId);
      }
    }

    // If we have modelUrl but no modelId, try to find the asset by glb_link
    if (modelUrl && !modelId) {
      const { data: assetData } = await supabase
        .from("assets")
        .select("id")
        .eq("glb_link", modelUrl)
        .single();

      if (assetData) {
        modelId = assetData.id;
        console.log("Found model ID for modelUrl:", modelId);
      }
    }

    // Find the source asset by modelId or article_id
    let sourceAsset = null;
    if (modelId) {
      const { data: asset } = await supabase
        .from("assets")
        .select("id, generated_scenes, article_id, product_name")
        .eq("id", modelId)
        .single();

      if (
        asset &&
        asset.generated_scenes &&
        Array.isArray(asset.generated_scenes)
      ) {
        sourceAsset = asset;
        console.log(
          "Found source asset with",
          asset.generated_scenes.length,
          "generated scenes"
        );
      }
    } else if (articleId) {
      const { data: asset } = await supabase
        .from("assets")
        .select("id, generated_scenes, article_id, product_name")
        .eq("article_id", articleId)
        .single();

      if (
        asset &&
        asset.generated_scenes &&
        Array.isArray(asset.generated_scenes)
      ) {
        sourceAsset = asset;
        console.log(
          "Found source asset with",
          asset.generated_scenes.length,
          "generated scenes"
        );
      }
    }

    if (!sourceAsset) {
      console.log("No source asset found with generated scenes");
      return NextResponse.json({
        success: true,
        scenes: [],
        count: 0,
      });
    }

    // Format the scenes from the generated_scenes array
    const scenes = sourceAsset.generated_scenes.map((scene: any) => ({
      id: scene.id,
      product_name: scene.product_name || sourceAsset.product_name,
      description: scene.description || "",
      preview_image: scene.image_url,
      created_at: scene.created_at,
      client: scene.client,
      tags: scene.tags || [],
    }));

    console.log("Found", scenes.length, "generated scenes from asset");

    // Debug: Log the first scene to see its structure
    if (scenes && scenes.length > 0) {
      console.log("First scene structure:", {
        id: scenes[0].id,
        product_name: scenes[0].product_name,
        tags: scenes[0].tags,
        category: scenes[0].category,
        subcategory: scenes[0].subcategory,
        preview_image: scenes[0].preview_image
          ? `${scenes[0].preview_image.substring(0, 100)}...`
          : null,
      });
    }

    // All scenes from the source asset are related by definition
    const relatedScenes = scenes;

    console.log("Related scenes found:", relatedScenes.length);

    return NextResponse.json({
      success: true,
      scenes: relatedScenes,
      count: relatedScenes.length,
    });
  } catch (error) {
    console.error("Error fetching related scenes:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
