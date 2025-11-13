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

    // Create user-batch assignments
    const assignments = userIds.map((userId) => ({
      user_id: userId,
      client_name: clientName,
      batch_number: batchNumber,
      role: role,
      assigned_at: new Date().toISOString(),
    }));

    const { data: createdAssignments, error } = await adminClient
      .from("user_batch_assignments")
      .insert(assignments)
      .select("user_id, client_name, batch_number, role, assigned_at");

    if (error) {
      console.error("Error creating user-batch assignments:", error);
      return NextResponse.json(
        { error: "Failed to assign users to batch" },
        { status: 500 }
      );
    }

    // Log the assignment for audit purposes

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${createdAssignments.length} users to batch ${batchNumber} for ${clientName}`,
      assignedUsers: createdAssignments,
    });
  } catch (error) {
    console.error("Error in assign-to-batch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
