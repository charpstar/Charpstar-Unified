import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notificationService } from "@/lib/notificationService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, approvedBy } = await request.json();
    const { id: pendingReplyId } = await params;

    if (!action || !approvedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the pending reply
    const { data: pendingReply, error: fetchError } = await supabaseAdmin
      .from("pending_replies")
      .select("*")
      .eq("id", pendingReplyId)
      .single();

    if (fetchError) {
      console.error("Error fetching pending reply:", fetchError);
      return NextResponse.json(
        { error: `Error fetching pending reply: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!pendingReply) {
      console.error("Pending reply not found:", pendingReplyId);
      return NextResponse.json(
        { error: "Pending reply not found" },
        { status: 404 }
      );
    }

    if (pendingReply.status !== "pending") {
      return NextResponse.json(
        { error: "Reply has already been processed" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Insert the reply as a regular comment
      let resolvedRevisionNumber = pendingReply.revision_number;
      if (typeof resolvedRevisionNumber !== "number") {
        const { data: assetRow } = await supabaseAdmin
          .from("onboarding_assets")
          .select("revision_count")
          .eq("id", pendingReply.asset_id)
          .single();
        resolvedRevisionNumber = assetRow?.revision_count ?? 0;
      }

      const { data: newComment, error: commentError } = await supabaseAdmin
        .from("asset_comments")
        .insert({
          asset_id: pendingReply.asset_id,
          comment: pendingReply.reply_text,
          parent_id: pendingReply.parent_comment_id,
          created_by: pendingReply.created_by,
          revision_number: resolvedRevisionNumber ?? 0,
        })
        .select(`*, profiles:created_by (title, role, email)`)
        .single();

      if (commentError) {
        console.error("Error creating comment:", commentError);
        return NextResponse.json(
          { error: "Failed to create comment" },
          { status: 500 }
        );
      }

      // Update pending reply status
      const { error: updateError } = await supabaseAdmin
        .from("pending_replies")
        .update({
          status: "approved",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("id", pendingReplyId);

      if (updateError) {
        console.error("Error updating pending reply:", updateError);
        return NextResponse.json(
          { error: "Failed to update pending reply" },
          { status: 500 }
        );
      }

      // Notify the QA user that their reply was approved
      try {
        await notificationService.sendReplyApprovedNotification({
          recipientId: pendingReply.created_by,
          recipientEmail: pendingReply.profiles?.email || "",
          assetId: pendingReply.asset_id,
          replyText: pendingReply.reply_text,
        });
      } catch (notificationError) {
        console.error(
          "Error sending approval notification:",
          notificationError
        );
      }

      // Notify the parent comment author about the new reply
      try {
        const parentAuthor = pendingReply.parent_comment?.created_by;
        if (parentAuthor && parentAuthor !== pendingReply.created_by) {
          const { data: parentProfile } = await supabaseAdmin
            .from("profiles")
            .select("id, email")
            .eq("id", parentAuthor)
            .single();

          if (parentProfile?.id) {
            await notificationService.sendCommentReplyNotification({
              recipientId: parentProfile.id,
              recipientEmail: parentProfile.email || "",
              assetId: pendingReply.asset_id,
              parentCommentId: pendingReply.parent_comment_id,
              replyPreview: pendingReply.reply_text,
            });
          }
        }
      } catch (notificationError) {
        console.error("Error sending reply notification:", notificationError);
      }

      return NextResponse.json({
        success: true,
        comment: newComment,
        message: "Reply approved and posted successfully",
      });
    } else if (action === "reject") {
      // Update pending reply status to rejected
      const { error: updateError } = await supabaseAdmin
        .from("pending_replies")
        .update({
          status: "rejected",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("id", pendingReplyId);

      if (updateError) {
        console.error("Error updating pending reply:", updateError);
        return NextResponse.json(
          { error: "Failed to update pending reply" },
          { status: 500 }
        );
      }

      // Notify the QA user that their reply was rejected
      try {
        await notificationService.sendReplyRejectedNotification({
          recipientId: pendingReply.created_by,
          recipientEmail: pendingReply.profiles?.email || "",
          assetId: pendingReply.asset_id,
          replyText: pendingReply.reply_text,
        });
      } catch (notificationError) {
        console.error(
          "Error sending rejection notification:",
          notificationError
        );
      }

      return NextResponse.json({
        success: true,
        message: "Reply rejected successfully",
      });
    }
  } catch (error) {
    console.error("Error in pending reply action API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
