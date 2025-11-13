import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { jobStorage } from "@/lib/job-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, settings } = body;

    if (!product || !product.glb_link) {
      return NextResponse.json(
        { error: "Product GLB link is required" },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: "Render settings are required" },
        { status: 400 }
      );
    }

    // Generate a unique preview ID
    const previewId = `preview_${uuidv4()}`;
    const jobId = `preview_${uuidv4()}`;

    // Adjust settings for preview (front view only, faster render)
    const previewSettings = {
      ...settings,
      cameraViews: ["front"], // Only front view for preview
      quality: settings.quality === "high" ? "low" : settings.quality, // Lower quality for preview
    };

    // Store the job with GLB URL in memory
    jobStorage.set(jobId, {
      id: jobId,
      status: "queued",
      glb_urls: [product.glb_link], // Store URL directly in memory
      progress: 0,
      settings: previewSettings,
      is_preview: true,
      preview_for: previewId,
      product_name: product.product_name,
      createdAt: new Date().toISOString(),
    });

    // Simulate processing (in production, this would be handled by a background worker)
    setTimeout(async () => {
      const job = jobStorage.get(jobId);
      if (job) {
        job.status = "processing";
        job.progress = 25;
        
        setTimeout(() => {
          const job = jobStorage.get(jobId);
          if (job) job.progress = 50;
        }, 1000);
        
        setTimeout(() => {
          const job = jobStorage.get(jobId);
          if (job) job.progress = 75;
        }, 2000);
        
        setTimeout(() => {
          const job = jobStorage.get(jobId);
          if (job) {
            job.status = "completed";
            job.progress = 100;
            // For now, use a placeholder image
            job.downloadUrl = `https://via.placeholder.com/800x600/4c5a75/ffffff?text=Preview+of+${encodeURIComponent(product.product_name)}`;
          }
        }, 3000);
      }
    }, 1000);

    return NextResponse.json({
      previewId,
      jobId,
      status: "queued"
    });

  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
