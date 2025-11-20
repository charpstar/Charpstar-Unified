import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

/**
 * GET /api/users/[id]/client-role
 * Get the client_role for a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);
    const { id: userId } = await params;

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get user's client_role
    const { data: userProfile, error } = await supabase
      .from("profiles")
      .select("client_role, role")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    if (userProfile.role !== "client") {
      return NextResponse.json(
        { error: "User is not a client" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      client_role: userProfile.client_role || "client_admin", // Default to client_admin
    });
  } catch (error) {
    console.error("Error fetching client role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/[id]/client-role
 * Update the client_role for a user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);
    const { id: userId } = await params;

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { clientRole } = await request.json();

    if (
      !clientRole ||
      (clientRole !== "client_admin" && clientRole !== "product_manager")
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid client role. Must be 'client_admin' or 'product_manager'",
        },
        { status: 400 }
      );
    }

    // Verify target user is a client
    const { data: targetUser, error: targetError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role !== "client") {
      return NextResponse.json(
        { error: "Can only set client_role for client users" },
        { status: 400 }
      );
    }

    // Update client_role
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        client_role: clientRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating client role:", updateError);
      return NextResponse.json(
        { error: "Failed to update client role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Client role updated successfully",
      client_role: clientRole,
    });
  } catch (error) {
    console.error("Error updating client role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
