import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to verify they're a client
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "client") {
      return NextResponse.json(
        { error: "Only clients can view invitations" },
        { status: 403 }
      );
    }

    // Extract client name from profile
    const clientName = Array.isArray(profile.client)
      ? profile.client[0]
      : profile.client;

    if (!clientName) {
      return NextResponse.json(
        { error: "Client name not found in profile" },
        { status: 400 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    // Build query
    let query = supabase
      .from("invitations")
      .select("*")
      .eq("client_name", clientName)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: invitations, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching invitations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch invitations" },
        { status: 500 }
      );
    }

    // Check for expired invitations and update their status
    const now = new Date();
    const expiredInvitations = invitations?.filter(
      (inv) => inv.status === "pending" && new Date(inv.expires_at) < now
    );

    if (expiredInvitations && expiredInvitations.length > 0) {
      const expiredIds = expiredInvitations.map((inv) => inv.id);
      await supabase
        .from("invitations")
        .update({ status: "expired" })
        .in("id", expiredIds);

      // Update the local data
      invitations?.forEach((inv) => {
        if (expiredIds.includes(inv.id)) {
          inv.status = "expired";
        }
      });
    }

    return NextResponse.json({
      invitations: invitations || [],
    });
  } catch (error) {
    console.error("Error in list invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
