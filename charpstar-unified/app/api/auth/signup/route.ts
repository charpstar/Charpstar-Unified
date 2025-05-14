import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceKey,
  });
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    console.log("Starting signup process...");

    // Log request headers for debugging
    console.log(
      "Request headers:",
      Object.fromEntries(request.headers.entries())
    );

    const body = await request.json();
    console.log("Request body:", { ...body, password: "[REDACTED]" });

    const { name, email, password, role } = body;

    // Validate input
    if (!name || !email || !password) {
      console.log("Missing required fields:", {
        hasName: !!name,
        hasEmail: !!email,
        hasPassword: !!password,
      });
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Checking if user exists...");
    // Check if user already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select()
      .eq("email", email)
      .single();

    if (existingUserError && existingUserError.code !== "PGRST116") {
      console.error("Error checking existing user:", existingUserError);
      return NextResponse.json(
        { message: "Error checking user existence" },
        { status: 500 }
      );
    }

    if (existingUser) {
      console.log("User already exists:", email);
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 }
      );
    }

    console.log("Hashing password...");
    // Hash the password
    const hashedPassword = await hash(password, 10);

    console.log("Creating user in Supabase...");
    // Create the user in Supabase
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error("Supabase error creating user:", createError);
      return NextResponse.json(
        { message: "Failed to create user", error: createError.message },
        { status: 500 }
      );
    }

    // Create the profile and assign role from request or default to 'user'
    console.log("Creating profile for new user...");
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        user_id: newUser.id,
        role: role ? role.toLowerCase() : "user",
        created_at: new Date().toISOString(),
      },
    ]);

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't return error here as user is already created
    }

    console.log("User created successfully:", {
      id: newUser.id,
      email: newUser.email,
      role: role ? role.toLowerCase() : "user",
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: role ? role.toLowerCase() : "user",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    // Return more detailed error information
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
