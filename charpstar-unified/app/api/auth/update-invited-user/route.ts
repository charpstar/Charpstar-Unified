import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,

      client,
      role,
      title,
      phoneNumber,

      softwareExperience,
      modelTypes,
      dailyHours,
      exclusiveWork,
      country,
      portfolioLinks,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Find the user by email
    const { data: users, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return NextResponse.json(
        { error: "Failed to find user" },
        { status: 500 }
      );
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update the user's password only
    const { data: updateData, error: updateError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password: password,
      });

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }

    // Also update the profiles table with role-specific data
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: user.id,
        email: email,
        title: title || null,
        phone_number: phoneNumber || null,
        discord_name: discordName || null,
        software_experience: softwareExperience || null,
        model_types: modelTypes || null,
        client: client,
        role: role,
        client_config: null, // Set to null to avoid foreign key constraint
        daily_hours: dailyHours || null,
        exclusive_work: exclusiveWork || false,
        country: country || null,
        portfolio_links: portfolioLinks || null,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (profileError) {
      console.error("Error updating profiles table:", profileError);
    } else {
      console.log("Profiles table updated successfully:", profileData);
    }

    return NextResponse.json({
      success: true,
      userId: updateData.user.id,
      profile: profileData?.[0],
      message: "User and profile updated successfully",
    });
  } catch (error) {
    console.error("Error in update-invited-user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
