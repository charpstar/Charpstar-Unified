import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notificationService } from "@/lib/notificationService";

type ReferenceVisibility = "client" | "internal";

const parseStoredReferences = (raw: unknown): string[] => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.includes("|||")) {
      return trimmed
        .split("|||")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed.startsWith('"')
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
        }
      } catch {
        // Ignore parse errors and fall back to single value handling
      }
    }

    return [trimmed];
  }

  return [];
};

const serializeStoredReferences = (
  refs: string[],
  originalValue?: unknown
): string | string[] | null => {
  if (!refs.length) return null;

  if (Array.isArray(originalValue)) {
    return refs;
  }

  if (typeof originalValue === "string") {
    const trimmed = originalValue.trim();
    if (trimmed.includes("|||")) {
      return refs.join("|||");
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        JSON.parse(trimmed);
        return JSON.stringify(refs);
      } catch {
        // Fallthrough to default behaviour
      }
    }

    if (refs.length === 1) {
      return refs[0];
    }

    return refs.join("|||");
  }

  return refs.join("|||");
};

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

    const body = await request.json();
    const { asset_id, reference_url } = body;
    const visibility: ReferenceVisibility =
      body?.visibility === "internal" ? "internal" : "client";

    if (!asset_id || !reference_url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the current asset to check existing references and get asset details for notification
    let { data: currentAsset, error: fetchError } = await supabase
      .from("onboarding_assets")
      .select("reference, internal_reference, product_name, client")
      .eq("id", asset_id)
      .single();

    let internalReferencesSupported = true;

    if (fetchError && fetchError.code === "42703") {
      internalReferencesSupported = false;
      const fallback = await supabase
        .from("onboarding_assets")
        .select("reference, product_name, client")
        .eq("id", asset_id)
        .single();

      if (!fallback.error && fallback.data) {
        currentAsset = {
          ...fallback.data,
          internal_reference: null,
        } as typeof currentAsset;
        fetchError = null;
      } else {
        fetchError = fallback.error ?? fetchError;
      }
    }

    if (fetchError || !currentAsset) {
      console.error("Error fetching current asset:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch asset" },
        { status: 500 }
      );
    }

    const originalValue =
      visibility === "internal"
        ? (currentAsset as any).internal_reference
        : currentAsset.reference;
    const existingReferences = parseStoredReferences(originalValue);
    const newReferences = [...existingReferences, reference_url];
    const serialized = serializeStoredReferences(newReferences, originalValue);

    // Update the asset
    if (visibility === "internal" && !internalReferencesSupported) {
      return NextResponse.json(
        {
          error:
            "Internal references are not enabled yet. Please add the internal_reference column or choose client visibility.",
        },
        { status: 409 }
      );
    }

    const updatePayload =
      visibility === "internal"
        ? { internal_reference: serialized }
        : { reference: serialized };

    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update(updatePayload)
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
    if (profile?.role === "client" && visibility === "client") {
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
