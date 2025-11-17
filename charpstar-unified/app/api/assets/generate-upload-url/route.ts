import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, assetId, clientName } = await request.json();

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

    // Sanitize file name and client name (same as upload-file route)
    const baseFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const sanitizedClientName = clientName
      ? clientName.replace(/[^a-zA-Z0-9._-]/g, "_")
      : "UnknownClient";

    // Check if client has custom BunnyCDN folder structure
    let useCustomStructure = false;
    let customStorageZone = storageZone;
    let customAccessKey = storageKey;
    if (clientName) {
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
          .eq("name", clientName)
          .single();

        if (
          clientData?.bunny_custom_structure &&
          clientData?.bunny_custom_url
        ) {
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
    }

    // Use custom or default storage zone
    const finalStorageZone = useCustomStructure
      ? customStorageZone
      : storageZone;

    // Skip verification for speed - let the actual upload fail if there's an issue
    // Storage zone validation was too slow (added ~5-10 seconds to every upload)

    // For reference images, fetch article_id to include in path
    let articleId = null;
    if (fileType === "reference") {
      try {
        const { data: assetData } = await supabase
          .from("onboarding_assets")
          .select("article_id")
          .eq("id", assetId)
          .single();

        if (assetData?.article_id) {
          articleId = assetData.article_id.toString().replace(/[^a-zA-Z0-9._-]/g, "_");
        }
      } catch (error) {
        console.error("Error fetching article_id for reference upload:", error);
        // Continue without article_id if fetch fails
      }
    }

    // Determine storage path based on file type
    let storagePath = "";
    if (useCustomStructure) {
      // Custom structure: No client name, just QC/file directly in custom storage zone
      if (fileType === "glb") {
        storagePath = `QC/${baseFileName}`;
      } else if (fileType === "reference") {
        // For custom structure, include article_id if available
        if (articleId) {
          storagePath = `${articleId}/reference/${baseFileName}`;
        } else {
          storagePath = `reference/${baseFileName}`;
        }
      } else {
        storagePath = `assets/${baseFileName}`;
      }
    } else {
      // Default structure: use client name as folder within maincdn
      if (fileType === "glb") {
        storagePath = `${sanitizedClientName}/QC/${baseFileName}`;
      } else if (fileType === "reference") {
        // Include article_id in path: client-name/article-id/reference/filename
        if (articleId) {
          storagePath = `${sanitizedClientName}/${articleId}/reference/${baseFileName}`;
        } else {
          // Fallback to old structure if article_id not available
          storagePath = `${sanitizedClientName}/reference/${baseFileName}`;
        }
      } else {
        storagePath = `${sanitizedClientName}/assets/${baseFileName}`;
      }
    }

    // Generate BunnyCDN upload URL (using final storage zone)
    const uploadUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${storagePath}`;
    // CDN URL: Never includes storage zone - Pull Zone handles the routing
    const cdnUrl = `${cdnBaseUrl}/${storagePath}`;

    return NextResponse.json({
      uploadUrl,
      cdnUrl,
      storagePath,
      accessKey: customAccessKey, // Use custom access key if available
      fileName: baseFileName,
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
