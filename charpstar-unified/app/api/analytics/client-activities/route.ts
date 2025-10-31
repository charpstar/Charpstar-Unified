import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Track a client activity
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { activity_type, activity_data, session_id, ip_address, user_agent } =
      body;

    // Get user info from auth token if available
    const authHeader = request.headers.get("authorization");
    let user_id: string | null = null;
    let user_email: string | null = null;
    let client_name: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (user && !error) {
          user_id = user.id;
          user_email = user.email || null;

          // Get client name from user profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("client")
            .eq("id", user.id)
            .single();

          if (profile?.client) {
            client_name = Array.isArray(profile.client)
              ? profile.client[0]
              : profile.client;
          }
        }
      } catch (error) {
        console.warn("Error getting user session:", error);
      }
    }

    // If client_name is not set, try to get from request body
    if (!client_name && body.client_name) {
      client_name = body.client_name;
    }

    // Validate required fields
    if (!activity_type) {
      return NextResponse.json(
        { error: "activity_type is required" },
        { status: 400 }
      );
    }

    // Get IP address from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");
    const extractedIp =
      ip_address ||
      forwardedFor?.split(",")[0]?.trim() ||
      realIp ||
      cfConnectingIp ||
      null;

    // Insert analytics record
    const { data, error } = await supabase
      .from("client_analytics")
      .insert({
        user_id,
        user_email,
        client_name: client_name || "Unknown",
        activity_type,
        activity_data: activity_data || {},
        session_id,
        ip_address: extractedIp,
        user_agent: user_agent || request.headers.get("user-agent") || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting client analytics:", error);
      return NextResponse.json(
        { error: "Failed to track activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analytics_id: data.id,
    });
  } catch (error) {
    console.error("Client activities tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "7d";
    const clientName = searchParams.get("clientName");

    const supabase = createAdminClient();

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "real-time":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Build query
    let query = supabase
      .from("client_analytics")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    // Filter by client if specified
    if (clientName && clientName !== "all") {
      query = query.eq("client_name", clientName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching client analytics:", error);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Process data for different activity types
    const logins = data.filter((d) => d.activity_type === "login");
    const sceneRenders = data.filter((d) => d.activity_type === "scene_render");

    // Calculate statistics
    const uniqueUsers = new Set(data.map((d) => d.user_id).filter(Boolean))
      .size;
    const totalLogins = logins.length;
    const totalSceneRenders = sceneRenders.length;

    // Get per-client breakdown
    const clientBreakdown = data.reduce(
      (acc, item) => {
        if (!acc[item.client_name]) {
          acc[item.client_name] = {
            logins: 0,
            sceneRenders: 0,
            other: 0,
          };
        }
        if (item.activity_type === "login") {
          acc[item.client_name].logins++;
        } else if (item.activity_type === "scene_render") {
          acc[item.client_name].sceneRenders++;
        } else {
          acc[item.client_name].other++;
        }
        return acc;
      },
      {} as Record<
        string,
        { logins: number; sceneRenders: number; other: number }
      >
    );

    // Daily activity summary
    const dailyActivity = data.reduce(
      (acc, item) => {
        const date = new Date(item.created_at).toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = { logins: 0, sceneRenders: 0, other: 0 };
        }
        if (item.activity_type === "login") {
          acc[date].logins++;
        } else if (item.activity_type === "scene_render") {
          acc[date].sceneRenders++;
        } else {
          acc[date].other++;
        }
        return acc;
      },
      {} as Record<
        string,
        { logins: number; sceneRenders: number; other: number }
      >
    );

    return NextResponse.json({
      success: true,
      summary: {
        uniqueUsers,
        totalLogins,
        totalSceneRenders,
        totalActivities: data.length,
      },
      clientBreakdown,
      dailyActivity: Object.entries(dailyActivity).map(([date, counts]) => {
        const typedCounts = counts as {
          logins: number;
          sceneRenders: number;
          other: number;
        };
        return {
          date,
          logins: typedCounts.logins,
          sceneRenders: typedCounts.sceneRenders,
          other: typedCounts.other,
        };
      }),
      rawData: data,
    });
  } catch (error) {
    console.error("Error in GET client activities:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
