import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, blendUrl, timestamp } = await request.json();

    if (!assetId || !blendUrl) {
      return NextResponse.json(
        { error: "Asset ID and Blender URL are required" },
        { status: 400 }
      );
    }

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client, blend_link")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Get BunnyCDN configuration
    const storageKey = process.env.BUNNY_STORAGE_KEY;
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
    const cdnUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

    if (!storageKey || !storageZone || !cdnUrl) {
      return NextResponse.json(
        { error: "BunnyCDN configuration missing" },
        { status: 500 }
      );
    }

    // Check if client has custom BunnyCDN folder structure
    let useCustomStructure = false;
    let customStorageZone = storageZone;
    let customAccessKey = storageKey;

    const { data: clientData } = await supabase
      .from("clients")
      .select(
        "bunny_custom_structure, bunny_custom_url, bunny_custom_access_key"
      )
      .eq("name", asset.client)
      .single();

    if (clientData?.bunny_custom_structure && clientData?.bunny_custom_url) {
      useCustomStructure = true;
      customStorageZone = clientData.bunny_custom_url.replace(/^\/+|\/+$/g, "");
      if (clientData?.bunny_custom_access_key) {
        customAccessKey = clientData.bunny_custom_access_key;
      }
    }

    const finalStorageZone = useCustomStructure
      ? customStorageZone
      : storageZone;

    // Construct the storage URL directly from asset data
    // Blend files are stored in the 'assets' folder, not 'QC'
    const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
    const mainFileName = `${asset.article_id}.blend`;
    const mainAssetsPath = useCustomStructure
      ? `assets/${mainFileName}`
      : `${sanitizedClientName}/assets/${mainFileName}`;
    const storageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${mainAssetsPath}`;

    // Download the current Blender file directly from storage
    console.log(
      "📥 Downloading current Blender file from storage for backup:",
      storageUrl
    );
    const currentFileResponse = await fetch(storageUrl, {
      method: "GET",
      headers: {
        AccessKey: customAccessKey,
      },
    });

    if (!currentFileResponse.ok) {
      return NextResponse.json({
        success: true,
        message: "No existing file to backup",
        backupUrl: null,
      });
    }

    const fileBuffer = await currentFileResponse.arrayBuffer();
    console.log(
      "✅ File downloaded from storage, size:",
      fileBuffer.byteLength,
      "bytes"
    );

    if (fileBuffer.byteLength === 0) {
      console.warn("⚠️ File is empty, skipping backup");
      return NextResponse.json({
        success: true,
        message: "File is empty, no backup created",
        backupUrl: null,
      });
    }

    // Verify magic bytes for Blender file ('BLENDER')
    const magicBytes = new Uint8Array(fileBuffer.slice(0, 7));
    const magicString = String.fromCharCode(...magicBytes);
    if (magicString !== "BLENDER") {
      console.warn(
        "⚠️ File doesn't appear to be a valid Blender file (missing BLENDER magic bytes), but continuing with backup"
      );
    }

    // Create backup filename with timestamp
    // Use provided timestamp if available (for syncing with GLB file), otherwise generate new one
    const backupTimestamp = timestamp || Date.now();
    const fileNameWithoutExt = mainFileName.replace(/\.[^/.]+$/, "");
    const backupFileName = `${fileNameWithoutExt}_backup_${backupTimestamp}.blend`;
    const backupPath = useCustomStructure
      ? `QC/backups/${backupFileName}`
      : `${sanitizedClientName}/QC/backups/${backupFileName}`;
    const backupStorageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${backupPath}`;
    const backupPublicUrl = `${cdnUrl}/${backupPath}`;

    // Upload backup to BunnyCDN
    const uploadResponse = await fetch(backupStorageUrl, {
      method: "PUT",
      headers: {
        AccessKey: customAccessKey,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(
        "Failed to upload backup:",
        uploadResponse.status,
        errorText
      );
      return NextResponse.json(
        {
          error: "Failed to create backup",
          status: uploadResponse.status,
          details: errorText,
        },
        { status: 500 }
      );
    }

    // Note: We are not saving to glb_upload_history as it might not support .blend files
    // The file system backup is sufficient for version history listing

    console.log("✅ Blend backup created successfully:", {
      backupFileName,
      backupPath,
      backupPublicUrl,
      fileSize: fileBuffer.byteLength,
    });

    return NextResponse.json({
      success: true,
      backupUrl: backupPublicUrl,
      backupFileName,
      message: "Backup created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating Blender backup:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
