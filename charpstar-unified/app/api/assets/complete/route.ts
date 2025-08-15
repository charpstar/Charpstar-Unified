import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notificationService } from "@/lib/notificationService";
import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, status, revisionCount } = await request.json();

    if (!assetId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: assetId, status" },
        { status: 400 }
      );
    }

    // Enforce role on client approval
    if (
      status === "approved_by_client" &&
      user.user_metadata?.role !== "client"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update the asset status
    const updateData: any = { status };
    // On revisions, increment revision_count immediately and notify modeler
    if (status === "revisions") {
      // Fetch latest revision number to set on asset
      const { data: latestRev } = await supabase
        .from("revision_history")
        .select("revision_number")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false })
        .limit(1)
        .single();
      const latestNumber = latestRev?.revision_number ?? revisionCount ?? null;
      if (latestNumber !== null) updateData.revision_count = latestNumber;
    } else if (revisionCount !== undefined) {
      updateData.revision_count = revisionCount;
    }

    const { error: assetError } = await supabase
      .from("onboarding_assets")
      .update(updateData)
      .eq("id", assetId);

    if (assetError) {
      console.error("Error updating asset status:", assetError);
      return NextResponse.json(
        { error: "Failed to update asset status" },
        { status: 500 }
      );
    }

    // Note: Revision notifications are now handled by the calling page
    // to ensure proper reviewer identification (Client vs QA vs Admin)
    // See client-review/[id]/page.tsx for revision notification logic

    // Note: Approval notifications are now handled by the calling page
    // to ensure proper role-based messaging (QA vs Client approval)
    // See client-review/[id]/page.tsx for approval notification logic

    // Do NOT notify on client submission of revisions; production will forward later

    // Check allocation list status whenever an asset status changes
    const { data: assignments, error: assignmentError } = await supabase
      .from("asset_assignments")
      .select("allocation_list_id")
      .eq("asset_id", assetId)
      .eq("role", "modeler");

    if (assignmentError) {
      console.error("Error fetching asset assignment:", assignmentError);
      return NextResponse.json(
        { error: "Failed to fetch asset assignment" },
        { status: 500 }
      );
    }

    let allocationListId: string | null = null;

    if (assignments && assignments.length > 0) {
      // Use the first assignment if multiple exist
      const assignment = assignments[0];

      if (assignment?.allocation_list_id) {
        allocationListId = assignment.allocation_list_id;

        // Get all assets in this allocation list
        const { data: listAssets, error: listError } = await supabase
          .from("asset_assignments")
          .select(
            `
          asset_id,
          onboarding_assets!inner(
            id,
            status
          )
        `
          )
          .eq("allocation_list_id", assignment.allocation_list_id)
          .eq("role", "modeler");

        if (listError) {
          console.error("Error fetching list assets:", listError);
          return NextResponse.json(
            { error: "Failed to fetch list assets" },
            { status: 500 }
          );
        }

        // Check if all assets in the list are approved
        console.log("List assets:", listAssets);
        console.log(
          "Asset statuses:",
          listAssets?.map((item: any) => item.onboarding_assets?.status)
        );

        // Only assets with status "approved" or "approved_by_client" count for allocation list approval
        // "delivered_by_artist" and "revisions" do NOT count as approved
        const allApproved = listAssets?.every(
          (item: any) =>
            item.onboarding_assets?.status === "approved" ||
            item.onboarding_assets?.status === "approved_by_client"
        );

        console.log(
          "All assets approved (excluding delivered_by_artist and revisions):",
          allApproved
        );
        console.log("Asset count breakdown:", {
          total: listAssets?.length || 0,
          approved:
            listAssets?.filter(
              (item: any) => item.onboarding_assets?.status === "approved"
            ).length || 0,
          approved_by_client:
            listAssets?.filter(
              (item: any) =>
                item.onboarding_assets?.status === "approved_by_client"
            ).length || 0,
          delivered_by_artist:
            listAssets?.filter(
              (item: any) =>
                item.onboarding_assets?.status === "delivered_by_artist"
            ).length || 0,
          revisions:
            listAssets?.filter(
              (item: any) => item.onboarding_assets?.status === "revisions"
            ).length || 0,
          other:
            listAssets?.filter(
              (item: any) =>
                ![
                  "approved",
                  "approved_by_client",
                  "delivered_by_artist",
                  "revisions",
                ].includes(item.onboarding_assets?.status)
            ).length || 0,
        });

        // Get current allocation list status
        const { data: currentList, error: listStatusError } =
          await supabaseAdmin
            .from("allocation_lists")
            .select("status")
            .eq("id", assignment.allocation_list_id)
            .single();

        console.log("Current list status:", currentList?.status);

        if (listStatusError) {
          console.error(
            "Error fetching allocation list status:",
            listStatusError
          );
          return NextResponse.json(
            { error: "Failed to fetch allocation list status" },
            { status: 500 }
          );
        }

        let allocationListApproved = false;

        if (allApproved && currentList?.status !== "approved") {
          // Update the allocation list status to approved
          const { error: listUpdateError } = await supabaseAdmin
            .from("allocation_lists")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
            })
            .eq("id", assignment.allocation_list_id);

          if (listUpdateError) {
            console.error(
              "Error updating allocation list status:",
              listUpdateError
            );
            return NextResponse.json(
              { error: "Failed to update allocation list status" },
              { status: 500 }
            );
          }

          allocationListApproved = true;
        } else if (!allApproved && currentList?.status === "approved") {
          // Update the allocation list status back to in_progress since not all assets are approved
          const { error: listUpdateError } = await supabaseAdmin
            .from("allocation_lists")
            .update({
              status: "in_progress",
              approved_at: null,
            })
            .eq("id", assignment.allocation_list_id);

          if (listUpdateError) {
            console.error(
              "Error updating allocation list status:",
              listUpdateError
            );
            return NextResponse.json(
              { error: "Failed to update allocation list status" },
              { status: 500 }
            );
          }

          allocationListApproved = false;
        }

        // Check if the allocation list is now empty and clean it up if necessary
        if (allocationListId) {
          await cleanupSingleAllocationList(supabase, allocationListId);
        }

        return NextResponse.json({
          message: "Asset status updated successfully",
          allocationListApproved,
          allocationListId,
        });
      }
    }

    return NextResponse.json({
      message: "Asset status updated successfully",
      allocationListApproved: false,
    });
  } catch (error) {
    console.error("Error in asset completion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
