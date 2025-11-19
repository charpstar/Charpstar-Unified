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

    // Get asset details - fetch both glb_link and blend_link
    const { data: asset, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client, glb_link, blend_link")
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

    console.log("📁 All backup files found:", backupFiles.length);
    console.log("🔍 Looking for backups for article_id:", asset.article_id);

    // Filter files that match the current asset's article_id (both .glb and .blend)
    const articleId = asset.article_id;
    const matchingBackups = backupFiles
      .filter((file: any) => {
        // Check if filename starts with the article_id
        const fileName = file.ObjectName || file.name || "";
        const matches =
          fileName.startsWith(`${articleId}_backup_`) &&
          (fileName.endsWith(".glb") || fileName.endsWith(".blend"));

        if (matches) {
          console.log("✅ Matched backup file:", fileName);
        }

        return matches;
      })
      .map((file: any) => {
        const fileName = file.ObjectName || file.name || "";
        const fileSize = file.Length || file.size || 0;
        const lastModified =
          file.LastChanged ||
          file.lastModified ||
          file.DateCreated ||
          new Date().toISOString();

        // Extract timestamp from filename for sorting (works for both .glb and .blend)
        const timestampMatch = fileName.match(/_backup_(\d+)\.(glb|blend)$/);
        const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : 0;

        // Determine file type
        const fileType = fileName.endsWith(".blend") ? "blend" : "glb";

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
          fileType, // "glb" or "blend"
          glbUrl: backupCdnUrl, // Keep this name for backward compatibility
          fileUrl: backupCdnUrl, // Also provide a generic fileUrl
          isBackup: true,
          isCurrent: false, // Backups are never current
        };
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

    // Only use BunnyCDN file system - no database lookups
    // This ensures we always show what's actually in storage

    // Create current file entries (both GLB and Blend files)
    const allVersions: any[] = [];

    // Add current GLB file
    if (asset.glb_link) {
      let currentGlbFileSize = 0;
      try {
        // Construct storage path directly from asset data (more reliable than parsing CDN URL)
        const sanitizedClientName = asset.client.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );
        const mainGlbFileName = `${articleId}.glb`;
        const mainQcPath = useCustomStructure
          ? `QC/${mainGlbFileName}`
          : `${sanitizedClientName}/QC/${mainGlbFileName}`;
        const storageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${mainQcPath}`;

        // Fetch file size from storage directly (most reliable)
        const storageResponse = await fetch(storageUrl, {
          method: "HEAD",
          headers: {
            AccessKey: customAccessKey,
          },
        });

        if (storageResponse.ok) {
          const storageContentLength =
            storageResponse.headers.get("content-length");
          if (storageContentLength) {
            currentGlbFileSize = parseInt(storageContentLength, 10);
          }
        } else {
          // Fallback: try CDN URL with HEAD request
          try {
            const fileResponse = await fetch(asset.glb_link, {
              method: "HEAD",
              headers: {
                "Cache-Control": "no-cache",
              },
            });
            const contentLength = fileResponse.headers.get("content-length");
            if (contentLength) {
              currentGlbFileSize = parseInt(contentLength, 10);
            }
          } catch {
            // Ignore errors - file size is optional
          }
        }
      } catch {
        // If storage fetch fails, try CDN URL as fallback
        try {
          const fileResponse = await fetch(asset.glb_link, {
            method: "HEAD",
            headers: {
              "Cache-Control": "no-cache",
            },
          });
          const contentLength = fileResponse.headers.get("content-length");
          if (contentLength) {
            currentGlbFileSize = parseInt(contentLength, 10);
          }
        } catch {
          // Ignore errors - file size is optional
        }
      }

      allVersions.push({
        id: "current-glb",
        fileName: `${articleId}.glb`,
        fileSize: currentGlbFileSize,
        lastModified: new Date().toISOString(),
        timestamp: Date.now(),
        fileType: "glb",
        glbUrl: asset.glb_link,
        fileUrl: asset.glb_link,
        isBackup: false,
        isCurrent: true,
      });
    }

    // Add current Blend file
    if (asset.blend_link) {
      let currentBlendFileSize = 0;
      try {
        // Construct storage path directly from asset data (more reliable than parsing CDN URL)
        const sanitizedClientName = asset.client.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );
        const mainBlendFileName = `${articleId}.blend`;
        const mainAssetsPath = useCustomStructure
          ? `assets/${mainBlendFileName}`
          : `${sanitizedClientName}/assets/${mainBlendFileName}`;
        const storageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${mainAssetsPath}`;

        // Fetch file size from storage directly (most reliable)
        const storageResponse = await fetch(storageUrl, {
          method: "HEAD",
          headers: {
            AccessKey: customAccessKey,
          },
        });

        if (storageResponse.ok) {
          const storageContentLength =
            storageResponse.headers.get("content-length");
          if (storageContentLength) {
            currentBlendFileSize = parseInt(storageContentLength, 10);
          }
        } else {
          // Fallback: try CDN URL with HEAD request
          try {
            const fileResponse = await fetch(asset.blend_link, {
              method: "HEAD",
              headers: {
                "Cache-Control": "no-cache",
              },
            });
            const contentLength = fileResponse.headers.get("content-length");
            if (contentLength) {
              currentBlendFileSize = parseInt(contentLength, 10);
            }
          } catch {
            // Ignore errors - file size is optional
          }
        }
      } catch {
        // If storage fetch fails, try CDN URL as fallback
        try {
          const fileResponse = await fetch(asset.blend_link, {
            method: "HEAD",
            headers: {
              "Cache-Control": "no-cache",
            },
          });
          const contentLength = fileResponse.headers.get("content-length");
          if (contentLength) {
            currentBlendFileSize = parseInt(contentLength, 10);
          }
        } catch {
          // Ignore errors - file size is optional
        }
      }

      allVersions.push({
        id: "current-blend",
        fileName: `${articleId}.blend`,
        fileSize: currentBlendFileSize,
        lastModified: new Date().toISOString(),
        timestamp: Date.now(),
        fileType: "blend",
        glbUrl: asset.blend_link, // Keep for backward compatibility
        fileUrl: asset.blend_link,
        isBackup: false,
        isCurrent: true,
      });
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

    console.log("📊 Version history summary:", {
      total: allVersions.length,
      glb: allVersions.filter((v) => v.fileType === "glb").length,
      blend: allVersions.filter((v) => v.fileType === "blend").length,
      current: allVersions.filter((v) => v.isCurrent).length,
      backups: allVersions.filter((v) => v.isBackup).length,
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
