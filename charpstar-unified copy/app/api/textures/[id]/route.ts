import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET - Get a single texture by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabaseAdmin
      .from("textures")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Texture not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching texture:", error);
      return NextResponse.json(
        { error: "Failed to fetch texture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ texture: data });
  } catch (error) {
    console.error("Error in GET /api/textures/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a texture
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const {
      name,
      category,
      basecolor_url,
      roughness_url,
      metallic_url,
      normal_url,
      preview_url,
      is_public,
    } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (basecolor_url !== undefined) updateData.basecolor_url = basecolor_url;
    if (roughness_url !== undefined) updateData.roughness_url = roughness_url;
    if (metallic_url !== undefined) updateData.metallic_url = metallic_url;
    if (normal_url !== undefined) updateData.normal_url = normal_url;
    if (preview_url !== undefined) updateData.preview_url = preview_url;
    if (is_public !== undefined) updateData.is_public = is_public;

    const { data, error } = await supabaseAdmin
      .from("textures")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating texture:", error);
      return NextResponse.json(
        { error: "Failed to update texture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ texture: data });
  } catch (error) {
    console.error("Error in PATCH /api/textures/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a texture
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from("textures")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting texture:", error);
      return NextResponse.json(
        { error: "Failed to delete texture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/textures/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
