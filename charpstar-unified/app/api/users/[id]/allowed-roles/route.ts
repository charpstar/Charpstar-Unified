import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Update allowed roles for a user (Admin only)
 * PUT /api/users/[id]/allowed-roles
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if user is authenticated and is admin
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin role
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = resolvedParams.id;
    const { allowed_roles } = await request.json();

    // Validate allowed_roles is an array
    if (!Array.isArray(allowed_roles)) {
      return NextResponse.json(
        { error: "allowed_roles must be an array" },
        { status: 400 }
      );
    }

    // Validate all roles are valid
    const validRoles = [
      "admin",
      "manager",
      "user",
      "qa",
      "qamanager",
      "modeler",
      "modelermanager",
      "client",
    ];
    const invalidRoles = allowed_roles.filter(
      (role: string) => !validRoles.includes(role)
    );
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Invalid roles: ${invalidRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Update metadata with allowed_roles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const currentMetadata = profile.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      allowed_roles: allowed_roles,
    };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ metadata: updatedMetadata })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating allowed roles:", updateError);
      return NextResponse.json(
        { error: "Failed to update allowed roles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      allowed_roles: allowed_roles,
    });
  } catch (error) {
    console.error("Error in allowed-roles API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get allowed roles for a user
 * GET /api/users/[id]/allowed-roles
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // Users can only view their own allowed roles, unless they're admin
    const isAdmin = await (async () => {
      const { data: userData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      return userData?.role === "admin";
    })();

    if (userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch user profile metadata
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("metadata, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const metadata = profile.metadata || {};
    const allowed_roles = (metadata.allowed_roles as string[]) || [
      profile.role,
    ];

    return NextResponse.json({
      allowed_roles: allowed_roles,
      current_role: profile.role,
    });
  } catch (error) {
    console.error("Error in allowed-roles API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
