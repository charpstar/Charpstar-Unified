import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or QA
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "qa"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin or QA access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Fetch user basic info from auth using admin client
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError) {
      console.error("Error fetching auth user:", authError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    // Fetch profile data
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile data" },
        { status: 500 }
      );
    }

    // Combine auth and profile data
    const combinedUserData = {
      id: userId,
      name:
        authUser.user?.user_metadata?.name || userProfile?.name || "Unknown",
      email: authUser.user?.email || "No email",
      role: userProfile?.role || "user",
      created_at: authUser.user?.created_at || userProfile?.created_at || "",
      country: userProfile?.country,
      avatar: authUser.user?.user_metadata?.avatar_url,
      title: userProfile?.title,
      phone_number: userProfile?.phone_number,
      discord_name: userProfile?.discord_name,
      software_experience: userProfile?.software_experience,
      model_types: userProfile?.model_types,
      daily_hours: userProfile?.daily_hours,
      exclusive_work: userProfile?.exclusive_work,
      portfolio_links: userProfile?.portfolio_links,
    };

    return NextResponse.json({ user: combinedUserData });
  } catch (error) {
    console.error("Error in user profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Valid name is required" },
        { status: 400 }
      );
    }

    // Update the user's name in auth user_metadata
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { name: name.trim() },
      });

    if (updateError) {
      console.error("Error updating user name:", updateError);
      return NextResponse.json(
        { error: "Failed to update user name" },
        { status: 500 }
      );
    }

    // Also update in profiles table if name field exists
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", userId);

    if (profileUpdateError) {
      // This is not critical since the primary source is user_metadata
    }

    return NextResponse.json({
      message: "User name updated successfully",
      name: name.trim(),
    });
  } catch (error) {
    console.error("Error updating user name:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
