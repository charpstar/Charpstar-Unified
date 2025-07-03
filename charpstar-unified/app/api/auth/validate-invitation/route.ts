import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    console.log("Validating invitation token:", token);

    // Find the invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("invitation_token", token)
      .single();

    if (fetchError || !invitation) {
      console.error("Invitation not found:", fetchError);
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    console.log("Found invitation:", invitation);

    // Check if invitation is still pending
    if (invitation.status !== "pending") {
      console.error("Invitation status is not pending:", invitation.status);
      return NextResponse.json(
        { error: "Invitation is no longer valid" },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      console.error("Invitation has expired:", invitation.expires_at);

      // Update invitation status to expired
      await supabase
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    console.log("Invitation is valid:", {
      id: invitation.id,
      email: invitation.email,
      client_name: invitation.client_name,
      role: invitation.role,
      expires_at: invitation.expires_at,
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        client_name: invitation.client_name,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Error in validate invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
