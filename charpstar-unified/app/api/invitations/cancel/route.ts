import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

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
        { error: "Only clients can cancel invitations" },
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

    // Parse request body
    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Verify the invitation belongs to this client and is pending
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("client_name", clientName)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invitations can be cancelled" },
        { status: 400 }
      );
    }

    // Update invitation status to cancelled
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("Error cancelling invitation:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel invitation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully",
    });
  } catch (error) {
    console.error("Error in cancel invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
