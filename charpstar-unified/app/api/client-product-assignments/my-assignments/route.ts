import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * GET /api/client-product-assignments/my-assignments
 *
 * Get all products assigned to the current user (product owner).
 */
//eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
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

    // Get all products assigned to this user
    // Simplified query - we only need asset_id, the profile joins aren't necessary
    const { data: assignments, error: assignmentsError } = await supabase
      .from("client_product_assignments")
      .select(
        `
        id,
        asset_id,
        assigned_by_user_id,
        assigned_to_user_id,
        client_name,
        created_at,
        asset:onboarding_assets(
          id,
          product_name,
          article_id,
          article_ids,
          client,
          batch,
          priority,
          delivery_date,
          status,
          glb_link,
          product_link,
          reference,
          internal_reference,
          upload_order,
          measurements
        )
        `
      )
      .eq("assigned_to_user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 }
      );
    }

    // Get all asset IDs assigned to this user
    const assignedAssetIds =
      assignments?.map((a) => a.asset_id).filter(Boolean) || [];

    return NextResponse.json({
      assignments: assignments || [],
      assignedAssetIds,
    });
  } catch (error: any) {
    console.error("Error in my-assignments endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
