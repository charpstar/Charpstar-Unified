import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { assetIds, userIds, role } = await request.json();

    if (!assetIds || !userIds || !role) {
      return NextResponse.json(
        { error: "Missing required fields: assetIds, userIds, role" },
        { status: 400 }
      );
    }

    if (!Array.isArray(assetIds) || !Array.isArray(userIds)) {
      return NextResponse.json(
        { error: "assetIds and userIds must be arrays" },
        { status: 400 }
      );
    }

    if (!["modeler", "qa"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'modeler' or 'qa'" },
        { status: 400 }
      );
    }

    // For modeler assignments, ensure only one modeler per asset
    if (role === "modeler") {
      // First, remove any existing modeler assignments for these assets
      const { error: deleteError } = await supabaseAdmin
        .from("asset_assignments")
        .delete()
        .in("asset_id", assetIds)
        .eq("role", "modeler");

      if (deleteError) {
        console.error(
          "Error removing existing modeler assignments:",
          deleteError
        );
        return NextResponse.json(
          { error: "Failed to remove existing assignments" },
          { status: 500 }
        );
      }

      // Create new assignments (only one modeler per asset)
      const assignments = [];
      const assignmentDetails = [];

      for (let i = 0; i < assetIds.length; i++) {
        const userId = userIds[0]; // Only one user selected
        assignments.push({
          asset_id: assetIds[i],
          user_id: userId,
          role: role,
          assigned_by: user.id,
          start_time: new Date().toISOString(),
        });
        assignmentDetails.push({
          assetId: assetIds[i],
          userId: userId,
        });
      }

      // Insert new assignments
      const { data, error } = await supabaseAdmin
        .from("asset_assignments")
        .insert(assignments);

      if (error) {
        console.error("Error creating asset assignments:", error);
        return NextResponse.json(
          { error: "Failed to create assignments" },
          { status: 500 }
        );
      }

      // Create a more detailed message
      const message = `Successfully assigned ${assignments.length} asset(s) to 1 modeler`;

      return NextResponse.json({
        message: message,
        data: data,
        assignmentDetails: assignmentDetails,
      });
    } else {
      // For QA assignments, allow multiple QA per asset (existing logic)
      const assignments = [];
      for (const assetId of assetIds) {
        for (const userId of userIds) {
          assignments.push({
            asset_id: assetId,
            user_id: userId,
            role: role,
            assigned_by: user.id,
            start_time: new Date().toISOString(),
          });
        }
      }

      // Insert assignments (using upsert to handle duplicates)
      const { data, error } = await supabaseAdmin
        .from("asset_assignments")
        .upsert(assignments, {
          onConflict: "asset_id,user_id,role",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Error creating asset assignments:", error);
        return NextResponse.json(
          { error: "Failed to create assignments" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `Successfully assigned ${assignments.length} asset(s) to ${userIds.length} user(s)`,
        data: data,
      });
    }
  } catch (error) {
    console.error("Error in asset assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { assetIds, userIds, role } = await request.json();

    if (!assetIds || !userIds || !role) {
      return NextResponse.json(
        { error: "Missing required fields: assetIds, userIds, role" },
        { status: 400 }
      );
    }

    // Delete assignments
    const { error } = await supabase
      .from("asset_assignments")
      .delete()
      .in("asset_id", assetIds)
      .in("user_id", userIds)
      .eq("role", role);

    if (error) {
      console.error("Error deleting asset assignments:", error);
      return NextResponse.json(
        { error: "Failed to delete assignments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Successfully removed assignments",
    });
  } catch (error) {
    console.error("Error in asset assignment deletion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
