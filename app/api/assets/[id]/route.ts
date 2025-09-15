import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Fetch the asset from the correct table with all fields
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Asset fetch error:", error);
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Parse JSON fields to arrays (same as in the main assets route)
    const parsedAsset = {
      ...data,
      materials: Array.isArray(data.materials)
        ? data.materials
        : JSON.parse(data.materials || "[]"),
      colors: Array.isArray(data.colors)
        ? data.colors
        : JSON.parse(data.colors || "[]"),
      tags: Array.isArray(data.tags)
        ? data.tags
        : JSON.parse(data.tags || "[]"),
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin (only admins can edit assets)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const assetData = await req.json();

    // Update the asset
    const { data, error } = await supabase
      .from("assets")
      .update({
        ...assetData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Asset update error:", error);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }

    // Parse JSON fields to arrays for response
    const parsedAsset = {
      ...data,
      materials: Array.isArray(data.materials)
        ? data.materials
        : JSON.parse(data.materials || "[]"),
      colors: Array.isArray(data.colors)
        ? data.colors
        : JSON.parse(data.colors || "[]"),
      tags: Array.isArray(data.tags)
        ? data.tags
        : JSON.parse(data.tags || "[]"),
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
