import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Admin access required", status: 403 } as const;
  }

  return { userId: user.id } as const;
}

async function getListAssetIds(listId: string) {
  const { data: assignments, error } = await supabaseAdmin
    .from("asset_assignments")
    .select("asset_id")
    .eq("allocation_list_id", listId)
    .eq("role", "modeler");

  if (error) {
    throw error;
  }

  const assetIds =
    assignments?.map((assignment) => assignment.asset_id).filter(Boolean) || [];

  return assetIds as string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }
    const assignedBy = adminCheck.userId;

    const listId = params.listId;
    if (!listId) {
      return NextResponse.json(
        { error: "Missing allocation list id" },
        { status: 400 }
      );
    }

    const { qaId } = await request.json();
    if (!qaId || typeof qaId !== "string") {
      return NextResponse.json(
        { error: "Missing qaId in request body" },
        { status: 400 }
      );
    }

    const { data: listData, error: listError } = await supabaseAdmin
      .from("allocation_lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !listData) {
      return NextResponse.json(
        { error: "Allocation list not found" },
        { status: 404 }
      );
    }

    const assetIds = await getListAssetIds(listId);
    if (assetIds.length === 0) {
      return NextResponse.json(
        { error: "This allocation list has no assets" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("asset_assignments")
      .delete()
      .in("asset_id", assetIds)
      .eq("role", "qa")
      .eq("is_provisional", true);

    if (deleteError) {
      console.error("Error clearing provisional QA assignments:", deleteError);
    }

    const assignments = assetIds.map((assetId) => ({
      asset_id: assetId,
      user_id: qaId,
      role: "qa",
      assigned_by: assignedBy,
      start_time: new Date().toISOString(),
      is_provisional: true,
      allocation_list_id: listId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("asset_assignments")
      .insert(assignments);

    if (insertError) {
      console.error("Error assigning QA override:", insertError);
      return NextResponse.json(
        { error: "Failed to assign QA to allocation list" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in allocation list QA assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const listId = params.listId;
    if (!listId) {
      return NextResponse.json(
        { error: "Missing allocation list id" },
        { status: 400 }
      );
    }

    const { data: listData, error: listError } = await supabaseAdmin
      .from("allocation_lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !listData) {
      return NextResponse.json(
        { error: "Allocation list not found" },
        { status: 404 }
      );
    }

    const assetIds = await getListAssetIds(listId);
    if (assetIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("asset_assignments")
      .delete()
      .in("asset_id", assetIds)
      .eq("role", "qa")
      .eq("is_provisional", true);

    if (deleteError) {
      console.error("Error removing provisional QA assignments:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove QA from allocation list" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing allocation list QA override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
