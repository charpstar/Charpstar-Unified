import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Initialize Supabase admin client for updates from render client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const data = await request.json();

    // Check if job exists (use admin client for render client updates)
    const { data: existingJob, error: fetchError } = await supabaseAdmin
      .from('render_jobs')
      .select('id')
      .eq('id', jobId)
      .single();

    if (fetchError || !existingJob) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};
    
    if (data.status) {
      updateData.status = data.status;
    }

    if (data.downloadUrl) {
      updateData.download_url = data.downloadUrl;
    }

    if (data.progress !== undefined) {
      const progress = parseInt(data.progress);
      if (progress >= 0 && progress <= 100) {
        updateData.progress = progress;
      }
    }

    // Update job in database (use admin client for render client updates)
    const { error: updateError } = await supabaseAdmin
      .from('render_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error("Error updating job:", updateError);
      throw updateError;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error updating job status:", error);
    return NextResponse.json(
      { error: "Failed to update job status" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    // Get authenticated user
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use authenticated client - RLS will ensure user can only see their own jobs
    const { data: job, error: fetchError } = await supabase
      .from('render_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      console.log("[Job Status API] Job not found or access denied:", jobId);
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Only log if there's an important status change (not on every poll)
    // console.log("[Job Status API] Job status:", {
    //   id: job.id,
    //   status: job.status,
    //   progress: job.progress,
    //   downloadUrl: job.download_url
    // });

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      downloadUrl: job.download_url,
      settings: job.settings,
      createdAt: job.created_at,
    });

  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
