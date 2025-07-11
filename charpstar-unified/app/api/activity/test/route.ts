import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log("Test API - Request started");
    console.log("Request URL:", request.url);

    // Get the current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log(
      "Test API - Session data:",
      session
        ? { user_id: session.user.id, expires_at: session.expires_at }
        : null
    );
    console.log("Test API - Session error:", sessionError);

    if (sessionError) {
      return NextResponse.json(
        { error: "Session error", details: sessionError },
        { status: 401 }
      );
    }

    if (!session) {
      const allCookies = await cookieStore;
      console.log(
        "Test API - Available cookies:",
        allCookies.getAll().map((c: any) => c.name)
      );
      return NextResponse.json({ error: "No session found" }, { status: 401 });
    }

    // Test a simple query to the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    console.log("Test API - Profile data:", profile);
    console.log("Test API - Profile error:", profileError);

    return NextResponse.json({
      success: true,
      user_id: session.user.id,
      email: session.user.email,
      profile: profile,
      profile_error: profileError,
    });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
