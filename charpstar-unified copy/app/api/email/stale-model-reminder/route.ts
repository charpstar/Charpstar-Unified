import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientEmail, clientName, daysThreshold = 7 } = body;

    if (!clientEmail || !clientName) {
      return NextResponse.json(
        { error: "Missing required fields: clientEmail, clientName" },
        { status: 400 }
      );
    }

    // Calculate the cutoff date for stale models
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // Get stale models (pending for 7+ days)
    const { data: staleAssets, error: assetsError } = await supabase
      .from("onboarding_assets")
      .select(
        `
        id,
        product_name,
        status,
        updated_at,
        delivery_date,
        asset_assignments!inner(
          user_id,
          profiles!asset_assignments_user_id_fkey(
            title
          )
        )
      `
      )
      .eq("client", clientName)
      .in("status", [
        "in_production",
        "revisions",
        "client_revision",
        "delivered_by_artist",
      ])
      .lt("updated_at", cutoffDate.toISOString())
      .order("updated_at", { ascending: true });

    if (assetsError) {
      console.error("Error fetching stale assets:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch stale model data" },
        { status: 500 }
      );
    }

    if (!staleAssets || staleAssets.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stale models found",
        staleModelsCount: 0,
      });
    }

    // Process stale models data
    const staleModels = staleAssets.map((asset) => {
      const daysPending = Math.floor(
        (new Date().getTime() - new Date(asset.updated_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Generate review link
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const reviewLink = `${baseUrl}/client-review/${asset.id}`;

      return {
        name: asset.product_name,
        modelerName:
          (asset.asset_assignments as any)?.profiles?.title || "Unknown",
        status: asset.status,
        lastUpdated: asset.updated_at,
        daysPending,
        deadline: asset.delivery_date,
        reviewLink,
      };
    });

    // Generate dashboard link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const dashboardLink = `${baseUrl}/dashboard`;

    // Send email
    await emailService.sendStaleModelReminder(
      {
        clientName,
        staleModels,
        dashboardLink,
      },
      {
        from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
        to: clientEmail,
        subject: `Stale Model Reminder - ${staleModels.length} Models Need Attention`,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Stale model reminder sent successfully",
      staleModelsCount: staleModels.length,
      oldestDaysPending: Math.max(...staleModels.map((m) => m.daysPending)),
    });
  } catch (error) {
    console.error("Error in stale model reminder API:", error);
    return NextResponse.json(
      { error: "Failed to send stale model reminder" },
      { status: 500 }
    );
  }
}
