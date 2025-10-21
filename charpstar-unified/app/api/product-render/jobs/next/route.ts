import { NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export async function GET() {
  try {
    // Find the next queued job
    const jobs = jobStorage.getAll();
    const queuedJob = jobs.find(job => job.status === 'queued');

    if (!queuedJob) {
      return NextResponse.json({ status: 'no_jobs' });
    }

    // Update job status to processing
    queuedJob.status = 'processing';
    queuedJob.progress = 0;
    jobStorage.set(queuedJob.id, queuedJob);

    // Return job in the format expected by the client
    return NextResponse.json({
      job_id: queuedJob.id,
      file_path: queuedJob.file_path,
      options: queuedJob.settings, // Client expects 'options' not 'settings'
      settings: queuedJob.settings, // Also provide as 'settings' for compatibility
    });

  } catch (error) {
    console.error("Error getting next job:", error);
    return NextResponse.json(
      { error: "Failed to get next job" },
      { status: 500 }
    );
  }
}
