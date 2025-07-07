import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { id } = params;
  const { data, error } = await supabase
    .from("onboarding_assets")
    .select("id, product_name, product_link")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new NextResponse("Asset not found", { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.product_name,
    product_link: data.product_link,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
        tags: JSON.stringify(body.tags || []),
        product_link: body.product_link,
        glb_link: body.glb_link,
        article_id: body.article_id,
        dimensions: body.dimensions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (await params).id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Parse materials and colors from string arrays to actual arrays for response
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
