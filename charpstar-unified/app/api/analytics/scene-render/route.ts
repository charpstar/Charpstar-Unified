import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientName = searchParams.get("clientName");
    const timeRange = searchParams.get("timeRange") || "7d"; // 7d, 30d, 90d, real-time

    // Calculate date range based on timeRange parameter
    let startDateFilter: string;
    // Set end date to end of today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let endDateFilter: string = today.toISOString();

    if (startDate && endDate) {
      startDateFilter = startDate;
      endDateFilter = endDate;
    } else {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      switch (timeRange) {
        case "real-time":
          startDateFilter = new Date(
            startOfDay.getTime() - 24 * 60 * 60 * 1000
          ).toISOString(); // Last 24 hours from start of today
          break;
        case "7d":
          // 7 days including today means 6 days back from start of today
          startDateFilter = new Date(
            startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000
          ).toISOString();
          break;
        case "30d":
          // 30 days including today means 29 days back from start of today
          startDateFilter = new Date(
            startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000
          ).toISOString();
          break;
        case "90d":
          // 90 days including today means 89 days back from start of today
          startDateFilter = new Date(
            startOfDay.getTime() - 89 * 24 * 60 * 60 * 1000
          ).toISOString();
          break;
        default:
          startDateFilter = new Date(
            startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000
          ).toISOString();
      }
    }

    // Build query filters
    let query = supabase
      .from("scene_render_analytics")
      .select("*")
      .gte("created_at", startDateFilter)
      .lte("created_at", endDateFilter);

    if (clientName) {
      query = query.eq("client_name", clientName);
    }

    const { data: analyticsData, error } = await query;

    if (error) {
      console.error("Error fetching analytics data:", error);
      return NextResponse.json(
        { error: "Failed to fetch analytics data" },
        { status: 500 }
      );
    }

    if (!analyticsData) {
      return NextResponse.json({
        summary: {
          totalRenders: 0,
          totalSaves: 0,
          conversionRate: 0,
          averageGenerationTime: 0,
          successRate: 0,
        },
        usageOverTime: [],
        topUsers: [],
        formatDistribution: [],
        conversionRateTrend: [],
        detailedRenders: [],
      });
    }

    // Calculate summary statistics
    const totalRenders = analyticsData.length;
    const totalSaves = analyticsData.filter(
      (item) => item.saved_to_library
    ).length;
    const conversionRate =
      totalRenders > 0 ? (totalSaves / totalRenders) * 100 : 0;
    const successfulRenders = analyticsData.filter(
      (item) => item.status === "success"
    ).length;
    const successRate =
      totalRenders > 0 ? (successfulRenders / totalRenders) * 100 : 0;

    const generationTimes = analyticsData
      .filter((item) => item.generation_time_ms)
      .map((item) => item.generation_time_ms);
    const averageGenerationTime =
      generationTimes.length > 0
        ? generationTimes.reduce((sum, time) => sum + time, 0) /
          generationTimes.length
        : 0;

    // Helper function to fill in all dates in the range
    const fillDateRange = (start: string, end: string) => {
      const dates: string[] = [];
      // Get the date part only (YYYY-MM-DD)
      const startDateStr = start.split("T")[0];
      const endDateStr = end.split("T")[0];

      // Parse dates without timezone to avoid issues
      const startYear = parseInt(startDateStr.split("-")[0]);
      const startMonth = parseInt(startDateStr.split("-")[1]) - 1;
      const startDay = parseInt(startDateStr.split("-")[2]);

      const endYear = parseInt(endDateStr.split("-")[0]);
      const endMonth = parseInt(endDateStr.split("-")[1]) - 1;
      const endDay = parseInt(endDateStr.split("-")[2]);

      const currentDate = new Date(startYear, startMonth, startDay);
      const endDate = new Date(endYear, endMonth, endDay);

      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const day = String(currentDate.getDate()).padStart(2, "0");
        dates.push(`${year}-${month}-${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return dates;
    };

    // Group by date for usage over time
    const usageByDate = analyticsData.reduce(
      (acc, item) => {
        const date = new Date(item.created_at).toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = { renders: 0, saves: 0 };
        }
        acc[date].renders++;
        if (item.saved_to_library) {
          acc[date].saves++;
        }
        return acc;
      },
      {} as Record<string, { renders: number; saves: number }>
    );

    // Fill in all dates in the range
    const allDates = fillDateRange(startDateFilter, endDateFilter);
    const usageOverTime = allDates.map((date) => ({
      date,
      renders: usageByDate[date]?.renders || 0,
      saves: usageByDate[date]?.saves || 0,
    }));

    // Top users by render count
    const userStats = analyticsData.reduce(
      (acc, item) => {
        if (!acc[item.client_name]) {
          acc[item.client_name] = {
            renders: 0,
            saves: 0,
            email: item.user_email || "",
          };
        }
        acc[item.client_name].renders++;
        if (item.saved_to_library) {
          acc[item.client_name].saves++;
        }
        return acc;
      },
      {} as Record<string, { renders: number; saves: number; email: string }>
    );

    const topUsers = (
      Object.entries(userStats) as [
        string,
        { renders: number; saves: number; email: string },
      ][]
    )
      .map(([client, stats]) => ({
        client,
        email: stats.email,
        renders: stats.renders,
        saves: stats.saves,
        conversionRate:
          stats.renders > 0 ? (stats.saves / stats.renders) * 100 : 0,
      }))
      .sort((a, b) => b.renders - a.renders)
      .slice(0, 10);

    // Image format distribution
    const formatStats = analyticsData.reduce(
      (acc, item) => {
        const format = item.image_format || "unknown";
        acc[format] = (acc[format] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const formatDistribution = (
      Object.entries(formatStats) as [string, number][]
    )
      .map(([format, count]) => ({
        format,
        count,
        percentage: totalRenders > 0 ? (count / totalRenders) * 100 : 0,
      }))
      .filter((item) => item.count > 0) // Only include formats with count > 0
      .sort((a, b) => b.count - a.count);

    // Conversion rate trend (daily)
    const conversionRateTrend = usageOverTime.map((day) => ({
      date: day.date,
      conversionRate: day.renders > 0 ? (day.saves / day.renders) * 100 : 0,
    }));

    // Detailed renders for table (last 50)
    const detailedRenders = analyticsData
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 50)
      .map((item) => ({
        id: item.id,
        date: new Date(item.created_at).toISOString().split("T")[0],
        time: new Date(item.created_at)
          .toISOString()
          .split("T")[1]
          .split(".")[0],
        client: item.client_name,
        email: item.user_email || "",
        objectType: item.object_type,
        format: item.image_format,
        status: item.status,
        saved: item.saved_to_library,
        generationTime: item.generation_time_ms,
        errorMessage: item.error_message,
      }));

    return NextResponse.json({
      summary: {
        totalRenders,
        totalSaves,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageGenerationTime: Math.round(averageGenerationTime),
        successRate: Math.round(successRate * 100) / 100,
      },
      usageOverTime,
      topUsers,
      formatDistribution,
      conversionRateTrend,
      detailedRenders,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
