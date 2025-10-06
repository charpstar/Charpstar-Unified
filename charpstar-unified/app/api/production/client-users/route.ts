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
      .select("id, email, role, client, created_at")
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
          const { data: authData } = await adminClient.auth.admin.getUserById(
            profile.id
          );
          const name =
            authData?.user?.user_metadata?.name ||
            `${authData?.user?.user_metadata?.first_name || ""} ${authData?.user?.user_metadata?.last_name || ""}`.trim() ||
            "Unknown User";

          // Get asset counts from both tables
          const [onboardingAssetsResult, assetsResult] = await Promise.all([
            supabaseAuth
              .from("onboarding_assets")
              .select("id", { count: "exact" })
              .eq("client", profile.client)
              .eq("transferred", false),
            supabaseAuth
              .from("assets")
              .select("id", { count: "exact" })
              .eq("client", profile.client),
          ]);

          const onboardingAssetsCount = onboardingAssetsResult.count || 0;
          const assetsCount = assetsResult.count || 0;
          const totalAssetsCount = onboardingAssetsCount + assetsCount;

          return {
            ...profile,
            name: name || "Unknown User",
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
            name: "Unknown User",
            onboardingAssetsCount: 0,
            assetsCount: 0,
            totalAssetsCount: 0,
          };
        }
      })
    );

    return NextResponse.json({ clients: clientsWithNames });
  } catch (error: any) {
    console.error("Error in client-users API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
