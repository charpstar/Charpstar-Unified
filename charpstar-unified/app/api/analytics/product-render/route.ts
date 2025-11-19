import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

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

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Fetch all assets that have packshot_renders
    const query = supabase
      .from("assets")
      .select(
        "id, packshot_renders, product_name, article_id, created_at, client"
      )
      .not("packshot_renders", "is", null);

    const { data: assets, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch render data: ${error.message}`);
    }

    // Extract all packshots from assets
    const allPackshots: any[] = [];
    const assetRenderCounts: any = {};

    assets?.forEach((asset) => {
      if (
        Array.isArray(asset.packshot_renders) &&
        asset.packshot_renders.length > 0
      ) {
        asset.packshot_renders.forEach((packshot: any) => {
          // Apply date filter
          const packshotDate = new Date(packshot.created_at);
          const shouldInclude =
            (!startDate || packshotDate >= new Date(startDate)) &&
            (!endDate || packshotDate <= new Date(endDate));

          if (shouldInclude) {
            allPackshots.push({
              ...packshot,
              asset_id: asset.id,
              asset_name: asset.product_name,
              article_id: asset.article_id,
              asset_client: asset.client,
            });

            // Count renders per asset
            const key = `${asset.article_id || asset.id}`;
            assetRenderCounts[key] = {
              asset_id: asset.id,
              asset_name: asset.product_name,
              article_id: asset.article_id,
              count: (assetRenderCounts[key]?.count || 0) + 1,
            };
          }
        });
      }
    });

    const totalRenders = allPackshots.length;

    // By resolution
    const byResolution = allPackshots.reduce((acc: any, packshot) => {
      const resolution =
        packshot.render_settings?.resolution?.toString() || "Unknown";
      acc[resolution] = (acc[resolution] || 0) + 1;
      return acc;
    }, {});

    // By format
    const byFormat = allPackshots.reduce((acc: any, packshot) => {
      const format = packshot.render_settings?.format || "Unknown";
      acc[format] = (acc[format] || 0) + 1;
      return acc;
    }, {});

    // By view angle
    const byView = allPackshots.reduce((acc: any, packshot) => {
      const view = packshot.render_settings?.view || "Unknown";
      acc[view] = (acc[view] || 0) + 1;
      return acc;
    }, {});

    // By background type
    const byBackground = allPackshots.reduce((acc: any, packshot) => {
      const bg = packshot.render_settings?.background || "Unknown";
      const bgType = bg.startsWith("#")
        ? "Color"
        : bg === "transparent"
          ? "Transparent"
          : "Other";
      acc[bgType] = (acc[bgType] || 0) + 1;
      return acc;
    }, {});

    // By client
    const byClient = allPackshots.reduce((acc: any, packshot) => {
      const client = packshot.client || "Unknown";
      acc[client] = (acc[client] || 0) + 1;
      return acc;
    }, {});

    // Most rendered assets (top 10)
    const topAssets = Object.values(assetRenderCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Render trends over time (last 30 days)
    const trends: any[] = [];
    if (allPackshots.length > 0) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentPackshots = allPackshots.filter(
        (p) => new Date(p.created_at) >= thirtyDaysAgo
      );

      // Group by date
      const byDate = recentPackshots.reduce((acc: any, packshot) => {
        const date = new Date(packshot.created_at).toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            count: 0,
            formats: {},
            resolutions: {},
          };
        }
        acc[date].count++;
        const format = packshot.render_settings?.format || "Unknown";
        const resolution =
          packshot.render_settings?.resolution?.toString() || "Unknown";
        acc[date].formats[format] = (acc[date].formats[format] || 0) + 1;
        acc[date].resolutions[resolution] =
          (acc[date].resolutions[resolution] || 0) + 1;
        return acc;
      }, {});

      trends.push(...Object.values(byDate));
      trends.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }

    // Average renders per asset
    const assetsWithRenders = Object.keys(assetRenderCounts).length;
    const avgRendersPerAsset =
      assetsWithRenders > 0
        ? Math.round((totalRenders / assetsWithRenders) * 10) / 10
        : 0;

    return NextResponse.json({
      success: true,
      analytics: {
        totalRenders,
        totalAssetsRendered: assetsWithRenders,
        avgRendersPerAsset,
        byResolution,
        byFormat,
        byView,
        byBackground,
        byClient,
        topAssets,
        trends,
        isAdmin,
      },
    });
  } catch (error: any) {
    console.error("Product render analytics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
