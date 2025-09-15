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
      email,
      dailyHours,
      exclusiveWork,
      country,
      portfolioLinks,
    } = body;

    const adminClient = createAdminClient();

    // Test direct profile table update
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        title: title || null,
        phone_number: phoneNumber || null,
        discord_name: discordName || null,
        software_experience: softwareExperience || null,
        model_types: modelTypes || null,
        client: client || null,
        role: role || null,
        client_config: null, // Set to null to avoid foreign key constraint
        daily_hours: dailyHours || null,
        exclusive_work: exclusiveWork || false,
        country: country || null,
        portfolio_links: portfolioLinks || null,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (profileError) {
      return NextResponse.json(
        {
          error: "Profile update failed",
          details: profileError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: profileData,
    });
  } catch (error) {
    console.error("Test profiles error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error,
      },
      { status: 500 }
    );
  }
}
