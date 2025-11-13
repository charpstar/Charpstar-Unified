import { NextRequest, NextResponse } from "next/server";
import { generateMultiAngleScenes } from "@/lib/geminiService";
import { processMultipleImages } from "@/lib/cloudinaryService";
import { createAdminClient } from "@/utils/supabase/admin";

// Helper function to get dimensions based on image format
const getFormatDimensions = (
  format: string,
  customWidth?: string,
  customHeight?: string
) => {
  const formatMap: Record<string, { width: number; height: number }> = {
    square: { width: 1080, height: 1080 },
    instagram_story: { width: 1080, height: 1920 },
    instagram_reel: { width: 1080, height: 1920 },
    facebook_cover: { width: 1920, height: 1080 },
    pinterest: { width: 1080, height: 1620 },
    custom: {
      width: customWidth ? parseInt(customWidth) : 1080,
      height: customHeight ? parseInt(customHeight) : 1080,
    },
  };

  return formatMap[format] || formatMap.square;
};

// Helper function to track analytics
//eslint-disable-next-line @typescript-eslint/no-unused-vars
const trackAnalytics = async (data: {
  user_id: string;
  client_name: string;
  object_type: string;
  scene_description?: string;
  image_format: string;
  inspiration_used: boolean;
  multi_asset_mode: boolean;
  asset_count: number;
  status: "pending" | "success" | "error";
  error_message?: string;
  generation_time_ms?: number;
  saved_to_library?: boolean;
  saved_asset_id?: string;
}) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/analytics/scene-render/track`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      console.warn("Failed to track analytics:", await response.text());
    }
  } catch (error) {
    console.warn("Error tracking analytics:", error);
  }
};

export async function POST(request: NextRequest) {
  let analyticsId: string | null = null;
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // Get user session for analytics
    const authHeader = request.headers.get("authorization");
    let user_id: string | null = null;
    let user_email: string | null = null;
    let client_name = "Unknown Client";

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        if (user && !error) {
          user_id = user.id;
          user_email = user.email || null;
          // Get client name from user metadata or email
          client_name =
            user.user_metadata?.client_name ||
            user.email?.split("@")[0] ||
            "Unknown Client";
        }
      } catch (error) {
        console.warn("Error getting user session:", error);
      }
    }

    const body = await request.json();
    const {
      base64Images,
      objectSize,
      objectType,
      sceneDescription,
      inspirationImage,
      imageFormat = "square",
      customWidth,
      customHeight,
      selectedAssets, // New parameter for multi-asset mode
    } = body;

    // Check if we have either base64Images or selectedAssets
    const hasImages =
      base64Images && Array.isArray(base64Images) && base64Images.length > 0;
    const hasSelectedAssets =
      selectedAssets &&
      Array.isArray(selectedAssets) &&
      selectedAssets.length > 0;

    if (!hasImages && !hasSelectedAssets) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: either base64Images array or selectedAssets array is required",
        },
        { status: 400 }
      );
    }

    if (!objectType) {
      return NextResponse.json(
        {
          error: "Missing required field: objectType is required",
        },
        { status: 400 }
      );
    }

    // Track analytics - render started
    if (user_id) {
      try {
        console.log("Creating analytics record for scene render");
        const { data, error } = await supabase
          .from("scene_render_analytics")
          .insert({
            user_id,
            user_email,
            client_name,
            object_type: objectType,
            scene_description: sceneDescription,
            image_format: imageFormat,
            inspiration_used: !!inspirationImage,
            multi_asset_mode: hasSelectedAssets,
            asset_count: hasSelectedAssets
              ? selectedAssets.length
              : base64Images?.length || 1,
            status: "pending",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating analytics record:", error);
        } else {
          analyticsId = data.id;
          console.log("Analytics record created:", analyticsId);
        }
      } catch (error) {
        console.warn("Failed to track analytics:", error);
      }
    }

    // First, analyze the fabric textures from the uploaded images (only if we have base64Images)
    let fabricDescription = "";
    if (hasImages) {
      try {
        console.log("Analyzing fabric textures from uploaded images...");

        const fabricAnalysisResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/analyze-fabric`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              base64Images,
              objectType,
            }),
          }
        );

        if (fabricAnalysisResponse.ok) {
          const fabricData = await fabricAnalysisResponse.json();
          fabricDescription = fabricData.fabricDescription;
          console.log("Fabric analysis completed:");
          console.log("Full fabric description:", fabricDescription);
        } else {
          console.warn(
            "Fabric analysis failed, proceeding without fabric details"
          );
        }
      } catch (error) {
        console.warn("Error analyzing fabric:", error);
      }
    } else {
      console.log(
        "Skipping fabric analysis - no base64Images provided (multi-asset mode)"
      );
    }

    // Generate scenes using all angles together for consistency, including fabric description
    const enhancedSceneDescription = sceneDescription
      ? `${sceneDescription}\n\nFabric Details: ${fabricDescription}`
      : `Fabric Details: ${fabricDescription}`;

    console.log("=== ENHANCED SCENE DESCRIPTION ===");
    console.log("Original scene description:", sceneDescription);
    console.log("Fabric description:", fabricDescription);
    console.log("Enhanced description:", enhancedSceneDescription);
    console.log("=== END ENHANCED SCENE DESCRIPTION ===");

    let generatedScenes;

    if (hasImages) {
      // Traditional mode with base64Images
      generatedScenes = await generateMultiAngleScenes(
        base64Images,
        objectSize || "Unknown dimensions",
        objectType,
        enhancedSceneDescription || fabricDescription,
        inspirationImage || null,
        imageFormat
      );
    } else {
      // Multi-asset mode - for now, generate a placeholder scene
      // TODO: Implement proper multi-asset scene generation
      console.log(
        "Multi-asset mode detected with selected assets:",
        selectedAssets
      );

      // Create a simple scene description for multi-asset mode
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
      const multiAssetDescription = `Create a professional product scene featuring ${selectedAssets.length} ${objectType} items: ${selectedAssets.map((asset: { name: string }) => asset.name).join(", ")}. ${sceneDescription || "Use a clean, modern environment with good lighting."}`;

      // For now, return a placeholder response
      // In a real implementation, you would process the 3D models from selectedAssets
      return NextResponse.json({
        scenes: [
          `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
        ], // 1x1 transparent PNG placeholder
        upscaledScenes: [
          `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
        ],
        comparison: false,
        message:
          "Multi-asset scene generation is not yet implemented. This is a placeholder response.",
      });
    }

    // Upload original images to Cloudinary and upscale them
    try {
      console.log("Uploading and upscaling images with Cloudinary...");
      console.log("Image format:", imageFormat);

      // Get format-specific dimensions
      const formatDimensions = getFormatDimensions(
        imageFormat,
        customWidth,
        customHeight
      );
      console.log("Format dimensions:", formatDimensions);

      // Upload original images to Cloudinary
      const originalCloudinaryUrls = await processMultipleImages(
        generatedScenes,
        { width: formatDimensions.width, height: formatDimensions.height },
        "scene-render/original"
      );

      // Upscale images using Cloudinary with format-specific dimensions
      const upscaledCloudinaryUrls = await processMultipleImages(
        generatedScenes,
        { width: formatDimensions.width, height: formatDimensions.height },
        "scene-render/upscaled"
      );

      console.log(
        `Successfully processed ${originalCloudinaryUrls.length} images`
      );

      // Track analytics - render completed successfully
      if (analyticsId) {
        const generationTime = Date.now() - startTime;
        try {
          const { error: updateError } = await supabase
            .from("scene_render_analytics")
            .update({
              status: "success",
              generation_time_ms: generationTime,
            })
            .eq("id", analyticsId);

          if (updateError) {
            console.error("Error updating analytics:", updateError);
          } else {
            console.log("Analytics updated with success status");
          }
        } catch (error) {
          console.warn("Failed to update analytics:", error);
        }
      }

      // Return both original and upscaled Cloudinary URLs for comparison
      return NextResponse.json({
        scenes: originalCloudinaryUrls,
        upscaledScenes: upscaledCloudinaryUrls,
        comparison: true,
      });
    } catch (cloudinaryError) {
      console.warn(
        "Cloudinary processing failed, returning original images:",
        cloudinaryError
      );
      // Track analytics - render completed with fallback
      if (analyticsId) {
        const generationTime = Date.now() - startTime;
        try {
          const { error: updateError } = await supabase
            .from("scene_render_analytics")
            .update({
              status: "success",
              generation_time_ms: generationTime,
            })
            .eq("id", analyticsId);

          if (updateError) {
            console.error("Error updating analytics:", updateError);
          }
        } catch (error) {
          console.warn("Failed to update analytics:", error);
        }
      }

      // Fallback to original generated images if Cloudinary fails
      return NextResponse.json({ scenes: generatedScenes });
    }
  } catch (error) {
    console.error("Error generating scenes:", error);

    // Track analytics - render failed
    if (analyticsId) {
      try {
        const { error: updateError } = await supabase
          .from("scene_render_analytics")
          .update({
            status: "error",
            error_message:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", analyticsId);

        if (updateError) {
          console.error("Error updating analytics:", updateError);
        } else {
          console.log("Analytics updated with error status");
        }
      } catch (analyticsError) {
        console.warn("Failed to update analytics with error:", analyticsError);
      }
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
