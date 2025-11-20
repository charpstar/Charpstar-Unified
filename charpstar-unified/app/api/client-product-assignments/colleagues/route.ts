import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * GET /api/client-product-assignments/colleagues
 *
 * Get all client users (colleagues) that share the same client(s) as the current user.
 * Used for product allocation dialog.
 */
//eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's profile and clients
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client, client_role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (currentProfile.role !== "client") {
      return NextResponse.json(
        { error: "Only clients can view colleagues" },
        { status: 403 }
      );
    }

    // Only client_admin can view colleagues (product_managers)
    // Default to client_admin for backward compatibility if client_role is null
    const clientRole = currentProfile.client_role || "client_admin";
    if (clientRole !== "client_admin") {
      return NextResponse.json(
        { error: "Only client admins can view colleagues" },
        { status: 403 }
      );
    }

    // Normalize client array
    const userClients = Array.isArray(currentProfile.client)
      ? currentProfile.client
      : currentProfile.client
        ? [currentProfile.client]
        : [];

    if (userClients.length === 0) {
      return NextResponse.json({ colleagues: [] });
    }

    // Get all product_manager users that share at least one client with the current user
    const { data: colleagues, error: colleaguesError } = await supabase
      .from("profiles")
      .select("id, email, role, client, client_role, title, created_at")
      .eq("role", "client")
      .eq("client_role", "product_manager") // Only show product_managers
      .neq("id", session.user.id) // Exclude current user
      .order("created_at", { ascending: false });

    if (colleaguesError) {
      console.error("Error fetching colleagues:", colleaguesError);
      return NextResponse.json(
        { error: "Failed to fetch colleagues" },
        { status: 500 }
      );
    }

    // Filter colleagues that share at least one client
    const sharedColleagues =
      colleagues?.filter((colleague) => {
        const colleagueClients = Array.isArray(colleague.client)
          ? colleague.client
          : colleague.client
            ? [colleague.client]
            : [];

        return colleagueClients.some((client) => userClients.includes(client));
      }) || [];

    // Get names from auth metadata
    const adminClient = createAdminClient();
    const colleaguesWithNames = await Promise.all(
      sharedColleagues.map(async (colleague) => {
        try {
          const { data: authData } = await adminClient.auth.admin.getUserById(
            colleague.id
          );
          const name =
            colleague.title ||
            authData?.user?.user_metadata?.name ||
            `${authData?.user?.user_metadata?.first_name || ""} ${authData?.user?.user_metadata?.last_name || ""}`.trim() ||
            colleague.email ||
            "Unknown User";

          return {
            ...colleague,
            name,
            displayName: name || colleague.email || "Unknown User",
          };
        } catch (error) {
          console.error(`Error fetching auth data for ${colleague.id}:`, error);
          return {
            ...colleague,
            name: colleague.title || colleague.email || "Unknown User",
            displayName: colleague.title || colleague.email || "Unknown User",
          };
        }
      })
    );

    return NextResponse.json({
      colleagues: colleaguesWithNames,
    });
  } catch (error: any) {
    console.error("Error in colleagues endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
