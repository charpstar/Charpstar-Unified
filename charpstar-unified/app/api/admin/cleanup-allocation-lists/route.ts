import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  cleanupEmptyAllocationLists,
  checkOrphanedAllocationLists,
} from "@/lib/allocationListCleanup";

export async function POST(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all allocation lists
    const { data: allocationLists, error: listsError } = await supabase
      .from("allocation_lists")
      .select("id, name, user_id, role");

    if (listsError) {
      console.error("Error fetching allocation lists:", listsError);
      return NextResponse.json(
        { error: "Failed to fetch allocation lists" },
        { status: 500 }
      );
    }

    if (!allocationLists || allocationLists.length === 0) {
      return NextResponse.json({
        message: "No allocation lists found",
        deletedCount: 0,
        remainingCount: 0,
      });
    }

    const allocationListIds = allocationLists.map((list) => list.id);
    const cleanupResult = await cleanupEmptyAllocationLists(
      supabase,
      allocationListIds
    );

    return NextResponse.json({
      message: `Cleanup completed. Deleted ${cleanupResult.deletedCount} empty allocation lists.`,
      deletedCount: cleanupResult.deletedCount,
      remainingCount: cleanupResult.remainingCount,
      deletedLists: cleanupResult.deletedLists,
      errors: cleanupResult.errors,
      totalProcessed: allocationLists.length,
    });
  } catch (error) {
    console.error("Error in allocation list cleanup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check for orphaned allocation lists without deleting them
export async function GET(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const result = await checkOrphanedAllocationLists(supabase);

    return NextResponse.json({
      message: `Found ${result.orphanedCount} orphaned allocation lists out of ${result.totalLists} total`,
      orphanedLists: result.orphanedLists,
      activeLists: result.activeLists,
      orphanedCount: result.orphanedCount,
      activeCount: result.activeCount,
      totalLists: result.totalLists,
    });
  } catch (error) {
    console.error("Error checking allocation lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
