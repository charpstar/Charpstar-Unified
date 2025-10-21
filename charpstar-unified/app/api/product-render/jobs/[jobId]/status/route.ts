import { NextRequest, NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const data = await request.json();

    const job = jobStorage.get(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Update job status
    if (data.status) {
      job.status = data.status;
    }

    if (data.downloadUrl) {
      job.downloadUrl = data.downloadUrl;
    }

    // Update progress
    if (data.progress !== undefined) {
      const progress = parseInt(data.progress);
      if (progress >= 0 && progress <= 100) {
        job.progress = progress;
      }
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

    const job = jobStorage.get(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      settings: job.settings,
      createdAt: job.createdAt,
    });

  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
