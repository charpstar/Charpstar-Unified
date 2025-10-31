import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Switch user role
 * POST /api/users/switch-role
 */
export async function POST(request: NextRequest) {
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

    const { role } = await request.json();

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    // Validate role is valid
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
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }

    // Fetch user profile to check allowed roles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("metadata, role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Get allowed roles from metadata
    const metadata = profile.metadata || {};
    const allowed_roles = (metadata.allowed_roles as string[]) || [
      profile.role,
    ];

    // Check if the requested role is in allowed roles
    if (!allowed_roles.includes(role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to switch to this role",
          allowed_roles: allowed_roles,
        },
        { status: 403 }
      );
    }

    // Update the role
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: role })
      .eq("id", session.user.id);

    if (updateError) {
      console.error("Error updating role:", updateError);
      return NextResponse.json(
        { error: "Failed to update role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: role,
      message: "Role switched successfully",
    });
  } catch (error) {
    console.error("Error in switch-role API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
