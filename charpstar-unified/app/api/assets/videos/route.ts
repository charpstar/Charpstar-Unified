import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("asset_id");
    const articleId = searchParams.get("article_id");
    const modelUrl = searchParams.get("model_url");

    console.log("Fetching videos for:", { assetId, articleId, modelUrl });

    // Priority: assetId > articleId > modelUrl
    let modelId = assetId || null;

    // If we have article_id but no assetId, get the actual model UUID from the assets table
    if (!modelId && articleId) {
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
    if (!modelId && modelUrl) {
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

    let allVideos: any[] = [];

    // First, try to fetch videos from the asset's generated_scenes array
    if (modelId) {
      const { data: sourceAsset } = await supabase
        .from("assets")
        .select("id, product_name, client, generated_scenes")
        .eq("id", modelId)
        .single();

      if (sourceAsset?.generated_scenes) {
        // Filter for video type scenes
        const videoScenes = (sourceAsset.generated_scenes as any[]).filter(
          (scene: any) => scene.type === "video" && scene.video_url
        );

        // Add asset context to each video
        allVideos = videoScenes.map((scene: any) => ({
          id: scene.id,
          product_name: scene.product_name || sourceAsset.product_name,
          description: scene.description || "",
          video_url: scene.video_url,
          preview_image: scene.image_url || null,
          created_at: scene.created_at,
          client: sourceAsset.client,
          tags: scene.tags || [],
          duration_seconds: scene.duration_seconds,
          source: "generated_scenes",
        }));

        console.log(`Found ${allVideos.length} videos in generated_scenes`);
      }
    }

    // Format the response
    const formattedVideos = allVideos.map((video) => ({
      id: video.id,
      product_name: video.product_name,
      description: video.description,
      video_url: video.video_url,
      preview_image: video.preview_image,
      created_at: video.created_at,
      client: video.client,
      tags: video.tags,
      duration_seconds: video.duration_seconds,
      resolution:
        video.tags
          ?.find((tag: string) => tag.startsWith("format:"))
          ?.replace("format:", "") ||
        video.tags?.find(
          (tag: string) => tag.includes("1080p") || tag.includes("720p")
        ),
      dimensions: video.tags
        ?.find((tag: string) => tag.startsWith("dimensions:"))
        ?.replace("dimensions:", ""),
    }));

    return NextResponse.json({ videos: formattedVideos });
  } catch (error) {
    console.error("Error in videos API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
