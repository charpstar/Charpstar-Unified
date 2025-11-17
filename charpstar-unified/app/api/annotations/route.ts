import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("asset_id");

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Get current user session and profile
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    let query = supabase
      .from("asset_annotations")
      .select(
        `
        *,
        profiles:created_by(title, email, role)
      `
      )
      .eq("asset_id", assetId);

    // Apply role-based filtering
    if (userProfile.role === "client") {
      // Clients can only see their own annotations and comments
      query = query.eq("created_by", session.user.id);
    }
    // QA, modelers, admin, and production can see all annotations (no additional filter needed)

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching annotations:", error);

      // If table doesn't exist yet, return empty array
      if (
        error.code === "PGRST200" ||
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json({ annotations: [] });
      }

      return NextResponse.json(
        { error: "Failed to fetch annotations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotations: data || [] });
  } catch (error) {
    console.error("Error in GET /api/annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      revision_number,
    } = body;

    // For replies (when parent_id is provided) we don't require position/normal
    if (!asset_id || (!parent_id && (!position || !normal))) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If this is a reply and position/normal are not provided, copy from parent
    let effectivePosition: string | null = position || null;
    let effectiveNormal: string | null = normal || null;
    let effectiveSurface: string | null = surface || null;

    let revisionNumber =
      typeof revision_number === "number" ? revision_number : null;

    if (parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("asset_annotations")
        .select("asset_id, position, normal, surface, revision_number")
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
      if (!effectivePosition || !effectiveNormal) {
        effectivePosition = effectivePosition || parent.position;
        effectiveNormal = effectiveNormal || parent.normal;
        effectiveSurface = effectiveSurface || parent.surface || null;
      }
      revisionNumber =
        typeof parent.revision_number === "number"
          ? parent.revision_number
          : revisionNumber;
    }

    if (revisionNumber === null || revisionNumber === undefined) {
      const { data: assetRow, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("revision_count")
        .eq("id", asset_id)
        .single();

      if (assetError) {
        console.error("Error fetching asset revision count:", assetError);
        revisionNumber = 0;
      } else {
        revisionNumber = assetRow?.revision_count ?? 0;
      }
    }

    const annotationData = {
      asset_id,
      position: effectivePosition,
      normal: effectiveNormal,
      surface: effectiveSurface,
      comment,
      image_url: image_url || null,
      parent_id: parent_id || null,
      created_by: session.user.id,
      created_at: new Date().toISOString(),
      revision_number: revisionNumber ?? 0,
    };

    const { data, error } = await supabase
      .from("asset_annotations")
      .insert([annotationData])
      .select(
        `
        *,
        profiles:created_by(title, email)
      `
      )
      .single();

    if (error) {
      console.error("Error creating annotation:", error);

      // If table doesn't exist yet, return error
      if (
        error.code === "PGRST200" ||
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "Database table not set up yet. Please run the setup script.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotation: data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, comment, image_url } = body;

    if (!id || !comment) {
      return NextResponse.json(
        { error: "Annotation ID and comment are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("asset_annotations")
      .update({ comment, image_url: image_url || null })
      .eq("id", id)
      .eq("created_by", session.user.id) // Ensure user can only update their own annotations
      .select(
        `
        *,
        profiles:created_by(title, email)
      `
      )
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
    console.error("Error in PUT /api/annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Annotation ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("asset_annotations")
      .delete()
      .eq("id", id)
      .eq("created_by", session.user.id); // Ensure user can only delete their own annotations

    if (error) {
      console.error("Error deleting annotation:", error);
      return NextResponse.json(
        { error: "Failed to delete annotation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/annotations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
