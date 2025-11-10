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

    if (!analyticsData || analyticsData.length === 0) {
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
        performanceMetrics: {
          hourlyUsage: [],
          dayOfWeekUsage: [],
          errorRateBreakdown: [],
          generationTimePercentiles: { p50: 0, p75: 0, p95: 0, p99: 0 },
          errorRate: 0,
        },
        engagementMetrics: {
          dailyActiveUsers: 0,
          weeklyActiveUsers: 0,
          monthlyActiveUsers: null,
          newUsers: 0,
          returningUsers: 0,
          clientGrowthRate: 0,
          growthRate: 0,
          churnRiskClients: [],
        },
        usageInsights: {
          formatPreferencesByClient: [],
          objectTypesByClient: [],
          frequencyDistribution: [],
          featureAdoption: {
            multiAssetMode: 0,
            inspirationUsed: 0,
            totalRenders: 0,
            multiAssetPercentage: 0,
            inspirationPercentage: 0,
          },
        },
        qualityMetrics: {
          successRateByFormat: [],
          successRateByObjectType: [],
          avgGenerationTimeByClient: [],
          reRenderRate: 0,
          reRenderPercentage: 0,
        },
        comparativeAnalytics: {
          periodComparison: {
            current: {
              totalRenders: 0,
              totalSaves: 0,
              conversionRate: 0,
              uniqueClients: 0,
              averageGenerationTime: 0,
            },
            previous: {
              totalRenders: 0,
              totalSaves: 0,
              conversionRate: 0,
              uniqueClients: 0,
              averageGenerationTime: 0,
            },
            growth: { renders: 0, saves: 0, conversionRate: 0, clients: 0 },
          },
          platformAverages: null,
        },
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

    // ========== PERFORMANCE & TIMING METRICS ==========

    // Hourly usage patterns
    const hourlyPatterns: Record<number, { renders: number; saves: number }> =
      {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyPatterns[hour] = { renders: 0, saves: 0 };
    }
    analyticsData.forEach((item) => {
      const hour = new Date(item.created_at).getHours();
      hourlyPatterns[hour].renders++;
      if (item.saved_to_library) {
        hourlyPatterns[hour].saves++;
      }
    });
    const hourlyUsage = Object.entries(hourlyPatterns).map(([hour, data]) => ({
      hour: parseInt(hour),
      renders: data.renders,
      saves: data.saves,
    }));

    // Day of week patterns
    const dayOfWeekPatterns: Record<
      number,
      { renders: number; saves: number }
    > = {};
    for (let day = 0; day < 7; day++) {
      dayOfWeekPatterns[day] = { renders: 0, saves: 0 };
    }
    analyticsData.forEach((item) => {
      const day = new Date(item.created_at).getDay();
      dayOfWeekPatterns[day].renders++;
      if (item.saved_to_library) {
        dayOfWeekPatterns[day].saves++;
      }
    });
    const dayOfWeekUsage = Object.entries(dayOfWeekPatterns).map(
      ([day, data]) => ({
        day: parseInt(day),
        dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
          parseInt(day)
        ],
        renders: data.renders,
        saves: data.saves,
      })
    );

    // Error rate trends by type
    const errorTypes = analyticsData
      .filter((item) => item.error_message)
      .reduce(
        (acc, item) => {
          const errorKey = item.error_message || "Unknown";
          acc[errorKey] = (acc[errorKey] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    const errorRateBreakdown = (
      Object.entries(errorTypes) as [string, number][]
    )
      .map(([error, count]) => ({
        error,
        count,
        percentage: (count / totalRenders) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generation time percentiles
    const sortedTimes = generationTimes.sort((a, b) => a - b);
    const percentiles = {
      p50:
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length * 0.5)]
          : 0,
      p75:
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length * 0.75)]
          : 0,
      p95:
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
          : 0,
      p99:
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length * 0.99)]
          : 0,
    };

    // ========== CLIENT ENGAGEMENT & RETENTION ==========

    // Get previous period data for comparison
    const previousStartDate = new Date(startDateFilter);
    const periodDays = Math.floor(
      (new Date(endDateFilter).getTime() -
        new Date(startDateFilter).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousEndDate = new Date(startDateFilter);

    const { data: previousData } = await supabase
      .from("scene_render_analytics")
      .select("*")
      .gte("created_at", previousStartDate.toISOString())
      .lt("created_at", previousEndDate.toISOString());

    const previousPeriodRenders = previousData?.length || 0;
    const growthRate =
      previousPeriodRenders > 0
        ? ((totalRenders - previousPeriodRenders) / previousPeriodRenders) * 100
        : 0;

    // Daily Active Users (DAU)
    const dailyActiveUsers = new Set(
      analyticsData.map((item) => {
        const date = new Date(item.created_at).toISOString().split("T")[0];
        return `${item.user_id || item.client_name}-${date}`;
      })
    ).size;

    // Weekly Active Users
    const weeklyActiveUsers = new Set(
      analyticsData
        .map((item) => item.user_id || item.client_name)
        .filter(Boolean)
    ).size;

    // Monthly Active Users (if timeRange is 30d or 90d)
    const monthlyActiveUsers =
      timeRange === "30d" || timeRange === "90d" ? weeklyActiveUsers : null;

    // New vs Returning users
    const userFirstSeen: Record<string, string> = {};
    const previousUserIds = new Set(
      previousData
        ?.map((item) => item.user_id || item.client_name)
        .filter(Boolean) || []
    );
    const currentUserIds = new Set(
      analyticsData
        .map((item) => item.user_id || item.client_name)
        .filter(Boolean)
    );

    analyticsData.forEach((item) => {
      const userId = item.user_id || item.client_name;
      if (userId && !userFirstSeen[userId]) {
        userFirstSeen[userId] = new Date(item.created_at)
          .toISOString()
          .split("T")[0];
      }
    });

    const newUsers = Array.from(currentUserIds).filter(
      (id) => !previousUserIds.has(id)
    ).length;
    const returningUsers = Array.from(currentUserIds).filter((id) =>
      previousUserIds.has(id)
    ).length;

    // Client growth rate
    const uniqueClients = new Set(analyticsData.map((item) => item.client_name))
      .size;
    const previousUniqueClients = new Set(
      previousData?.map((item) => item.client_name) || []
    ).size;
    const clientGrowthRate =
      previousUniqueClients > 0
        ? ((uniqueClients - previousUniqueClients) / previousUniqueClients) *
          100
        : uniqueClients > 0
          ? 100
          : 0;

    // Churn risk (clients with declining activity)
    const clientActivityByPeriod: Record<
      string,
      { current: number; previous: number }
    > = {};
    analyticsData.forEach((item) => {
      if (!clientActivityByPeriod[item.client_name]) {
        clientActivityByPeriod[item.client_name] = { current: 0, previous: 0 };
      }
      clientActivityByPeriod[item.client_name].current++;
    });
    previousData?.forEach((item) => {
      if (!clientActivityByPeriod[item.client_name]) {
        clientActivityByPeriod[item.client_name] = { current: 0, previous: 0 };
      }
      clientActivityByPeriod[item.client_name].previous++;
    });

    const churnRiskClients = Object.entries(clientActivityByPeriod)
      .filter(
        ([, activity]) =>
          activity.previous > 0 && activity.current < activity.previous * 0.5
      )
      .map(([client, activity]) => ({
        client,
        currentActivity: activity.current,
        previousActivity: activity.previous,
        declinePercentage:
          ((activity.previous - activity.current) / activity.previous) * 100,
      }))
      .sort((a, b) => b.declinePercentage - a.declinePercentage)
      .slice(0, 10);

    // ========== ADVANCED USAGE INSIGHTS ==========

    // Format preferences per client
    const clientFormatPreferences: Record<string, Record<string, number>> = {};
    analyticsData.forEach((item) => {
      if (!clientFormatPreferences[item.client_name]) {
        clientFormatPreferences[item.client_name] = {};
      }
      const format = item.image_format || "unknown";
      clientFormatPreferences[item.client_name][format] =
        (clientFormatPreferences[item.client_name][format] || 0) + 1;
    });
    const formatPreferencesByClient = Object.entries(
      clientFormatPreferences
    ).map(([client, formats]) => ({
      client,
      formats: Object.entries(formats)
        .map(([format, count]) => ({ format, count }))
        .sort((a, b) => b.count - a.count),
    }));

    // Most popular object types per client
    const clientObjectTypes: Record<string, Record<string, number>> = {};
    analyticsData.forEach((item) => {
      if (!clientObjectTypes[item.client_name]) {
        clientObjectTypes[item.client_name] = {};
      }
      const objectType = item.object_type || "unknown";
      clientObjectTypes[item.client_name][objectType] =
        (clientObjectTypes[item.client_name][objectType] || 0) + 1;
    });
    const objectTypesByClient = Object.entries(clientObjectTypes).map(
      ([client, types]) => ({
        client,
        types: Object.entries(types)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
      })
    );

    // Render frequency distribution
    const renderFrequency = analyticsData.reduce(
      (acc, item) => {
        const client = item.client_name;
        acc[client] = (acc[client] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const frequencyDistribution = [
      {
        range: "1-5 renders",
        count: (Object.values(renderFrequency) as number[]).filter(
          (c) => c >= 1 && c <= 5
        ).length,
      },
      {
        range: "6-10 renders",
        count: (Object.values(renderFrequency) as number[]).filter(
          (c) => c >= 6 && c <= 10
        ).length,
      },
      {
        range: "11-20 renders",
        count: (Object.values(renderFrequency) as number[]).filter(
          (c) => c >= 11 && c <= 20
        ).length,
      },
      {
        range: "21-50 renders",
        count: (Object.values(renderFrequency) as number[]).filter(
          (c) => c >= 21 && c <= 50
        ).length,
      },
      {
        range: "50+ renders",
        count: (Object.values(renderFrequency) as number[]).filter(
          (c) => c > 50
        ).length,
      },
    ];

    // Feature adoption (multi-asset mode, inspiration used)
    const featureAdoption = {
      multiAssetMode: analyticsData.filter((item) => item.multi_asset_mode)
        .length,
      inspirationUsed: analyticsData.filter((item) => item.inspiration_used)
        .length,
      totalRenders,
      multiAssetPercentage:
        (analyticsData.filter((item) => item.multi_asset_mode).length /
          totalRenders) *
        100,
      inspirationPercentage:
        (analyticsData.filter((item) => item.inspiration_used).length /
          totalRenders) *
        100,
    };

    // ========== QUALITY & EFFICIENCY METRICS ==========

    // Success rate by format
    const successRateByFormat: Record<
      string,
      { total: number; success: number }
    > = {};
    analyticsData.forEach((item) => {
      const format = item.image_format || "unknown";
      if (!successRateByFormat[format]) {
        successRateByFormat[format] = { total: 0, success: 0 };
      }
      successRateByFormat[format].total++;
      if (item.status === "success") {
        successRateByFormat[format].success++;
      }
    });
    const successRateByFormatData = Object.entries(successRateByFormat).map(
      ([format, data]) => ({
        format,
        total: data.total,
        success: data.success,
        successRate: (data.success / data.total) * 100,
      })
    );

    // Success rate by object type
    const successRateByObjectType: Record<
      string,
      { total: number; success: number }
    > = {};
    analyticsData.forEach((item) => {
      const type = item.object_type || "unknown";
      if (!successRateByObjectType[type]) {
        successRateByObjectType[type] = { total: 0, success: 0 };
      }
      successRateByObjectType[type].total++;
      if (item.status === "success") {
        successRateByObjectType[type].success++;
      }
    });
    const successRateByObjectTypeData = Object.entries(
      successRateByObjectType
    ).map(([type, data]) => ({
      type,
      total: data.total,
      success: data.success,
      successRate: (data.success / data.total) * 100,
    }));

    // Average generation time per client
    const generationTimeByClient: Record<string, number[]> = {};
    analyticsData.forEach((item) => {
      if (item.generation_time_ms) {
        if (!generationTimeByClient[item.client_name]) {
          generationTimeByClient[item.client_name] = [];
        }
        generationTimeByClient[item.client_name].push(item.generation_time_ms);
      }
    });
    const avgGenerationTimeByClient = Object.entries(generationTimeByClient)
      .map(([client, times]) => ({
        client,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        count: times.length,
      }))
      .sort((a, b) => a.averageTime - b.averageTime);

    // Re-render rate (failed renders that are retried)
    const reRenderRate = analyticsData.filter(
      (item) => item.status !== "success" && item.error_message
    ).length;
    const reRenderPercentage = (reRenderRate / totalRenders) * 100;

    // ========== COMPARATIVE ANALYTICS ==========

    const periodComparison = {
      current: {
        totalRenders,
        totalSaves,
        conversionRate,
        uniqueClients,
        averageGenerationTime,
      },
      previous: {
        totalRenders: previousPeriodRenders,
        totalSaves:
          previousData?.filter((item) => item.saved_to_library).length || 0,
        conversionRate:
          previousPeriodRenders > 0
            ? ((previousData?.filter((item) => item.saved_to_library).length ||
                0) /
                previousPeriodRenders) *
              100
            : 0,
        uniqueClients: previousUniqueClients,
        averageGenerationTime: previousData
          ? previousData
              .filter((item) => item.generation_time_ms)
              .reduce((sum, item) => sum + (item.generation_time_ms || 0), 0) /
              previousData.filter((item) => item.generation_time_ms).length || 0
          : 0,
      },
      growth: {
        renders: growthRate,
        saves: previousData
          ? ((totalSaves -
              (previousData.filter((item) => item.saved_to_library).length ||
                0)) /
              (previousData.filter((item) => item.saved_to_library).length ||
                1)) *
            100
          : 0,
        conversionRate: 0, // Will calculate below
        clients: clientGrowthRate,
      },
    };

    // Overall platform averages (for benchmarking)
    const { data: allTimeData } = await supabase
      .from("scene_render_analytics")
      .select("*")
      .limit(10000); // Sample for performance

    const platformAverages = allTimeData
      ? {
          averageConversionRate:
            allTimeData.length > 0
              ? (allTimeData.filter((item) => item.saved_to_library).length /
                  allTimeData.length) *
                100
              : 0,
          averageGenerationTime:
            allTimeData.filter((item) => item.generation_time_ms).length > 0
              ? allTimeData
                  .filter((item) => item.generation_time_ms)
                  .reduce(
                    (sum, item) => sum + (item.generation_time_ms || 0),
                    0
                  ) /
                allTimeData.filter((item) => item.generation_time_ms).length
              : 0,
          averageSuccessRate:
            allTimeData.length > 0
              ? (allTimeData.filter((item) => item.status === "success")
                  .length /
                  allTimeData.length) *
                100
              : 0,
        }
      : null;

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
      // Performance & Timing Metrics
      performanceMetrics: {
        hourlyUsage,
        dayOfWeekUsage,
        errorRateBreakdown,
        generationTimePercentiles: percentiles,
        errorRate:
          (errorRateBreakdown.reduce((sum, e) => sum + e.count, 0) /
            totalRenders) *
          100,
      },
      // Client Engagement & Retention
      engagementMetrics: {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        newUsers,
        returningUsers,
        clientGrowthRate,
        growthRate,
        churnRiskClients,
      },
      // Advanced Usage Insights
      usageInsights: {
        formatPreferencesByClient,
        objectTypesByClient,
        frequencyDistribution,
        featureAdoption,
      },
      // Quality & Efficiency Metrics
      qualityMetrics: {
        successRateByFormat: successRateByFormatData,
        successRateByObjectType: successRateByObjectTypeData,
        avgGenerationTimeByClient,
        reRenderRate,
        reRenderPercentage,
      },
      // Comparative Analytics
      comparativeAnalytics: {
        periodComparison,
        platformAverages,
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
