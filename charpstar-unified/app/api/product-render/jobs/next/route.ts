import { NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export async function GET() {
  try {
    // Find the next queued job
    const jobs = jobStorage.getAll();
    console.log("[Jobs Next API] Total jobs:", jobs.length);
    const queuedJob = jobs.find(job => job.status === 'queued');

    if (!queuedJob) {
      console.log("[Jobs Next API] No queued jobs found");
      return NextResponse.json({ status: 'no_jobs' });
    }

    console.log("[Jobs Next API] Found queued job:", queuedJob.id);
    console.log("[Jobs Next API] GLB URLs:", queuedJob.glb_urls);

    // Update job status to processing
    queuedJob.status = 'processing';
    queuedJob.progress = 0;
    jobStorage.set(queuedJob.id, queuedJob);

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
