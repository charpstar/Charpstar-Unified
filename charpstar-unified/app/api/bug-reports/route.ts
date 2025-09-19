import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch bug reports (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("bug_reports")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by category if provided
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching bug reports:", error);
      return NextResponse.json(
        { error: "Failed to fetch bug reports" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bugReports: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in bug reports GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new bug report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      additionalInfo,
      userEmail,
      userAgent,
      url,
      pageTitle,
      images = [],
    } = body;

    if (!title || !description || !category || !url) {
      return NextResponse.json(
        { error: "Title, description, category, and URL are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bug_reports")
      .insert([
        {
          title,
          description,
          category,
          steps_to_reproduce: stepsToReproduce || null,
          expected_behavior: expectedBehavior || null,
          actual_behavior: actualBehavior || null,
          additional_info: additionalInfo || null,
          user_email: userEmail || null,
          user_agent: userAgent || null,
          url,
          page_title: pageTitle || null,
          images: images || [],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating bug report:", error);
      return NextResponse.json(
        { error: "Failed to create bug report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bugReport: data });
  } catch (error) {
    console.error("Error in bug reports POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
