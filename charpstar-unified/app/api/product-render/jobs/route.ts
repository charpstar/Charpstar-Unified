import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: jobs, error } = await supabase
      .from('render_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ jobs: jobs || [] });
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

    // Extract GLB URLs from products
    const glbUrls = products.map(product => product.glb_link);
    console.log("[Product Render API] GLB URLs:", glbUrls);

    // Get user ID from request (you might need to get this from auth)
    // For now, we'll use a placeholder - you should get this from your auth system
    const userId = request.headers.get('x-user-id') || null;

    // Create the job in database
    const { data: job, error: insertError } = await supabase
      .from('render_jobs')
      .insert({
        id: jobId,
        user_id: userId,
        status: 'queued',
        progress: 0,
        products,
        settings,
        glb_urls: glbUrls,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Product Render API] Database error:", insertError);
      throw insertError;
    }

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
