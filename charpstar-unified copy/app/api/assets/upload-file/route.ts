import { NextRequest, NextResponse } from "next/server";

// Folder creation functions removed - BunnyCDN auto-creates folders on file upload
// This optimization removed ~3-5 seconds from upload time

export async function POST(request: NextRequest) {
  // const startTime = Date.now(); // Not currently used

  try {
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const clientName = formData.get("client_name") as string;

    // Try alternative field names that might be used
    const alternativeClientName =
      (formData.get("client") as string) ||
      (formData.get("clientName") as string) ||
      (formData.get("client_id") as string);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size limits (Vercel has a 4.5MB limit for serverless functions)
    const maxSize = 15 * 1024 * 1024; // 4.5MB (Vercel's actual limit)
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: "File too large",
          details: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${(maxSize / 1024 / 1024).toFixed(2)}MB. Please compress the GLB file or use a different upload method.`,
          maxSize,
          fileSize: file.size,
          suggestion:
            "Try compressing the GLB file using tools like Blender's 'Decimate' modifier or online GLB compressors.",
        },
        { status: 413 }
      );
    }

    // Use alternative client name if primary one is not found
    const finalClientName = clientName || alternativeClientName;

    if (!finalClientName) {
      return NextResponse.json(
        {
          error:
            "Client name is required. Please provide 'client_name', 'client', 'clientName', or 'client_id' in the form data.",
        },
        { status: 400 }
      );
    }

    // 🔑 Load from .env
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
    const storageKey = process.env.BUNNY_STORAGE_KEY;
    const cdnUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;
    const bunnyApiKey = process.env.BUNNY_API_KEY;

    if (!storageKey || !storageZone || !cdnUrl) {
      return NextResponse.json(
        { error: "Missing BunnyCDN config" },
        { status: 500 }
      );
    }

    // Check if client has custom BunnyCDN folder structure
    let useCustomStructure = false;
    let customStorageZone = storageZone;
    let customAccessKey = storageKey;
    try {
      const { createRouteHandlerClient } = await import(
        "@supabase/auth-helpers-nextjs"
      );
      const { cookies } = await import("next/headers");
      const supabase = createRouteHandlerClient({ cookies });

      const { data: clientData } = await supabase
        .from("clients")
        .select(
          "bunny_custom_structure, bunny_custom_url, bunny_custom_access_key"
        )
        .eq("name", finalClientName)
        .single();

      if (clientData?.bunny_custom_structure && clientData?.bunny_custom_url) {
        useCustomStructure = true;
        // Custom URL REPLACES the storage zone (e.g., "Polhus" instead of "maincdn")
        customStorageZone = clientData.bunny_custom_url.replace(
          /^\/+|\/+$/g,
          ""
        );
        // Use custom access key if provided, otherwise fall back to default
        if (clientData?.bunny_custom_access_key) {
          customAccessKey = clientData.bunny_custom_access_key;
        }
      }
    } catch (error) {
      console.error("Error fetching client folder structure:", error);
      // Continue with default structure if fetch fails
    }

    // Use custom or default storage zone
    const finalStorageZone = useCustomStructure
      ? customStorageZone
      : storageZone;

    // Convert File → Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload path - using client name as folder with QC subfolder
    const baseFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const sanitizedClientName = finalClientName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    // Skip folder creation - BunnyCDN creates folders automatically when uploading files
    // The old approach was creating folders on every upload, adding 3 API calls (~3-5 seconds delay)

    // Original file path (where the current version will be stored)
    const originalPath = useCustomStructure
      ? `QC/${baseFileName}`
      : `${sanitizedClientName}/QC/${baseFileName}`;
    const originalUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${originalPath}`;

    // Note: Backup is now handled by the frontend before calling this endpoint
    // This prevents duplicate backups from being created
    // The frontend calls /api/assets/backup-glb which properly records the backup in the database

    // Upload new file to original location
    const uploadPath = originalPath;
    const url = originalUrl;

    // Upload to Bunny
    // const mainUploadStartTime = Date.now(); // Not currently used

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(url, {
        method: "PUT",
        headers: {
          AccessKey: customAccessKey,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: buffer,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        return NextResponse.json(
          {
            error: "Upload timeout",
            details: "Request timed out after 30 seconds",
          },
          { status: 408 }
        );
      }
      throw error;
    }

    // const mainUploadDuration = Date.now() - mainUploadStartTime; // Not currently used

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: "Upload failed", status: response.status, details: errText },
        { status: response.status }
      );
    }

    // Public URL - Pull Zone handles storage zone routing, so CDN URL never includes it
    const cleanCdnUrl = cdnUrl;
    const publicUrl = `${cleanCdnUrl}/${uploadPath}`;

    // Purge cache for the uploaded GLB file URL
    if (bunnyApiKey) {
      try {
        console.log("🗑️ Purging cache for uploaded GLB:", publicUrl);
        const purgeResponse = await fetch(
          "https://api.bunny.net/purge?async=false",
          {
            method: "POST",
            headers: {
              AccessKey: bunnyApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: [publicUrl] }),
          }
        );

        if (purgeResponse.ok) {
          console.log("✅ Cache purged successfully for:", publicUrl);
        } else {
          const errorText = await purgeResponse.text();
          console.warn(
            `⚠️ Cache purge warning: ${purgeResponse.status} - ${errorText}`
          );
        }
      } catch (purgeError) {
        console.error("❌ Error purging cache:", purgeError);
        // Continue even if purge fails - the file is still uploaded
      }
    } else {
      console.warn("⚠️ BUNNY_API_KEY not set, skipping cache purge");
    }

    // const totalDuration = Date.now() - startTime; // Not currently used

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: baseFileName,
      originalFileName: file.name,
      fileSize: buffer.length,
      uploadPath,
    });
  } catch (err) {
    console.error("[UPLOAD] Server error:", err);
    return NextResponse.json(
      { error: "Server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
