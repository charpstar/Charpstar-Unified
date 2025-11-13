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

    const { assetId, glbUrl } = await request.json();

    if (!assetId || !glbUrl) {
      return NextResponse.json(
        { error: "Asset ID and GLB URL are required" },
        { status: 400 }
      );
    }

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client, glb_link")
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

    // Construct the storage URL directly from asset data to ensure we get the correct file
    // This is more reliable than parsing the CDN URL
    const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
    const mainFileName = `${asset.article_id}.glb`;
    const mainQcPath = useCustomStructure
      ? `QC/${mainFileName}`
      : `${sanitizedClientName}/QC/${mainFileName}`;
    const storageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${mainQcPath}`;

    // Download the current GLB file directly from storage (not CDN) to avoid caching
    // This ensures we get the actual file that's in storage, not a cached version
    console.log(
      "📥 Downloading current file from storage for backup:",
      storageUrl
    );
    console.log("📊 Asset GLB link from database:", asset.glb_link);
    const currentFileResponse = await fetch(storageUrl, {
      method: "GET",
      headers: {
        AccessKey: customAccessKey,
      },
    });

    if (!currentFileResponse.ok) {
      // If file doesn't exist, that's okay - no backup needed
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

    // Validate file is not empty
    if (fileBuffer.byteLength === 0) {
      console.warn("⚠️ File is empty, skipping backup");
      return NextResponse.json({
        success: true,
        message: "File is empty, no backup created",
        backupUrl: null,
      });
    }

    // Verify the file is actually a GLB file by checking the magic bytes
    // GLB files start with "glTF" (0x676C5446) at offset 0
    const magicBytes = new Uint8Array(fileBuffer.slice(0, 4));
    const magicString = String.fromCharCode(...magicBytes);
    if (magicString !== "glTF") {
      console.warn(
        "⚠️ File doesn't appear to be a valid GLB file (missing glTF magic bytes), but continuing with backup"
      );
    }

    // Check if a backup was created in the last 10 seconds to prevent duplicates
    // This handles cases where the endpoint might be called multiple times rapidly
    // We check by file size to ensure it's the same file being backed up
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const { data: recentBackups } = await supabase
      .from("glb_upload_history")
      .select("id, uploaded_at, glb_url, file_size")
      .eq("asset_id", assetId)
      .eq("file_size", fileBuffer.byteLength) // Same file size = same file
      .gte("uploaded_at", tenSecondsAgo)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (recentBackups && recentBackups.length > 0) {
      const recentBackup = recentBackups[0];
      console.log(
        "⚠️ Recent backup found with same file size, skipping duplicate backup creation"
      );
      return NextResponse.json({
        success: true,
        message: "Backup already created recently for this file",
        backupUrl: recentBackup.glb_url,
        skipped: true,
      });
    }

    // Create backup filename with timestamp
    const timestamp = Date.now();
    const fileExtension = mainFileName.split(".").pop();
    const fileNameWithoutExt = mainFileName.replace(/\.[^/.]+$/, "");
    const backupFileName = `${fileNameWithoutExt}_backup_${timestamp}.${fileExtension}`;
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

    // Record backup in glb_upload_history
    try {
      const { error: historyError } = await supabase
        .from("glb_upload_history")
        .insert({
          asset_id: assetId,
          glb_url: backupPublicUrl,
          file_name: backupFileName,
          file_size: fileBuffer.byteLength,
          uploaded_by: session.user.id,
          uploaded_at: new Date().toISOString(),
        });

      if (historyError) {
        console.error("Error recording backup to history:", historyError);
        // Don't fail the request if history recording fails
      }
    } catch (historyErr) {
      console.error("Error recording backup to history:", historyErr);
      // Don't fail the request if history recording fails
    }

    return NextResponse.json({
      success: true,
      backupUrl: backupPublicUrl,
      backupFileName,
      message: "Backup created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating GLB backup:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
