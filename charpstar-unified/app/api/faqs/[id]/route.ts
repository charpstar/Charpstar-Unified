import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT - Update FAQ (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { question, answer, category, order_index, is_active } = body;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "FAQ ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;
    if (category !== undefined) updateData.category = category;
    if (order_index !== undefined) updateData.order_index = order_index;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from("faqs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating FAQ:", error);
      return NextResponse.json(
        { error: "Failed to update FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json({ faq: data });
  } catch (error) {
    console.error("Error in FAQ PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete FAQ (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "FAQ ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("faqs").delete().eq("id", id);

    if (error) {
      console.error("Error deleting FAQ:", error);
      return NextResponse.json(
        { error: "Failed to delete FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in FAQ DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
