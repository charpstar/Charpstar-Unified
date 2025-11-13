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

    const { id: assetId } = await params;
    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
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

    // Construct backup folder path based on structure
    const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
    const backupFolderPath = useCustomStructure
      ? `QC/backups/`
      : `${sanitizedClientName}/QC/backups/`;

    // List files in backup folder using BunnyCDN API
    const listUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${backupFolderPath}`;

    const listResponse = await fetch(listUrl, {
      method: "GET",
      headers: {
        AccessKey: customAccessKey,
      },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error(
        "❌ Failed to list backup files:",
        listResponse.status,
        listResponse.statusText,
        errorText
      );
      return NextResponse.json(
        { error: "Failed to list backup files", details: errorText },
        { status: 500 }
      );
    }

    const backupFiles = await listResponse.json();

    // Filter files that match the current asset's article_id
    const articleId = asset.article_id;
    const matchingBackups = backupFiles
      .filter((file: any) => {
        // Check if filename starts with the article_id
        const fileName = file.ObjectName || file.name || "";
        return (
          fileName.startsWith(`${articleId}_backup_`) &&
          fileName.endsWith(".glb")
        );
      })
      .map((file: any) => {
        const fileName = file.ObjectName || file.name || "";
        const fileSize = file.Length || file.size || 0;
        const lastModified =
          file.LastChanged ||
          file.lastModified ||
          file.DateCreated ||
          new Date().toISOString();

        // Extract timestamp from filename for sorting
        const timestampMatch = fileName.match(/_backup_(\d+)\.glb$/);
        const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;

        // Construct the correct CDN URL based on structure
        // For custom structure, CDN URL doesn't include storage zone
        // For default structure, CDN URL includes the client folder
        const backupCdnUrl = useCustomStructure
          ? `${cdnUrl}/${backupFolderPath}${fileName}`
          : `${cdnUrl}/${backupFolderPath}${fileName}`;

        return {
          id: fileName, // Use filename as ID since we don't have database IDs
          fileName,
          fileSize,
          lastModified,
          timestamp,
          glbUrl: backupCdnUrl,
          isBackup: true,
          isCurrent: false, // Backups are never current
        };
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

    // Only use BunnyCDN file system - no database lookups
    // This ensures we always show what's actually in storage

    // Create current file entry (the main GLB file, not a backup)
    let currentFileSize = 0;
    if (asset.glb_link) {
      try {
        const fileResponse = await fetch(asset.glb_link, { method: "HEAD" });
        const contentLength = fileResponse.headers.get("content-length");
        if (contentLength) {
          currentFileSize = parseInt(contentLength, 10);
        }
      } catch {
        // Ignore errors - file size is optional
      }
    }

    const currentFile = {
      id: "current",
      fileName: `${articleId}.glb`,
      fileSize: currentFileSize,
      lastModified: new Date().toISOString(),
      timestamp: Date.now(),
      glbUrl: asset.glb_link,
      isBackup: false,
      isCurrent: true,
    };

    // Build version list from file system only
    const allVersions: any[] = [];

    // First, add the current file (always first)
    if (currentFile.glbUrl) {
      allVersions.push(currentFile);
    }

    // Then, add all backup files from BunnyCDN file system
    // Try to fetch file sizes for backups that don't have them
    for (const backup of matchingBackups) {
      // If file size is missing, try to fetch it
      if (backup.fileSize === 0 && backup.glbUrl) {
        try {
          const fileResponse = await fetch(backup.glbUrl, { method: "HEAD" });
          const contentLength = fileResponse.headers.get("content-length");
          if (contentLength) {
            backup.fileSize = parseInt(contentLength, 10);
          }
        } catch {
          // Ignore errors - file size is optional
        }
      }
      allVersions.push(backup);
    }

    // Sort with current version first, then by timestamp
    allVersions.sort((a: any, b: any) => {
      // Current version should always be first (latest)
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      // If both or neither are current, sort by timestamp (newest first)
      return b.timestamp - a.timestamp;
    });

    return NextResponse.json({
      success: true,
      versions: allVersions,
      totalCount: allVersions.length,
    });
  } catch (error) {
    console.error("❌ Error fetching backup files:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
