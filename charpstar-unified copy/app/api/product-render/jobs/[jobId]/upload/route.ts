import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { jobStorage } from "@/lib/job-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    // Check if job exists
    const job = jobStorage.get(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Create downloads directory
    const downloadsDir = join(process.cwd(), "public", "downloads");
    await mkdir(downloadsDir, { recursive: true });

    // Save the uploaded file
    const filePath = join(downloadsDir, `${jobId}.zip`);
    const buffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(buffer));

    // Update job status
    job.status = 'completed';
    job.progress = 100;
    job.downloadUrl = `/api/product-render/downloads/${jobId}.zip`;
    jobStorage.set(jobId, job);

    return NextResponse.json({ 
      message: 'File uploaded successfully',
      downloadUrl: job.downloadUrl
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

