import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id } = body;

    if (user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: analyticsRecords, error: queryError } = await supabase
      .from("video_render_analytics")
      .select("id, downloaded")
      .eq("user_id", user_id)
      .eq("downloaded", false)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      console.error("Error querying video analytics:", queryError);
      return NextResponse.json(
        { error: "Failed to query analytics" },
        { status: 500 }
      );
    }

    if (analyticsRecords && analyticsRecords.length > 0) {
      const analyticsId = analyticsRecords[0].id;
      const { error: updateError } = await supabase
        .from("video_render_analytics")
        .update({ downloaded: true })
        .eq("id", analyticsId);

      if (updateError) {
        console.error("Error updating video analytics:", updateError);
        return NextResponse.json(
          { error: "Failed to update analytics" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        analytics_id: analyticsId,
      });
    }

    return NextResponse.json({
      success: true,
      message: "No recent analytics record found",
    });
  } catch (error) {
    console.error("Video download tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

