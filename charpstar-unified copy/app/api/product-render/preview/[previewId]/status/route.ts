import { NextRequest, NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { previewId: string } }
) {
  try {
    const { previewId } = params;

    // Find the job associated with this preview
    const previewJob = jobStorage.findByPreviewId(previewId);

    if (!previewJob) {
      return NextResponse.json(
        { error: "Preview job not found" },
        { status: 404 }
      );
    }

    // If the job is completed, return the preview URL
    if (previewJob.status === "completed") {
      return NextResponse.json({
        status: "completed",
        previewUrl: previewJob.downloadUrl,
        progress: 100,
      });
    }

    // Return the current status
    return NextResponse.json({
      status: previewJob.status,
      progress: previewJob.progress || 0,
    });

  } catch (error) {
    console.error("Error checking preview status:", error);
    return NextResponse.json(
      { error: "Failed to check preview status" },
      { status: 500 }
    );
  }
}
