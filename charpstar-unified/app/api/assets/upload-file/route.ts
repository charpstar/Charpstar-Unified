import { NextRequest, NextResponse } from "next/server";

// Helper function to create folder structure in BunnyCDN
async function createClientFolderStructure(
  storageKey: string,
  storageZone: string,
  clientName: string
) {
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folders = ["QC", "Android", "iOS"];

  for (const folder of folders) {
    const folderPath = `${sanitizedClientName}/${folder}/`;
    const folderUrl = `https://se.storage.bunnycdn.com/${storageZone}/${folderPath}`;

    try {
      const response = await fetch(folderUrl, {
        method: "PUT",
        headers: {
          AccessKey: storageKey,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(0), // Empty file to create folder
      });

      if (!response.ok && response.status !== 409) {
        // 409 means folder already exists, which is fine
        console.warn(`Failed to create folder ${folderPath}:`, response.status);
      } else {
      }
    } catch (error) {
      console.warn(`Error creating folder ${folderPath}:`, error);
    }
  }
}

export async function POST(request: NextRequest) {
  // const startTime = Date.now(); // Not currently used

  try {
    console.log("[UPLOAD] Starting file upload process");

    const formData = await request.formData();
    console.log("[UPLOAD] Form data parsed successfully");

    const file = formData.get("file") as File;
    const clientName = formData.get("client_name") as string;

    // Try alternative field names that might be used
    const alternativeClientName =
      (formData.get("client") as string) ||
      (formData.get("clientName") as string) ||
      (formData.get("client_id") as string);

    if (!file) {
      console.log("[UPLOAD] No file provided in form data");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("[UPLOAD] File received:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Check file size limits (Vercel has a 4.5MB limit for serverless functions)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      console.log("[UPLOAD] File too large:", file.size, "bytes");
      return NextResponse.json(
        {
          error: "File too large",
          details: `File size ${file.size} bytes exceeds maximum of ${maxSize} bytes`,
          maxSize,
        },
        { status: 413 }
      );
    }

    // Use alternative client name if primary one is not found
    const finalClientName = clientName || alternativeClientName;

    if (!finalClientName) {
      console.log("[UPLOAD] No client name provided");
      return NextResponse.json(
        {
          error:
            "Client name is required. Please provide 'client_name', 'client', 'clientName', or 'client_id' in the form data.",
        },
        { status: 400 }
      );
    }

    console.log("[UPLOAD] Client name:", finalClientName);

    // 🔑 Load from .env
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
    const storageKey = process.env.BUNNY_STORAGE_KEY;
    const cdnUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

    if (!storageKey || !storageZone || !cdnUrl) {
      console.log("[UPLOAD] Missing BunnyCDN config:", {
        hasStorageKey: !!storageKey,
        hasStorageZone: !!storageZone,
        hasCdnUrl: !!cdnUrl,
      });
      return NextResponse.json(
        { error: "Missing BunnyCDN config" },
        { status: 500 }
      );
    }

    console.log("[UPLOAD] BunnyCDN config loaded successfully");

    // Create folder structure for the client
    await createClientFolderStructure(storageKey, storageZone, finalClientName);

    // Convert File → Buffer
    console.log("[UPLOAD] Converting file to buffer...");
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log("[UPLOAD] Buffer created, size:", buffer.length);

    // Upload path - using client name as folder with QC subfolder
    const baseFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const sanitizedClientName = finalClientName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    // Original file path (where the current version will be stored)
    const originalPath = `${sanitizedClientName}/QC/${baseFileName}`;
    const originalUrl = `https://se.storage.bunnycdn.com/${storageZone}/${originalPath}`;

    let backupUrl = null;
    let backupFileName = null;

    // Check if file already exists by trying to download it
    // const checkStartTime = Date.now(); // Not currently used
    const existingFileResponse = await fetch(originalUrl, {
      method: "GET",
      headers: {
        AccessKey: storageKey,
      },
    });

    // const checkDuration = Date.now() - checkStartTime; // Not currently used

    if (existingFileResponse.ok) {
      // We already have the file from the check above
      const existingFileBuffer = await existingFileResponse.arrayBuffer();

      // Create backup filename with timestamp
      const timestamp = Date.now();
      const fileExtension = baseFileName.split(".").pop();
      const fileNameWithoutExt = baseFileName.replace(/\.[^/.]+$/, "");
      backupFileName = `${fileNameWithoutExt}_backup_${timestamp}.${fileExtension}`;
      const backupPath = `${sanitizedClientName}/QC/backups/${backupFileName}`;
      const backupStorageUrl = `https://se.storage.bunnycdn.com/${storageZone}/${backupPath}`;

      // BunnyCDN will create the folder structure automatically when we upload to the path

      // Upload backup
      // const backupStartTime = Date.now(); // Not currently used
      const backupUploadResponse = await fetch(backupStorageUrl, {
        method: "PUT",
        headers: {
          AccessKey: storageKey,
          "Content-Type": "application/octet-stream",
        },
        body: existingFileBuffer,
      });

      // const backupDuration = Date.now() - backupStartTime; // Not currently used

      if (backupUploadResponse.ok) {
        // Construct public backup URL
        const cleanCdnUrl = cdnUrl;
        backupUrl = `${cleanCdnUrl}/${backupPath}`;
      } else {
        // const errorText = await backupUploadResponse.text(); // Not currently used
      }
    }

    // Upload new file to original location
    const uploadPath = originalPath;
    const url = originalUrl;

    // Upload to Bunny
    console.log("[UPLOAD] Uploading to BunnyCDN:", url);
    // const mainUploadStartTime = Date.now(); // Not currently used

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response;
    try {
      response = await fetch(url, {
        method: "PUT",
        headers: {
          AccessKey: storageKey,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: buffer,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        console.log("[UPLOAD] Upload timeout after 30 seconds");
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

    console.log("[UPLOAD] BunnyCDN response status:", response.status);

    // const mainUploadDuration = Date.now() - mainUploadStartTime; // Not currently used

    if (!response.ok) {
      const errText = await response.text();
      console.log("[UPLOAD] Upload failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errText,
      });
      return NextResponse.json(
        { error: "Upload failed", status: response.status, details: errText },
        { status: response.status }
      );
    }

    console.log("[UPLOAD] Upload successful");

    // Public URL - ensure no double slashes
    const cleanCdnUrl = cdnUrl; // Remove trailing slash if present
    const publicUrl = `${cleanCdnUrl}/${uploadPath}`;

    // const totalDuration = Date.now() - startTime; // Not currently used

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: baseFileName,
      originalFileName: file.name,
      fileSize: buffer.length,
      uploadPath,
      backupUrl,
      backupFileName,
    });
  } catch (err) {
    console.error("[UPLOAD] Server error:", err);
    return NextResponse.json(
      { error: "Server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
