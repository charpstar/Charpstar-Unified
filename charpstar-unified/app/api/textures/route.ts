import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET - List all textures with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const isPublic = searchParams.get("isPublic");

    let query = supabaseAdmin
      .from("textures")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (isPublic !== null && isPublic !== undefined) {
      query = query.eq("is_public", isPublic === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching textures:", error);
      return NextResponse.json(
        { error: "Failed to fetch textures" },
        { status: 500 }
      );
    }

    return NextResponse.json({ textures: data || [] });
  } catch (error) {
    console.error("Error in GET /api/textures:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new texture
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      category,
      basecolor_url,
      roughness_url,
      metallic_url,
      normal_url,
      preview_url,
      is_public = true,
    } = body;

    // Validate required fields
    if (!name || !category || !basecolor_url || !preview_url) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, category, basecolor_url, preview_url",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("textures")
      .insert([
        {
          name,
          category,
          basecolor_url,
          roughness_url,
          metallic_url,
          normal_url,
          preview_url,
          is_public,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating texture:", error);
      return NextResponse.json(
        { error: "Failed to create texture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ texture: data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/textures:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
