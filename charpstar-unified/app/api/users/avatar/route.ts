import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PUT(request: Request) {
  try {
    const { avatar_url, user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    // First try to update the profile with the new avatar
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url })
      .eq("id", user_id);

    if (updateError) {
      // If profile doesn't exist, create it with the avatar
      if (
        updateError.message.includes("No rows found") ||
        updateError.code === "PGRST116"
      ) {
        console.log(
          "Profile not found, creating new profile with avatar for user:",
          user_id
        );

        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .insert([
            {
              id: user_id,
              role: "user",
              avatar_url,
              created_at: new Date().toISOString(),
            },
          ])
          .select("avatar_url")
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return NextResponse.json(
            { message: createError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          avatar_url: newProfile?.avatar_url,
        });
      }

      console.error("Error updating avatar:", updateError);
      return NextResponse.json(
        { message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, avatar_url });
  } catch (err: any) {
    console.error("API /users/avatar error:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    // Get the user's profile with avatar using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user_id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create it
      if (
        profileError.message.includes("No rows found") ||
        profileError.code === "PGRST116"
      ) {
        console.log(
          "Profile not found, creating new profile for user:",
          user_id
        );

        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .insert([
            {
              id: user_id,
              role: "user",
              created_at: new Date().toISOString(),
            },
          ])
          .select("avatar_url")
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return NextResponse.json(
            { message: createError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          avatar_url: newProfile?.avatar_url || null,
        });
      }

      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { message: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ avatar_url: profile?.avatar_url || null });
  } catch (err: any) {
    console.error("API /users/avatar error:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
