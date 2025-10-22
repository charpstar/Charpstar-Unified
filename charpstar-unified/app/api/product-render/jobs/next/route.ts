import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Find the next queued job
    const { data: queuedJob, error: fetchError } = await supabase
      .from('render_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !queuedJob) {
      console.log("[Jobs Next API] No queued jobs found");
      return NextResponse.json({ status: 'no_jobs' });
    }

    console.log("[Jobs Next API] Found queued job:", queuedJob.id);
    console.log("[Jobs Next API] GLB URLs:", queuedJob.glb_urls);

    // Update job status to processing
    const { error: updateError } = await supabase
      .from('render_jobs')
      .update({ 
        status: 'processing',
        progress: 0 
      })
      .eq('id', queuedJob.id);

    if (updateError) {
      console.error("[Jobs Next API] Error updating job status:", updateError);
    }

    const response = {
      job_id: queuedJob.id,
      glb_urls: queuedJob.glb_urls || [], // Array of GLB URLs to render
      file_path: queuedJob.glb_urls && queuedJob.glb_urls.length > 0 ? queuedJob.glb_urls[0] : '', // For backward compatibility - send first URL as file_path
      options: queuedJob.settings, // Client expects 'options' not 'settings'
      settings: queuedJob.settings, // Also provide as 'settings' for compatibility
    };

    console.log("[Jobs Next API] Sending response:", JSON.stringify(response, null, 2));

    // Return job in the format expected by the client
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error getting next job:", error);
    return NextResponse.json(
      { error: "Failed to get next job" },
      { status: 500 }
    );
  }
}
