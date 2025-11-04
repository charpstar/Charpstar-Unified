import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    console.log("Refreshing allocation list completion statuses...");

    // Get all allocation lists that haven't been marked as approved yet
    const { data: pendingLists, error: pendingListsError } = await supabaseAdmin
      .from("allocation_lists")
      .select("id")
      .or("approved_at.is.null,status.neq.approved");

    if (pendingListsError) {
      console.error("Error fetching pending lists:", pendingListsError);
      return NextResponse.json(
        { error: "Failed to fetch allocation lists" },
        { status: 500 }
      );
    }

    if (!pendingLists || pendingLists.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "No pending allocation lists found",
      });
    }

    let updatedCount = 0;

    for (const list of pendingLists) {
      try {
        // Get all assets in this allocation list
        const { data: allAssetsInList, error: listAssetsError } =
          await supabaseAdmin
            .from("asset_assignments")
            .select(
              `
            onboarding_assets(id, status, transferred, qa_team_handles_model, pricing_option_id)
          `
            )
            .eq("allocation_list_id", list.id);

        if (!listAssetsError && allAssetsInList && allAssetsInList.length > 0) {
          // Filter out QA-handled models - they don't count toward completion
          const pricedAssets = allAssetsInList.filter((assignment: any) => {
            if (!assignment.onboarding_assets) return false;
            const asset = assignment.onboarding_assets;
            // Exclude QA-handled models
            return (
              !asset.qa_team_handles_model &&
              asset.pricing_option_id !== "qa_team_handles_model"
            );
          });

          // Check if all priced assets are approved
          // If list has no priced assets (only QA-handled), it should never be marked as approved
          const allApproved =
            pricedAssets.length > 0 &&
            pricedAssets.every((assignment: any) => {
              const asset = assignment.onboarding_assets;
              // If asset has been transferred, it's approved
              if (asset.transferred === true) return true;
              // Otherwise, check if status is approved
              return (
                asset.status === "approved_by_client" ||
                asset.status === "approved"
              );
            });

          if (allApproved) {
            // Update the allocation list to mark it as approved
            const { error: updateListError } = await supabaseAdmin
              .from("allocation_lists")
              .update({
                approved_at: new Date().toISOString(),
                status: "approved",
                updated_at: new Date().toISOString(),
              })
              .eq("id", list.id);

            if (updateListError) {
              console.error(
                `Error updating allocation list ${list.id}:`,
                updateListError
              );
            } else {
              updatedCount++;
              console.log(`Allocation list ${list.id} marked as approved`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing list ${list.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Updated ${updatedCount} allocation list(s)`,
    });
  } catch (error) {
    console.error("Error refreshing allocation list completion:", error);
    return NextResponse.json(
      { error: "Failed to refresh allocation list completion" },
      { status: 500 }
    );
  }
}
