import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id: assetId } = await params;
    const { active } = await request.json();

    if (typeof active !== "boolean") {
      return NextResponse.json(
        { error: "Active must be a boolean" },
        { status: 400 }
      );
    }

    // Get the asset to check permissions
    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select("client")
      .eq("id", assetId)
      .single();

    if (assetError || !assetData) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check permissions: admin can edit any, client can edit their own
    const isAdmin = profile.role === "admin";
    const isOwner = Array.isArray(profile.client)
      ? profile.client.includes(assetData.client)
      : profile.client === assetData.client;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You don't have permission to edit this asset" },
        { status: 403 }
      );
    }

    // Update the asset
    const { data, error } = await supabase
      .from("assets")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", assetId)
      .select()
      .single();

    if (error) {
      console.error("Error updating asset active status:", error);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      asset: data,
      message: `Asset ${active ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling asset active status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
