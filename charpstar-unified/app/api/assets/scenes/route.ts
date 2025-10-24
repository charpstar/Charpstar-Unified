import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("article_id");
    const modelUrl = searchParams.get("model_url");

    console.log("Fetching scenes for:", { articleId, modelUrl });

    if (!articleId && !modelUrl) {
      return NextResponse.json(
        { error: "Either article_id or model_url is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

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

    // First, get all generated scenes
    const { data: scenes, error } = await supabase
      .from("assets")
      .select("*")
      .eq("category", "Generated Scene")
      .eq("subcategory", "AI Generated")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching scenes:", error);
      return NextResponse.json(
        { error: "Failed to fetch scenes", details: error.message },
        { status: 500 }
      );
    }

    console.log("Found scenes:", scenes?.length || 0);

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

    // Filter scenes that were generated using this model
    // We'll check if the scene tags mention the model or if it has related metadata
    const relatedScenes =
      scenes?.filter((scene) => {
        try {
          // Check if the scene was generated using this model
          // This is based on tags since description is stored in tags
          const hasSceneRenderTag = scene.tags?.includes("scene-render");
          console.log(
            `Scene ${scene.id}: hasSceneRenderTag = ${hasSceneRenderTag}, tags =`,
            scene.tags
          );

          let isRelated = false;
          if (modelId) {
            // If we have modelId, check if tags reference it
            const hasModelId = scene.tags?.some((tag: string) =>
              tag.includes(modelId)
            );
            const hasSourceModel = scene.tags?.some((tag: string) =>
              tag.includes(`source-model-${modelId}`)
            );
            isRelated = hasModelId || hasSourceModel;
            console.log(
              `Scene ${scene.id}: hasModelId = ${hasModelId}, hasSourceModel = ${hasSourceModel}, isRelated = ${isRelated}`
            );
          } else if (modelUrl) {
            // If we have model_url, check if tags reference the model
            isRelated = scene.tags?.some((tag: string) =>
              tag.includes(modelUrl.toLowerCase())
            );
            console.log(`Scene ${scene.id}: modelUrl check = ${isRelated}`);
          } else {
            isRelated = true;
          }

          const result = hasSceneRenderTag && isRelated;
          console.log(`Scene ${scene.id}: final result = ${result}`);
          return result;
        } catch (filterError) {
          console.error("Error filtering scene:", filterError, scene);
          return false;
        }
      }) || [];

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
