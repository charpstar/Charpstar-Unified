import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientEmail, clientName, batchNumber } = body;

    if (!clientEmail || !clientName || !batchNumber) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: clientEmail, clientName, batchNumber",
        },
        { status: 400 }
      );
    }

    // Get completed models for the batch
    const { data: assets, error: assetsError } = await supabase
      .from("onboarding_assets")
      .select(
        `
        id,
        product_name,
        status,
        updated_at,
        asset_assignments!inner(
          user_id,
          profiles!asset_assignments_user_id_fkey(
            title
          )
        )
      `
      )
      .eq("client", clientName)
      .eq("batch", batchNumber)
      .in("status", ["approved", "approved_by_client"]);

    if (assetsError) {
      console.error("Error fetching completed assets for batch:", assetsError);
      return NextResponse.json(
        { error: "Failed to fetch batch data" },
        { status: 500 }
      );
    }

    if (!assets || assets.length === 0) {
      return NextResponse.json(
        { error: "No completed models found for this batch" },
        { status: 404 }
      );
    }

    // Get total models in batch for completion percentage
    const { data: totalAssets, error: totalError } = await supabase
      .from("onboarding_assets")
      .select("id")
      .eq("client", clientName)
      .eq("batch", batchNumber);

    if (totalError) {
      console.error("Error fetching total assets for batch:", totalError);
      return NextResponse.json(
        { error: "Failed to fetch total batch data" },
        { status: 500 }
      );
    }

    const totalModels = totalAssets?.length || 0;
    const completedModels = assets.map((asset) => ({
      name: asset.product_name,
      modelerName:
        (asset.asset_assignments as any)?.profiles?.title || "Unknown",
      completedAt: asset.updated_at,
    }));

    // Check if there's a next batch
    const { data: nextBatch, error: nextBatchError } = await supabase
      .from("onboarding_assets")
      .select("id, batch")
      .eq("client", clientName)
      .eq("batch", batchNumber + 1)
      .limit(1);

    let nextBatchInfo = undefined;
    if (!nextBatchError && nextBatch && nextBatch.length > 0) {
      const { data: nextBatchAssets } = await supabase
        .from("onboarding_assets")
        .select("id")
        .eq("client", clientName)
        .eq("batch", batchNumber + 1);

      nextBatchInfo = {
        batchNumber: batchNumber + 1,
        totalModels: nextBatchAssets?.length || 0,
        estimatedCompletion: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toLocaleDateString(), // 1 week from now
      };
    }

    // Generate dashboard link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const dashboardLink = `${baseUrl}/dashboard`;

    // Send email
    await emailService.sendBatchCompletion(
      {
        clientName,
        batchNumber,
        completedModels,
        totalModels,
        completionDate: new Date().toISOString(),
        dashboardLink,
        nextBatchInfo,
      },
      {
        from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
        to: clientEmail,
        subject: `Batch ${batchNumber} Complete - ${clientName}`,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Batch ${batchNumber} completion notification sent successfully`,
      completedModels: completedModels.length,
      totalModels,
    });
  } catch (error) {
    console.error("Error in batch completion API:", error);
    return NextResponse.json(
      { error: "Failed to send batch completion notification" },
      { status: 500 }
    );
  }
}
