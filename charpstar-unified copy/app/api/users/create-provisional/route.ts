import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      role,
      password,
      clientNames, // Changed to array for multiple companies
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
      dailyHours,
      exclusiveWork,
      country,
      portfolioLinks,
    } = body;

    // Validate required fields
    if (!email || !firstName || !lastName || !role || !password) {
      return NextResponse.json(
        {
          error:
            "Email, first name, last name, role, and password are required",
        },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Create user in Supabase Auth
    // Filter out empty company names and prepare the array
    const validClientNames =
      clientNames
        ?.filter((name: string) => name && name.trim())
        .map((name: string) => name.trim()) || [];

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          client: validClientNames.length > 0 ? validClientNames : null,
          role: role,
          client_config: validClientNames[0] || null, // Use first client for config
        },
      });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Create profile in profiles table
    const profileData = {
      id: authData.user.id,
      email: email, // Add email field to satisfy NOT NULL constraint
      role: role,
      client: validClientNames.length > 0 ? validClientNames : null,
      title: title || null,
      phone_number: phoneNumber || null,
      discord_name: discordName || null,
      software_experience:
        softwareExperience?.length > 0 ? softwareExperience : null,
      model_types: modelTypes?.length > 0 ? modelTypes : null,
      daily_hours: dailyHours || null,
      exclusive_work: exclusiveWork || null,
      country: country || null,
      portfolio_links:
        portfolioLinks?.filter((link: string) => link.trim()) || null,
    };

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      console.error("Profile error:", profileError);
      // Try to clean up the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role,
        firstName,
        lastName,
      },
      message: `Successfully created ${role} user: ${email}`,
    });
  } catch (error: any) {
    console.error("Error creating provisional user:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
