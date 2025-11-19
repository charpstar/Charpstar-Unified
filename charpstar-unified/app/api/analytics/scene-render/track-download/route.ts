import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id } = body;

    // Validate user_id matches authenticated user
    if (user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Find the most recent analytics record for this user (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: analyticsRecords, error: queryError } = await supabase
      .from("scene_render_analytics")
      .select("id, downloaded")
      .eq("user_id", user_id)
      .eq("downloaded", false)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      console.error("Error querying analytics:", queryError);
      return NextResponse.json(
        { error: "Failed to query analytics" },
        { status: 500 }
      );
    }

    if (analyticsRecords && analyticsRecords.length > 0) {
      const analyticsId = analyticsRecords[0].id;
      console.log("Updating analytics record for download:", analyticsId);

      const { error: updateError } = await supabase
        .from("scene_render_analytics")
        .update({
          downloaded: true,
        })
        .eq("id", analyticsId);

      if (updateError) {
        console.error("Error updating analytics:", updateError);
        return NextResponse.json(
          { error: "Failed to update analytics" },
          { status: 500 }
        );
      }

      console.log("Analytics updated successfully - download tracked");
      return NextResponse.json({
        success: true,
        analytics_id: analyticsId,
      });
    } else {
      console.log("No recent analytics record found to update");
      // Don't fail - just log that we couldn't find a record
      return NextResponse.json({
        success: true,
        message: "No recent analytics record found",
      });
    }
  } catch (error) {
    console.error("Scene render download tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
