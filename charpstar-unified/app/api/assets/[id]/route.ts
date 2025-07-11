import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { error: "Authentication error" },
        { status: 401 }
      );
    }

    if (!session) {
      console.error("No session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's profile to get their client and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("client, role")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    const assetId = params.id;
    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }

    // Fetch the asset by ID
    let query = supabase.from("assets").select("*").eq("id", assetId);

    // Only filter by client if user is not an admin
    if (profile?.role !== "admin" && profile?.client) {
      query = query.eq("client", profile.client);
    }
    const { data: asset, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("No rows")) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    // Parse materials, colors, tags as arrays
    const parsedAsset = {
      ...asset,
      materials: Array.isArray(asset.materials)
        ? asset.materials
        : JSON.parse(asset.materials || "[]"),
      colors: Array.isArray(asset.colors)
        ? asset.colors
        : JSON.parse(asset.colors || "[]"),
      tags: Array.isArray(asset.tags)
        ? asset.tags
        : JSON.parse(asset.tags || "[]"),
    };

    return NextResponse.json(parsedAsset);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
