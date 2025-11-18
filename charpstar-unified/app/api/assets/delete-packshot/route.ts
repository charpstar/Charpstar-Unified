import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { packshotId, assetId } = body;

    if (!packshotId || !assetId) {
      return NextResponse.json(
        { error: "packshotId and assetId are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Fetch the current asset
    const { data: currentAsset, error: fetchError } = await supabaseAdmin
      .from("assets")
      .select("packshot_renders")
      .eq("id", assetId)
      .single();

    if (fetchError) {
      console.error("Error fetching asset:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    if (
      !currentAsset.packshot_renders ||
      !Array.isArray(currentAsset.packshot_renders)
    ) {
      return NextResponse.json(
        { error: "No packshot renders found for this asset" },
        { status: 404 }
      );
    }

    // Filter out the packshot to delete
    const updatedPackshots = currentAsset.packshot_renders.filter(
      (packshot: any) => packshot.id !== packshotId
    );

    // Update the asset
    const { error: updateError } = await supabaseAdmin
      .from("assets")
      .update({
        packshot_renders: updatedPackshots,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating asset:", updateError);
      return NextResponse.json(
        { error: "Failed to delete packshot" },
        { status: 500 }
      );
    }

    console.log(`Packshot ${packshotId} deleted from asset ${assetId}`);

    return NextResponse.json({
      success: true,
      message: "Packshot deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete-packshot API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
