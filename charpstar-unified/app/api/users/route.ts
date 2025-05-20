// app/api/users/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Helper function to check if a user is an admin
async function isAdmin(userId: string) {
  const { data: user, error } =
    await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !user) return false;
  return user.user.user_metadata?.role === "admin";
}

export async function GET() {
  try {
    // Fetch users from auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Supabase Auth Error:", authError);
      return NextResponse.json({ message: authError.message }, { status: 500 });
    }

    // Fetch profiles with roles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error("Profiles Error:", profilesError);
      return NextResponse.json(
        { message: profilesError.message },
        { status: 500 }
      );
    }

    // Create a map of profiles by user ID
    const profilesMap = new Map(
      profiles.map((profile) => [profile.id, profile])
    );

    // Combine auth users with their profiles
    const users = authData.users.map((user) => {
      const profile = profilesMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "",
        role: profile?.role || "user",
        created_at: user.created_at,
      };
    });

    return NextResponse.json(users);
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

    return NextResponse.json({ success: true, user: userData.user });
  } catch (err: any) {
    console.error("Error creating user:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
