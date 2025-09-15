import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    const { assetId, parentCommentId, replyText, createdBy } =
      await request.json();

    console.log("Pending reply API called:", {
      assetId,
      parentCommentId,
      replyText: replyText?.substring(0, 50) + "...",
      createdBy,
    });

    if (!assetId || !parentCommentId || !replyText || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the asset exists
    const { data: assets, error: assetError } = await supabaseAdmin
      .from("onboarding_assets")
      .select("id")
      .eq("id", assetId);

    console.log("Asset query result:", { assets, assetError, assetId });

    if (assetError) {
      console.error("Asset query error:", assetError);
      return NextResponse.json(
        {
          error: `Asset query error: ${assetError.message}`,
        },
        { status: 500 }
      );
    }

    if (!assets || assets.length === 0) {
      console.error("Asset not found:", assetId);
      return NextResponse.json(
        {
          error: `Asset not found: ${assetId}`,
        },
        { status: 404 }
      );
    }

    console.log("Asset found:", assets[0]);

    // Insert pending reply
    const { data: pendingReply, error } = await supabaseAdmin
      .from("pending_replies")
      .insert({
        asset_id: assetId,
        parent_comment_id: parentCommentId,
        reply_text: replyText,
        created_by: createdBy,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating pending reply:", error);
      return NextResponse.json(
        { error: `Failed to create pending reply: ${error.message}` },
        { status: 500 }
      );
    }

    // Notify all admins about the pending reply
    try {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await notificationService.sendPendingReplyNotification({
            recipientId: admin.id,
            recipientEmail: admin.email || "",
            assetId: assetId,
            pendingReplyId: pendingReply.id,
            qaName:
              pendingReply.profiles?.name ||
              pendingReply.profiles?.email ||
              "QA User",
            replyPreview: replyText,
            parentCommentPreview: pendingReply.parent_comment?.comment || "",
          });
        }
      }
    } catch (notificationError) {
      console.error("Error sending admin notifications:", notificationError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({ pendingReply });
  } catch (error) {
    console.error("Error in pending replies API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    // First, let's try a simple query to see if the table exists and has data
    const { data: pendingReplies, error } = await supabaseAdmin
      .from("pending_replies")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending replies:", error);
      return NextResponse.json(
        { error: `Failed to fetch pending replies: ${error.message}` },
        { status: 500 }
      );
    }

    // If we have data, try to fetch the related data separately
    if (pendingReplies && pendingReplies.length > 0) {
      for (const reply of pendingReplies) {
        // Fetch profile data
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("title, role, email, name")
          .eq("id", reply.created_by)
          .single();

        // Fetch parent comment data
        const { data: parentComment } = await supabaseAdmin
          .from("asset_comments")
          .select("id, comment, created_by")
          .eq("id", reply.parent_comment_id)
          .single();

        // Fetch parent comment author profile
        let parentCommentProfile = null;
        if (parentComment) {
          const { data: parentProfile } = await supabaseAdmin
            .from("profiles")
            .select("title, role, email, name")
            .eq("id", parentComment.created_by)
            .single();
          parentCommentProfile = parentProfile;
        }

        // Fetch asset data
        const { data: asset } = await supabaseAdmin
          .from("onboarding_assets")
          .select("id, product_name, article_id")
          .eq("id", reply.asset_id)
          .single();

        // Attach the related data
        (reply as any).profiles = profile;
        (reply as any).parent_comment = parentComment
          ? {
              ...parentComment,
              profiles: parentCommentProfile,
            }
          : null;
        (reply as any).assets = asset;
      }
    }

    return NextResponse.json({ pendingReplies });
  } catch (error) {
    console.error("Error in pending replies GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
