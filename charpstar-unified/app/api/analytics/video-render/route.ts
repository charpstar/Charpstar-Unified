import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { Pool } from "pg";

// Create a direct PostgreSQL connection pool for complex queries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

interface VideoRenderAnalyticsRow {
  id: string;
  user_id: string;
  user_email: string | null;
  client_name: string;
  object_type: string | null;
  scene_description: string | null;
  resolution: string;
  duration_seconds: number;
  inspiration_used: boolean;
  multi_asset_mode: boolean;
  asset_count: number;
  status: string;
  error_message: string | null;
  generation_time_ms: number | null;
  saved_to_library: boolean;
  saved_asset_id: string | null;
  downloaded: boolean;
  created_at: string;
}

async function runQuery<T = any>(
  sql: string,
  params: Array<string | number | boolean | Date>
): Promise<{ rows: T[] }> {
  try {
    const result = await pool.query(sql, params);
    return { rows: result.rows as T[] };
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

function processAnalyticsData(analyticsData: VideoRenderAnalyticsRow[]) {
  const totalGenerations = analyticsData.length;
  const successfulGenerations = analyticsData.filter(
    (r) => r.status === "success"
  ).length;
  const totalSaves = analyticsData.filter((r) => r.saved_to_library).length;
  const totalDownloads = analyticsData.filter((r) => r.downloaded).length;
  const conversionRate =
    totalGenerations > 0
      ? Math.round((totalSaves / totalGenerations) * 100)
      : 0;
  const successRate =
    totalGenerations > 0
      ? Math.round((successfulGenerations / totalGenerations) * 100)
      : 0;

  // Calculate average generation time (only for successful generations)
  const generationTimes = analyticsData
    .filter((r) => r.status === "success" && r.generation_time_ms)
    .map((r) => r.generation_time_ms!);
  const averageGenerationTime =
    generationTimes.length > 0
      ? Math.round(
          generationTimes.reduce((sum, time) => sum + time, 0) /
            generationTimes.length
        )
      : 0;

  // Usage over time (group by date)
  const usageByDate: {
    [date: string]: { generations: number; saves: number; downloads: number };
  } = {};

  analyticsData.forEach((record) => {
    const date = new Date(record.created_at).toISOString().split("T")[0];
    if (!usageByDate[date]) {
      usageByDate[date] = { generations: 0, saves: 0, downloads: 0 };
    }
    usageByDate[date].generations++;
    if (record.saved_to_library) usageByDate[date].saves++;
    if (record.downloaded) usageByDate[date].downloads++;
  });

  const usageOverTime = Object.entries(usageByDate)
    .map(([date, data]) => ({
      date,
      generations: data.generations,
      saves: data.saves,
      downloads: data.downloads,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top users by generation count
  const userStats: {
    [key: string]: {
      client: string;
      email: string;
      generations: number;
      saves: number;
      downloads: number;
    };
  } = {};

  analyticsData.forEach((record) => {
    const key = `${record.client_name}::${record.user_email}`;
    if (!userStats[key]) {
      userStats[key] = {
        client: record.client_name || "Unknown",
        email: record.user_email || "Unknown",
        generations: 0,
        saves: 0,
        downloads: 0,
      };
    }
    userStats[key].generations++;
    if (record.saved_to_library) userStats[key].saves++;
    if (record.downloaded) userStats[key].downloads++;
  });

  const topUsers = Object.values(userStats)
    .map((user) => ({
      ...user,
      conversionRate:
        user.generations > 0
          ? Math.round((user.saves / user.generations) * 100)
          : 0,
    }))
    .sort((a, b) => b.generations - a.generations)
    .slice(0, 10);

  // Resolution distribution
  const resolutionCounts: { [key: string]: number } = {};
  analyticsData.forEach((record) => {
    const resolution = record.resolution || "Unknown";
    resolutionCounts[resolution] = (resolutionCounts[resolution] || 0) + 1;
  });

  const resolutionDistribution = Object.entries(resolutionCounts)
    .map(([resolution, count]) => ({
      resolution,
      count,
      percentage: Math.round((count / totalGenerations) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Duration distribution
  const durationCounts: { [key: string]: number } = {};
  analyticsData.forEach((record) => {
    const duration = `${record.duration_seconds}s`;
    durationCounts[duration] = (durationCounts[duration] || 0) + 1;
  });

  const durationDistribution = Object.entries(durationCounts)
    .map(([duration, count]) => ({
      duration,
      count,
      percentage: Math.round((count / totalGenerations) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Conversion rate trend (by date)
  const conversionByDate: {
    [date: string]: { total: number; saved: number };
  } = {};

  analyticsData.forEach((record) => {
    const date = new Date(record.created_at).toISOString().split("T")[0];
    if (!conversionByDate[date]) {
      conversionByDate[date] = { total: 0, saved: 0 };
    }
    conversionByDate[date].total++;
    if (record.saved_to_library) conversionByDate[date].saved++;
  });

  const conversionRateTrend = Object.entries(conversionByDate)
    .map(([date, data]) => ({
      date,
      conversionRate:
        data.total > 0 ? Math.round((data.saved / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Detailed generations (last 100)
  const detailedGenerations = analyticsData.slice(0, 100).map((record) => ({
    id: record.id,
    date: new Date(record.created_at).toLocaleDateString(),
    time: new Date(record.created_at).toLocaleTimeString(),
    client: record.client_name || "Unknown",
    email: record.user_email || "Unknown",
    objectType: record.object_type || "Unknown",
    resolution: record.resolution,
    duration: `${record.duration_seconds}s`,
    status: record.status,
    saved: record.saved_to_library,
    downloaded: record.downloaded,
    generationTime: record.generation_time_ms
      ? Math.round(record.generation_time_ms / 1000)
      : null,
    errorMessage: record.error_message,
    inspirationUsed: record.inspiration_used,
    multiAssetMode: record.multi_asset_mode,
    assetCount: record.asset_count,
  }));

  // Feature adoption metrics
  const inspirationUsedCount = analyticsData.filter(
    (r) => r.inspiration_used
  ).length;
  const multiAssetModeCount = analyticsData.filter(
    (r) => r.multi_asset_mode
  ).length;

  const featureAdoption = {
    inspirationUsed: inspirationUsedCount,
    multiAssetMode: multiAssetModeCount,
    totalGenerations,
    inspirationPercentage:
      totalGenerations > 0
        ? Math.round((inspirationUsedCount / totalGenerations) * 100)
        : 0,
    multiAssetPercentage:
      totalGenerations > 0
        ? Math.round((multiAssetModeCount / totalGenerations) * 100)
        : 0,
  };

  // Object type distribution
  const objectTypeCounts: { [key: string]: number } = {};
  analyticsData.forEach((record) => {
    const objectType = record.object_type || "Unknown";
    objectTypeCounts[objectType] = (objectTypeCounts[objectType] || 0) + 1;
  });

  const objectTypeDistribution = Object.entries(objectTypeCounts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / totalGenerations) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    summary: {
      totalGenerations,
      totalSaves,
      totalDownloads,
      conversionRate,
      averageGenerationTime,
      successRate,
    },
    usageOverTime,
    topUsers,
    resolutionDistribution,
    durationDistribution,
    objectTypeDistribution,
    conversionRateTrend,
    detailedGenerations,
    featureAdoption,
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters for date filtering and client filter
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientName = searchParams.get("clientName") || null;

    // Calculate date range - default to last 30 days if not provided
    const startDateFilter = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDateFilter = endDate ? new Date(endDate) : new Date();

    console.log(
      `[Video Analytics] Query params: startDate=${startDateFilter.toISOString()}, endDate=${endDateFilter.toISOString()}, clientName=${clientName}`
    );

    // Check if DATABASE_URL is configured for direct PostgreSQL access
    if (!process.env.DATABASE_URL) {
      console.warn(
        "[Video Analytics] DATABASE_URL not configured, using Supabase client"
      );

      // Fallback to Supabase client
      let query = supabase
        .from("video_render_analytics")
        .select("*")
        .gte("created_at", startDateFilter.toISOString())
        .lte("created_at", endDateFilter.toISOString())
        .order("created_at", { ascending: false });

      if (clientName) {
        query = query.eq("client_name", clientName);
      }

      const { data: analyticsData, error: queryError } = await query;

      if (queryError) {
        throw new Error(`Supabase query error: ${queryError.message}`);
      }

      console.log(
        `[Video Analytics] Found ${analyticsData?.length || 0} records (via Supabase)`
      );

      // Transform Supabase data to match expected format
      const transformedData: VideoRenderAnalyticsRow[] = (
        analyticsData || []
      ).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email,
        client_name: row.client_name,
        object_type: row.object_type,
        scene_description: row.scene_description,
        resolution: row.resolution,
        duration_seconds: row.duration_seconds,
        inspiration_used: row.inspiration_used,
        multi_asset_mode: row.multi_asset_mode || false,
        asset_count: row.asset_count || 1,
        status: row.status,
        error_message: row.error_message,
        generation_time_ms: row.generation_time_ms,
        saved_to_library: row.saved_to_library,
        saved_asset_id: row.saved_asset_id,
        downloaded: row.downloaded,
        created_at: row.created_at,
      }));

      // Continue with processing using transformedData
      const analyticsDataToProcess = transformedData;

      console.log(
        `[Video Analytics] Processing ${analyticsDataToProcess.length} records`
      );

      if (!analyticsDataToProcess || analyticsDataToProcess.length === 0) {
        return NextResponse.json({
          summary: {
            totalGenerations: 0,
            totalSaves: 0,
            totalDownloads: 0,
            conversionRate: 0,
            averageGenerationTime: 0,
            successRate: 0,
          },
          usageOverTime: [],
          topUsers: [],
          resolutionDistribution: [],
          durationDistribution: [],
          conversionRateTrend: [],
          detailedGenerations: [],
          featureAdoption: {},
          objectTypeDistribution: [],
        });
      }

      // Use the same processing logic as below
      return processAnalyticsData(analyticsDataToProcess);
    }

    // Original PostgreSQL pool logic
    const params: Array<string | Date> = [startDateFilter, endDateFilter];
    let sql = `
      SELECT *
      FROM video_render_analytics
      WHERE created_at BETWEEN $1 AND $2
    `;

    if (clientName) {
      params.push(clientName);
      sql += ` AND client_name = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";

    const { rows: analyticsData } = await runQuery<VideoRenderAnalyticsRow>(
      sql,
      params
    );

    console.log(
      `[Video Analytics] Found ${analyticsData?.length || 0} records (via PostgreSQL)`
    );

    if (!analyticsData || analyticsData.length === 0) {
      return NextResponse.json({
        summary: {
          totalGenerations: 0,
          totalSaves: 0,
          totalDownloads: 0,
          conversionRate: 0,
          averageGenerationTime: 0,
          successRate: 0,
        },
        usageOverTime: [],
        topUsers: [],
        resolutionDistribution: [],
        durationDistribution: [],
        conversionRateTrend: [],
        detailedGenerations: [],
        featureAdoption: {},
        objectTypeDistribution: [],
      });
    }

    // Process and return the analytics data
    return processAnalyticsData(analyticsData);
  } catch (error: any) {
    console.error("Video render analytics error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch video render analytics",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
