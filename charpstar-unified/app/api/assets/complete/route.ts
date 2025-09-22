import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { cleanupSingleAllocationList } from "@/lib/allocationListCleanup";
import { logActivityServer } from "@/lib/serverActivityLogger";
import { notificationService } from "@/lib/notificationService";

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

    // Get user's role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Enforce role on client approval
    if (status === "approved_by_client" && profile?.role !== "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get previous status for activity logging
    const { data: prevAssetRow } = await supabase
      .from("onboarding_assets")
      .select("status")
      .eq("id", assetId)
      .single();
    const prevStatus = prevAssetRow?.status || null;

    // Update the asset status
    const updateData: any = { status };
    // On revisions, increment revision_count immediately and log the revision action
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

      // Also create a revision history entry so QA metrics can attribute the review
      const nextRevisionNumber = (latestNumber ?? 0) + 1;
      await supabase.from("revision_history").insert({
        asset_id: assetId,
        revision_number: nextRevisionNumber,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
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

    // Mark all existing annotations as old when setting status to revisions
    if (status === "revisions") {
      const { error: markOldError } = await supabase
        .from("asset_annotations")
        .update({ is_old_annotation: true })
        .eq("asset_id", assetId);

      if (markOldError) {
        console.error("Error marking old annotations:", markOldError);
        // Don't fail the main request if annotation marking fails
      }
    }

    // Log activity for status change (used by QA metrics for approvals)
    try {
      await logActivityServer({
        action: `Updated asset status to ${status}`,
        type: "update",
        resource_type: "asset",
        resource_id: assetId,
        metadata: { prev_status: prevStatus, new_status: status },
      });
    } catch (e) {
      console.error("Error logging status update activity:", e);
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

        // Only assets with status "approved" or "approved_by_client" count for allocation list approval
        // "delivered_by_artist" and "revisions" do NOT count as approved
        const allApproved = listAssets?.every(
          (item: any) =>
            item.onboarding_assets?.status === "approved" ||
            item.onboarding_assets?.status === "approved_by_client"
        );

        // Get current allocation list status
        const { data: currentList, error: listStatusError } =
          await supabaseAdmin
            .from("allocation_lists")
            .select("status")
            .eq("id", assignment.allocation_list_id)
            .single();

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

        // Check for progress milestones and send client notifications
        if (currentList && status === "approved_by_client") {
          try {
            // Get all assets in this allocation list
            const { data: listAssets, error: listAssetsError } =
              await supabaseAdmin
                .from("asset_assignments")
                .select(
                  `
                onboarding_assets!inner(
                  id,
                  status,
                  client,
                  batch
                )
              `
                )
                .eq("allocation_list_id", allocationListId);

            if (!listAssetsError && listAssets) {
              const totalAssets = listAssets.length;
              const completedAssets = listAssets.filter(
                (assignment: any) =>
                  assignment.onboarding_assets.status === "approved" ||
                  assignment.onboarding_assets.status === "approved_by_client"
              ).length;

              const completionPercentage =
                totalAssets > 0
                  ? Math.round((completedAssets / totalAssets) * 100)
                  : 0;

              // Check if this is a milestone (25%, 50%, 75%, 100%)
              const milestones = [25, 50, 75, 100];
              const isMilestone = milestones.includes(completionPercentage);

              if (isMilestone) {
                // Get client information
                const firstAsset = listAssets[0] as any;
                const client =
                  firstAsset?.onboarding_assets?.client || "Unknown";
                const batch = firstAsset?.onboarding_assets?.batch || 1;

                // Find client profile
                const { data: clientProfile, error: clientError } =
                  await supabaseAdmin
                    .from("profiles")
                    .select("id, email")
                    .eq("client", client)
                    .eq("role", "client")
                    .single();

                if (!clientError && clientProfile && allocationListId) {
                  await notificationService.sendClientListProgressNotification(
                    clientProfile.id,
                    clientProfile.email,
                    allocationListId,
                    (currentList as any).name ||
                      `Allocation List #${(currentList as any).number}`,
                    completionPercentage,
                    completedAssets,
                    totalAssets,
                    client,
                    batch
                  );
                }
              }
            }
          } catch (progressError) {
            console.error(
              "Error sending progress notification:",
              progressError
            );
            // Don't fail the main request if progress notification fails
          }
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
