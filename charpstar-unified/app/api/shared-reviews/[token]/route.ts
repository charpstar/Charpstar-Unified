import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint to get shared assets for review
 * No authentication required - access is controlled by token
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
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
      // Update status to expired if not already
      if (invitation.status !== "expired") {
        await supabaseAdmin
          .from("asset_share_invitations")
          .update({ status: "expired", updated_at: now.toISOString() })
          .eq("id", invitation.id);
      }
      return NextResponse.json(
        { error: "This invitation link has expired" },
        { status: 410 } // 410 Gone
      );
    }

    // Check if invitation is cancelled
    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { error: "This invitation has been cancelled" },
        { status: 403 }
      );
    }

    // Update viewed_at on first access if not already set
    const isFirstView = !invitation.viewed_at;
    if (isFirstView) {
      await supabaseAdmin
        .from("asset_share_invitations")
        .update({
          viewed_at: now.toISOString(),
          status:
            invitation.status === "pending" ? "viewed" : invitation.status,
          updated_at: now.toISOString(),
        })
        .eq("id", invitation.id);
    }

    // Fetch creator information
    let creatorName = "Unknown";
    let creatorEmail = "Unknown";
    try {
      const { data: creator, error: creatorError } =
        await supabaseAdmin.auth.admin.getUserById(invitation.created_by);

      if (!creatorError && creator?.user) {
        creatorName =
          creator.user.user_metadata?.name ||
          creator.user.email?.split("@")[0] ||
          "Unknown";
        creatorEmail = creator.user.email || "Unknown";
      }
    } catch (error) {
      console.error("Error fetching creator info:", error);
      // Continue with default values
    }

    // Fetch assets from onboarding_assets table
    if (!invitation.asset_ids || invitation.asset_ids.length === 0) {
      return NextResponse.json(
        {
          invitation: {
            id: invitation.id,
            recipientName: invitation.recipient_name || null,
            recipientEmail: invitation.recipient_email,
            message: invitation.message || null,
            expiresAt: invitation.expires_at,
            status: invitation.status,
            createdBy: {
              name: creatorName,
              email: creatorEmail,
            },
          },
          assets: [],
          responses: [],
        },
        { status: 200 }
      );
    }

    // Fetch assets
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("onboarding_assets")
      .select(
        "id, product_name, article_id, status, glb_link, reference, preview_images, product_link"
      )
      .in("id", invitation.asset_ids);

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch assets" },
        { status: 500 }
      );
    }

    // Format assets for response
    const formattedAssets = (assets || []).map((asset) => {
      // Parse reference images - handle both array and string formats
      let referenceImages: string[] = [];
      if (asset.reference) {
        if (Array.isArray(asset.reference)) {
          referenceImages = asset.reference;
        } else if (typeof asset.reference === "string") {
          // Check if it's a pipe-separated string
          if (asset.reference.includes("|||")) {
            referenceImages = asset.reference
              .split("|||")
              .map((ref) => ref.trim())
              .filter(Boolean);
          } else {
            try {
              referenceImages = JSON.parse(asset.reference);
            } catch {
              referenceImages = [asset.reference];
            }
          }
        }
      }

      // Get preview image (first image from preview_images array or null)
      let previewImage: string | null = null;
      if (asset.preview_images) {
        if (Array.isArray(asset.preview_images)) {
          previewImage = asset.preview_images[0] || null;
        } else if (typeof asset.preview_images === "string") {
          try {
            const parsed = JSON.parse(asset.preview_images);
            previewImage = Array.isArray(parsed) ? parsed[0] : parsed;
          } catch {
            previewImage = asset.preview_images;
          }
        }
      }

      return {
        id: asset.id,
        productName: asset.product_name,
        articleId: asset.article_id,
        status: asset.status,
        glbLink: asset.glb_link || null,
        reference: referenceImages,
        previewImage: previewImage,
        productLink: asset.product_link || null,
      };
    });

    // Fetch existing responses
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from("asset_share_responses")
      .select("asset_id, action, comment")
      .eq("invitation_id", invitation.id);

    if (responsesError) {
      console.error("Error fetching responses:", responsesError);
      // Continue without responses - not critical
    }

    const formattedResponses = (responses || []).map((response) => ({
      assetId: response.asset_id,
      action: response.action === "approve" ? "approve" : "revision",
      comment: response.comment || null,
    }));

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        recipientName: invitation.recipient_name || null,
        recipientEmail: invitation.recipient_email,
        message: invitation.message || null,
        expiresAt: invitation.expires_at,
        status: invitation.status,
        createdBy: {
          name: creatorName,
          email: creatorEmail,
        },
      },
      assets: formattedAssets,
      responses: formattedResponses,
    });
  } catch (error) {
    console.error("Unexpected error in shared-reviews API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
