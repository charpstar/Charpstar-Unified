import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Parse materials and colors from string arrays to actual arrays
    const parsedData = {
      ...data,
      materials: Array.isArray(data.materials)
        ? data.materials
        : JSON.parse(data.materials || "[]"),
      colors: Array.isArray(data.colors)
        ? data.colors
        : JSON.parse(data.colors || "[]"),
      tags: Array.isArray(data.tags)
        ? data.tags
        : JSON.parse(data.tags || "[]"),
    };

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error fetching asset:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();

    const { data, error } = await supabase
      .from("assets")
      .update({
        product_name: body.product_name,
        category: body.category,
        subcategory: body.subcategory,
        description: body.description,
        client: body.client,
        materials: JSON.stringify(body.materials || []),
        colors: JSON.stringify(body.colors || []),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Parse the response data to ensure arrays are properly formatted
    const parsedData = {
      ...data,
      materials: Array.isArray(data.materials)
        ? data.materials
        : JSON.parse(data.materials || "[]"),
      colors: Array.isArray(data.colors)
        ? data.colors
        : JSON.parse(data.colors || "[]"),
      tags: Array.isArray(data.tags)
        ? data.tags
        : JSON.parse(data.tags || "[]"),
    };

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error updating asset:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
