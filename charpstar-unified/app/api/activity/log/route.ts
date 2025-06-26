import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current session to get user ID
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log("Session user ID:", session?.user?.id);
    console.log("Session user email:", session?.user?.email);

    // Get the user's profile ID
    let profileId = null;
    let userEmail = session?.user?.email || null;

    if (session?.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        profileId = profile.id;
      }
    }

    // Parse the request body
    const body = await request.json();
    const { action, description, type, resource_type, resource_id, metadata } =
      body;

    // Use email from metadata as fallback if session doesn't have it
    if (!userEmail && metadata?.user_email) {
      userEmail = metadata.user_email;
    }

    // Validate required fields
    if (!action || !type) {
      return NextResponse.json(
        { error: "Action and type are required" },
        { status: 400 }
      );
    }

    // Insert activity with user ID and email directly in the table
    const activityData = {
      action,
      description: description || null,
      type,
      resource_type: resource_type || null,
      resource_id: resource_id || null,
      user_id: profileId,
      user_email: userEmail,
      metadata: metadata || null,
    };

    console.log("Inserting activity data:", activityData);

    const { data, error } = await supabase
      .from("activity_log")
      .insert(activityData)
      .select()
      .single();

    if (error) {
      console.error("Error logging activity:", error);
      return NextResponse.json(
        { error: "Failed to log activity", details: error },
        { status: 500 }
      );
    }

    console.log("Activity logged successfully:", data);

    return NextResponse.json({
      success: true,
      activity_id: data.id,
    });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // For now, allow access even without session for testing
    // In production, you'd want to check for session here
    console.log(
      "Fetching activities, user:",
      session?.user?.email || "anonymous"
    );

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");
    const resource_type = searchParams.get("resource_type");

    // Build the query - RLS policies will handle access control
    let query = supabase
      .from("recent_activities")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Add filters if provided
    if (type) {
      query = query.eq("type", type);
    }
    if (resource_type) {
      query = query.eq("resource_type", resource_type);
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error("Error fetching activities:", error);
      return NextResponse.json(
        { error: "Failed to fetch activities", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
