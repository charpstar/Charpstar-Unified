import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { asset_id, reference_url } = await request.json();

    if (!asset_id || !reference_url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the current asset to check existing references
    const { data: currentAsset, error: fetchError } = await supabase
      .from("onboarding_assets")
      .select("reference")
      .eq("id", asset_id)
      .single();

    if (fetchError) {
      console.error("Error fetching current asset:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    // Parse existing references
    let existingReferences: string[] = [];
    if (currentAsset.reference) {
      try {
        existingReferences = Array.isArray(currentAsset.reference)
          ? currentAsset.reference
          : JSON.parse(currentAsset.reference);
      } catch {
        existingReferences = [currentAsset.reference];
      }
    }

    // Add new reference
    const newReferences = [...existingReferences, reference_url];

    // Update the asset
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({ reference: newReferences })
      .eq("id", asset_id);

    if (updateError) {
      console.error("Error updating asset:", updateError);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in add-reference API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error)?.message || String(error),
      },
      { status: 500 }
    );
  }
}
