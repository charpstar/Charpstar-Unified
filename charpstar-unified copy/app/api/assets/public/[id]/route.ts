import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";

/**
 * Public API endpoint for AR viewing
 * Returns minimal asset data without authentication
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Fetch minimal asset data - no authentication required
    const { data, error } = await supabase
      .from("assets")
      .select("id, product_name, glb_link, article_id, preview_image")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Asset fetch error:", error);
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Return only necessary fields for AR viewing
    return NextResponse.json({
      id: data.id,
      product_name: data.product_name,
      glb_link: data.glb_link,
      article_id: data.article_id,
      preview_image: data.preview_image,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

