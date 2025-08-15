import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Clean up empty allocation lists by checking if they have any assets assigned
 * @param supabase - Supabase client instance
 * @param allocationListIds - Array of allocation list IDs to check
 * @returns Object with cleanup results
 */
export async function cleanupEmptyAllocationLists(
  supabase: SupabaseClient,
  allocationListIds: string[]
): Promise<{
  deletedCount: number;
  remainingCount: number;
  deletedLists: Array<{ id: string; name: string; reason: string }>;
  errors: Array<{ id: string; error: string }>;
}> {
  let deletedCount = 0;
  let remainingCount = 0;
  const deletedLists: Array<{ id: string; name: string; reason: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];

  try {
    for (const listId of allocationListIds) {
      try {
        // Check how many assets are left in this allocation list
        const { data: remainingAssets, error: countError } = await supabase
          .from("asset_assignments")
          .select("asset_id")
          .eq("allocation_list_id", listId);

        if (countError) {
          console.error(
            `Error checking remaining assets for list ${listId}:`,
            countError
          );
          errors.push({
            id: listId,
            error: `Failed to check assets: ${countError.message}`,
          });
          continue;
        }

        // If no assets remain in this list, delete the allocation list
        if (!remainingAssets || remainingAssets.length === 0) {
          // Get the list name before deletion for logging
          const { data: listInfo } = await supabase
            .from("allocation_lists")
            .select("name")
            .eq("id", listId)
            .single();

          const listName = listInfo?.name || listId;

          const { error: allocationListError } = await supabase
            .from("allocation_lists")
            .delete()
            .eq("id", listId);

          if (allocationListError) {
            console.error(
              `Error deleting empty allocation list ${listId}:`,
              allocationListError
            );
            deletedLists.push({
              id: listId,
              name: listName,
              reason: `Failed to delete: ${allocationListError.message}`,
            });
            errors.push({
              id: listId,
              error: `Failed to delete: ${allocationListError.message}`,
            });
          } else {
            deletedCount++;
            deletedLists.push({
              id: listId,
              name: listName,
              reason: "No assets assigned",
            });
            console.log(
              `Deleted empty allocation list: ${listName} (${listId})`
            );
          }
        } else {
          remainingCount++;
          console.log(
            `Allocation list ${listId} still has ${remainingAssets.length} assets, keeping it`
          );
        }
      } catch (error) {
        console.error(`Error processing allocation list ${listId}:`, error);
        errors.push({
          id: listId,
          error: `Error processing: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }
  } catch (error) {
    console.error("Error in allocation list cleanup:", error);
    throw error;
  }

  return {
    deletedCount,
    remainingCount,
    deletedLists,
    errors,
  };
}

/**
 * Check for orphaned allocation lists without deleting them
 * @param supabase - Supabase client instance
 * @returns Object with orphaned lists information
 */
export async function checkOrphanedAllocationLists(
  supabase: SupabaseClient
): Promise<{
  orphanedLists: Array<{
    id: string;
    name: string;
    user_id: string;
    role: string;
    created_at: string;
    deadline: string;
    bonus: number;
    assetCount: number;
    status: "orphaned" | "active";
  }>;
  activeLists: Array<{
    id: string;
    name: string;
    user_id: string;
    role: string;
    created_at: string;
    deadline: string;
    bonus: number;
    assetCount: number;
    status: "orphaned" | "active";
  }>;
  orphanedCount: number;
  activeCount: number;
  totalLists: number;
}> {
  try {
    // Get all allocation lists
    const { data: allocationLists, error: listsError } = await supabase.from(
      "allocation_lists"
    ).select(`
        id,
        name,
        user_id,
        role,
        created_at,
        deadline,
        bonus
      `);

    if (listsError) {
      console.error("Error fetching allocation lists:", listsError);
      throw listsError;
    }

    if (!allocationLists || allocationLists.length === 0) {
      return {
        orphanedLists: [],
        activeLists: [],
        orphanedCount: 0,
        activeCount: 0,
        totalLists: 0,
      };
    }

    const orphanedLists: Array<{
      id: string;
      name: string;
      user_id: string;
      role: string;
      created_at: string;
      deadline: string;
      bonus: number;
      assetCount: number;
      status: "orphaned" | "active";
    }> = [];

    // Check each allocation list for assets
    for (const list of allocationLists) {
      try {
        const { data: assignments, error: assignmentError } = await supabase
          .from("asset_assignments")
          .select("asset_id")
          .eq("allocation_list_id", list.id);

        if (assignmentError) {
          console.error(
            `Error checking assets for list ${list.id}:`,
            assignmentError
          );
          continue;
        }

        const assetCount = assignments?.length || 0;
        const isOrphaned = assetCount === 0;

        orphanedLists.push({
          ...list,
          assetCount,
          status: isOrphaned ? "orphaned" : "active",
        });
      } catch (error) {
        console.error(`Error processing allocation list ${list.id}:`, error);
        orphanedLists.push({
          ...list,
          assetCount: 0,
          status: "orphaned",
        });
      }
    }

    const orphanedCount = orphanedLists.filter(
      (list) => list.status === "orphaned"
    ).length;
    const activeCount = orphanedLists.filter(
      (list) => list.status === "active"
    ).length;

    return {
      orphanedLists: orphanedLists.filter((list) => list.status === "orphaned"),
      activeLists: orphanedLists.filter((list) => list.status === "active"),
      orphanedCount,
      activeCount,
      totalLists: allocationLists.length,
    };
  } catch (error) {
    console.error("Error checking allocation lists:", error);
    throw error;
  }
}

/**
 * Clean up a single empty allocation list
 * @param supabase - Supabase client instance
 * @param allocationListId - ID of the allocation list to check and potentially delete
 * @returns Object with cleanup result
 */
export async function cleanupSingleAllocationList(
  supabase: SupabaseClient,
  allocationListId: string
): Promise<{
  deleted: boolean;
  reason: string;
  error?: string;
}> {
  try {
    // Check how many assets are left in this allocation list
    const { data: remainingAssets, error: countError } = await supabase
      .from("asset_assignments")
      .select("asset_id")
      .eq("allocation_list_id", allocationListId);

    if (countError) {
      console.error("Error checking remaining assets in list:", countError);
      return {
        deleted: false,
        reason: `Failed to check assets: ${countError.message}`,
        error: countError.message,
      };
    }

    // If no assets remain in this list, delete the allocation list
    if (!remainingAssets || remainingAssets.length === 0) {
      const { error: allocationListError } = await supabase
        .from("allocation_lists")
        .delete()
        .eq("id", allocationListId);

      if (allocationListError) {
        console.error(
          "Error deleting empty allocation list:",
          allocationListError
        );
        return {
          deleted: false,
          reason: `Failed to delete: ${allocationListError.message}`,
          error: allocationListError.message,
        };
      } else {
        console.log(`Deleted empty allocation list ${allocationListId}`);
        return {
          deleted: true,
          reason: "No assets assigned",
        };
      }
    } else {
      console.log(
        `Allocation list ${allocationListId} still has ${remainingAssets.length} assets, keeping it`
      );
      return {
        deleted: false,
        reason: `Still has ${remainingAssets.length} assets assigned`,
      };
    }
  } catch (error) {
    console.error("Error cleaning up allocation list:", error);
    return {
      deleted: false,
      reason: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
