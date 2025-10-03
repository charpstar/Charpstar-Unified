import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get the current user from the session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { stepId } = await request.json();

    if (!stepId) {
      return NextResponse.json({ error: "Missing stepId" }, { status: 400 });
    }

    // Set both flags to true and mark onboarding as complete
    const updateData = {
      csv_uploaded: true,
      reference_images_uploaded: true,
      onboarding: false,
    };

    // Update the profiles table directly
    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Step ${stepId} skipped successfully`,
    });
  } catch (error) {
    console.error("Error skipping onboarding step:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
