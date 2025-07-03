import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function GET() {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all invitations
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*")
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json(
        { error: "Failed to fetch invitations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (error) {
    console.error("Error in invitations GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("=== INVITATION API CALLED ===");
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    console.log("✅ Server client created");

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, client_name, role, onboarding = true } = body;

    // Validate required fields
    if (!email || !client_name || !role) {
      return NextResponse.json(
        { error: "Email, client name, and role are required" },
        { status: 400 }
      );
    }

    // Check if invitation already exists for this email
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("email", email)
      .single();

    if (existingInvitation && existingInvitation.status === "pending") {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation record
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        email,
        client_name,
        role,
        onboarding,
        status: "pending",
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        invitation_token: invitationToken,
        invitation_link: `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://charpstar-unified.vercel.app" : "http://localhost:3000")}/auth/signup?token=${invitationToken}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invitation:", insertError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Send invitation using Supabase Auth
    try {
      console.log("Attempting to send Supabase invitation to:", email);
      console.log("Invitation data:", {
        client_name,
        role,
        invitation_id: invitation.id,
      });

      const adminClient = createAdminClient();
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://charpstar-unified.vercel.app" : "http://localhost:3000")}/auth/signup?token=${invitationToken}`,
          data: {
            client_name: client_name,
            role: role,
            invitation_id: invitation.id,
          },
        });

      if (inviteError) {
        console.error("Error sending Supabase invitation:", inviteError);
        console.error("Error details:", {
          code: inviteError.code,
          message: inviteError.message,
          status: inviteError.status,
        });
        // Update invitation status to failed
        await supabase
          .from("invitations")
          .update({ status: "failed" })
          .eq("id", invitation.id);
      } else {
        console.log("Supabase invitation sent successfully:", inviteData);
        console.log("Invitation response:", {
          user: inviteData.user,
          userEmail: inviteData.user?.email,
        });
      }
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
      console.error("Full error object:", JSON.stringify(emailError, null, 2));
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({
      invitation,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Error in invitations POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Check if invitation exists and get its status
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("id, status, email")
      .eq("id", invitationId)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Don't allow deletion of accepted invitations
    if (invitation.status === "accepted") {
      return NextResponse.json(
        { error: "Cannot delete accepted invitations" },
        { status: 400 }
      );
    }

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId);

    if (deleteError) {
      console.error("Error deleting invitation:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete invitation" },
        { status: 500 }
      );
    }

    console.log(
      `Invitation ${invitationId} for ${invitation.email} deleted successfully`
    );

    return NextResponse.json({
      success: true,
      message: "Invitation deleted successfully",
    });
  } catch (error) {
    console.error("Error in invitations DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
