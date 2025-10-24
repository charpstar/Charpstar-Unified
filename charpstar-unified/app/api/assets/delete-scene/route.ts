import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: "Scene ID is required" },
        { status: 400 }
      );
    }

    // Create admin client for database operations
    const supabase = createAdminClient();

    // First, get the scene to check if it exists and get the image URL
    const { data: scene, error: fetchError } = await supabase
      .from("assets")
      .select("id, product_name, preview_image, tags")
      .eq("id", sceneId)
      .single();

    if (fetchError) {
      console.error("Error fetching scene:", fetchError);
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Delete the scene from the database
    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .eq("id", sceneId);

    if (deleteError) {
      console.error("Error deleting scene:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete scene from database" },
        { status: 500 }
      );
    }

    // If the image is stored in Supabase storage, delete it too
    if (scene.preview_image && scene.preview_image.includes("supabase.co")) {
      try {
        // Extract the file path from the URL
        const url = new URL(scene.preview_image);
        const pathParts = url.pathname.split("/");
        const fileName = pathParts[pathParts.length - 1];
        const filePath = `generated-scenes/${fileName}`;

        // Delete from Supabase storage
        const { error: storageError } = await supabase.storage
          .from("assets")
          .remove([filePath]);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
          // Don't fail the request if storage deletion fails
        } else {
          console.log("Successfully deleted image from storage:", filePath);
        }
      } catch (error) {
        console.error("Error processing storage deletion:", error);
        // Don't fail the request if storage deletion fails
      }
    }

    console.log("Scene deleted successfully:", sceneId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete-scene API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
