import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);

    const body = await request.json();
    const {
      userId,
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
    } = body;

    // Get current user (either from auth or from userId parameter)
    let user;
    if (userId) {
      // Use provided userId (for signup flow)
      user = { id: userId };
    } else {
      // Get from auth context (for authenticated requests)
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      user = authUser;
    }

    console.log("Syncing profile for user:", user.id);
    console.log("Profile data:", {
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
    });

    // Use admin client to bypass RLS for profile sync
    const adminClient = createAdminClient();

    // Update or insert profile with role-specific data
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: user.id,
        title: title || null,
        phone_number: phoneNumber || null,
        discord_name: discordName || null,
        software_experience: softwareExperience || null,
        model_types: modelTypes || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error syncing profile:", profileError);
      return NextResponse.json(
        { error: "Failed to sync profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
      message: "Profile synced successfully",
    });
  } catch (error) {
    console.error("Error in sync-profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
