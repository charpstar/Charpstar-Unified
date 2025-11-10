import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * API endpoint to validate PIN code for shared review access
 * No authentication required - access is controlled by token and PIN
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { pinCode } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!pinCode) {
      return NextResponse.json(
        { error: "PIN code is required" },
        { status: 400 }
      );
    }

    // Fetch invitation by token
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("id, pin_code, expires_at, status")
      .eq("token", token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: "This invitation link has expired" },
        { status: 410 }
      );
    }

    // Check if invitation is cancelled
    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { error: "This invitation has been cancelled" },
        { status: 403 }
      );
    }

    // Validate PIN code
    if (!invitation.pin_code) {
      // No PIN required for this invitation
      return NextResponse.json({ valid: true });
    }

    if (invitation.pin_code !== pinCode) {
      return NextResponse.json({ error: "Invalid PIN code" }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Unexpected error in PIN validation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
