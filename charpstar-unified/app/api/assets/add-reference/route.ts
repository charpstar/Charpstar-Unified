import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { asset_id, reference_url } = await request.json();

    if (!asset_id || !reference_url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the current asset to check existing references and get asset details for notification
    const { data: currentAsset, error: fetchError } = await supabase
      .from("onboarding_assets")
      .select("reference, product_name, client")
      .eq("id", asset_id)
      .single();

    if (fetchError) {
      console.error("Error fetching current asset:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    // Parse existing references
    let existingReferences: string[] = [];
    if (currentAsset.reference) {
      try {
        existingReferences = Array.isArray(currentAsset.reference)
          ? currentAsset.reference
          : JSON.parse(currentAsset.reference);
      } catch {
        existingReferences = [currentAsset.reference];
      }
    }

    // Add new reference
    const newReferences = [...existingReferences, reference_url];

    // Update the asset
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({ reference: newReferences })
      .eq("id", asset_id);

    if (updateError) {
      console.error("Error updating asset:", updateError);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }

    // Get user profile to determine if this is a client update
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, title")
      .eq("id", session.user.id)
      .single();

    console.log("📋 User profile:", {
      role: profile?.role,
      title: profile?.title,
      userId: session.user.id,
      email: session.user.email,
      profileError,
    });

    // Send notification to QA, production, and admin if updated by a client
    if (profile?.role === "client") {
      console.log("🔔 Attempting to send client_asset_update notification...");
      try {
        await notificationService.sendClientAssetUpdateNotification({
          assetId: asset_id,
          assetName: currentAsset.product_name || "Unknown Asset",
          clientName: currentAsset.client || "Unknown Client",
          updateType: "references",
          updatedFields: ["reference"],
          updatedBy: profile.title || session.user.email || "Unknown User",
          updatedAt: new Date().toISOString(),
        });
        console.log("✅ Successfully triggered notification service");
      } catch (notificationError) {
        console.error("❌ Failed to send notification:", notificationError);
        // Don't fail the request if notification fails
      }
    } else {
      console.log(
        `ℹ️ Skipping notification - user role is '${profile?.role}', not 'client'`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in add-reference API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: (error as Error)?.message || String(error),
      },
      { status: 500 }
    );
  }
}
