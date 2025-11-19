import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
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

    // Get user's companies
    const { data: userProfile, error } = await supabase
      .from("profiles")
      .select("client, email, role")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      companies: userProfile.client || [],
      email: userProfile.email,
      role: userProfile.role,
    });
  } catch (error) {
    console.error("Error fetching user companies:", error);
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
    const cookieStore = await cookies();
    const supabase = await createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
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
    const { companies } = await request.json();

    if (!Array.isArray(companies)) {
      return NextResponse.json(
        { error: "Companies must be an array" },
        { status: 400 }
      );
    }

    // Filter out empty company names
    const validCompanies = companies
      .filter((name: string) => name && name.trim())
      .map((name: string) => name.trim());

    const adminClient = createAdminClient();

    // Update profile in database
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        client: validCompanies.length > 0 ? validCompanies : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating companies:", updateError);
      return NextResponse.json(
        { error: "Failed to update companies" },
        { status: 500 }
      );
    }

    // Also update user metadata
    const { error: metadataError } =
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          client: validCompanies.length > 0 ? validCompanies : null,
        },
      });

    if (metadataError) {
      console.error("Error updating user metadata:", metadataError);
      // Don't fail the request, profile update is more important
    }

    return NextResponse.json({
      success: true,
      companies: validCompanies,
      message: "Companies updated successfully",
    });
  } catch (error) {
    console.error("Error updating user companies:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
