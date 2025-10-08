import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportType, clientEmail, clientName, options = {} } = body;

    if (!reportType) {
      return NextResponse.json(
        { error: "Missing required field: reportType" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const results = [];

    switch (reportType) {
      case "weekly-summary":
        if (!clientEmail || !clientName) {
          return NextResponse.json(
            {
              error:
                "Missing required fields for weekly summary: clientEmail, clientName",
            },
            { status: 400 }
          );
        }

        // Get all clients if no specific client provided
        const clients =
          clientName === "all"
            ? await getAllClients()
            : [{ email: clientEmail, name: clientName }];

        for (const client of clients) {
          try {
            const result = await sendWeeklySummaryForClient(client, baseUrl);
            results.push({ client: client.name, success: true, ...result });
          } catch (error) {
            console.error(
              `Failed to send weekly summary for ${client.name}:`,
              error
            );
            results.push({
              client: client.name,
              success: false,
              error: (error as Error).message,
            });
          }
        }
        break;

      case "batch-completion":
        if (!clientEmail || !clientName || !options.batchNumber) {
          return NextResponse.json(
            {
              error:
                "Missing required fields for batch completion: clientEmail, clientName, batchNumber",
            },
            { status: 400 }
          );
        }

        try {
          const result = await sendBatchCompletionNotification(
            clientEmail,
            clientName,
            options.batchNumber,
            baseUrl
          );
          results.push({ success: true, ...result });
        } catch (error) {
          console.error("Failed to send batch completion notification:", error);
          results.push({ success: false, error: (error as Error).message });
        }
        break;

      case "stale-models":
        if (!clientEmail || !clientName) {
          return NextResponse.json(
            {
              error:
                "Missing required fields for stale models: clientEmail, clientName",
            },
            { status: 400 }
          );
        }

        try {
          const result = await sendStaleModelReminder(
            clientEmail,
            clientName,
            options.daysThreshold || 7,
            baseUrl
          );
          results.push({ success: true, ...result });
        } catch (error) {
          console.error("Failed to send stale model reminder:", error);
          results.push({ success: false, error: (error as Error).message });
        }
        break;

      case "all-reports":
        // Send all types of reports
        const allClients = await getAllClients();

        for (const client of allClients) {
          try {
            // Weekly summary
            const weeklyResult = await sendWeeklySummaryForClient(
              client,
              baseUrl
            );
            results.push({
              client: client.name,
              reportType: "weekly-summary",
              success: true,
              ...weeklyResult,
            });

            // Stale models check
            const staleResult = await sendStaleModelReminder(
              client.email,
              client.name,
              7,
              baseUrl
            );
            results.push({
              client: client.name,
              reportType: "stale-models",
              success: true,
              ...staleResult,
            });
          } catch (error) {
            console.error(`Failed to send reports for ${client.name}:`, error);
            results.push({
              client: client.name,
              success: false,
              error: (error as Error).message,
            });
          }
        }
        break;

      default:
        return NextResponse.json(
          {
            error:
              "Invalid report type. Valid types: weekly-summary, batch-completion, stale-models, all-reports",
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Scheduled ${reportType} report(s) processed`,
      results,
    });
  } catch (error) {
    console.error("Error in scheduled reports API:", error);
    return NextResponse.json(
      { error: "Failed to process scheduled reports" },
      { status: 500 }
    );
  }
}

async function getAllClients() {
  const { data: clients, error } = await supabase
    .from("profiles")
    .select("email, metadata")
    .eq("role", "client")
    .not("email", "is", null);

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }

  return (
    clients?.map((client) => ({
      email: client.email,
      name: client.metadata?.client || "Unknown Client",
    })) || []
  );
}

async function sendWeeklySummaryForClient(
  client: { email: string; name: string },
  baseUrl: string
) {
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
    .eq("client", client.name)
    .order("created_at", { ascending: false });

  if (assetsError) {
    throw new Error(
      `Failed to fetch assets for ${client.name}: ${assetsError.message}`
    );
  }

  if (!assets || assets.length === 0) {
    return { message: "No data found for client" };
  }

  // Calculate summary statistics
  const totalModels = assets.length;
  const completedModels = assets.filter(
    (asset) =>
      asset.status === "approved" || asset.status === "approved_by_client"
  ).length;
  const inProgressModels = assets.filter(
    (asset) =>
      asset.status === "in_production" || asset.status === "delivered_by_artist"
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

    if (asset.status === "approved" || asset.status === "approved_by_client") {
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
    readyForReviewModels: assets.filter((asset) => asset.status === "approved")
      .length,
    inProgressModels,
    pendingModels,
    revisionModels,
    completionPercentage,
    batches,
  };

  const dashboardLink = `${baseUrl}/dashboard`;
  const weekRange = `Week of ${new Date().toLocaleDateString()}`;

  await emailService.sendWeeklyStatusSummary(
    {
      clientName: client.name,
      summaryData,
      dashboardLink,
      weekRange,
    },
    {
      from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
      to: client.email,
      subject: `Weekly Status Summary - ${weekRange}`,
    }
  );

  return {
    message: "Weekly summary sent successfully",
    totalModels,
    completedModels,
    completionPercentage,
  };
}

async function sendBatchCompletionNotification(
  clientEmail: string,
  clientName: string,
  batchNumber: number,
  baseUrl: string
) {
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
    throw new Error(
      `Failed to fetch completed assets for batch: ${assetsError.message}`
    );
  }

  if (!assets || assets.length === 0) {
    return { message: "No completed models found for this batch" };
  }

  const totalModels = assets.length;
  const completedModels = assets.map((asset) => ({
    name: asset.product_name,
    modelerName: (asset.asset_assignments as any)?.profiles?.title || "Unknown",
    completedAt: asset.updated_at,
  }));

  const dashboardLink = `${baseUrl}/dashboard`;

  await emailService.sendBatchCompletion(
    {
      clientName,
      batchNumber,
      completedModels,
      totalModels,
      completionDate: new Date().toISOString(),
      dashboardLink,
    },
    {
      from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
      to: clientEmail,
      subject: `Batch ${batchNumber} Complete - ${clientName}`,
    }
  );

  return {
    message: "Batch completion notification sent successfully",
    completedModels: completedModels.length,
    totalModels,
  };
}

async function sendStaleModelReminder(
  clientEmail: string,
  clientName: string,
  daysThreshold: number,
  baseUrl: string
) {
  // Calculate the cutoff date for stale models
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  // Get stale models
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
    throw new Error(`Failed to fetch stale assets: ${assetsError.message}`);
  }

  if (!staleAssets || staleAssets.length === 0) {
    return { message: "No stale models found" };
  }

  // Process stale models data
  const staleModels = staleAssets.map((asset) => {
    const daysPending = Math.floor(
      (new Date().getTime() - new Date(asset.updated_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

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

  const dashboardLink = `${baseUrl}/dashboard`;

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

  return {
    message: "Stale model reminder sent successfully",
    staleModelsCount: staleModels.length,
    oldestDaysPending: Math.max(...staleModels.map((m) => m.daysPending)),
  };
}
