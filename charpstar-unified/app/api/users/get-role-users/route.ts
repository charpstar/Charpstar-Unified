import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const clientName = searchParams.get("client");
    const batchNumber = searchParams.get("batch");

    if (!role || !["modeler", "qa"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'modeler' or 'qa'" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get all users with the specified role
    const { data: allUsers, error: usersError } = await adminClient
      .from("profiles")
      .select(
        `
        id,
        email,
        role,
        title,
        phone_number,
        discord_name,
        software_experience,
        model_types,
        daily_hours,
        exclusive_work,
        country,
        portfolio_links,
        created_at,
        updated_at
      `
      )
      .eq("role", role)
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // If a specific client and batch are provided, filter out users already assigned to that specific batch
    let availableUsers = allUsers;
    if (clientName && batchNumber) {
      const { data: existingAssignments, error: assignmentsError } =
        await adminClient
          .from("user_batch_assignments")
          .select("user_id")
          .eq("client_name", clientName)
          .eq("batch_number", parseInt(batchNumber))
          .eq("role", role);

      if (assignmentsError) {
        console.error("Error fetching existing assignments:", assignmentsError);
      } else {
        const assignedUserIds = new Set(
          existingAssignments?.map((a) => a.user_id) || []
        );

        availableUsers = allUsers.filter(
          (user) => !assignedUserIds.has(user.id)
        );
      }
    }

    // Group users by experience level for modelers
    let categorizedUsers: any = availableUsers;
    if (role === "modeler") {
      const categorized = {
        experienced: [] as any[],
      };

      availableUsers.forEach((user: any) => {
        // Categorize based on software experience and daily hours
        const softwareCount = user.software_experience?.length || 0;
        const dailyHours = user.daily_hours || 0;
        const modelTypesCount = user.model_types?.length || 0;

        // Simple categorization logic
        if (softwareCount >= 4 && dailyHours >= 6 && modelTypesCount >= 3) {
          categorized.experienced.push(user);
        }
      });

      categorizedUsers = categorized;
    }

    return NextResponse.json({
      users: categorizedUsers,
      total: availableUsers.length,
    });
  } catch (error) {
    console.error("Error in get-role-users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
