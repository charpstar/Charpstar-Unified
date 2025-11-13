import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { logActivityServer } from "@/lib/serverActivityLogger";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, subcategory } = await request.json();

    if (!assetId || subcategory === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: assetId, subcategory" },
        { status: 400 }
      );
    }

    // Check if user has permission to update subcategories (QA, Admin, or Client)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["qa", "admin", "client"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current asset data for logging
    const { data: currentAsset } = await supabase
      .from("onboarding_assets")
      .select("subcategory, product_name, client")
      .eq("id", assetId)
      .single();

    if (!currentAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Update the asset subcategory and tracking fields
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({
        subcategory: subcategory.trim(),
        subcategory_updated_by: user.id,
        subcategory_updated_at: new Date().toISOString(),
        // The trigger will automatically update subcategory_missing flag
      })
      .eq("id", assetId);

    if (updateError) {
      console.error("Error updating subcategory:", updateError);
      return NextResponse.json(
        { error: "Failed to update subcategory" },
        { status: 500 }
      );
    }

    // Log the activity
    try {
      await logActivityServer({
        action: `Updated subcategory from "${currentAsset.subcategory || "empty"}" to "${subcategory}"`,
        type: "update",
        resource_type: "asset",
        resource_id: assetId,
        metadata: {
          previous_subcategory: currentAsset.subcategory,
          new_subcategory: subcategory,
          updated_by_role: profile.role,
        },
      });
    } catch (e) {
      console.error("Error logging subcategory update activity:", e);
    }

    // Send notifications
    try {
      const updatedBy =
        user.user_metadata?.name || user.email || "Unknown User";
      await notificationService.sendSubcategoryUpdatedNotification(
        assetId,
        currentAsset.product_name,
        currentAsset.client,
        updatedBy,
        currentAsset.subcategory,
        subcategory
      );
    } catch (e) {
      console.error("Error sending subcategory update notification:", e);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Subcategory updated successfully",
    });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
