import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { name, email, password, role = "user" } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the user with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: role.toLowerCase(),
        },
      });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ message: authError.message }, { status: 500 });
    }

    // Create the profile
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        user_id: authData.user.id,
        role: role.toLowerCase(),
        created_at: new Date().toISOString(),
      },
    ]);

    if (profileError) {
      console.error("Profile error:", profileError);
      // Don't fail the request as the user is created
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: authData.user.id,
          name,
          email,
          role: role.toLowerCase(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
