import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function DELETE(request: NextRequest) {
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
      .select("article_id, client, glb_link")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Prevent deletion of current GLB file
    if (backupUrl === asset.glb_link) {
      return NextResponse.json(
        { error: "Cannot delete the current GLB file" },
        { status: 400 }
      );
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

    // Extract the file path from the backup URL
    // The URL format is: https://cdn.url/client/QC/backups/filename.glb
    // We need to extract: client/QC/backups/filename.glb
    const urlObj = new URL(backupUrl);
    const pathParts = urlObj.pathname.split("/").filter((p) => p);

    // Find the storage path (everything after the domain)
    // For custom structure: QC/backups/filename.glb
    // For default: client/QC/backups/filename.glb
    let storagePath: string;
    if (useCustomStructure) {
      // For custom structure, the path should be QC/backups/filename.glb
      const qcIndex = pathParts.indexOf("QC");
      if (qcIndex !== -1) {
        storagePath = pathParts.slice(qcIndex).join("/");
      } else {
        // Fallback: try to construct from backup URL
        const fileName = backupUrl.split("/").pop() || "";
        storagePath = `QC/backups/${fileName}`;
      }
    } else {
      // For default structure, find the client name and construct path
      const sanitizedClientName = asset.client.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = backupUrl.split("/").pop() || "";
      storagePath = `${sanitizedClientName}/QC/backups/${fileName}`;
    }

    const deleteStorageUrl = `https://se.storage.bunnycdn.com/${finalStorageZone}/${storagePath}`;

    // Delete the file from BunnyCDN
    const deleteResponse = await fetch(deleteStorageUrl, {
      method: "DELETE",
      headers: {
        AccessKey: customAccessKey,
      },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      // 404 means file doesn't exist, which is fine
      const errorText = await deleteResponse.text();
      console.error(
        "Failed to delete backup file:",
        deleteResponse.status,
        errorText
      );
      return NextResponse.json(
        {
          error: "Failed to delete backup file",
          status: deleteResponse.status,
          details: errorText,
        },
        { status: 500 }
      );
    }

    // Also delete from glb_upload_history if it exists
    try {
      const { error: historyError } = await supabase
        .from("glb_upload_history")
        .delete()
        .eq("asset_id", assetId)
        .eq("glb_url", backupUrl);

      if (historyError) {
        console.error("Error deleting from history:", historyError);
        // Don't fail the request if history deletion fails
      }
    } catch (historyErr) {
      console.error("Error deleting from history:", historyErr);
      // Don't fail the request if history deletion fails
    }

    return NextResponse.json({
      success: true,
      message: "Backup file deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting backup file:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
