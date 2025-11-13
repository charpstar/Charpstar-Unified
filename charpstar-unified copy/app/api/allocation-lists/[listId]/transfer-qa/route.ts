import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireQaUser() {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Failed to fetch profile for QA transfer:", profileError);
    return { error: "Failed to verify user role", status: 500 } as const;
  }

  if ((profile?.role || "").toLowerCase() !== "qa") {
    return { error: "QA access required", status: 403 } as const;
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
    assignments
      ?.map((assignment) => assignment.asset_id)
      .filter(
        (assetId): assetId is string =>
          typeof assetId === "string" && assetId.length > 0
      ) ?? [];

  return assetIds;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const authCheck = await requireQaUser();
    if ("error" in authCheck) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const listId = params.listId;
    if (!listId || typeof listId !== "string") {
      return NextResponse.json(
        { error: "Missing allocation list id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const newQaId = body?.newQaId;

    if (!newQaId || typeof newQaId !== "string") {
      return NextResponse.json(
        { error: "Missing newQaId in request body" },
        { status: 400 }
      );
    }

    // Validate target QA exists and has QA role
    const { data: targetQaProfile, error: targetQaError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", newQaId)
      .single();

    if (targetQaError) {
      console.error("Failed to validate new QA user:", targetQaError);
      return NextResponse.json(
        { error: "Unable to validate target QA user" },
        { status: 500 }
      );
    }

    if ((targetQaProfile?.role || "").toLowerCase() !== "qa") {
      return NextResponse.json(
        { error: "Selected user is not a QA" },
        { status: 400 }
      );
    }

    // Ensure the allocation list exists
    const { data: listRecord, error: listError } = await supabaseAdmin
      .from("allocation_lists")
      .select("id")
      .eq("id", listId)
      .single();

    if (listError || !listRecord) {
      return NextResponse.json(
        { error: "Allocation list not found" },
        { status: 404 }
      );
    }

    // Fetch provisional QA assignments for this list
    const { data: provisionalAssignments, error: assignmentsError } =
      await supabaseAdmin
        .from("asset_assignments")
        .select("asset_id, user_id")
        .eq("allocation_list_id", listId)
        .eq("role", "qa")
        .eq("is_provisional", true);

    if (assignmentsError) {
      console.error(
        "Failed to fetch provisional QA assignments:",
        assignmentsError
      );
      return NextResponse.json(
        { error: "Failed to load existing QA assignments" },
        { status: 500 }
      );
    }

    let assetIds: string[] = [];

    if (provisionalAssignments && provisionalAssignments.length > 0) {
      const currentQaIds = new Set(
        provisionalAssignments
          .map((assignment) => assignment.user_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      );

      if (!currentQaIds.has(authCheck.userId)) {
        return NextResponse.json(
          {
            error:
              "You are not assigned to this allocation list and cannot transfer it.",
          },
          { status: 403 }
        );
      }

      if (currentQaIds.has(newQaId) && currentQaIds.size === 1) {
        return NextResponse.json({
          success: true,
          message: "Allocation list is already assigned to the selected QA.",
        });
      }

      assetIds = Array.from(
        new Set(
          provisionalAssignments
            .map((assignment) => assignment.asset_id)
            .filter(
              (assetId): assetId is string =>
                typeof assetId === "string" && assetId.length > 0
            )
        )
      );
    } else {
      const { data: listData, error: listDataError } = await supabaseAdmin
        .from("allocation_lists")
        .select("user_id")
        .eq("id", listId)
        .single();

      if (listDataError) {
        console.error("Failed to fetch allocation list owner:", listDataError);
        return NextResponse.json(
          { error: "Failed to load allocation list details" },
          { status: 500 }
        );
      }

      if (!listData?.user_id) {
        return NextResponse.json(
          {
            error:
              "This allocation list is not associated with a modeler and cannot be transferred.",
          },
          { status: 400 }
        );
      }

      const { data: qaLinkage, error: qaLinkageError } = await supabaseAdmin
        .from("qa_allocations")
        .select("id")
        .eq("qa_id", authCheck.userId)
        .eq("modeler_id", listData.user_id);

      if (qaLinkageError) {
        console.error(
          "Failed to verify QA allocation linkage:",
          qaLinkageError
        );
        return NextResponse.json(
          { error: "Unable to verify your assignment for this list." },
          { status: 500 }
        );
      }

      if (!qaLinkage || qaLinkage.length === 0) {
        return NextResponse.json(
          {
            error:
              "You are not assigned to this allocation list and cannot transfer it.",
          },
          { status: 403 }
        );
      }

      assetIds = await getListAssetIds(listId);
    }

    assetIds = Array.from(new Set(assetIds));

    if (assetIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No assets found for this allocation list. Transfer cannot be completed.",
        },
        { status: 400 }
      );
    }

    // Remove existing provisional QA assignments for the list
    const { error: deleteError } = await supabaseAdmin
      .from("asset_assignments")
      .delete()
      .eq("allocation_list_id", listId)
      .eq("role", "qa")
      .eq("is_provisional", true);

    if (deleteError) {
      console.error("Failed to remove existing QA assignments:", deleteError);
      return NextResponse.json(
        { error: "Failed to clear existing QA assignments" },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString();
    const assignmentsToInsert = assetIds.map((assetId) => ({
      asset_id: assetId,
      user_id: newQaId,
      role: "qa",
      allocation_list_id: listId,
      assigned_by: authCheck.userId,
      start_time: timestamp,
      is_provisional: true,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("asset_assignments")
      .insert(assignmentsToInsert);

    if (insertError) {
      console.error("Failed to create new QA assignments:", insertError);
      return NextResponse.json(
        { error: "Failed to assign allocation list to the new QA" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transferredAssetCount: assignmentsToInsert.length,
    });
  } catch (error) {
    console.error("Unexpected error transferring QA allocation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
