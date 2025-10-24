import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
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

    // Create admin client for database operations
    const supabase = createAdminClient();

    // Generate a unique article_id
    const article_id = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle image URL - use provided URL or upload base64 data
    let imageUrl = scene_image_url;

    // If we have a Cloudinary URL, use it directly
    if (scene_image_url && scene_image_url.includes("cloudinary.com")) {
      imageUrl = scene_image_url;
      console.log("Using Cloudinary URL directly:", imageUrl);
    } else if (scene_image_data && !scene_image_url) {
      try {
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
        const fileName = `generated-scenes/${article_id}.png`;
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

    // Prepare asset data - match the actual assets table schema
    const assetData = {
      product_name,
      category: category || "Generated Scene",
      subcategory: "AI Generated",
      client: client || "Generated Content",
      article_id,
      preview_image: imageUrl,
      glb_link: null, // No 3D model for generated scenes
      product_link: null, // No product link for generated scenes
      materials: null,
      colors: null,
      tags: [
        "scene-render",
        ...(sourceModelId ? [`source-model-${sourceModelId}`] : []),
        // Store format information in tags
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
