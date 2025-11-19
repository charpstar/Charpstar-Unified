import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin or production role
    const { data: profile, error: profileError } = await supabase
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

    // Get all modelers from profiles
    const { data: modelersData, error: modelersError } = await supabase
      .from("profiles")
      .select("id, email, title")
      .eq("role", "modeler")
      .order("email");

    if (modelersError) {
      console.error("Error fetching modelers:", modelersError);
      return NextResponse.json(
        { error: "Failed to fetch modelers" },
        { status: 500 }
      );
    }

    // Fetch names from Supabase Auth metadata using admin client
    const adminClient = createAdminClient();
    const modelersWithNames = await Promise.all(
      (modelersData || []).map(async (modeler) => {
        try {
          const { data: authData } = await adminClient.auth.admin.getUserById(
            modeler.id
          );
          // Get name from auth user_metadata (prioritize name, then first_name + last_name)
          const name =
            authData?.user?.user_metadata?.name ||
            `${authData?.user?.user_metadata?.first_name || ""} ${authData?.user?.user_metadata?.last_name || ""}`.trim() ||
            null;
          return {
            id: modeler.id,
            email: modeler.email,
            name: name || undefined,
            title: modeler.title || undefined,
          };
        } catch (error) {
          console.error(
            `Error fetching name for modeler ${modeler.id}:`,
            error
          );
          return {
            id: modeler.id,
            email: modeler.email,
            name: undefined,
            title: modeler.title || undefined,
          };
        }
      })
    );

    return NextResponse.json({ modelers: modelersWithNames });
  } catch (error) {
    console.error("Error in modelers API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
