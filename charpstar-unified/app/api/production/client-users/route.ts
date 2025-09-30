import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
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

    // Get user names from auth metadata using admin client
    const adminClient = createAdminClient();
    const clientsWithNames = await Promise.all(
      (profiles || []).map(async (profile) => {
        try {
          const { data: authData } = await adminClient.auth.admin.getUserById(
            profile.id
          );
          const name =
            authData?.user?.user_metadata?.name ||
            `${authData?.user?.user_metadata?.first_name || ""} ${authData?.user?.user_metadata?.last_name || ""}`.trim() ||
            "Unknown User";

          return {
            ...profile,
            name: name || "Unknown User",
          };
        } catch (error) {
          console.error(
            `Error fetching auth data for user ${profile.id}:`,
            error
          );
          return {
            ...profile,
            name: "Unknown User",
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
