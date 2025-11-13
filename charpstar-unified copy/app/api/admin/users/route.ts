import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if user is authenticated and is admin
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin role from profiles table
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (userError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, client_name, role } = await request.json();

    if (!email || !client_name || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          client: client_name,
          role: role,
        },
      });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // Check if this UUID already exists in profiles table
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id, email, client_name, role, created_at")
      .eq("id", authUser.user.id)
      .single();

    if (existingUser) {
      // Update the existing user with the new data
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          client_name: client_name,
          role: role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.user.id);

      if (updateError) {
        console.error("Error updating existing user:", updateError);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json(
          { error: "Failed to update existing user" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "User updated successfully",
        user: {
          id: authUser.user.id,
          email: email,
          client: client_name,
          role: role,
        },
      });
    }

    // Create user record in profiles table
    const { error: dbError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.user.id,
      email: email,
      client_name: client_name,
      role: role,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("Error creating user record:", dbError);
      // Clean up the auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: "Failed to create user record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: {
        id: authUser.user.id,
        email: email,
        client: client_name,
        role: role,
      },
    });
  } catch (error) {
    console.error("Error in create user API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
