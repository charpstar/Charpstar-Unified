import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/utils/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // First, get the model to extract the storage path
    const { data: model, error: fetchError } = await supabase
      .from("generated_models")
      .select("model_url, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !model) {
      console.error("Model not found:", fetchError);
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Verify ownership
    if (model.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Extract filename from URL (format: https://...supabase.co/storage/v1/object/public/generated-models/USER_ID/TIMESTAMP.glb)
    const urlParts = model.model_url.split("/generated-models/");
    if (urlParts.length > 1) {
      const storagePath = urlParts[1];

      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("generated-models")
        .remove([storagePath]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
        // Continue to delete from DB even if storage deletion fails
      } else {
        console.log("✓ Deleted from Supabase Storage");
      }
    }

    // Delete from database
    const { error } = await supabase
      .from("generated_models")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Database error:", error);
      throw new Error(`Failed to delete model: ${error.message}`);
    }

    return NextResponse.json({ success: true, message: "Model deleted" });
  } catch (error: any) {
    console.error("Delete model error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete model" },
      { status: 500 }
    );
  }
}
