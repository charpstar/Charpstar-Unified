import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
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

    const { assetIds, userIds, role, deadline, bonus, allocationName, prices } =
      await request.json();

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

    // For modeler assignments, create allocation lists
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

      // Create allocation lists for each modeler
      const allocationLists = [];
      const assignments = [];
      const assignmentDetails = [];

      for (const userId of userIds) {
        // Create allocation list
        const allocationList = {
          name:
            allocationName ||
            `Allocation ${new Date().toISOString().split("T")[0]}`,
          user_id: userId,
          role: role,
          assigned_by: user.id,
          deadline: deadline,
          bonus: bonus || 0,
          created_at: new Date().toISOString(),
        };

        const { data: listData, error: listError } = await supabaseAdmin
          .from("allocation_lists")
          .insert(allocationList)
          .select()
          .single();

        if (listError) {
          console.error("Error creating allocation list:", listError);
          return NextResponse.json(
            { error: "Failed to create allocation list" },
            { status: 500 }
          );
        }

        allocationLists.push(listData);

        // Create asset assignments linked to this allocation list
        for (const assetId of assetIds) {
          const assignment = {
            asset_id: assetId,
            user_id: userId,
            role: role,
            allocation_list_id: listData.id,
            status: "pending",
            price: prices?.[assetId] || 0,
            assigned_by: user.id,
            start_time: new Date().toISOString(),
          };
          assignments.push(assignment);
          assignmentDetails.push({
            assetId: assetId,
            userId: userId,
            allocationListId: listData.id,
          });
        }
      }

      // Insert all assignments
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

      // Send notifications to assigned modelers
      try {
        for (const userId of userIds) {
          // Get user details
          const { data: userProfile, error: userError } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", userId)
            .single();

          if (userError || !userProfile) {
            console.error(
              `Error fetching user profile for ${userId}:`,
              userError
            );
            continue;
          }

          // Get asset details for this user's assignments
          const userAssignments = assignments.filter(
            (a) => a.user_id === userId
          );
          const assetIds = userAssignments.map((a) => a.asset_id);

          // Get asset names
          const { data: assetDetails, error: assetError } = await supabase
            .from("onboarding_assets")
            .select("product_name, client")
            .in("id", assetIds);

          if (assetError) {
            console.error("Error fetching asset details:", assetError);
            continue;
          }

          const assetNames = assetDetails?.map((a) => a.product_name) || [];
          const client = assetDetails?.[0]?.client || "Unknown";
          const totalPrice = userAssignments.reduce(
            (sum, a) => sum + (a.price || 0),
            0
          );

          // Send notification
          await notificationService.sendAssetAllocationNotification({
            modelerId: userId,
            modelerEmail: userProfile.email,
            assetIds: assetIds,
            assetNames: assetNames,
            deadline: deadline,
            price: totalPrice,
            bonus: bonus || 0,
            client: client,
          });
        }
      } catch (notificationError) {
        console.error("Failed to send notifications:", notificationError);
        // Don't fail the entire request if notifications fail
      }

      const message = `Successfully created ${allocationLists.length} allocation list(s) with ${assignments.length} asset(s)`;

      return NextResponse.json({
        message: message,
        data: data,
        allocationLists: allocationLists,
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
