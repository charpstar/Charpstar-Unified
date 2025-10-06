import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, fileName, cdnUrl, storagePath, fileType, fileSize } =
      await request.json();

    if (!assetId || !fileName || !cdnUrl || !storagePath || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user profile to determine client
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("client, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get client from profile or from asset as fallback
    let client = profile.client;
    if (!client) {
      // Fallback: get client from asset
      const { data: asset, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("client")
        .eq("id", assetId)
        .single();

      if (assetError || !asset) {
        return NextResponse.json(
          { error: "Could not determine client" },
          { status: 400 }
        );
      }

      client = asset.client;
    }

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    // Update the asset with the new file URL
    const adminClient = createAdminClient();
    let backupUrl = null;

    if (fileType === "glb") {
      // Get asset details for backup
      const { data: asset, error: assetError } = await adminClient
        .from("onboarding_assets")
        .select("article_id, glb_link")
        .eq("id", assetId)
        .single();

      if (assetError || !asset) {
        console.error("Error fetching asset for backup:", assetError);
        return NextResponse.json(
          { error: "Failed to fetch asset" },
          { status: 500 }
        );
      }

      // Create backup if there's an existing GLB file
      if (asset.glb_link) {
        try {
          // Get BunnyCDN configuration
          const storageKey = process.env.BUNNY_STORAGE_KEY;
          const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
          const cdnBaseUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

          if (storageKey && storageZone && cdnBaseUrl) {
            // Download existing file for backup
            const existingFileResponse = await fetch(asset.glb_link, {
              method: "GET",
              headers: {
                AccessKey: storageKey,
              },
            });

            if (existingFileResponse.ok) {
              const existingFileBuffer =
                await existingFileResponse.arrayBuffer();

              // Create backup filename with timestamp
              const timestamp = Date.now();
              const fileExtension = fileName.split(".").pop();
              const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
              const backupFileName = `${fileNameWithoutExt}_backup_${timestamp}.${fileExtension}`;

              // Create backup path
              const sanitizedClientName = (client || "unknown").replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
              );
              const backupPath = `${sanitizedClientName}/QC/backups/${backupFileName}`;
              const backupStorageUrl = `https://se.storage.bunnycdn.com/${storageZone}/${backupPath}`;

              // Upload backup to BunnyCDN
              const backupUploadResponse = await fetch(backupStorageUrl, {
                method: "PUT",
                headers: {
                  AccessKey: storageKey,
                  "Content-Type": "application/octet-stream",
                },
                body: existingFileBuffer,
              });

              if (backupUploadResponse.ok) {
                backupUrl = `${cdnBaseUrl}/${backupPath}`;
              } else {
                console.warn(
                  "Failed to create backup:",
                  backupUploadResponse.status
                );
              }
            }
          }
        } catch (backupError) {
          console.error("Error creating backup:", backupError);
          // Don't fail the upload if backup fails
        }
      }

      // Update GLB link in onboarding_assets
      const { error: updateError } = await adminClient
        .from("onboarding_assets")
        .update({ glb_link: cdnUrl })
        .eq("id", assetId);

      if (updateError) {
        console.error("Error updating GLB link:", updateError);
        return NextResponse.json(
          { error: "Failed to update asset" },
          { status: 500 }
        );
      }
    } else if (fileType === "reference") {
      // Update reference images
      const { data: currentAsset, error: fetchError } = await adminClient
        .from("onboarding_assets")
        .select("reference")
        .eq("id", assetId)
        .single();

      if (fetchError) {
        console.error("Error fetching current asset:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch asset" },
          { status: 500 }
        );
      }

      const currentReferences = currentAsset?.reference || [];
      const updatedReferences = [...currentReferences, cdnUrl];

      const { error: updateError } = await adminClient
        .from("onboarding_assets")
        .update({ reference: updatedReferences })
        .eq("id", assetId);

      if (updateError) {
        console.error("Error updating reference images:", updateError);
        return NextResponse.json(
          { error: "Failed to update asset" },
          { status: 500 }
        );
      }
    }

    // Log activity
    const { error: logError } = await adminClient.from("activities").insert({
      user_id: user.id,
      action: "file_uploaded",
      description: `Large file uploaded: ${fileName} (${fileType})${backupUrl ? ` with backup created` : ""}`,
      type: "create",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        cdn_url: cdnUrl,
        storage_path: storagePath,
        client: client,
        backup_url: backupUrl,
      },
    });

    if (logError) {
      console.error("Error logging activity:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      cdnUrl,
      fileName,
      fileType,
      backupUrl,
    });
  } catch (error: any) {
    console.error("Error in upload-large-file API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
