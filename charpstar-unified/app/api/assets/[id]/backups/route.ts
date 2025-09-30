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

    // Construct backup folder path
    const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
    const backupFolderPath = `${sanitizedClientName}/QC/backups/`;

    // List files in backup folder using BunnyCDN API
    const listUrl = `https://se.storage.bunnycdn.com/${storageZone}/${backupFolderPath}`;

    const listResponse = await fetch(listUrl, {
      method: "GET",
      headers: {
        AccessKey: storageKey,
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

        return {
          id: fileName, // Use filename as ID since we don't have database IDs
          fileName,
          fileSize,
          lastModified,
          timestamp,
          glbUrl: `${cdnUrl}/${backupFolderPath}${fileName}`,
          isBackup: true,
          isCurrent: false, // Backups are never current
        };
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

    // Add current file as the first entry
    const currentFile = {
      id: "current",
      fileName: `${articleId}.glb`,
      fileSize: 0, // We don't have current file size easily available
      lastModified: new Date().toISOString(),
      timestamp: Date.now(),
      glbUrl: asset.glb_link,
      isBackup: false,
      isCurrent: true,
    };

    const allVersions = [currentFile, ...matchingBackups];

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
