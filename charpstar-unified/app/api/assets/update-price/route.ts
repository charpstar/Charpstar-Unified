import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { assetId, pricingOptionId, price, qaTeamHandlesModel } =
      await request.json();

    if (!assetId || !pricingOptionId) {
      return NextResponse.json(
        { error: "assetId and pricingOptionId are required" },
        { status: 400 }
      );
    }

    // Update the asset with the new pricing information
    const updateData: {
      pricing_option_id: string;
      price: number;
      qa_team_handles_model?: boolean;
    } = {
      pricing_option_id: pricingOptionId,
      price: price,
    };

    // Set qa_team_handles_model flag if provided, or auto-detect from pricingOptionId
    if (qaTeamHandlesModel !== undefined) {
      updateData.qa_team_handles_model = qaTeamHandlesModel;
    } else if (pricingOptionId === "qa_team_handles_model") {
      updateData.qa_team_handles_model = true;
    }

    const { error } = await supabaseAdmin
      .from("onboarding_assets")
      .update(updateData)
      .eq("id", assetId);

    if (error) {
      console.error("Error updating asset price:", error);
      return NextResponse.json(
        { error: "Failed to update asset price" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in update-price API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
