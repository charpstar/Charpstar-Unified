import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint for annotations on shared review assets
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

    // Fetch annotations for this asset
    // Filter to only show annotations from this invitation (external reviewers)
    // Identify external reviewer annotations by created_by matching invitation.created_by
    const { data: annotations, error } = await supabaseAdmin
      .from("asset_annotations")
      .select("*")
      .eq("asset_id", assetId)
      .eq("created_by", invitation.created_by) // Only get annotations from this invitation
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching annotations:", error);
      return NextResponse.json(
        { error: "Failed to fetch annotations" },
        { status: 500 }
      );
    }

    // Filter to ensure asset_id is in invitation (additional safety check)
    const filteredAnnotations = (annotations || []).filter((ann) =>
      invitation.asset_ids.includes(ann.asset_id)
    );

    return NextResponse.json({ annotations: filteredAnnotations });
  } catch (error) {
    console.error(
      "Error in GET /api/shared-reviews/[token]/annotations:",
      error
    );
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
    const {
      asset_id,
      position,
      normal,
      surface,
      comment,
      image_url,
      parent_id,
    } = body;

    // For replies (when parent_id is provided) we don't require position/normal
    if (!asset_id || (!parent_id && (!position || !normal))) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // If this is a reply and position/normal are not provided, copy from parent
    let effectivePosition: string | null = position || null;
    let effectiveNormal: string | null = normal || null;
    let effectiveSurface: string | null = surface || null;

    if (parent_id) {
      if (!effectivePosition || !effectiveNormal) {
        const { data: parent, error: parentError } = await supabaseAdmin
          .from("asset_annotations")
          .select("asset_id, position, normal, surface")
          .eq("id", parent_id)
          .single();
        if (parentError || !parent) {
          return NextResponse.json(
            { error: "Invalid parent annotation" },
            { status: 400 }
          );
        }
        if (parent.asset_id !== asset_id) {
          return NextResponse.json(
            { error: "Parent annotation does not match asset" },
            { status: 400 }
          );
        }
        effectivePosition = effectivePosition || parent.position;
        effectiveNormal = effectiveNormal || parent.normal;
        effectiveSurface = effectiveSurface || parent.surface || null;
      }
    }

    // Create annotation for external reviewer
    // Use invitation creator as created_by (same as comments)
    // Note: asset_annotations table may not have metadata column, so we identify external reviews
    // by checking created_by matches invitation.created_by and asset_id is in invitation
    if (!invitation.created_by) {
      console.error("Invitation created_by is missing:", invitation);
      return NextResponse.json(
        { error: "Invalid invitation configuration" },
        { status: 500 }
      );
    }

    const annotationData = {
      asset_id,
      position: effectivePosition,
      normal: effectiveNormal,
      surface: effectiveSurface,
      comment,
      image_url: image_url || null,
      parent_id: parent_id || null,
      created_by: invitation.created_by, // Use invitation creator (same as comments)
      created_at: new Date().toISOString(),
      // Note: metadata column may not exist in asset_annotations table
      // External reviewer info is identified by created_by + asset_id + timestamp
    };

    const { data, error } = await supabaseAdmin
      .from("asset_annotations")
      .insert([annotationData])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating annotation:", error);
      console.error("Annotation data:", annotationData);
      return NextResponse.json(
        {
          error: `Failed to create annotation: ${error.message || "Unknown error"}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotation: data }, { status: 201 });
  } catch (error) {
    console.error(
      "Error in POST /api/shared-reviews/[token]/annotations:",
      error
    );
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
    const { id, comment, image_url } = body;

    if (!id || !comment) {
      return NextResponse.json(
        { error: "Annotation ID and comment are required" },
        { status: 400 }
      );
    }

    // Check if annotation belongs to this invitation
    // Verify by checking created_by matches and asset_id is in invitation
    const { data: existingAnnotation, error: fetchError } = await supabaseAdmin
      .from("asset_annotations")
      .select("asset_id, created_by, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !existingAnnotation) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    // Verify annotation belongs to this invitation
    // Check: created_by matches invitation.created_by AND asset_id is in invitation.asset_ids
    if (
      existingAnnotation.created_by !== invitation.created_by ||
      !invitation.asset_ids.includes(existingAnnotation.asset_id)
    ) {
      return NextResponse.json(
        { error: "You can only edit annotations from this review" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("asset_annotations")
      .update({ comment, image_url: image_url || null })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating annotation:", error);
      return NextResponse.json(
        { error: "Failed to update annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotation: data });
  } catch (error) {
    console.error(
      "Error in PUT /api/shared-reviews/[token]/annotations:",
      error
    );
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
        { error: "Annotation ID is required" },
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

    // Check if annotation belongs to this invitation
    // Verify by checking created_by matches and asset_id is in invitation
    const { data: existingAnnotation, error: fetchError } = await supabaseAdmin
      .from("asset_annotations")
      .select("asset_id, created_by, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !existingAnnotation) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    // Verify annotation belongs to this invitation
    // Check: created_by matches invitation.created_by AND asset_id is in invitation.asset_ids
    if (
      existingAnnotation.created_by !== invitation.created_by ||
      !invitation.asset_ids.includes(existingAnnotation.asset_id)
    ) {
      return NextResponse.json(
        { error: "You can only delete annotations from this review" },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("asset_annotations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting annotation:", error);
      return NextResponse.json(
        { error: "Failed to delete annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Error in DELETE /api/shared-reviews/[token]/annotations:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
