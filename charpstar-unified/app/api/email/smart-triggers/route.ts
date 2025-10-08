import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggerType, options = {} } = body;

    if (!triggerType) {
      return NextResponse.json(
        { error: "Missing required field: triggerType" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const results = [];

    switch (triggerType) {
      case "stale-models":
        const staleResults = await processStaleModelTriggers(
          options.daysThreshold || 7,
          baseUrl
        );
        results.push(...staleResults);
        break;

      case "batch-completion-check":
        const batchResults = await processBatchCompletionTriggers(baseUrl);
        results.push(...batchResults);
        break;

      case "weekly-summary-trigger":
        const weeklyResults = await processWeeklySummaryTriggers(baseUrl);
        results.push(...weeklyResults);
        break;

      case "all-triggers":
        // Process all smart triggers
        const allStaleResults = await processStaleModelTriggers(7, baseUrl);
        const allBatchResults = await processBatchCompletionTriggers(baseUrl);
        const allWeeklyResults = await processWeeklySummaryTriggers(baseUrl);

        results.push(
          ...allStaleResults,
          ...allBatchResults,
          ...allWeeklyResults
        );
        break;

      default:
        return NextResponse.json(
          {
            error:
              "Invalid trigger type. Valid types: stale-models, batch-completion-check, weekly-summary-trigger, all-triggers",
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Smart triggers processed for ${triggerType}`,
      results,
      totalProcessed: results.length,
    });
  } catch (error) {
    console.error("Error in smart triggers API:", error);
    return NextResponse.json(
      { error: "Failed to process smart triggers" },
      { status: 500 }
    );
  }
}

async function processStaleModelTriggers(
  daysThreshold: number,
  baseUrl: string
) {
  const results = [];

  try {
    // Calculate the cutoff date for stale models
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from("profiles")
      .select("id, email, metadata")
      .eq("role", "client")
      .not("email", "is", null);

    if (clientsError) {
      console.error(
        "Error fetching clients for stale model triggers:",
        clientsError
      );
      return [{ success: false, error: "Failed to fetch clients" }];
    }

    if (!clients || clients.length === 0) {
      return [{ success: true, message: "No clients found" }];
    }

    // Process each client
    for (const client of clients) {
      try {
        const clientName = client.metadata?.client || "Unknown Client";

        // Get stale models for this client
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
          console.error(
            `Error fetching stale assets for ${clientName}:`,
            assetsError
          );
          results.push({
            client: clientName,
            success: false,
            error: `Failed to fetch stale assets: ${assetsError.message}`,
          });
          continue;
        }

        if (!staleAssets || staleAssets.length === 0) {
          results.push({
            client: clientName,
            success: true,
            message: "No stale models found",
            staleModelsCount: 0,
          });
          continue;
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

        // Send stale model reminder email
        await emailService.sendStaleModelReminder(
          {
            clientName,
            staleModels,
            dashboardLink,
          },
          {
            from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
            to: client.email,
            subject: `Stale Model Reminder - ${staleModels.length} Models Need Attention`,
          }
        );

        results.push({
          client: clientName,
          success: true,
          message: "Stale model reminder sent successfully",
          staleModelsCount: staleModels.length,
          oldestDaysPending: Math.max(...staleModels.map((m) => m.daysPending)),
        });
      } catch (error) {
        console.error(
          `Failed to process stale models for ${client.metadata?.client}:`,
          error
        );
        results.push({
          client: client.metadata?.client || "Unknown",
          success: false,
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    console.error("Error in processStaleModelTriggers:", error);
    results.push({ success: false, error: (error as Error).message });
  }

  return results;
}

async function processBatchCompletionTriggers(baseUrl: string) {
  const results = [];

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from("profiles")
      .select("id, email, metadata")
      .eq("role", "client")
      .not("email", "is", null);

    if (clientsError) {
      console.error(
        "Error fetching clients for batch completion triggers:",
        clientsError
      );
      return [{ success: false, error: "Failed to fetch clients" }];
    }

    if (!clients || clients.length === 0) {
      return [{ success: true, message: "No clients found" }];
    }

    // Process each client
    for (const client of clients) {
      try {
        const clientName = client.metadata?.client || "Unknown Client";

        // Get all batches for this client
        const { data: batches, error: batchesError } = await supabase
          .from("onboarding_assets")
          .select("batch")
          .eq("client", clientName)
          .not("batch", "is", null);

        if (batchesError) {
          console.error(
            `Error fetching batches for ${clientName}:`,
            batchesError
          );
          continue;
        }

        if (!batches || batches.length === 0) {
          continue;
        }

        // Get unique batch numbers
        const uniqueBatches = [...new Set(batches.map((b) => b.batch))];

        for (const batchNumber of uniqueBatches) {
          // Check if this batch is complete
          const { data: batchAssets, error: batchError } = await supabase
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
            .eq("batch", batchNumber);

          if (batchError) {
            console.error(
              `Error fetching batch ${batchNumber} for ${clientName}:`,
              batchError
            );
            continue;
          }

          if (!batchAssets || batchAssets.length === 0) {
            continue;
          }

          // Check if all assets in this batch are completed
          const completedAssets = batchAssets.filter(
            (asset) =>
              asset.status === "approved" ||
              asset.status === "approved_by_client"
          );

          if (
            completedAssets.length === batchAssets.length &&
            completedAssets.length > 0
          ) {
            // Batch is complete - check if we've already sent notification
            const { data: existingNotification } = await supabase
              .from("notifications")
              .select("id")
              .eq("recipient_id", client.id)
              .eq("type", "batch_completion")
              .eq("metadata->>batchNumber", batchNumber.toString())
              .limit(1);

            if (!existingNotification || existingNotification.length === 0) {
              // Send batch completion notification
              const completedModels = completedAssets.map((asset) => ({
                name: asset.product_name,
                modelerName:
                  (asset.asset_assignments as any)?.profiles?.title ||
                  "Unknown",
                completedAt: asset.updated_at,
              }));

              const dashboardLink = `${baseUrl}/dashboard`;

              await emailService.sendBatchCompletion(
                {
                  clientName,
                  batchNumber,
                  completedModels,
                  totalModels: completedAssets.length,
                  completionDate: new Date().toISOString(),
                  dashboardLink,
                },
                {
                  from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
                  to: client.email,
                  subject: `Batch ${batchNumber} Complete - ${clientName}`,
                }
              );

              results.push({
                client: clientName,
                batch: batchNumber,
                success: true,
                message: "Batch completion notification sent successfully",
                completedModels: completedAssets.length,
              });
            }
          }
        }
      } catch (error) {
        console.error(
          `Failed to process batch completion for ${client.metadata?.client}:`,
          error
        );
        results.push({
          client: client.metadata?.client || "Unknown",
          success: false,
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    console.error("Error in processBatchCompletionTriggers:", error);
    results.push({ success: false, error: (error as Error).message });
  }

  return results;
}

async function processWeeklySummaryTriggers(baseUrl: string) {
  const results = [];

  try {
    // Check if it's Monday (weekly summary day)
    const today = new Date();
    const isMonday = today.getDay() === 1;

    if (!isMonday) {
      return [
        {
          success: true,
          message: "Not Monday - skipping weekly summary triggers",
        },
      ];
    }

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from("profiles")
      .select("id, email, metadata")
      .eq("role", "client")
      .not("email", "is", null);

    if (clientsError) {
      console.error(
        "Error fetching clients for weekly summary triggers:",
        clientsError
      );
      return [{ success: false, error: "Failed to fetch clients" }];
    }

    if (!clients || clients.length === 0) {
      return [{ success: true, message: "No clients found" }];
    }

    // Process each client
    for (const client of clients) {
      try {
        const clientName = client.metadata?.client || "Unknown Client";

        // Check if we've already sent weekly summary this week
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday of this week
        weekStart.setHours(0, 0, 0, 0);

        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", client.id)
          .eq("type", "weekly_summary")
          .gte("created_at", weekStart.toISOString())
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          results.push({
            client: clientName,
            success: true,
            message: "Weekly summary already sent this week",
          });
          continue;
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
          console.error(
            `Error fetching assets for weekly summary for ${clientName}:`,
            assetsError
          );
          results.push({
            client: clientName,
            success: false,
            error: `Failed to fetch assets: ${assetsError.message}`,
          });
          continue;
        }

        if (!assets || assets.length === 0) {
          results.push({
            client: clientName,
            success: true,
            message: "No data found for client",
          });
          continue;
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
          totalModels > 0
            ? Math.round((completedModels / totalModels) * 100)
            : 0;

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

        const dashboardLink = `${baseUrl}/dashboard`;
        const weekRange = `Week of ${new Date().toLocaleDateString()}`;

        // Send weekly summary email
        await emailService.sendWeeklyStatusSummary(
          {
            clientName,
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

        results.push({
          client: clientName,
          success: true,
          message: "Weekly summary sent successfully",
          totalModels,
          completedModels,
          completionPercentage,
        });
      } catch (error) {
        console.error(
          `Failed to process weekly summary for ${client.metadata?.client}:`,
          error
        );
        results.push({
          client: client.metadata?.client || "Unknown",
          success: false,
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    console.error("Error in processWeeklySummaryTriggers:", error);
    results.push({ success: false, error: (error as Error).message });
  }

  return results;
}
