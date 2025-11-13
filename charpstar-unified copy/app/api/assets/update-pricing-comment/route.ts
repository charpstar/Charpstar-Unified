import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { assetId, comment } = await req.json();

    if (!assetId) {
      return NextResponse.json(
        { error: "Missing required field: assetId" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("onboarding_assets")
      .update({
        pricing_comment: comment || null,
      })
      .eq("id", assetId);

    if (error) {
      console.error("Error updating pricing comment:", error);
      return NextResponse.json(
        { error: "Failed to update pricing comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in update-pricing-comment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
