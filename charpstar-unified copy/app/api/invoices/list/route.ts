import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the session from the request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const modelerId = searchParams.get("modeler_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Build query based on user role
    let query = supabase
      .from("invoices")
      .select(
        `
        *,
        modeler:profiles!invoices_modeler_id_fkey(id, email, title),
        reviewer:profiles!invoices_reviewed_by_fkey(id, email, title)
      `
      )
      .order("submitted_at", { ascending: false });

    // If modeler, only show their invoices
    if (profile.role === "modeler") {
      query = query.eq("modeler_id", user.id);
    }
    // If admin, apply optional filters
    else if (profile.role === "admin") {
      if (status) {
        query = query.eq("status", status);
      }
      if (modelerId) {
        query = query.eq("modeler_id", modelerId);
      }
      if (startDate) {
        query = query.gte("submitted_at", startDate);
      }
      if (endDate) {
        query = query.lte("submitted_at", endDate);
      }
    } else {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoices: invoices || [],
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in invoice list:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
