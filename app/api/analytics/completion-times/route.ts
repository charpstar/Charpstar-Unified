import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "modeler";
    const userId = searchParams.get("userId"); // Optional: filter by specific user
    const days = parseInt(searchParams.get("days") || "30"); // Default to 30 days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query for completed assignments
    let query = supabase
      .from("asset_assignments")
      .select(
        `
        id,
        asset_id,
        user_id,
        role,
        start_time,
        end_time,
        profiles!inner(email, title)
      `
      )
      .eq("role", role)
      .not("end_time", "is", null)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString());

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: completedAssignments, error } = await query;

    if (error) {
      console.error("Error fetching completion times:", error);
      return NextResponse.json(
        { error: "Failed to fetch completion times" },
        { status: 500 }
      );
    }

    // Calculate statistics
    const completionTimes =
      completedAssignments?.map((assignment) => {
        const start = new Date(assignment.start_time);
        const end = new Date(assignment.end_time);
        return {
          ...assignment,
          durationHours: (end.getTime() - start.getTime()) / (1000 * 60 * 60),
          durationDays:
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        };
      }) || [];

    // Calculate averages
    const totalAssignments = completionTimes.length;
    const avgHours =
      totalAssignments > 0
        ? completionTimes.reduce((sum, item) => sum + item.durationHours, 0) /
          totalAssignments
        : 0;
    const avgDays =
      totalAssignments > 0
        ? completionTimes.reduce((sum, item) => sum + item.durationDays, 0) /
          totalAssignments
        : 0;

    // Group by user for per-user statistics
    const userStats = new Map();
    completionTimes.forEach((item) => {
      const profile = item.profiles as any;
      const userKey = profile.email;

      if (!userStats.has(userKey)) {
        userStats.set(userKey, {
          email: profile.email,
          name: profile.title,
          assignments: [],
          totalHours: 0,
          avgHours: 0,
        });
      }

      const userStat = userStats.get(userKey);
      userStat.assignments.push(item);
      userStat.totalHours += item.durationHours;
      userStat.avgHours = userStat.totalHours / userStat.assignments.length;
    });

    // Convert to array and sort by average completion time
    const userStatsArray = Array.from(userStats.values()).sort(
      (a, b) => a.avgHours - b.avgHours
    );

    return NextResponse.json({
      summary: {
        totalAssignments,
        averageHours: Math.round(avgHours * 100) / 100,
        averageDays: Math.round(avgDays * 100) / 100,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days,
        },
      },
      userStats: userStatsArray,
      detailedData: completionTimes,
    });
  } catch (error) {
    console.error("Error in completion times analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
