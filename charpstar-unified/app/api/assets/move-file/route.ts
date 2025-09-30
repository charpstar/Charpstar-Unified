import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, fileId, newStatus } = await request.json();

    if (!assetId || !fileId || !newStatus) {
      return NextResponse.json(
        { error: "Asset ID, file ID, and new status are required" },
        { status: 400 }
      );
    }

    // Get asset details first
    const { data: assetData, error: assetError } = await supabase
      .from("onboarding_assets")
      .select("article_id, client")
      .eq("id", assetId)
      .single();

    if (assetError || !assetData) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Get client's BunnyCDN configuration
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("company, bunny_custom_structure, bunny_custom_url")
      .eq("name", assetData.client)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        {
          error:
            "Client not found or not configured for BunnyCDN. Please ensure the client exists and has a company name set.",
        },
        { status: 404 }
      );
    }

    // Combine asset and client data
    const asset = {
      ...assetData,
      clients: clientData,
    };

    if (!asset.clients || !(asset.clients as any).company) {
      return NextResponse.json(
        {
          error:
            "Client company name is required for folder generation. Please ensure the client has a company name set.",
        },
        { status: 400 }
      );
    }

    // Get file details
    const { data: fileData, error: fileError } = await supabase
      .from("asset_files")
      .select("file_path, file_url, file_type")
      .eq("id", fileId)
      .eq("asset_id", assetId)
      .single();

    if (fileError || !fileData) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const clientFolder = (asset.clients as any).company
      .toLowerCase()
      .replace(/\s+/g, "-");
    const articleId = asset.article_id;
    const currentPath = fileData.file_path;
    const fileName = currentPath.split("/").pop();

    // Determine new folder based on status
    let newFolder: string;
    switch (newStatus) {
      case "approved":
      case "completed":
        newFolder = "Android";
        break;
      case "revisions":
      case "client_revision":
        newFolder = "QC";
        break;
      default:
        newFolder = "QC";
    }

    // Construct new path
    const newPath = `${clientFolder}/${newFolder}/${articleId}/${fileName}`;

    // BunnyCDN configuration
    const bunnyApiKey = process.env.BUNNY_API_KEY;
    const bunnyStorageKey = process.env.BUNNY_STORAGE_KEY;
    const bunnyStorageZone = process.env.BUNNY_STORAGE_ZONE_NAME; // Remove trailing slash
    const bunnyCdnUrl = process.env.BUNNY_STORAGE_PUBLIC_URL;

    // Use storage key for storage operations, API key for management operations
    const authKey = bunnyStorageKey || bunnyApiKey;

    if (!authKey || !bunnyStorageZone || !bunnyCdnUrl) {
      return NextResponse.json(
        {
          error:
            "BunnyCDN configuration missing - need either API key or storage key",
        },
        { status: 500 }
      );
    }

    // Determine CDN URL based on client configuration
    const clientConfig = asset.clients as any;
    const isCustomStructure = clientConfig.bunny_custom_structure;
    const customUrl = clientConfig.bunny_custom_url;
    const finalCdnUrl =
      isCustomStructure && customUrl ? customUrl : bunnyCdnUrl;

    // Download file from current location
    const downloadUrl = `https://storage.bunnycdn.com/${bunnyStorageZone}/${currentPath}`;
    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        AccessKey: authKey,
      },
    });

    if (!downloadResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download file from current location" },
        { status: 500 }
      );
    }

    const fileBuffer = await downloadResponse.arrayBuffer();

    // Upload to new location
    const uploadUrl = `https://storage.bunnycdn.com/${bunnyStorageZone}/${newPath}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: authKey,
        "Content-Type": fileData.file_type || "application/octet-stream",
        "Cache-Control": "3600",
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return NextResponse.json(
        {
          error: "Failed to upload file to new location",
          details: errorText,
        },
        { status: 500 }
      );
    }

    // Delete file from old location
    const deleteResponse = await fetch(downloadUrl, {
      method: "DELETE",
      headers: {
        AccessKey: authKey,
      },
    });

    if (!deleteResponse.ok) {
      console.warn(
        "Failed to delete file from old location, but upload succeeded"
      );
    }

    // Update file record in database
    const newPublicUrl = `${finalCdnUrl}/${newPath}`;
    const { error: updateError } = await supabase
      .from("asset_files")
      .update({
        file_path: newPath,
        file_url: newPublicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    if (updateError) {
      console.error("Error updating file record:", updateError);
      return NextResponse.json(
        { error: "File moved but database update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newPath,
      newUrl: newPublicUrl,
      message: `File moved to ${newFolder} folder`,
    });
  } catch (error) {
    console.error("Error in file move API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error)?.message || String(error),
      },
      { status: 500 }
    );
  }
}
