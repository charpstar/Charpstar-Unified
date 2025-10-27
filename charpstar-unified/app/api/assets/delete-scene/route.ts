import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId, assetId } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: "Scene ID is required" },
        { status: 400 }
      );
    }

    // Create admin client for database operations
    const supabase = createAdminClient();

    // If we have assetId, we're working with the new structure (generated_scenes array)
    if (assetId) {
      // Get the asset with its generated_scenes
      const { data: asset, error: fetchError } = await supabase
        .from("assets")
        .select("id, generated_scenes")
        .eq("id", assetId)
        .single();

      if (fetchError) {
        console.error("Error fetching asset:", fetchError);
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      // Find the scene to get its image URL before deleting
      const scenes = asset.generated_scenes || [];
      const sceneToDelete = scenes.find((s: any) => s.id === sceneId);

      if (!sceneToDelete) {
        return NextResponse.json({ error: "Scene not found" }, { status: 404 });
      }

      // Remove the scene from the array
      const updatedScenes = scenes.filter((s: any) => s.id !== sceneId);

      // Update the asset
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          generated_scenes: updatedScenes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetId);

      if (updateError) {
        console.error("Error updating asset:", updateError);
        return NextResponse.json(
          { error: "Failed to delete scene from asset" },
          { status: 500 }
        );
      }

      // Try to delete the image from storage if it's in Supabase storage
      if (
        sceneToDelete.image_url &&
        sceneToDelete.image_url.includes("supabase.co")
      ) {
        try {
          const url = new URL(sceneToDelete.image_url);
          const pathParts = url.pathname.split("/");
          const fileName = pathParts[pathParts.length - 1];
          const filePath = `generated-scenes/${fileName}`;

          const { error: storageError } = await supabase.storage
            .from("assets")
            .remove([filePath]);

          if (storageError) {
            console.error("Error deleting from storage:", storageError);
          } else {
            console.log("Successfully deleted image from storage:", filePath);
          }
        } catch (error) {
          console.error("Error processing storage deletion:", error);
        }
      }

      console.log("Scene deleted successfully from asset:", sceneId);
      return NextResponse.json({ success: true });
    }

    // Legacy: Delete entire asset (old structure for backward compatibility)
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
        const url = new URL(scene.preview_image);
        const pathParts = url.pathname.split("/");
        const fileName = pathParts[pathParts.length - 1];
        const filePath = `generated-scenes/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from("assets")
          .remove([filePath]);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        } else {
          console.log("Successfully deleted image from storage:", filePath);
        }
      } catch (error) {
        console.error("Error processing storage deletion:", error);
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
