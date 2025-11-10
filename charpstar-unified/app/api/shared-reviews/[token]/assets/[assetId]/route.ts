import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint to get a single asset for shared review
 * Access controlled by token
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; assetId: string }> }
) {
  try {
    const { token, assetId } = await params;

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

    // Check if invitation is cancelled
    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { error: "This invitation has been cancelled" },
        { status: 403 }
      );
    }

    // Verify asset belongs to this invitation
    if (!invitation.asset_ids.includes(assetId)) {
      return NextResponse.json(
        { error: "Asset not found in this review" },
        { status: 404 }
      );
    }

    // Fetch asset data
    const { data: asset, error: assetError } = await supabaseAdmin
      .from("onboarding_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Parse reference images
    let referenceImages: string[] = [];
    if (asset.reference) {
      if (Array.isArray(asset.reference)) {
        referenceImages = asset.reference;
      } else if (typeof asset.reference === "string") {
        if (asset.reference.includes("|||")) {
          referenceImages = asset.reference
            .split("|||")
            .map((ref: string) => ref.trim())
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

    // Filter to only show image files
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
    ];
    const imageUrls = referenceImages.filter((url) => {
      if (!url) return false;
      const lowerUrl = url.toLowerCase();
      return imageExtensions.some((ext) => lowerUrl.includes(ext));
    });

    // Get client viewer type
    let clientViewerType: string | null = null;
    if (asset.client) {
      const { data: clientData } = await supabaseAdmin
        .from("clients")
        .select("viewer_type")
        .eq("name", asset.client)
        .single();

      if (clientData) {
        clientViewerType = clientData.viewer_type;
      }
    }

    return NextResponse.json({
      asset: {
        ...asset,
        reference: imageUrls,
      },
      invitation: {
        recipientEmail: invitation.recipient_email,
        recipientName: invitation.recipient_name,
        message: invitation.message,
        expiresAt: invitation.expires_at,
        created_by: invitation.created_by,
        assetIds: invitation.asset_ids,
      },
      clientViewerType,
    });
  } catch (error) {
    console.error(
      "Error in GET /api/shared-reviews/[token]/assets/[assetId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
