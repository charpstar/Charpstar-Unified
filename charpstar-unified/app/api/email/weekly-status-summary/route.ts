import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientEmail, clientName, weekRange } = body;

    if (!clientEmail || !clientName) {
      return NextResponse.json(
        { error: "Missing required fields: clientEmail, clientName" },
        { status: 400 }
      );
    }

    // Get client's model data for the week
    const { data: assets, error: assetsError } = await supabase
      .from("onboarding_assets")
      .select(
        `
        id,
        product_name,
        status,
        batch,
        created_at,
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
      .order("created_at", { ascending: false });

    if (assetsError) {
      console.error("Error fetching assets for weekly summary:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch client data" },
        { status: 500 }
      );
    }

    if (!assets || assets.length === 0) {
      return NextResponse.json(
        { error: "No data found for client" },
        { status: 404 }
      );
    }

    // Calculate summary statistics
    const totalModels = assets.length;
    const completedModels = assets.filter(
      (asset) =>
        asset.status === "approved" || asset.status === "approved_by_client"
    ).length;
    const inProgressModels = assets.filter(
      (asset) =>
        asset.status === "in_production" ||
        asset.status === "delivered_by_artist"
    ).length;
    const pendingModels = assets.filter(
      (asset) => asset.status === "not_started"
    ).length;
    const revisionModels = assets.filter(
      (asset) =>
        asset.status === "revisions" || asset.status === "client_revision"
    ).length;

    const completionPercentage =
      totalModels > 0 ? Math.round((completedModels / totalModels) * 100) : 0;

    // Group by batch
    const batchMap = new Map();
    assets.forEach((asset) => {
      const batch = asset.batch || 1;
      if (!batchMap.has(batch)) {
        batchMap.set(batch, {
          batchNumber: batch,
          totalModels: 0,
          completedModels: 0,
          completionPercentage: 0,
          status: "pending" as const,
        });
      }

      const batchData = batchMap.get(batch);
      batchData.totalModels++;

      if (
        asset.status === "approved" ||
        asset.status === "approved_by_client"
      ) {
        batchData.completedModels++;
      }
    });

    // Calculate batch completion percentages and status
    const batches = Array.from(batchMap.values()).map((batch) => {
      batch.completionPercentage =
        batch.totalModels > 0
          ? Math.round((batch.completedModels / batch.totalModels) * 100)
          : 0;

      if (batch.completionPercentage === 100) {
        batch.status = "completed";
      } else if (batch.completedModels > 0) {
        batch.status = "in_progress";
      } else {
        batch.status = "pending";
      }

      return batch;
    });

    const summaryData = {
      totalModels,
      completedModels,
      readyForReviewModels: assets.filter(
        (asset) => asset.status === "approved"
      ).length,
      inProgressModels,
      pendingModels,
      revisionModels,
      completionPercentage,
      batches,
    };

    // Generate dashboard link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const dashboardLink = `${baseUrl}/dashboard`;

    // Send email
    await emailService.sendWeeklyStatusSummary(
      {
        clientName,
        summaryData,
        dashboardLink,
        weekRange: weekRange || `Week of ${new Date().toLocaleDateString()}`,
      },
      {
        from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
        to: clientEmail,
        subject: `Weekly Status Summary - ${weekRange || new Date().toLocaleDateString()}`,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Weekly status summary sent successfully",
      summaryData,
    });
  } catch (error) {
    console.error("Error in weekly status summary API:", error);
    return NextResponse.json(
      { error: "Failed to send weekly status summary" },
      { status: 500 }
    );
  }
}
