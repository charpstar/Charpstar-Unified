import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export const maxDuration = 60;

interface SaveModelRequest {
  tencentUrl: string; // The temporary Tencent CDN URL to download from
  modelName?: string;
  settings: {
    faceCount: number;
    enablePBR: boolean;
    generateType: string;
    imageMode: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SaveModelRequest = await request.json();
    const { tencentUrl, modelName, settings } = body;

    if (!tencentUrl) {
      return NextResponse.json(
        { error: "Tencent URL is required" },
        { status: 400 }
      );
    }

    console.log("Downloading model from Tencent CDN...");

    // Download the GLB file from Tencent
    const downloadResponse = await fetch(tencentUrl);
    if (!downloadResponse.ok) {
      throw new Error(
        `Failed to download model from Tencent: ${downloadResponse.status}`
      );
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `✓ Model downloaded (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`
    );

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${user.id}/${timestamp}.glb`;

    console.log("Uploading to Supabase Storage...");

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("generated-models")
      .upload(filename, buffer, {
        contentType: "model/gltf-binary",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    console.log("✓ Model uploaded to Supabase Storage");

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("generated-models")
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    console.log("Saving metadata to database...");

    // Save metadata to database
    const { data: savedModel, error: dbError } = await supabase
      .from("generated_models")
      .insert({
        user_id: user.id,
        model_name:
          modelName || `Generated Model ${new Date().toLocaleDateString()}`,
        model_url: publicUrl,
        file_size: buffer.length,
        face_count: settings.faceCount,
        enable_pbr: settings.enablePBR,
        generate_type: settings.generateType,
        image_mode: settings.imageMode,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to save model metadata: ${dbError.message}`);
    }

    console.log("✓ Model metadata saved to database");

    return NextResponse.json({
      success: true,
      model: savedModel,
      message: "Model saved successfully",
    });
  } catch (error: any) {
    console.error("Save model error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save model" },
      { status: 500 }
    );
  }
}
