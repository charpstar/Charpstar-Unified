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

    const { assetId, backupUrl } = await request.json();

    if (!assetId || !backupUrl) {
      return NextResponse.json(
        { error: "Asset ID and backup URL are required" },
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
    const bunnyApiKey = process.env.BUNNY_API_KEY;

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

    // Construct the main assets path (where blend files are stored)
    const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${asset.article_id}.blend`;
    const mainAssetsPath = useCustomStructure
      ? `assets/${fileName}`
      : `${sanitizedClientName}/assets/${fileName}`;
    const mainAssetsStorageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${mainAssetsPath}`;
    const mainAssetsPublicUrl = `${cdnUrl}/${mainAssetsPath}`;

    // When restoring, we just replace the current file directly
    // No need to backup the current file - the backup we're restoring from already exists
    // If the user wants the current file back, they can restore it from the backups

    // Download the backup file we want to restore
    // Convert public CDN URL to storage URL to avoid CDN caching
    let backupStorageUrl = backupUrl;
    try {
      const urlObj = new URL(backupUrl);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Extract the storage path from the CDN URL
      // For custom structure: QC/backups/filename.blend
      // For default: client/QC/backups/filename.blend
      let storagePath: string;
      if (useCustomStructure) {
        const qcIndex = pathParts.indexOf("QC");
        if (qcIndex !== -1) {
          storagePath = pathParts.slice(qcIndex).join("/");
        } else {
          // Fallback: try to extract from backup URL
          const fileName = backupUrl.split("/").pop() || "";
          storagePath = `QC/backups/${fileName}`;
        }
      } else {
        // For default structure, find the client name and construct path
        const fileName = backupUrl.split("/").pop() || "";
        storagePath = `${sanitizedClientName}/QC/backups/${fileName}`;
      }

      backupStorageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${storagePath}`;
      console.log("📥 Converted CDN URL to storage URL:", backupStorageUrl);
    } catch (error) {
      console.warn(
        "⚠️ Could not convert CDN URL to storage URL, using original:",
        error
      );
      // Fall back to using the original URL
    }

    console.log("📥 Downloading backup Blender file from:", backupStorageUrl);
    const backupFileResponse = await fetch(backupStorageUrl, {
      method: "GET",
      headers: {
        AccessKey: customAccessKey,
      },
    });

    if (!backupFileResponse.ok) {
      console.error(
        "❌ Failed to download backup file:",
        backupFileResponse.status,
        backupFileResponse.statusText
      );
      return NextResponse.json(
        {
          error: "Failed to download backup file",
          status: backupFileResponse.status,
        },
        { status: 500 }
      );
    }

    const fileBuffer = await backupFileResponse.arrayBuffer();
    console.log(
      "✅ Backup file downloaded, size:",
      fileBuffer.byteLength,
      "bytes"
    );

    // Verify magic bytes for Blender file ('BLENDER')
    const magicBytes = new Uint8Array(fileBuffer.slice(0, 7));
    const magicString = String.fromCharCode(...magicBytes);
    if (magicString !== "BLENDER") {
      console.warn(
        "⚠️ File doesn't appear to be a valid Blender file (missing BLENDER magic bytes), but continuing with restore"
      );
    }

    // Upload the backup file to main assets location (overwrites current file)
    // Add cache-control headers to prevent caching of the restored file
    console.log("📤 Uploading restored Blender file to:", mainAssetsStorageUrl);
    console.log("📊 File size:", fileBuffer.byteLength, "bytes");
    const uploadResponse = await fetch(mainAssetsStorageUrl, {
      method: "PUT",
      headers: {
        AccessKey: customAccessKey,
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      body: fileBuffer,
    });

    console.log("📤 Upload response status:", uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return NextResponse.json(
        {
          error: "Failed to copy file to main assets location",
          status: uploadResponse.status,
          details: errorText,
        },
        { status: 500 }
      );
    }

    // Verify the file was uploaded correctly by checking its size
    // Wait longer for CDN propagation and ensure file is fully written
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify using storage URL directly (not CDN) to avoid cache issues
    const verifyResponse = await fetch(mainAssetsStorageUrl, {
      method: "GET",
      headers: {
        AccessKey: customAccessKey,
        "Cache-Control": "no-cache",
      },
    });

    if (!verifyResponse.ok) {
      console.warn("⚠️ Warning: Could not verify restored file immediately");
    } else {
      const verifiedBuffer = await verifyResponse.arrayBuffer();
      console.log(
        "✅ Verified restored file, size:",
        verifiedBuffer.byteLength,
        "bytes"
      );
      if (verifiedBuffer.byteLength !== fileBuffer.byteLength) {
        console.error(
          `❌ File size mismatch after restore. Expected: ${fileBuffer.byteLength}, Got: ${verifiedBuffer.byteLength}`
        );
        // This is a critical error - the file wasn't restored correctly
        return NextResponse.json(
          {
            error:
              "File size mismatch after restore - file may not have been restored correctly",
            expectedSize: fileBuffer.byteLength,
            actualSize: verifiedBuffer.byteLength,
          },
          { status: 500 }
        );
      } else {
        console.log("✅ File size matches - restore successful");
      }
    }

    // Purge cache for the restored Blender file URL
    if (bunnyApiKey) {
      try {
        console.log(
          "🗑️ Purging cache for restored Blender file:",
          mainAssetsPublicUrl
        );
        const purgeResponse = await fetch(
          "https://api.bunny.net/purge?async=false",
          {
            method: "POST",
            headers: {
              AccessKey: bunnyApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: [mainAssetsPublicUrl] }),
          }
        );

        if (purgeResponse.ok) {
          console.log("✅ Cache purged successfully for:", mainAssetsPublicUrl);
        } else {
          const errorText = await purgeResponse.text();
          console.warn(
            `⚠️ Cache purge warning: ${purgeResponse.status} - ${errorText}`
          );
        }
      } catch (purgeError) {
        console.error("❌ Error purging cache:", purgeError);
        // Continue even if purge fails - the file is still restored
      }
    } else {
      console.warn("⚠️ BUNNY_API_KEY not set, skipping cache purge");
    }

    // Update the asset in the database with the restored Blender link
    const timestamp = Date.now();
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({
        blend_link: mainAssetsPublicUrl, // Store clean URL without cache-busting in DB
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating asset after restore:", updateError);
      // Don't fail the request, but log the error
    }

    // Note: We don't record restore operations in the database
    // Version history is now based solely on BunnyCDN file system

    return NextResponse.json({
      success: true,
      blendUrl: mainAssetsPublicUrl,
      restoreTimestamp: timestamp, // Include timestamp for cache-busting
      message: "Blender file restored to main assets location",
    });
  } catch (error) {
    console.error("❌ Error restoring Blender file:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
