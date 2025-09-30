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
  const startTime = Date.now();

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

    if (!storageKey || !storageZone || !cdnUrl) {
      return NextResponse.json(
        { error: "Missing BunnyCDN config" },
        { status: 500 }
      );
    }

    // Create folder structure for the client
    await createClientFolderStructure(storageKey, storageZone, finalClientName);

    // Convert File → Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

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
    const checkStartTime = Date.now();
    const existingFileResponse = await fetch(originalUrl, {
      method: "GET",
      headers: {
        AccessKey: storageKey,
      },
    });

    const checkDuration = Date.now() - checkStartTime;

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
      const backupStartTime = Date.now();
      const backupUploadResponse = await fetch(backupStorageUrl, {
        method: "PUT",
        headers: {
          AccessKey: storageKey,
          "Content-Type": "application/octet-stream",
        },
        body: existingFileBuffer,
      });

      const backupDuration = Date.now() - backupStartTime;

      if (backupUploadResponse.ok) {
        // Construct public backup URL
        const cleanCdnUrl = cdnUrl;
        backupUrl = `${cleanCdnUrl}/${backupPath}`;
      } else {
        const errorText = await backupUploadResponse.text();
      }
    }

    // Upload new file to original location
    const uploadPath = originalPath;
    const url = originalUrl;

    // Upload to Bunny
    const mainUploadStartTime = Date.now();
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: storageKey,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: buffer,
    });

    const mainUploadDuration = Date.now() - mainUploadStartTime;

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: "Upload failed", status: response.status, details: errText },
        { status: response.status }
      );
    }

    // Public URL - ensure no double slashes
    const cleanCdnUrl = cdnUrl; // Remove trailing slash if present
    const publicUrl = `${cleanCdnUrl}/${uploadPath}`;

    const totalDuration = Date.now() - startTime;

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
    return NextResponse.json(
      { error: "Server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
