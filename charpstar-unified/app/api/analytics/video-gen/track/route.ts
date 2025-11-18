import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const {
      user_id,
      client_name,
      object_type,
      scene_description,
      resolution,
      duration_seconds,
      inspiration_used = false,
      status,
      error_message,
      generation_time_ms,
      saved_to_library = false,
      saved_asset_id,
    } = body;

    if (!user_id || !client_name || !status) {
      return NextResponse.json(
        { error: "user_id, client_name and status are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("video_render_analytics")
      .insert({
        user_id,
        client_name,
        object_type,
        scene_description,
        resolution,
        duration_seconds,
        inspiration_used,
        status,
        error_message,
        generation_time_ms,
        saved_to_library,
        saved_asset_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting video analytics:", error);
      return NextResponse.json(
        { error: "Failed to track analytics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analytics_id: data.id,
    });
  } catch (error) {
    console.error("Video analytics tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const {
      analytics_id,
      status,
      error_message,
      generation_time_ms,
      saved_to_library,
      saved_asset_id,
    } = body;

    if (!analytics_id || !status) {
      return NextResponse.json(
        { error: "analytics_id and status are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (error_message) updateData.error_message = error_message;
    if (generation_time_ms !== undefined)
      updateData.generation_time_ms = generation_time_ms;
    if (saved_to_library !== undefined)
      updateData.saved_to_library = saved_to_library;
    if (saved_asset_id) updateData.saved_asset_id = saved_asset_id;

    const { data, error } = await supabase
      .from("video_render_analytics")
      .update(updateData)
      .eq("id", analytics_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating video analytics:", error);
      return NextResponse.json(
        { error: "Failed to update analytics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analytics_id: data.id,
    });
  } catch (error) {
    console.error("Video analytics update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

