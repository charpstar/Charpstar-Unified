import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const generateType = searchParams.get("generateType");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    // Build query - admins can see all, others only their own
    let query = supabase.from("generated_models").select("*");

    if (!isAdmin) {
      // Non-admins only see their own models
      query = query.eq("user_id", user.id);
    } else if (userId) {
      // Admin filtering by specific user
      query = query.eq("user_id", userId);
    }

    // Apply filters
    if (generateType) {
      query = query.eq("generate_type", generateType);
    }

    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }

    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    if (search) {
      query = query.ilike("model_name", `%${search}%`);
    }

    const { data: models, error } = await query.order("created_at", {
      ascending: false,
    });

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

    return NextResponse.json({
      models: modelsWithUsers,
      isAdmin: isAdmin,
    });
  } catch (error: any) {
    console.error("Fetch models error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
