import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

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

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build base query
    let query = supabase.from("generated_models").select("*");

    // Non-admins only see their own data
    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    // Apply date filters if provided
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: models, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }

    // Calculate analytics
    const totalGenerations = models?.length || 0;

    // By generation type
    const byGenerationType = models?.reduce((acc: any, model) => {
      const type = model.generate_type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // By image mode
    const byImageMode = models?.reduce((acc: any, model) => {
      const mode = model.image_mode || "Unknown";
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    // PBR enabled vs disabled
    const pbrEnabled = models?.filter((m) => m.enable_pbr).length || 0;
    const pbrDisabled = totalGenerations - pbrEnabled;

    // Average face count
    const avgFaceCount =
      models && models.length > 0
        ? Math.round(
            models.reduce((sum, m) => sum + (m.face_count || 0), 0) /
              models.length
          )
        : 0;

    // Average file size
    const avgFileSize =
      models && models.length > 0
        ? Math.round(
            models.reduce((sum, m) => sum + (m.file_size || 0), 0) /
              models.length
          )
        : 0;

    // Top users (admin only)
    let topUsers: any[] = [];
    if (isAdmin && models) {
      const userCounts = models.reduce((acc: any, model) => {
        acc[model.user_id] = (acc[model.user_id] || 0) + 1;
        return acc;
      }, {});

      const topUserIds = Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Fetch user details for top users
      const { createAdminClient } = await import("@/utils/supabase/admin");
      const adminClient = createAdminClient();

      topUsers = await Promise.all(
        topUserIds.map(async ({ userId, count }) => {
          try {
            // Get user from auth
            const { data: authUser } =
              await adminClient.auth.admin.getUserById(userId);

            // Get profile name
            const { data: profile } = await supabase
              .from("profiles")
              .select("title")
              .eq("id", userId)
              .single();

            const name =
              profile?.title ||
              authUser?.user?.user_metadata?.name ||
              `${authUser?.user?.user_metadata?.first_name || ""} ${authUser?.user?.user_metadata?.last_name || ""}`.trim() ||
              authUser?.user?.email?.split("@")[0] ||
              "Unknown User";

            return {
              userId,
              count,
              name,
              email: authUser?.user?.email || "N/A",
            };
          } catch (err) {
            console.error(`Failed to fetch user ${userId}:`, err);
            return {
              userId,
              count,
              name: "Unknown User",
              email: "N/A",
            };
          }
        })
      );
    }

    // Generation trends over time (last 30 days)
    const trends: any[] = [];
    if (models && models.length > 0) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentModels = models.filter(
        (m) => new Date(m.created_at) >= thirtyDaysAgo
      );

      // Group by date
      const byDate = recentModels.reduce((acc: any, model) => {
        const date = new Date(model.created_at).toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            count: 0,
            types: {},
          };
        }
        acc[date].count++;
        const type = model.generate_type || "Unknown";
        acc[date].types[type] = (acc[date].types[type] || 0) + 1;
        return acc;
      }, {});

      trends.push(...Object.values(byDate));
      trends.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }

    // Most popular face count ranges
    const faceCountRanges = {
      "0-100k": 0,
      "100k-500k": 0,
      "500k-1M": 0,
      "1M+": 0,
    };

    models?.forEach((model) => {
      const count = model.face_count || 0;
      if (count < 100000) faceCountRanges["0-100k"]++;
      else if (count < 500000) faceCountRanges["100k-500k"]++;
      else if (count < 1000000) faceCountRanges["500k-1M"]++;
      else faceCountRanges["1M+"]++;
    });

    return NextResponse.json({
      success: true,
      analytics: {
        totalGenerations,
        byGenerationType,
        byImageMode,
        pbrStats: {
          enabled: pbrEnabled,
          disabled: pbrDisabled,
        },
        avgFaceCount,
        avgFileSize,
        faceCountRanges,
        topUsers: isAdmin ? topUsers : [],
        trends,
        isAdmin,
      },
    });
  } catch (error: any) {
    console.error("Generator analytics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
