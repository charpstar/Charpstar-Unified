import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint for comments on shared review assets
 * Access controlled by token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("asset_id");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Verify token and get invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("*")
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

    // Verify asset belongs to this invitation
    if (!invitation.asset_ids.includes(assetId)) {
      return NextResponse.json(
        { error: "Asset not found in this review" },
        { status: 404 }
      );
    }

    // Fetch comments for this asset
    // Show all comments (internal + external from this invitation)
    const { data: comments, error } = await supabaseAdmin
      .from("asset_comments")
      .select("*")
      .eq("asset_id", assetId)
      .not("comment", "like", "NOTE:%")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error("Error in GET /api/shared-reviews/[token]/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify token and get invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("*")
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

    // Check if invitation is cancelled or completed
    if (
      invitation.status === "cancelled" ||
      invitation.status === "completed"
    ) {
      return NextResponse.json(
        { error: "This invitation is no longer active" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { asset_id, comment, parent_id } = body;

    if (!asset_id || !comment) {
      return NextResponse.json(
        { error: "Asset ID and comment are required" },
        { status: 400 }
      );
    }

    // Verify asset belongs to this invitation
    if (!invitation.asset_ids.includes(asset_id)) {
      return NextResponse.json(
        { error: "Asset not found in this review" },
        { status: 404 }
      );
    }

    // Create comment for external reviewer
    // Use invitation creator as created_by (same as annotations)
    // Note: asset_comments table doesn't have metadata column, so we identify external reviews
    // by checking created_by matches invitation.created_by and asset_id is in invitation
    if (!invitation.created_by) {
      console.error("Invitation created_by is missing:", invitation);
      return NextResponse.json(
        { error: "Invalid invitation configuration" },
        { status: 500 }
      );
    }

    const commentData = {
      asset_id,
      comment: comment.trim(),
      parent_id: parent_id || null,
      created_by: invitation.created_by, // Use invitation creator (same as annotations)
      created_at: new Date().toISOString(),
      // Note: metadata column doesn't exist in asset_comments table
      // External reviewer info is identified by created_by + asset_id + timestamp
    };

    const { data, error } = await supabaseAdmin
      .from("asset_comments")
      .insert([commentData])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      console.error("Comment data:", commentData);
      return NextResponse.json(
        {
          error: `Failed to create comment: ${error.message || "Unknown error"}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/shared-reviews/[token]/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify token and get invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { id, comment } = body;

    if (!id || !comment) {
      return NextResponse.json(
        { error: "Comment ID and comment are required" },
        { status: 400 }
      );
    }

    // Check if comment belongs to this invitation
    // Verify by checking created_by matches and asset_id is in invitation
    const { data: existingComment, error: fetchError } = await supabaseAdmin
      .from("asset_comments")
      .select("asset_id, created_by, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify comment belongs to this invitation
    // Check: created_by matches invitation.created_by AND asset_id is in invitation.asset_ids
    if (
      existingComment.created_by !== invitation.created_by ||
      !invitation.asset_ids.includes(existingComment.asset_id)
    ) {
      return NextResponse.json(
        { error: "You can only edit comments from this review" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("asset_comments")
      .update({ comment: comment.trim() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating comment:", error);
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment: data });
  } catch (error) {
    console.error("Error in PUT /api/shared-reviews/[token]/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // Verify token and get invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      );
    }

    // Check if comment belongs to this invitation
    // Verify by checking created_by matches and asset_id is in invitation
    const { data: existingComment, error: fetchError } = await supabaseAdmin
      .from("asset_comments")
      .select("asset_id, created_by, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify comment belongs to this invitation
    // Check: created_by matches invitation.created_by AND asset_id is in invitation.asset_ids
    if (
      existingComment.created_by !== invitation.created_by ||
      !invitation.asset_ids.includes(existingComment.asset_id)
    ) {
      return NextResponse.json(
        { error: "You can only delete comments from this review" },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("asset_comments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting comment:", error);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in DELETE /api/shared-reviews/[token]/comments:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
