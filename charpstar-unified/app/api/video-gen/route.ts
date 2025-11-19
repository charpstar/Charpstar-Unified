import { NextRequest, NextResponse } from "next/server";
import { generateVideoScene } from "@/lib/geminiVideoService";
import { createAdminClient } from "@/utils/supabase/admin";

async function getUserFromAuth(authHeader: string | null, supabase: any) {
  if (!authHeader) return null;

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;

    // Get client name from user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("client")
      .eq("id", user.id)
      .single();

    // Handle client being an array or string
    const rawClient = Array.isArray(profile?.client) 
      ? profile.client[0] 
      : profile?.client;
    const clientName = rawClient && String(rawClient).trim().length > 0 
      ? String(rawClient) 
      : "Shared";

    return {
      id: user.id,
      email: user.email || null,
      client_name: clientName,
    };
  } catch (error) {
    console.warn("Failed to authenticate user:", error);
    return null;
  }
}

async function trackAnalytics(
  supabase: any,
  user: { id: string; email: string | null; client_name: string },
  data: {
    objectType: string;
    sceneDescription: string;
    resolution: string;
    durationSeconds: number;
    inspirationUsed: boolean;
  }
) {
  try {
    const { data: record, error } = await supabase
      .from("video_render_analytics")
      .insert({
        user_id: user.id,
        user_email: user.email,
        client_name: user.client_name,
        object_type: data.objectType,
        scene_description: data.sceneDescription,
        resolution: data.resolution,
        duration_seconds: data.durationSeconds,
        inspiration_used: data.inspirationUsed,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[Video Gen] Failed to insert analytics record:", error);
      return null;
    }

    console.log("[Video Gen] Successfully created analytics record:", record?.id);
    return record?.id;
  } catch (error) {
    console.error("[Video Gen] Exception tracking analytics:", error);
    return null;
  }
}

async function updateAnalytics(
  supabase: any,
  analyticsId: string,
  update: { status: string; generation_time_ms?: number; error_message?: string }
) {
  try {
    console.log(`[Video Gen] Updating analytics ${analyticsId}:`, update);
    const { error } = await supabase
      .from("video_render_analytics")
      .update(update)
      .eq("id", analyticsId);
    
    if (error) {
      console.error("[Video Gen] Failed to update analytics:", error);
    } else {
      console.log("[Video Gen] Analytics updated successfully");
    }
  } catch (error) {
    console.error("[Video Gen] Exception updating analytics:", error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const startTime = Date.now();
  let analyticsId: string | null = null;

  try {
    // Parse request body
    const {
      base64Images,
      objectSize,
      objectType,
      sceneDescription,
      inspirationImage,
      resolution = "720p",
      durationSeconds = "8",
    } = await request.json();

    // Validate required fields
    if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) {
      return NextResponse.json(
        { error: "base64Images array is required" },
        { status: 400 }
      );
    }

    if (!objectType) {
      return NextResponse.json(
        { error: "objectType is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const user = await getUserFromAuth(request.headers.get("authorization"), supabase);

    // Track analytics if user is authenticated
    if (user) {
      console.log("[Video Gen] Tracking analytics for user:", user.email, "client:", user.client_name);
      analyticsId = await trackAnalytics(supabase, user, {
        objectType,
        sceneDescription,
        resolution,
        durationSeconds: Number(durationSeconds),
        inspirationUsed: Boolean(inspirationImage),
      });
      console.log("[Video Gen] Analytics ID created:", analyticsId);
    } else {
      console.warn("[Video Gen] No user authenticated, skipping analytics tracking");
    }

    // Generate video with Vertex AI VEO
    const videoResult = await generateVideoScene({
      base64Images,
      objectSize: objectSize || "Unknown scale",
      objectType,
      sceneDescription: sceneDescription || "Professional product video scene",
      inspirationImage,
      resolution,
      durationSeconds,
    });

    // Return video as base64 data URL
    const videoDataUrl = `data:${videoResult.mimeType};base64,${videoResult.videoBase64}`;
    const posterBase64 = videoResult.posterBase64 || base64Images[0];

    // Update analytics on success
    if (analyticsId) {
      await updateAnalytics(supabase, analyticsId, {
        status: "success",
        generation_time_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json({
      videoUrl: videoDataUrl,
      posterImage: posterBase64,
    });
  } catch (error) {
    console.error("Video generation error:", error);

    // Update analytics on error
    if (analyticsId) {
      await updateAnalytics(supabase, analyticsId, {
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while generating the video",
      },
      { status: 500 }
    );
  }
}
