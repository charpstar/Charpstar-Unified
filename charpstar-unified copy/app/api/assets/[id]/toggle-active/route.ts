import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id: assetId } = await params;
    const { active } = await request.json();

    if (typeof active !== "boolean") {
      return NextResponse.json(
        { error: "Active must be a boolean" },
        { status: 400 }
      );
    }

    // Get the asset to check permissions
    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select("client")
      .eq("id", assetId)
      .single();

    if (assetError || !assetData) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check permissions: admin can edit any, client can edit their own
    const isAdmin = profile.role === "admin";
    const isOwner = Array.isArray(profile.client)
      ? profile.client.includes(assetData.client)
      : profile.client === assetData.client;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You don't have permission to edit this asset" },
        { status: 403 }
      );
    }

    // Update the asset
    const { data, error } = await supabase
      .from("assets")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", assetId)
      .select()
      .single();

    if (error) {
      console.error("Error updating asset active status:", error);
      return NextResponse.json(
        { error: "Failed to update asset" },
        { status: 500 }
      );
    }

    // Track change if client is deactivating an asset (active: false)
    // OR restore change if client is reactivating an asset (active: true)
    if (!isAdmin) {
      const currentYear = new Date().getFullYear();

      // Check if client has remaining changes
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, models_in_contract, change_percentage")
        .eq("name", assetData.client)
        .single();

      if (clientData) {
        const changeLimit =
          clientData.models_in_contract && clientData.change_percentage
            ? Math.floor(
                (clientData.models_in_contract * clientData.change_percentage) /
                  100
              )
            : 0;

        // Get current year's changes
        const { data: currentChanges } = await supabase
          .from("asset_changes")
          .select("change_count")
          .eq("client", assetData.client)
          .eq("year", currentYear)
          .single();

        const changesUsed = currentChanges?.change_count || 0;

        // Calculate new change count based on action
        let newChangeCount = changesUsed;
        if (!active) {
          // Deactivating: increment change count (uses up a change)
          newChangeCount = changesUsed + 1;

          // Check if client has remaining changes for deactivation
          if (changesUsed >= changeLimit) {
            return NextResponse.json(
              {
                error:
                  "You have reached your annual change limit. Contact your administrator to increase your limit.",
              },
              { status: 403 }
            );
          }
        } else {
          // Reactivating: decrement change count (frees up a change)
          newChangeCount = Math.max(0, changesUsed - 1);
        }

        // Update change count
        const { error: changeError } = await supabase
          .from("asset_changes")
          .upsert(
            {
              client: assetData.client,
              year: currentYear,
              change_count: newChangeCount,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "client,year",
            }
          );

        if (changeError) {
          console.error("Error tracking asset change:", changeError);
          // Don't fail the request, just log the error
        }
      }
    }

    return NextResponse.json({
      success: true,
      asset: data,
      message: `Asset ${active ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling asset active status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
