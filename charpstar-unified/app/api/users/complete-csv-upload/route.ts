import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const body = await request.json();
    const { userId } = body;

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can only update their own progress
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Update the user's CSV upload status
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .update({
        csv_uploaded: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select();

    if (profileError) {
      console.error("Error updating CSV upload status:", profileError);
      return NextResponse.json(
        { error: "Failed to update CSV upload status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "CSV upload marked as complete",
      profile: profileData?.[0],
    });
  } catch (error) {
    console.error("Error in complete-csv-upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const body = await request.json();
    const { userId } = body;

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can only update their own progress
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // First, get the user's client information
    const { data: userProfile, error: profileFetchError } = await adminClient
      .from("profiles")
      .select("client")
      .eq("id", userId)
      .single();

    if (profileFetchError) {
      console.error("Error fetching user profile:", profileFetchError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Delete all onboarding assets for this client
    if (userProfile?.client) {
      const { error: deleteError } = await adminClient
        .from("onboarding_assets")
        .delete()
        .eq("client", userProfile.client);

      if (deleteError) {
        console.error("Error deleting onboarding assets:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete onboarding assets" },
          { status: 500 }
        );
      }
    }

    // Remove the user's CSV upload status
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .update({
        csv_uploaded: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select();

    if (profileError) {
      console.error("Error removing CSV upload status:", profileError);
      return NextResponse.json(
        { error: "Failed to remove CSV upload status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "CSV upload status and data removed",
      profile: profileData?.[0],
    });
  } catch (error) {
    console.error("Error in complete-csv-upload DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
