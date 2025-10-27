import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // Get user session for analytics
    const supabase = createAdminClient();
    const authHeader = request.headers.get("authorization");
    let user_id: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);
        if (user && !error) {
          user_id = user.id;
        }
      } catch (error) {
        console.warn("Error getting user session:", error);
      }
    }

    const body = await request.json();
    const {
      product_name,
      category,
      scene_image_url,
      scene_image_data,
      client,
      sourceModelId,
      imageFormat,
      customWidth,
      customHeight,
    } = body;

    if (!product_name || (!scene_image_url && !scene_image_data)) {
      return NextResponse.json(
        { error: "Product name and scene image data are required" },
        { status: 400 }
      );
    }

    // Handle image URL - use provided URL or upload base64 data
    let imageUrl = scene_image_url;

    // If we have a Cloudinary URL, use it directly
    if (scene_image_url && scene_image_url.includes("cloudinary.com")) {
      imageUrl = scene_image_url;
      console.log("Using Cloudinary URL directly:", imageUrl);
    } else if (scene_image_data && !scene_image_url) {
      try {
        // Generate a unique ID for the scene
        const sceneId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log("Processing image data:", {
          dataLength: scene_image_data.length,
          dataStart: scene_image_data.substring(0, 50),
          hasDataPrefix: scene_image_data.startsWith("data:image/"),
        });

        // Convert base64 to buffer
        const base64Data = scene_image_data.replace(
          /^data:image\/[a-z]+;base64,/,
          ""
        );
        console.log("Base64 data after cleanup:", {
          length: base64Data.length,
          start: base64Data.substring(0, 50),
        });

        const buffer = Buffer.from(base64Data, "base64");
        console.log("Buffer created:", {
          length: buffer.length,
          firstBytes: Array.from(buffer.slice(0, 10)),
        });

        // Validate buffer
        if (buffer.length === 0) {
          console.error("Empty buffer created from base64 data");
          return NextResponse.json(
            { error: "Invalid image data - empty buffer" },
            { status: 400 }
          );
        }

        // Check if it looks like a valid PNG (starts with PNG signature)
        const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
        const bufferStart = Array.from(buffer.slice(0, 8));
        const isValidPng = pngSignature.every(
          (byte, index) => bufferStart[index] === byte
        );

        if (!isValidPng) {
          console.error("Buffer does not appear to be a valid PNG file");
          console.error("Expected PNG signature:", pngSignature);
          console.error("Actual buffer start:", bufferStart);
        }

        // Upload to Supabase storage
        const fileName = `generated-scenes/${sceneId}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("assets")
          .upload(fileName, buffer, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Supabase storage upload error:", uploadError);
          console.error("Upload details:", {
            fileName,
            bufferLength: buffer.length,
            contentType: "image/png",
          });
          return NextResponse.json(
            {
              error: "Failed to upload image to storage",
              details: uploadError.message,
            },
            { status: 500 }
          );
        }

        console.log("Upload successful:", uploadData);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("assets")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
        console.log(
          "Image uploaded successfully to Supabase storage:",
          imageUrl
        );
      } catch (error) {
        console.error("Error processing image data:", error);
        return NextResponse.json(
          { error: "Failed to process image data" },
          { status: 500 }
        );
      }
    }

    // Ensure we have a valid image URL
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No valid image URL available" },
        { status: 400 }
      );
    }

    // If we have a sourceModelId, update the existing asset instead of creating a new one
    if (sourceModelId) {
      // Get the existing asset
      const { data: existingAsset, error: fetchError } = await supabase
        .from("assets")
        .select("id, generated_scenes")
        .eq("id", sourceModelId)
        .single();

      if (fetchError) {
        console.error("Error fetching existing asset:", fetchError);
        return NextResponse.json(
          { error: "Source asset not found" },
          { status: 404 }
        );
      }

      // Prepare the new scene object
      const newScene = {
        id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        image_url: imageUrl,
        product_name,
        category: category || "Generated Scene",
        description: product_name,
        created_at: new Date().toISOString(),
        tags: [
          ...(imageFormat ? [`format:${imageFormat}`] : []),
          ...(customWidth && customHeight
            ? [`dimensions:${customWidth}x${customHeight}`]
            : []),
        ],
      };

      // Get existing scenes or initialize empty array
      const existingScenes = existingAsset.generated_scenes || [];
      const updatedScenes = [...existingScenes, newScene];

      // Update the asset with the new scene
      const { data: updatedAsset, error: updateError } = await supabase
        .from("assets")
        .update({
          generated_scenes: updatedScenes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceModelId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating asset:", updateError);
        return NextResponse.json(
          { error: "Failed to update asset with scene" },
          { status: 500 }
        );
      }

      // Update analytics - mark scene as saved
      if (user_id) {
        try {
          console.log("Updating analytics for saved scene, user_id:", user_id);
          // Find the most recent analytics record for this user (within last 10 minutes)
          const tenMinutesAgo = new Date(
            Date.now() - 10 * 60 * 1000
          ).toISOString();

          const { data: analyticsRecords, error: queryError } = await supabase
            .from("scene_render_analytics")
            .select("id, saved_to_library")
            .eq("user_id", user_id)
            .eq("saved_to_library", false)
            .gte("created_at", tenMinutesAgo)
            .order("created_at", { ascending: false })
            .limit(1);

          console.log(
            "Analytics records found:",
            analyticsRecords?.length,
            queryError
          );

          if (analyticsRecords && analyticsRecords.length > 0) {
            const analyticsId = analyticsRecords[0].id;
            console.log("Updating analytics record:", analyticsId);

            const { error: updateError } = await supabase
              .from("scene_render_analytics")
              .update({
                saved_to_library: true,
                saved_asset_id: updatedAsset.id,
              })
              .eq("id", analyticsId);

            if (updateError) {
              console.error("Error updating analytics:", updateError);
            } else {
              console.log("Analytics updated successfully");
            }
          } else {
            console.log("No recent analytics record found to update");
          }
        } catch (error) {
          console.error("Failed to update analytics with save status:", error);
        }
      } else {
        console.log("No user_id available for analytics update");
      }

      return NextResponse.json({
        success: true,
        asset: updatedAsset,
        scene: newScene,
        message: "Scene saved to asset successfully",
      });
    }

    // Fallback: If no sourceModelId, create a new asset (for backward compatibility)
    const fallback_article_id = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const assetData = {
      product_name,
      category: category || "Generated Scene",
      subcategory: "AI Generated",
      client: client || "Generated Content",
      article_id: fallback_article_id,
      preview_image: imageUrl,
      glb_link: null, // No 3D model for generated scenes
      product_link: null, // No product link for generated scenes
      materials: [],
      colors: [],
      tags: [
        "scene-render",
        ...(imageFormat ? [`format:${imageFormat}`] : []),
        ...(customWidth && customHeight
          ? [`dimensions:${customWidth}x${customHeight}`]
          : []),
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true,
      glb_status: "completed", // Mark as completed since it's a generated scene
    };

    // Log the asset data before inserting (without the full image URL)
    console.log("Inserting asset with data:", {
      ...assetData,
      preview_image: assetData.preview_image
        ? `[URL: ${assetData.preview_image.substring(0, 100)}...]`
        : null,
    });

    // Insert the new asset
    const { data: newAsset, error: insertError } = await supabase
      .from("assets")
      .insert([assetData])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting asset:", {
        error: insertError,
        assetData: {
          ...assetData,
          // Don't log the full image data, just the length
          preview_image: assetData.preview_image
            ? `[${assetData.preview_image.length} chars]`
            : null,
        },
      });
      return NextResponse.json(
        {
          error: "Failed to save asset to library",
          details: insertError.message || insertError,
          code: insertError.code,
        },
        { status: 500 }
      );
    }

    // Update analytics - mark scene as saved
    if (user_id) {
      try {
        console.log("Updating analytics for saved scene, user_id:", user_id);
        // Find the most recent analytics record for this user (within last 10 minutes)
        const tenMinutesAgo = new Date(
          Date.now() - 10 * 60 * 1000
        ).toISOString();

        const { data: analyticsRecords, error: queryError } = await supabase
          .from("scene_render_analytics")
          .select("id, saved_to_library")
          .eq("user_id", user_id)
          .eq("saved_to_library", false)
          .gte("created_at", tenMinutesAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        console.log(
          "Analytics records found:",
          analyticsRecords?.length,
          queryError
        );

        if (analyticsRecords && analyticsRecords.length > 0) {
          const analyticsId = analyticsRecords[0].id;
          console.log("Updating analytics record:", analyticsId);

          const { error: updateError } = await supabase
            .from("scene_render_analytics")
            .update({
              saved_to_library: true,
              saved_asset_id: newAsset.id,
            })
            .eq("id", analyticsId);

          if (updateError) {
            console.error("Error updating analytics:", updateError);
          } else {
            console.log("Analytics updated successfully");
          }
        } else {
          console.log("No recent analytics record found to update");
        }
      } catch (error) {
        console.error("Failed to update analytics with save status:", error);
      }
    } else {
      console.log("No user_id available for analytics update");
    }

    // If we have original images, we could store them as additional data
    // For now, we'll just return the created asset
    return NextResponse.json({
      success: true,
      asset: newAsset,
      message: "Scene saved to asset library successfully",
    });
  } catch (error) {
    console.error("Error saving scene to asset library:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
