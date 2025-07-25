import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
      client,
      role,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Update the profiles table with the same data

    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .update({
        title: title || null,
        phone_number: phoneNumber || null,
        discord_name: discordName || null,
        software_experience: softwareExperience || null,
        model_types: modelTypes || null,
        client: client || null,
        role: role || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select();

    if (profileError) {
      console.error("Error updating profiles table:", profileError);
      console.error("Profile update error details:", {
        message: profileError.message,
        code: profileError.code,
      });
      return NextResponse.json(
        { error: "Failed to update profiles table", details: profileError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: profileData?.[0],
      message: "Profiles table updated successfully",
    });
  } catch (error) {
    console.error("Error in update-app-metadata:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
