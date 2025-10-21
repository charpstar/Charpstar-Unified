import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { jobStorage } from "@/lib/job-storage";

export async function GET() {
  try {
    const jobsArray = jobStorage.getAll();
    return NextResponse.json({ jobs: jobsArray });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, settings } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Products array is required" },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: "Render settings are required" },
        { status: 400 }
      );
    }

    // Generate a unique job ID
    const jobId = `job_${uuidv4()}`;

    // Create job directory
    const jobFolder = join(process.cwd(), "public", "jobs", jobId);
    await mkdir(jobFolder, { recursive: true });

    // Save the GLB URLs to a file (one per line)
    const filePath = join(jobFolder, "urls.txt");
    const glbUrls = products.map(product => product.glb_link).join('\n');
    await writeFile(filePath, glbUrls);

    // Create the job
    const job = {
      id: jobId,
      status: 'queued' as const,
      progress: 0,
      products,
      settings,
      createdAt: new Date().toISOString(),
      downloadUrl: undefined,
      file_path: `/jobs/${jobId}/urls.txt`,
    };

    // Store the job
    jobStorage.set(jobId, job);

    // Job will be processed by the client when it polls /jobs/next

    return NextResponse.json({
      job,
      message: "Render job submitted successfully"
    });

  } catch (error) {
    console.error("Error submitting job:", error);
    return NextResponse.json(
      { error: "Failed to submit render job" },
      { status: 500 }
    );
  }
}
