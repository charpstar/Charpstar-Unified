import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { asset_id, position, normal, surface, comment, image_url } = body;

    if (!asset_id || !position || !normal || !comment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const annotationData = {
      asset_id,
      position,
      normal,
      surface: surface || null,
      comment,
      image_url: image_url || null,
      created_by: session.user.id,
      created_at: new Date().toISOString(),
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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
