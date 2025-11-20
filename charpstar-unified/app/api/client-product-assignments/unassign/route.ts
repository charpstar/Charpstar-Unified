import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * DELETE /api/client-product-assignments/unassign
 *
 * Remove product assignments. Users can unassign products they allocated,
 * or admins/production can unassign any products.
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetIds, assignedToUserId } = await request.json();

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: "assetIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!assignedToUserId || typeof assignedToUserId !== "string") {
      return NextResponse.json(
        { error: "assignedToUserId is required" },
        { status: 400 }
      );
    }

    // Check if user is admin (can unassign anything) or assigned_by (can unassign their own allocations)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Build delete query
    let deleteQuery = supabase
      .from("client_product_assignments")
      .delete()
      .in("asset_id", assetIds)
      .eq("assigned_to_user_id", assignedToUserId);

    // If not admin, only allow deleting assignments they created
    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("assigned_by_user_id", session.user.id);
    }

    const { data, error: deleteError } = await deleteQuery.select();

    if (deleteError) {
      console.error("Error deleting assignments:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete assignments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unassigned ${data?.length || 0} product(s)`,
      unassigned: data,
    });
  } catch (error: any) {
    console.error("Error in unassign endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
