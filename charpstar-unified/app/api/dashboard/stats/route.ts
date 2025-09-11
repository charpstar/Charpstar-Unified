import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch dashboard statistics
    const [{ count: totalModels, error: modelsError }] = await Promise.all([
      // Count total models (assets)
      supabase.from("assets").select("*", { count: "exact", head: true }),

      // Count unique categories
      supabase
        .from("assets")
        .select("category", { count: "exact", head: true })
        .not("category", "is", null),

      // Count unique materials
      supabase
        .from("assets")
        .select("materials", { count: "exact", head: true })
        .not("materials", "is", null),

      // Count unique colors
      supabase
        .from("assets")
        .select("colors", { count: "exact", head: true })
        .not("colors", "is", null),
    ]);

    // Handle errors
    if (modelsError) {
      console.error("Error fetching total models:", modelsError);
    }

    // Get unique categories count
    let uniqueCategoriesCount = 0;
    try {
      const { data: categoriesData } = await supabase
        .from("assets")
        .select("category")
        .not("category", "is", null);

      if (categoriesData) {
        const uniqueCategories = new Set(
          categoriesData.map((item) => item.category).filter(Boolean)
        );
        uniqueCategoriesCount = uniqueCategories.size;
      }
    } catch (error) {
      console.error("Error calculating unique categories:", error);
    }

    // Get unique materials count
    let uniqueMaterialsCount = 0;
    try {
      const { data: materialsData } = await supabase
        .from("assets")
        .select("materials")
        .not("materials", "is", null);

      if (materialsData) {
        const allMaterials = new Set<string>();
        materialsData.forEach((item) => {
          if (item.materials && Array.isArray(item.materials)) {
            item.materials.forEach((material: string) => {
              if (material) {
                allMaterials.add(material.replace(/[[\]"]/g, ""));
              }
            });
          }
        });
        uniqueMaterialsCount = allMaterials.size;
      }
    } catch (error) {
      console.error("Error calculating unique materials:", error);
    }

    // Get unique colors count
    let uniqueColorsCount = 0;
    try {
      const { data: colorsData } = await supabase
        .from("assets")
        .select("colors")
        .not("colors", "is", null);

      if (colorsData) {
        const allColors = new Set<string>();
        colorsData.forEach((item) => {
          if (item.colors && Array.isArray(item.colors)) {
            item.colors.forEach((color: string) => {
              if (color) {
                allColors.add(color.replace(/[[\]"]/g, ""));
              }
            });
          }
        });
        uniqueColorsCount = allColors.size;
      }
    } catch (error) {
      console.error("Error calculating unique colors:", error);
    }

    // Get recent activity count (last 7 days)
    let recentActivityCount = 0;
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentCount } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

      recentActivityCount = recentCount || 0;
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }

    // Get category breakdown
    let categoryBreakdown: { category: string; count: number }[] = [];
    try {
      const { data: categoryData } = await supabase
        .from("assets")
        .select("category")
        .not("category", "is", null);

      if (categoryData) {
        const categoryCounts: Record<string, number> = {};
        categoryData.forEach((item) => {
          if (item.category) {
            categoryCounts[item.category] =
              (categoryCounts[item.category] || 0) + 1;
          }
        });

        categoryBreakdown = Object.entries(categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 categories
      }
    } catch (error) {
      console.error("Error calculating category breakdown:", error);
    }

    const stats = {
      totalModels: totalModels || 0,
      totalCategories: uniqueCategoriesCount,
      totalMaterials: uniqueMaterialsCount,
      totalColors: uniqueColorsCount,
      recentActivity: recentActivityCount,
      categoryBreakdown,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
