import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { name, role } = await request.json();

    // Update user metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        user_metadata: { name },
      }
    );

    if (authError) {
      throw authError;
    }

    // Update role in profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error updating user:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Delete user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      throw authError;
    }

    // The profile will be automatically deleted by the foreign key constraint

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting user:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
