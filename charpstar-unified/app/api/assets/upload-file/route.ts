import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const assetId = formData.get("asset_id") as string;
    const fileType = formData.get("file_type") as string; // "glb", "asset", "reference"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Get asset details to create proper file path
    const { data: asset, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client, product_name")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Validate file size based on type
    const maxSizes = {
      glb: 200 * 1024 * 1024, // 200MB for GLB files
      asset: 500 * 1024 * 1024, // 500MB for general asset files (e.g., .ma/.mb/.sbs/.sbsar/.spp)
      reference: 50 * 1024 * 1024, // 50MB for reference files
    };

    const maxSize =
      maxSizes[fileType as keyof typeof maxSizes] || 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`,
        },
        { status: 400 }
      );
    }

    // Determine storage path based on file type
    let storagePath: string;
    let contentType: string;

    switch (fileType) {
      case "glb":
        storagePath = `assets/${asset.client}/${asset.article_id}/models/`;
        contentType = "model/gltf-binary";
        break;
      case "asset":
        storagePath = `assets/${asset.client}/${asset.article_id}/files/`;
        // Some desktop formats (Maya/Substance) come without a MIME type; force binary if missing
        contentType =
          file.type && file.type.trim() !== ""
            ? file.type
            : "application/octet-stream";
        break;
      case "reference":
        storagePath = `assets/${asset.client}/${asset.article_id}/references/`;
        contentType = file.type || "image/jpeg";
        break;
      default:
        storagePath = `assets/${asset.client}/${asset.article_id}/misc/`;
        contentType = file.type || "application/octet-stream";
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const fullPath = `${storagePath}${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fullPath, file, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("assets")
      .getPublicUrl(fullPath);

    // Store file metadata in database
    try {
      const { error: metadataError } = await supabase
        .from("asset_files")
        .insert({
          asset_id: assetId,
          file_name: file.name,
          file_path: fullPath,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: session.user.id,
          uploaded_at: new Date().toISOString(),
        });

      if (metadataError) {
        console.error("Error storing file metadata:", metadataError);
        // Don't fail the upload, just log the error
      }
    } catch (err) {
      console.error(
        "Error inserting file metadata (table may not exist):",
        err
      );
      // Don't fail the upload if the table doesn't exist yet
    }

    // Update asset record based on file type
    const updateData: any = {};

    if (fileType === "glb" || fileType === "reference") {
      // Get existing references and add new one (for both GLB and reference files)
      const { data: currentAsset, error: fetchError } = await supabase
        .from("onboarding_assets")
        .select("reference")
        .eq("id", assetId)
        .single();

      if (fetchError) {
        console.error("Error fetching current asset:", fetchError);
      }

      console.log("Current asset before update:", currentAsset);
      console.log("File type:", fileType);
      console.log("File URL:", urlData.publicUrl);

      const existingReferences = currentAsset?.reference || [];
      let newReferences;

      if (Array.isArray(existingReferences)) {
        newReferences = [...existingReferences, urlData.publicUrl];
      } else if (typeof existingReferences === "string") {
        // Handle case where reference might be a JSON string
        try {
          const parsed = JSON.parse(existingReferences);
          newReferences = Array.isArray(parsed)
            ? [...parsed, urlData.publicUrl]
            : [urlData.publicUrl];
        } catch {
          newReferences = [urlData.publicUrl];
        }
      } else {
        newReferences = [urlData.publicUrl];
      }

      updateData.reference = newReferences;
      console.log("New references array:", newReferences);
      console.log("Update data:", updateData);

      // For GLB files, also update status
      if (fileType === "glb") {
        updateData.status = "in_production";
      }
    }

    if (Object.keys(updateData).length > 0) {
      console.log("Updating asset with data:", updateData);

      const { data: updateResult, error: updateError } = await supabase
        .from("onboarding_assets")
        .update(updateData)
        .eq("id", assetId)
        .select();

      if (updateError) {
        console.error("Error updating asset:", updateError);
      } else {
        console.log("Asset update result:", updateResult);
      }
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename: file.name,
      file_path: fullPath,
      file_type: fileType,
    });
  } catch (error) {
    console.error("Error in asset file upload API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
