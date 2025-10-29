// app/api/users/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ActivityLogger } from "@/lib/activityLogger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    // Fetch all users from auth with pagination
    let allAuthUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // Supabase max per page
    let hasMore = true;

    while (hasMore) {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: perPage,
        });

      if (authError) {
        console.error("Supabase Auth Error:", authError);
        return NextResponse.json(
          { message: authError.message },
          { status: 500 }
        );
      }

      if (authData?.users && authData.users.length > 0) {
        allAuthUsers = [...allAuthUsers, ...authData.users];
        // If we got less than perPage, we've reached the end
        hasMore = authData.users.length === perPage;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Fetch profiles with roles - handle pagination to get all
    let allProfiles: any[] = [];
    let profilePage = 0;
    const profilePageSize = 1000; // Supabase default limit
    let hasMoreProfiles = true;

    while (hasMoreProfiles) {
      let profilesQuery = supabaseAdmin
        .from("profiles")
        .select("*")
        .range(
          profilePage * profilePageSize,
          (profilePage + 1) * profilePageSize - 1
        );

      if (role) {
        profilesQuery = profilesQuery.eq("role", role);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) {
        console.error("Profiles Error:", profilesError);
        return NextResponse.json(
          { message: profilesError.message },
          { status: 500 }
        );
      }

      if (profiles && profiles.length > 0) {
        allProfiles = [...allProfiles, ...profiles];
        // If we got less than pageSize, we've reached the end
        hasMoreProfiles = profiles.length === profilePageSize;
        profilePage++;
      } else {
        hasMoreProfiles = false;
      }
    }

    // Create a map of profiles by user ID
    const profilesMap = new Map(
      allProfiles.map((profile) => [profile.id, profile])
    );

    // Combine auth users with their profiles, but only include users with a matching profile
    const users = allAuthUsers
      .map((user) => {
        const profile = profilesMap.get(user.id);
        if (!profile) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || "",
          role: profile?.role || "user",
          created_at: user.created_at,
          country: profile?.country || null,
          avatar: user.user_metadata?.avatar_url || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("API /users error:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role } = body;

    // First create the user in Supabase Auth
    const { data: userData, error: signUpError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (signUpError) {
      throw signUpError;
    }

    // Then update their role in the profiles table
    // The trigger will have created the profile, we just need to update the role
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", userData.user.id);

    if (profileError) {
      throw profileError;
    }

    // Log the user creation activity
    await ActivityLogger.userCreated(email);

    return NextResponse.json({ success: true, user: userData.user });
  } catch (err: any) {
    console.error("Error creating user:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
