import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, fileName, cdnUrl, storagePath, fileType, fileSize } =
      await request.json();

    if (!assetId || !fileName || !cdnUrl || !storagePath || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user profile to determine client
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("client, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const client = profile.client;

    // Update the asset with the new file URL
    const adminClient = createAdminClient();

    if (fileType === "glb") {
      // Update GLB link in onboarding_assets
      const { error: updateError } = await adminClient
        .from("onboarding_assets")
        .update({ glb_link: cdnUrl })
        .eq("id", assetId);

      if (updateError) {
        console.error("Error updating GLB link:", updateError);
        return NextResponse.json(
          { error: "Failed to update asset" },
          { status: 500 }
        );
      }
    } else if (fileType === "reference") {
      // Update reference images
      const { data: currentAsset, error: fetchError } = await adminClient
        .from("onboarding_assets")
        .select("reference")
        .eq("id", assetId)
        .single();

      if (fetchError) {
        console.error("Error fetching current asset:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch asset" },
          { status: 500 }
        );
      }

      const currentReferences = currentAsset?.reference || [];
      const updatedReferences = [...currentReferences, cdnUrl];

      const { error: updateError } = await adminClient
        .from("onboarding_assets")
        .update({ reference: updatedReferences })
        .eq("id", assetId);

      if (updateError) {
        console.error("Error updating reference images:", updateError);
        return NextResponse.json(
          { error: "Failed to update asset" },
          { status: 500 }
        );
      }
    }

    // Log activity
    const { error: logError } = await adminClient.from("activities").insert({
      user_id: user.id,
      action: "file_uploaded",
      description: `Large file uploaded: ${fileName} (${fileType})`,
      type: "create",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        cdn_url: cdnUrl,
        storage_path: storagePath,
        client: client,
      },
    });

    if (logError) {
      console.error("Error logging activity:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      cdnUrl,
      fileName,
      fileType,
    });
  } catch (error: any) {
    console.error("Error in upload-large-file API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
