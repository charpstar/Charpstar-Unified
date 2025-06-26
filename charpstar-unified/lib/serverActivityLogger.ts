import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

interface ActivityLogData {
  action: string;
  description?: string;
  type:
    | "upload"
    | "create"
    | "update"
    | "delete"
    | "view"
    | "settings"
    | "login"
    | "logout"
    | "download"
    | "share"
    | "export"
    | "import"
    | "general";
  resource_type?:
    | "asset"
    | "user"
    | "project"
    | "analytics"
    | "model"
    | "material"
    | "texture"
    | "scene"
    | "layout"
    | "profile";
  resource_id?: string;
  metadata?: Record<string, any>;
}

// Server-side activity logging function for API routes
export async function logActivityServer(data: ActivityLogData): Promise<void> {
  try {
    console.log("Server activity logger called with data:", data);

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current session to get user ID
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("Session data:", session);
    console.log("Session error:", sessionError);

    // Get the user's profile ID
    let profileId = null;
    let userEmail = session?.user?.email || null;

    if (session?.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        profileId = profile.id;
        console.log("Profile found:", profile);
      }
    }

    // Use email from metadata as fallback if session doesn't have it
    if (!userEmail && data.metadata?.user_email) {
      userEmail = data.metadata.user_email;
    }

    console.log(
      "Final user data - profileId:",
      profileId,
      "userEmail:",
      userEmail
    );

    // Insert activity with user ID and email directly in the table
    const activityData = {
      action: data.action,
      description: data.description || null,
      type: data.type,
      resource_type: data.resource_type || null,
      resource_id: data.resource_id || null,
      user_id: profileId,
      user_email: userEmail,
      metadata: data.metadata || null,
    };

    console.log("Inserting activity data:", activityData);

    const { error } = await supabase.from("activity_log").insert(activityData);

    if (error) {
      console.error("Error logging activity:", error);
    } else {
      console.log("Activity logged successfully to database");
    }
  } catch (error) {
    console.error("Error in server activity logging:", error);
  }
}
