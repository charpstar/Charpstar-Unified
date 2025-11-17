import { NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  try {
    const supabase = createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's generated models
    const { data: models, error } = await supabase
      .from("generated_models")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      throw new Error(`Failed to fetch models: ${error.message}`);
    }

    // Get unique user IDs
    const userIds = [...new Set(models?.map((m) => m.user_id) || [])];

    // Fetch user information using admin client
    const adminClient = createAdminClient();
    const usersMap = new Map();

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data: authUser } =
            await adminClient.auth.admin.getUserById(userId);
          if (authUser?.user) {
            // Get name from profiles or auth metadata
            const { data: profile } = await supabase
              .from("profiles")
              .select("title")
              .eq("id", userId)
              .single();

            const name =
              profile?.title ||
              authUser.user.user_metadata?.name ||
              `${authUser.user.user_metadata?.first_name || ""} ${authUser.user.user_metadata?.last_name || ""}`.trim() ||
              authUser.user.email?.split("@")[0] ||
              "Unknown User";

            usersMap.set(userId, {
              email: authUser.user.email,
              name: name,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch user ${userId}:`, err);
        }
      })
    );

    // Attach user information to models
    const modelsWithUsers = models?.map((model) => ({
      ...model,
      user: usersMap.get(model.user_id) || {
        email: "Unknown",
        name: "Unknown User",
      },
    }));

    return NextResponse.json({ models: modelsWithUsers });
  } catch (error: any) {
    console.error("Fetch models error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
