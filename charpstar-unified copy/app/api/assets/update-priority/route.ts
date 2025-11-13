import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has production role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "production")
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { assetId, priority } = await request.json();

    if (!assetId || !priority) {
      return NextResponse.json(
        { error: "Asset ID and priority are required" },
        { status: 400 }
      );
    }

    if (![1, 2, 3].includes(priority)) {
      return NextResponse.json(
        { error: "Priority must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    // Update the asset priority
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({ priority })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating asset priority:", updateError);
      return NextResponse.json(
        { error: "Failed to update priority" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Priority updated successfully",
    });
  } catch (error) {
    console.error("Error in update-priority route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
