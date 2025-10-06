import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, assetId } = await request.json();

    if (!fileName || !fileType || !assetId) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileType, assetId" },
        { status: 400 }
      );
    }

    // Get BunnyCDN credentials (using same variables as existing upload system)
    const storageKey = process.env.BUNNY_STORAGE_KEY;
    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "maincdn";
    const cdnBaseUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

    if (!storageKey || !storageZone || !cdnBaseUrl) {
      return NextResponse.json(
        { error: "BunnyCDN configuration missing" },
        { status: 500 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const fileExtension = fileName.split(".").pop();
    const uniqueFileName = `${assetId}_${timestamp}_${randomString}.${fileExtension}`;

    // Determine storage path based on file type
    let storagePath = "";
    if (fileType === "glb") {
      storagePath = `assets/glb/${uniqueFileName}`;
    } else if (fileType === "reference") {
      storagePath = `assets/reference/${uniqueFileName}`;
    } else {
      storagePath = `assets/other/${uniqueFileName}`;
    }

    // Generate BunnyCDN upload URL (using same format as existing system)
    const uploadUrl = `https://se.storage.bunnycdn.com/${storageZone}/${storagePath}`;
    const cdnUrl = `${cdnBaseUrl}/${storagePath}`;

    return NextResponse.json({
      uploadUrl,
      cdnUrl,
      storagePath,
      accessKey: storageKey, // Include the access key for authentication
      fileName: uniqueFileName,
      expiresIn: 3600, // 1 hour
    });
  } catch (error: any) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
