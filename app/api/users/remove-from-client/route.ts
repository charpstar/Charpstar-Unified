import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userIds, clientName, role } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "User IDs array is required" },
        { status: 400 }
      );
    }

    if (!clientName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    if (!role || !["modeler", "qa"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role (modeler or qa) is required" },
        { status: 400 }
      );
    }

    // Remove the user assignments
    const { error: deleteError } = await supabase
      .from("user_client_assignments")
      .delete()
      .in("user_id", userIds)
      .eq("client_name", clientName)
      .eq("role", role);

    if (deleteError) {
      console.error("Error removing users from client:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove users from client" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${userIds.length} user${
        userIds.length !== 1 ? "s" : ""
      } from ${clientName} as ${role}`,
    });
  } catch (error) {
    console.error("Error in POST /api/users/remove-from-client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
