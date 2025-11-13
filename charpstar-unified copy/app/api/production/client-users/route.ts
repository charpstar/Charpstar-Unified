import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin or production role
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      (profile.role !== "admin" && profile.role !== "production")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all client users from profiles table
    const { data: profiles, error: profilesError } = await supabaseAuth
      .from("profiles")
      .select("id, email, role, client, created_at, title")
      .eq("role", "client")
      .order("created_at", { ascending: false });

    if (profilesError) {
      throw profilesError;
    }

    // Get user names from auth metadata using admin client and asset counts
    const adminClient = createAdminClient();
    const clientsWithNames = await Promise.all(
      (profiles || []).map(async (profile: any) => {
        try {
          // Prioritize title from profiles table, then auth metadata
          let name = profile.title || null;

          // If no title, try to get name from auth metadata
          if (!name) {
            const { data: authData } = await adminClient.auth.admin.getUserById(
              profile.id
            );
            name =
              authData?.user?.user_metadata?.name ||
              `${authData?.user?.user_metadata?.first_name || ""} ${authData?.user?.user_metadata?.last_name || ""}`.trim() ||
              null;
          }

          // Final fallback
          const displayName = name || "Unknown User";

          // Get asset counts from both tables
          // Build queries with .in() for array of companies
          let onboardingQuery = supabaseAuth
            .from("onboarding_assets")
            .select("id", { count: "exact" })
            .eq("transferred", false);

          let assetsQuery = supabaseAuth
            .from("assets")
            .select("id", { count: "exact" });

          // Filter by user's companies
          if (Array.isArray(profile.client) && profile.client.length > 0) {
            onboardingQuery = onboardingQuery.in("client", profile.client);
            assetsQuery = assetsQuery.in("client", profile.client);
          } else if (profile.client && typeof profile.client === "string") {
            // Handle old format (string) for backward compatibility
            onboardingQuery = onboardingQuery.eq("client", profile.client);
            assetsQuery = assetsQuery.eq("client", profile.client);
          }

          const [onboardingAssetsResult, assetsResult] = await Promise.all([
            onboardingQuery,
            assetsQuery,
          ]);

          const onboardingAssetsCount = onboardingAssetsResult.count || 0;
          const assetsCount = assetsResult.count || 0;
          const totalAssetsCount = onboardingAssetsCount + assetsCount;

          return {
            ...profile,
            name: displayName,
            onboardingAssetsCount,
            assetsCount,
            totalAssetsCount,
          };
        } catch (error) {
          console.error(
            `Error fetching auth data for user ${profile.id}:`,
            error
          );
          return {
            ...profile,
            name: profile.title || "Unknown User",
            onboardingAssetsCount: 0,
            assetsCount: 0,
            totalAssetsCount: 0,
          };
        }
      })
    );

    // Calculate total unique assets across all valid client companies (no duplicates)
    const allClientNames = new Set(
      (profiles || [])
        .flatMap((p: any) => p.client || [])
        .filter((c: string) => c && c !== "N/A" && c.trim())
    );

    let totalOnboardingAssets = 0;
    let totalProductionAssets = 0;

    if (allClientNames.size > 0) {
      const clientNamesArray = Array.from(allClientNames);

      // Get unique onboarding assets across all clients
      const { count: onboardingCount } = await supabaseAuth
        .from("onboarding_assets")
        .select("id", { count: "exact", head: true })
        .in("client", clientNamesArray)
        .eq("transferred", false);

      // Get unique production assets across all clients
      const { count: productionCount } = await supabaseAuth
        .from("assets")
        .select("id", { count: "exact", head: true })
        .in("client", clientNamesArray);

      totalOnboardingAssets = onboardingCount || 0;
      totalProductionAssets = productionCount || 0;
    }

    return NextResponse.json({
      clients: clientsWithNames,
      totals: {
        onboarding: totalOnboardingAssets,
        production: totalProductionAssets,
        total: totalOnboardingAssets + totalProductionAssets,
      },
    });
  } catch (error: any) {
    console.error("Error in client-users API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
