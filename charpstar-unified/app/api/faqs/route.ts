import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all FAQs (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const admin = searchParams.get("admin") === "true";

    let query = supabaseAdmin
      .from("faqs")
      .select("*")
      .order("order_index", { ascending: true });

    // If not admin, only show active FAQs
    if (!admin) {
      query = query.eq("is_active", true);
    }

    // Filter by category if provided
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching FAQs:", error);
      return NextResponse.json(
        { error: "Failed to fetch FAQs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ faqs: data || [] });
  } catch (error) {
    console.error("Error in FAQs GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new FAQ (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      answer,
      category = "General",
      order_index = 0,
      is_active = true,
    } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("faqs")
      .insert([
        {
          question,
          answer,
          category,
          order_index,
          is_active,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating FAQ:", error);
      return NextResponse.json(
        { error: "Failed to create FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json({ faq: data });
  } catch (error) {
    console.error("Error in FAQs POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
