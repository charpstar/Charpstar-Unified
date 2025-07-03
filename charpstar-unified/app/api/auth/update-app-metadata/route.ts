import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    console.log("=== UPDATE APP METADATA API CALLED ===");

    const body = await request.json();
    console.log("Request body:", body);

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

    console.log("Updating profiles table for user:", userId);
    console.log("Profiles data:", {
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
      client,
      role,
    });

    // Test admin client connection first
    console.log("Testing admin client connection...");
    const { data: testData, error: testError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .limit(1);

    console.log("Admin client test result:", { testData, testError });

    // Only update the profiles table - no app_metadata or user_metadata
    console.log("Updating profiles table for user:", userId);

    // Now update the profiles table with the same data
    console.log("Updating profiles table for user:", userId);
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

    console.log("Profiles table updated successfully:", profileData);

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
