import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
//eslint-disable-next-line @typescript-eslint/no-unused-vars
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logActivityServer } from "@/lib/serverActivityLogger";

/**
 * API endpoint to create a share invitation for assets
 * Requires authentication and client role
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      recipientEmail,
      recipientName,
      assetIds,
      message,
      expiresInDays = 30,
    } = body;

    // Validate required fields
    if (
      !recipientEmail ||
      !assetIds ||
      !Array.isArray(assetIds) ||
      assetIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: recipientEmail, assetIds (non-empty array)",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate expiration days (1-90 days)
    if (expiresInDays < 1 || expiresInDays > 90) {
      return NextResponse.json(
        { error: "Expiration days must be between 1 and 90" },
        { status: 400 }
      );
    }

    // Get user's role and client from profiles table
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role, client")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Only clients can share assets for review
    if (profile?.role !== "client") {
      return NextResponse.json(
        { error: "Only clients can share assets for review" },
        { status: 403 }
      );
    }

    // Get user's client(s) - handle both array and single value
    const userClients = Array.isArray(profile.client)
      ? profile.client
      : profile.client
        ? [profile.client]
        : [];

    if (userClients.length === 0) {
      return NextResponse.json(
        { error: "User must be associated with a client" },
        { status: 400 }
      );
    }

    // Validate that all assets belong to user's client(s)
    const { data: assets, error: assetsError } = await supabaseAuth
      .from("onboarding_assets")
      .select("id, client, product_name")
      .in("id", assetIds);

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }

    if (!assets || assets.length !== assetIds.length) {
      return NextResponse.json(
        { error: "Some assets could not be found" },
        { status: 404 }
      );
    }

    // Check that all assets belong to user's client(s)
    const invalidAssets = assets.filter(
      (asset) => !userClients.includes(asset.client)
    );

    if (invalidAssets.length > 0) {
      return NextResponse.json(
        {
          error: `You don't have permission to share ${invalidAssets.length} asset(s). They belong to a different client.`,
        },
        { status: 403 }
      );
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Generate 4-digit PIN code
    const pinCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Get base URL for share link - hardcoded to localhost for testing
    const baseUrl = "http://localhost:3000";
    const shareLink = `${baseUrl}/shared-review/${token}`;

    // Create invitation record
    const { data: invitation, error: insertError } = await supabaseAuth
      .from("asset_share_invitations")
      .insert({
        created_by: user.id,
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        token: token,
        asset_ids: assetIds,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        message: message || null,
        pin_code: pinCode,
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

    // Get sharer information for email
    const sharerName =
      user.user_metadata?.name || user.email?.split("@")[0] || "A team member";
    const sharerEmail = user.email || "unknown";

    // Send invitation email
    try {
      console.log(
        "[share-review] Attempting to send email to:",
        recipientEmail
      );

      // Import Resend directly to avoid HTTP routing issues
      const { Resend } = await import("resend");
      const AssetShareInvitationEmail = (
        await import("@/components/emails/AssetShareInvitationEmail")
      ).default;

      if (!process.env.RESEND_API_KEY) {
        console.error("[share-review] RESEND_API_KEY not configured");
      } else {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const subject = `${sharerName} has requested your review of ${assetIds.length} ${assetIds.length === 1 ? "model" : "models"}`;
        const from = process.env.EMAIL_FROM || "noreply@mail.charpstar.co";

        const { data, error } = await resend.emails.send({
          from,
          to: [recipientEmail],
          subject,
          react: AssetShareInvitationEmail({
            recipientName: recipientName || recipientEmail.split("@")[0],
            sharerName: sharerName,
            sharerEmail: sharerEmail,
            assetCount: assetIds.length,
            shareLink: shareLink,
            expiresAt: expiresAt.toISOString(),
            message: message || null,
            pinCode: pinCode,
          }),
        });

        if (error) {
          console.error("[share-review] Email send failed:", {
            error: (error as any)?.message || String(error),
          });
        } else {
          console.log("[share-review] Email sent successfully:", {
            messageId: data?.id,
            provider: "resend-sdk",
          });
        }
      }
    } catch (emailError: any) {
      console.error("[share-review] Email send exception:", {
        error: emailError?.message || String(emailError),
        stack: emailError?.stack,
      });
      // Don't fail the request if email fails
    }

    // Log activity
    try {
      await logActivityServer({
        action: "asset_share_invitation_created",
        description: `Shared ${assetIds.length} asset(s) for external review with ${recipientEmail}`,
        type: "share",
        resource_type: "asset",
        metadata: {
          invitationId: invitation.id,
          recipientEmail: recipientEmail,
          recipientName: recipientName || null,
          assetCount: assetIds.length,
          assetIds: assetIds,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (activityError) {
      console.error("Error logging activity:", activityError);
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({
      success: true,
      invitationId: invitation.id,
      shareLink: shareLink,
      expiresAt: expiresAt.toISOString(),
      message: "Invitation created successfully",
    });
  } catch (error) {
    console.error("Unexpected error in share-review API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
