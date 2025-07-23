import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userIds, clientName, batchNumber, role } = body;

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

    if (!batchNumber || typeof batchNumber !== "number") {
      return NextResponse.json(
        { error: "Batch number is required" },
        { status: 400 }
      );
    }

    if (!role || !["modeler", "qa"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role (modeler or qa) is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Remove user-batch assignments
    const { error } = await adminClient
      .from("user_batch_assignments")
      .delete()
      .in("user_id", userIds)
      .eq("client_name", clientName)
      .eq("batch_number", batchNumber)
      .eq("role", role);

    if (error) {
      console.error("Error removing user-batch assignments:", error);
      return NextResponse.json(
        { error: "Failed to remove users from batch" },
        { status: 500 }
      );
    }

    // Log the removal for audit purposes

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${userIds.length} users from batch ${batchNumber} for ${clientName}`,
    });
  } catch (error) {
    console.error("Error in remove-from-batch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
