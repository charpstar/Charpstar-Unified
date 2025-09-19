import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT - Update bug report (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, priority, adminNotes } = body;

    const updateData: any = {};

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;

    // Set resolved_at if status is being changed to resolved
    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("bug_reports")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating bug report:", error);
      return NextResponse.json(
        { error: "Failed to update bug report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bugReport: data });
  } catch (error) {
    console.error("Error in bug report PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete bug report (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from("bug_reports")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting bug report:", error);
      return NextResponse.json(
        { error: "Failed to delete bug report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in bug report DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
