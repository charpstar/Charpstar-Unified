import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { logActivityServer } from "@/lib/serverActivityLogger";

/**
 * API endpoint to cancel/revoke a share invitation
 * Requires authentication and ownership validation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: invitationId } = await params;

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Fetch invitation to verify ownership
    const { data: invitation, error: fetchError } = await supabaseAuth
      .from("asset_share_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("created_by", user.id)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        {
          error:
            "Invitation not found or you don't have permission to cancel it",
        },
        { status: 404 }
      );
    }

    // Check if already cancelled or completed
    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { error: "This invitation has already been cancelled" },
        { status: 400 }
      );
    }

    if (invitation.status === "completed") {
      return NextResponse.json(
        { error: "Cannot cancel a completed review" },
        { status: 400 }
      );
    }

    // Update invitation status to cancelled
    const { error: updateError } = await supabaseAuth
      .from("asset_share_invitations")
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

    // Log activity
    try {
      await logActivityServer({
        action: "asset_share_invitation_cancelled",
        description: `Cancelled share invitation for ${invitation.recipient_email}`,
        type: "update",
        resource_type: "asset",
        metadata: {
          invitationId: invitation.id,
          recipientEmail: invitation.recipient_email,
          assetCount: invitation.asset_ids?.length || 0,
        },
      });
    } catch (activityError) {
      console.error("Error logging activity:", activityError);
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully",
    });
  } catch (error) {
    console.error("Unexpected error in cancel share API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
