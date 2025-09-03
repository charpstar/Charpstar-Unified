import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assetId = params.id;

    // Get asset details to find the storage path
    const { data: asset, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client, glb_link, reference, product_link")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // List files from storage - check all subfolders
    if (!asset.client || !asset.article_id) {
      return NextResponse.json({ files: [] });
    }

    const basePath = `assets/${asset.client}/${asset.article_id}/`;

    try {
      // Get all subfolders first
      const { data: folders, error: folderError } = await supabase.storage
        .from("assets")
        .list(basePath, {
          limit: 100,
          offset: 0,
        });

      if (folderError) {
        console.error("Error listing folders:", folderError);
        return NextResponse.json({ files: [] });
      }

      // Collect all files from all subfolders
      let allFiles: any[] = [];

      for (const folder of folders || []) {
        if (folder.name && !folder.name.includes(".")) {
          // Only process folders, not files
          const subfolderPath = `${basePath}${folder.name}/`;

          const { data: subfolderFiles, error: subfolderError } =
            await supabase.storage.from("assets").list(subfolderPath, {
              limit: 100,
              offset: 0,
            });

          if (!subfolderError && subfolderFiles) {
            // Convert storage files to our format
            const fileList = subfolderFiles.map((file) => ({
              id: file.id || file.name,
              file_name: file.name,
              file_url: supabase.storage
                .from("assets")
                .getPublicUrl(`${subfolderPath}${file.name}`).data.publicUrl,
              file_type: getFileType(file.name),
              file_size: file.metadata?.size || 0,
              mime_type: file.metadata?.mimetype || "application/octet-stream",
              uploaded_at: file.updated_at || new Date().toISOString(),
              uploaded_by: session.user.email
                ? session.user.email.split("@")[0]
                : "Unknown",
            }));

            allFiles = [...allFiles, ...fileList];
          }
        }
      }

      // Also check for GLB files in the models folder
      const modelsPath = `models/`;

      const { data: modelsFiles, error: modelsError } = await supabase.storage
        .from("assets")
        .list(modelsPath, {
          limit: 100,
          offset: 0,
        });

      if (!modelsError && modelsFiles) {
        // Filter for files that belong to this asset (check if filename contains article_id)
        const assetModelsFiles = modelsFiles.filter(
          (file) =>
            file.name &&
            asset.article_id &&
            file.name.includes(asset.article_id)
        );

        if (assetModelsFiles.length > 0) {
          const modelsFileList = assetModelsFiles.map((file) => ({
            id: `models_${file.id || file.name}`,
            file_name: file.name,
            file_url: supabase.storage
              .from("assets")
              .getPublicUrl(`${modelsPath}${file.name}`).data.publicUrl,
            file_type: getFileType(file.name),
            file_size: file.metadata?.size || 0,
            mime_type: file.metadata?.mimetype || "application/octet-stream",
            uploaded_at: file.updated_at || new Date().toISOString(),
            uploaded_by: session.user.email
              ? session.user.email.split("@")[0]
              : "Unknown",
          }));

          allFiles = [...allFiles, ...modelsFileList];
        }
      }

      // Also add current asset files (GLB, reference images, product link)
      if (asset.glb_link) {
        allFiles.unshift({
          id: "current_glb",
          file_name: "Current GLB File",
          file_url: asset.glb_link,
          file_type: "glb" as const,
          file_size: 0,
          mime_type: "model/gltf-binary",
          uploaded_at: new Date().toISOString(),
          uploaded_by: "Current Asset",
        });
      }

      if (asset.reference && asset.reference.length > 0) {
        asset.reference.forEach((refUrl: string, index: number) => {
          allFiles.unshift({
            id: `current_ref_${index}`,
            file_name: `Reference Image ${index + 1}`,
            file_url: refUrl,
            file_type: "reference" as const,
            file_size: 0,
            mime_type: "image/png", // Assuming reference images are PNG
            uploaded_at: new Date().toISOString(),
            uploaded_by: "Asset Reference",
          });
        });
      }

      if (asset.product_link) {
        allFiles.unshift({
          id: "current_product",
          file_name: "Product Link",
          file_url: asset.product_link,
          file_type: "misc" as const,
          file_size: 0,
          mime_type: "text/uri-list",
          uploaded_at: new Date().toISOString(),
          uploaded_by: "Asset Reference",
        });
      }

      return NextResponse.json({ files: allFiles });
    } catch (storageError) {
      console.error("Storage error:", storageError);
      return NextResponse.json({ files: [] });
    }
  } catch (error) {
    console.error("Error in asset files API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getFileType(fileName: string): "glb" | "asset" | "reference" | "misc" {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "glb" || ext === "gltf") return "glb";
  if (
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "png" ||
    ext === "gif" ||
    ext === "bmp"
  )
    return "reference";
  if (
    ext === "zip" ||
    ext === "blend" ||
    ext === "obj" ||
    ext === "fbx" ||
    ext === "dae" ||
    ext === "max" ||
    ext === "ma" ||
    ext === "mb" ||
    ext === "3ds" ||
    ext === "stl" ||
    ext === "ply" ||
    ext === "wrl" ||
    ext === "x3d" ||
    ext === "usd" ||
    ext === "abc" ||
    ext === "c4d" ||
    ext === "skp" ||
    ext === "dwg" ||
    ext === "dxf" ||
    ext === "iges" ||
    ext === "step" ||
    ext === "stp"
  )
    return "asset";

  return "misc";
}

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("file_name");
    const filePath = searchParams.get("file_path");
    const assetId = searchParams.get("asset_id");

    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: "File name and path are required" },
        { status: 400 }
      );
    }

    // Clean up the file path - remove any leading "assets/" if present
    let cleanFilePath = filePath;
    if (cleanFilePath.startsWith("assets/")) {
      cleanFilePath = cleanFilePath.substring(7); // Remove "assets/" prefix
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("assets")
      .remove([cleanFilePath]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
      return NextResponse.json(
        {
          error: "Failed to delete file from storage",
          details: storageError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
      deletedPath: cleanFilePath,
    });
  } catch (error) {
    console.error("Error in delete file API:", error);
    // Ensure we return a proper error response instead of throwing
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
