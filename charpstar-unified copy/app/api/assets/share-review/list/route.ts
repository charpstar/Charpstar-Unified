import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * API endpoint to list all share invitations created by the authenticated user
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for filtering and pagination
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabaseAuth
      .from("asset_share_invitations")
      .select("*", { count: "exact" })
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data: invitations, error, count } = await query;

    if (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json(
        { error: "Failed to fetch invitations" },
        { status: 500 }
      );
    }

    // Format response with additional computed fields
    const formattedInvitations = (invitations || []).map((invitation) => ({
      id: invitation.id,
      recipientEmail: invitation.recipient_email,
      recipientName: invitation.recipient_name,
      assetCount: invitation.asset_ids?.length || 0,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      viewedAt: invitation.viewed_at,
      completedAt: invitation.completed_at,
      message: invitation.message,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
      shareLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/shared-review/${invitation.token}`,
    }));

    return NextResponse.json({
      invitations: formattedInvitations,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Unexpected error in list shares API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
