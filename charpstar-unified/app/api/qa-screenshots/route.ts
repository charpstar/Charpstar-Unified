import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { glbUrl, assetId } = await request.json();

    if (!glbUrl) {
      return NextResponse.json(
        { error: "GLB URL is required" },
        { status: 400 }
      );
    }

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Create a QA job record
    const { data: qaJob, error: qaJobError } = await supabaseAdmin
      .from("qa_jobs")
      .insert({
        status: "pending",
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (qaJobError) {
      console.error("Failed to create QA job:", qaJobError);
      return NextResponse.json(
        { error: "Failed to create QA job" },
        { status: 500 }
      );
    }

    // For now, we'll return a response indicating the job was created
    // The actual screenshot capture will be handled by the frontend
    // In a production environment, you might want to use a background job system

    return NextResponse.json({
      success: true,
      qaJobId: qaJob.id,
      message:
        "QA job created successfully. Screenshot capture will be initiated.",
      glbUrl,
      assetId,
    });
  } catch (error: any) {
    console.error("Screenshot capture API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// This endpoint will be called by the frontend after screenshots are captured
export async function PUT(request: NextRequest) {
  try {
    const { qaJobId, screenshotUrls, modelStats } = await request.json();

    if (!qaJobId) {
      return NextResponse.json(
        { error: "QA Job ID is required" },
        { status: 400 }
      );
    }

    if (!screenshotUrls || !Array.isArray(screenshotUrls)) {
      return NextResponse.json(
        { error: "Screenshot URLs array is required" },
        { status: 400 }
      );
    }

    // Update the QA job with screenshot URLs and model stats
    const { data: updatedJob, error: updateError } = await supabaseAdmin
      .from("qa_jobs")
      .update({
        status: "screenshots_captured",
        qa_results: {
          screenshots: screenshotUrls,
          model_stats: modelStats,
          captured_at: new Date().toISOString(),
        },
      })
      .eq("id", qaJobId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update QA job:", updateError);
      return NextResponse.json(
        { error: "Failed to update QA job" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      qaJobId,
      screenshotUrls,
      message: "Screenshots captured and stored successfully",
    });
  } catch (error: any) {
    console.error("Update QA job error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

