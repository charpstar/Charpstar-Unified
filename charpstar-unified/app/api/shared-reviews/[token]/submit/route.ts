import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint to submit review responses for shared assets
 * No authentication required - access is controlled by token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { responses } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: "Responses array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate response format
    for (const response of responses) {
      if (!response.assetId) {
        return NextResponse.json(
          { error: "Each response must have an assetId" },
          { status: 400 }
        );
      }
      if (
        !response.action ||
        !["approve", "revision"].includes(response.action)
      ) {
        return NextResponse.json(
          {
            error:
              "Each response must have an action of 'approve' or 'revision'",
          },
          { status: 400 }
        );
      }
    }

    // Fetch invitation by token
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("asset_share_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation fetch error:", invitationError);
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (now > expiresAt) {
      if (invitation.status !== "expired") {
        await supabaseAdmin
          .from("asset_share_invitations")
          .update({ status: "expired", updated_at: now.toISOString() })
          .eq("id", invitation.id);
      }
      return NextResponse.json(
        { error: "This invitation link has expired" },
        { status: 410 }
      );
    }

    // Check if invitation is cancelled or already completed
    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { error: "This invitation has been cancelled" },
        { status: 403 }
      );
    }

    if (invitation.status === "completed") {
      return NextResponse.json(
        { error: "This review has already been completed" },
        { status: 403 }
      );
    }

    // Validate that all asset IDs in responses belong to this invitation
    const invitationAssetIds = invitation.asset_ids || [];
    const responseAssetIds = responses.map((r) => r.assetId);
    const invalidAssetIds = responseAssetIds.filter(
      (id) => !invitationAssetIds.includes(id)
    );

    if (invalidAssetIds.length > 0) {
      return NextResponse.json(
        {
          error: `Some asset IDs are not part of this invitation: ${invalidAssetIds.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch current asset statuses for logging
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("onboarding_assets")
      .select("id, status, product_name, revision_count")
      .in("id", responseAssetIds);

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }

    if (!assets || assets.length !== responseAssetIds.length) {
      return NextResponse.json(
        { error: "Some assets could not be found" },
        { status: 404 }
      );
    }

    // Create a map of asset data for quick lookup
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

    // Store responses in asset_share_responses table
    const responseRecords = responses.map((response) => ({
      invitation_id: invitation.id,
      asset_id: response.assetId,
      action: response.action,
      comment: response.comment || null,
    }));

    // Insert or update responses (handle upsert in case of re-submission)
    const { error: responsesInsertError } = await supabaseAdmin
      .from("asset_share_responses")
      .upsert(responseRecords, {
        onConflict: "invitation_id,asset_id",
      });

    if (responsesInsertError) {
      console.error("Error inserting responses:", responsesInsertError);
      return NextResponse.json(
        { error: "Failed to save review responses" },
        { status: 500 }
      );
    }

    // Update asset statuses and log activities
    const updatePromises = responses.map(async (response) => {
      const asset = assetMap.get(response.assetId);
      if (!asset) return;

      const previousStatus = asset.status;
      let newStatus: string;
      let revisionNumber = asset.revision_count || 0;

      if (response.action === "approve") {
        newStatus = "approved_by_client";
      } else {
        // revision
        newStatus = "client_revision";
        revisionNumber += 1;
      }

      // Update asset status
      const { error: updateError } = await supabaseAdmin
        .from("onboarding_assets")
        .update({
          status: newStatus,
          revision_count: revisionNumber,
          updated_at: now.toISOString(),
        })
        .eq("id", response.assetId);

      if (updateError) {
        console.error(`Error updating asset ${response.assetId}:`, updateError);
        return;
      }

      // Log status change to asset_status_history table
      try {
        const actionType =
          response.action === "approve"
            ? "client_approved"
            : "client_revision_requested";

        await supabaseAdmin.from("asset_status_history").insert({
          asset_id: response.assetId,
          previous_status: previousStatus,
          new_status: newStatus,
          action_type: actionType,
          revision_number: revisionNumber,
          revision_reason:
            response.action === "revision" ? response.comment || null : null,
          comments: response.comment || null,
          metadata: {
            externalReview: true,
            invitationId: invitation.id,
            reviewerEmail: invitation.recipient_email,
          },
          // User information will be set to invitation creator by trigger
          user_id: invitation.created_by,
        });
      } catch (logError) {
        console.error(
          `Error logging status change for asset ${response.assetId}:`,
          logError
        );
        // Don't fail the request if logging fails
      }

      // Log activity for external review (using supabaseAdmin directly since no user session)
      try {
        await supabaseAdmin.from("activity_log").insert({
          action: `External review: ${response.action === "approve" ? "Approved" : "Requested revision"}`,
          description: `Asset reviewed via shared invitation. ${response.comment ? `Comment: ${response.comment}` : ""}`,
          type: "update",
          resource_type: "asset",
          resource_id: response.assetId,
          user_id: invitation.created_by, // Attribute to invitation creator
          user_email: invitation.recipient_email, // Track external reviewer email
          metadata: {
            assetId: response.assetId,
            assetName: asset.product_name,
            previousStatus,
            newStatus,
            action: response.action,
            comment: response.comment || null,
            invitationId: invitation.id,
            externalReviewer: true,
            externalReviewerEmail: invitation.recipient_email,
          },
        });
      } catch (activityError) {
        console.error(
          `Error logging activity for asset ${response.assetId}:`,
          activityError
        );
        // Don't fail the request if activity logging fails
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Check if all assets in the invitation have been responded to
    const { data: allResponses, error: allResponsesError } = await supabaseAdmin
      .from("asset_share_responses")
      .select("asset_id")
      .eq("invitation_id", invitation.id);

    if (!allResponsesError && allResponses) {
      const respondedAssetIds = new Set(allResponses.map((r) => r.asset_id));
      const allAssetsResponded = invitationAssetIds.every((id: string) =>
        respondedAssetIds.has(id)
      );

      if (allAssetsResponded) {
        // Mark invitation as completed
        await supabaseAdmin
          .from("asset_share_invitations")
          .update({
            status: "completed",
            completed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", invitation.id);
      }
    }

    // TODO: Send notification to original sharer (Phase 7)
    // This will be implemented when we add notification system

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${responses.length} review response(s)`,
      completed: allResponses
        ? invitationAssetIds.every((id: string) =>
            allResponses.some((r) => r.asset_id === id)
          )
        : false,
    });
  } catch (error) {
    console.error("Unexpected error in shared-reviews submit API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
