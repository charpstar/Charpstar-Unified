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

    // Get BunnyCDN credentials
    const storageKey = process.env.BUNNYCDN_STORAGE_KEY;
    const storageZone = process.env.BUNNYCDN_STORAGE_ZONE;

    if (!storageKey || !storageZone) {
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

    // Generate BunnyCDN upload URL
    const uploadUrl = `https://storage.bunnycdn.com/${storageZone}/${storagePath}`;
    const cdnUrl = `https://maincdn.b-cdn.net/${storageZone}/${storagePath}`;

    // Generate signature for authentication (if needed)
    const signature = crypto
      .createHmac("sha256", storageKey)
      .update(storagePath)
      .digest("hex");

    return NextResponse.json({
      uploadUrl,
      cdnUrl,
      storagePath,
      signature,
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
