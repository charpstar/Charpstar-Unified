import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    // Get all profiles to see what client names exist
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("email, client_name, client")
      .not("client_name", "is", null);

    if (profilesError) {
      return NextResponse.json(
        {
          error: "Failed to fetch profiles",
          details: profilesError.message,
        },
        { status: 500 }
      );
    }

    // Get all unique client names from onboarding_assets
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("onboarding_assets")
      .select("client")
      .not("client", "is", null);

    if (assetsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch assets",
          details: assetsError.message,
        },
        { status: 500 }
      );
    }

    // Get unique client names from assets
    const uniqueAssetClients = [...new Set(assets?.map((a) => a.client) || [])];

    return NextResponse.json({
      profiles: profiles,
      assetClients: uniqueAssetClients,
      message: "Debug info for client names",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
