import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { emailService } from "@/lib/emailService";

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

    // Get user profile to verify they're a client and specifically a client_admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client, client_role, email, title")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "client") {
      return NextResponse.json(
        { error: "Only clients can send invitations" },
        { status: 403 }
      );
    }

    // Only client_admin can invite members
    // Default to client_admin for backward compatibility if client_role is null
    const clientRole = profile.client_role || "client_admin";
    if (clientRole !== "client_admin") {
      return NextResponse.json(
        { error: "Only client admins can invite team members" },
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
    const { email, clientRole: inviteeClientRole } = body;

    // Always set role to "client" for invited members
    const role = "client";

    // Validate inviteeClientRole if provided (default to product_manager for safety)
    const validClientRole =
      inviteeClientRole === "client_admin" ||
      inviteeClientRole === "product_manager"
        ? inviteeClientRole
        : "product_manager"; // Default to product_manager for new invites

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, email, client")
      .eq("email", email)
      .single();

    if (existingUser) {
      // Check if they're already part of this client
      const existingClient = Array.isArray(existingUser.client)
        ? existingUser.client
        : [existingUser.client];

      if (existingClient.includes(clientName)) {
        return NextResponse.json(
          { error: "This user is already a member of your organization" },
          { status: 400 }
        );
      }
    }

    // Check if there's already a pending invitation for this email and client
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("email", email)
      .eq("client_name", clientName)
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 400 }
      );
    }

    // Generate invitation token and expiration date
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Generate signup link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const signupLink = `${baseUrl}/auth/signup?token=${invitationToken}`;

    // Insert invitation record
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase().trim(),
        client_name: clientName,
        role: role,
        client_role: validClientRole, // Store client sub-role
        invitation_token: invitationToken,
        invitation_link: signupLink,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting invitation:", insertError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Send invitation email
    try {
      const inviterName = profile.title
        ? `${profile.title}`
        : profile.email || "A team member";

      await emailService.sendTeamInvitation(
        {
          invitedEmail: email,
          clientName: clientName,
          role: role,
          signupLink: signupLink,
          inviterName: inviterName,
          expiresAt: expiresAt.toISOString(),
        },
        {
          from: "noreply@mail.charpstar.co",
          to: email,
          subject: `You're invited to join ${clientName} on CharpstAR`,
        }
      );
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
      // Don't fail the request if email fails - invitation is already created
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error("Error in send invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
