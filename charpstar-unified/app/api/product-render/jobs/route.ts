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
    console.log("[Product Render API] Received POST request");
    const body = await request.json();
    console.log("[Product Render API] Request body:", JSON.stringify(body, null, 2));
    const { products, settings } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      console.error("[Product Render API] Invalid products array");
      return NextResponse.json(
        { error: "Products array is required" },
        { status: 400 }
      );
    }

    if (!settings) {
      console.error("[Product Render API] Missing settings");
      return NextResponse.json(
        { error: "Render settings are required" },
        { status: 400 }
      );
    }

    // Generate a unique job ID
    const jobId = `job_${uuidv4()}`;
    console.log("[Product Render API] Generated job ID:", jobId);

    // Validate that all products have glb_link
    const invalidProducts = products.filter(p => !p.glb_link);
    if (invalidProducts.length > 0) {
      console.error("[Product Render API] Products without GLB:", invalidProducts);
      return NextResponse.json(
        { error: `Some products are missing GLB files: ${invalidProducts.map(p => p.product_name || p.id).join(', ')}` },
        { status: 400 }
      );
    }

    // Create job directory
    const jobFolder = join(process.cwd(), "public", "jobs", jobId);
    console.log("[Product Render API] Creating job folder:", jobFolder);
    await mkdir(jobFolder, { recursive: true });

    // Save the GLB URLs to a file (one per line)
    const filePath = join(jobFolder, "urls.txt");
    const glbUrls = products.map(product => product.glb_link).join('\n');
    console.log("[Product Render API] Writing GLB URLs to:", filePath);
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
    console.log("[Product Render API] Storing job in memory");
    jobStorage.set(jobId, job);

    console.log("[Product Render API] Job created successfully:", jobId);
    return NextResponse.json({
      job,
      message: "Render job submitted successfully"
    });

  } catch (error) {
    console.error("[Product Render API] Error submitting job:", error);
    console.error("[Product Render API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit render job" },
      { status: 500 }
    );
  }
}
