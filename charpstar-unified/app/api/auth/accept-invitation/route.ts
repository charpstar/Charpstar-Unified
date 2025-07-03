import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    console.log("=== ACCEPT INVITATION API CALLED ===");

    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    const body = await request.json();

    console.log("Request body:", body);

    const {
      invitationToken,
      userId,
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
      email,
      dailyHours,
      exclusiveWork,
      country,
      portfolioLinks,
    } = body;

    console.log("Extracted role-specific data:", {
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
      email,
    });

    if (!invitationToken || !userId) {
      return NextResponse.json(
        { error: "Invitation token and user ID are required" },
        { status: 400 }
      );
    }

    // Find the invitation by token
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("*")
      .eq("invitation_token", invitationToken)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check if invitation is still pending and not expired
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation is no longer valid" },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Update invitation status to accepted
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Error updating invitation:", updateError);
      return NextResponse.json(
        { error: "Failed to update invitation" },
        { status: 500 }
      );
    }

    // Update user profile with invitation data and role-specific fields
    console.log("Updating profile for user:", userId);
    console.log("Profile data:", {
      client: invitation.client_name,
      role: invitation.role,
      title,
      phoneNumber,
      discordName,
      softwareExperience,
      modelTypes,
    });

    const adminClient = createAdminClient();

    // Test admin client connection
    console.log("Testing admin client...");
    const { data: testData, error: testError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .limit(1);

    console.log("Admin client test result:", { testData, testError });

    // Update the profiles table with invitation data and role-specific fields
    console.log("Updating profiles table with role-specific data...");
    console.log("Profiles table payload:", {
      id: userId,
      email: email,
      title: title || null,
      phone_number: phoneNumber || null,
      discord_name: discordName || null,
      software_experience: softwareExperience || null,
      model_types: modelTypes || null,
      client: invitation.client_name,
      role: invitation.role,
      client_config: null,
      daily_hours: dailyHours || null,
      exclusive_work: exclusiveWork || false,
      country: country || null,
      portfolio_links: portfolioLinks || null,
      onboarding: invitation.onboarding || true,
    });

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
        client: invitation.client_name,
        role: invitation.role,
        client_config: null,
        daily_hours: dailyHours || null,
        exclusive_work: exclusiveWork || false,
        country: country || null,
        portfolio_links: portfolioLinks || null,
        onboarding: invitation.onboarding || true,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (profileError) {
      console.error("Error updating profiles table:", profileError);
      console.error("Profile error details:", {
        message: profileError.message,
        code: profileError.code,
      });
      // Don't fail the request, just log the error
    } else {
      console.log("Profiles table updated successfully:", profileData);
    }

    return NextResponse.json({
      message: "Invitation accepted successfully",
      invitation: {
        client_name: invitation.client_name,
        role: invitation.role,
      },
    });
  } catch (error) {
    console.error("Error in accept invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
