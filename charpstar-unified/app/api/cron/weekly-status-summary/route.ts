import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    // For testing, skip authorization check
    // const authHeader = request.headers.get("authorization");
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const emailsSent = [];
    const errors = [];

    try {
      // Get all clients from profiles table
      const { data: clients, error: clientsError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, metadata")
        .eq("role", "client")
        .not("email", "is", null);

      if (clientsError) {
        return NextResponse.json(
          { error: "Failed to fetch clients", details: clientsError.message },
          { status: 500 }
        );
      }

      if (!clients || clients.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No clients found",
          totalClients: 0,
          emailsSent: 0,
        });
      }

      // Get all assets grouped by client
      const clientsMap: Record<string, any[]> = {};

      for (const client of clients) {
        const clientName = client.metadata?.client || client.email;

        const { data: clientAssets, error: assetsError } = await supabaseAdmin
          .from("onboarding_assets")
          .select("*")
          .eq("client", clientName);

        if (assetsError) {
          continue; // Skip this client if assets can't be fetched
        }

        if (clientAssets && clientAssets.length > 0) {
          clientsMap[clientName] = clientAssets;
        }
      }

      // Process each client
      for (const [clientName, clientAssets] of Object.entries(clientsMap)) {
        try {
          // Skip clients with no assets
          if (!clientAssets || clientAssets.length === 0) {
            continue;
          }

          // Find the client's email from the profiles table
          const clientProfile = clients.find(
            (c) => (c.metadata?.client || c.email) === clientName
          );

          if (!clientProfile?.email) {
            errors.push({
              client: clientName,
              error: "No email found for client",
            });
            continue;
          }

          const clientEmail = clientProfile.email;

          // Calculate summary data for this client
          const totalModels = clientAssets.length;
          const readyForReviewModels = clientAssets.filter(
            (a: any) => a.status === "approved"
          ).length;
          const completedModels = clientAssets.filter(
            (a: any) => a.status === "approved_by_client"
          ).length;
          const pendingModels = clientAssets.filter(
            (a: any) =>
              a.status === "not_started" ||
              a.status === "delivered_by_artist" ||
              a.status === "in_production" ||
              a.status === "in_progress" ||
              a.status === "revisions" ||
              a.status === "client_revision"
          ).length;

          const completionPercentage =
            totalModels > 0
              ? Math.round((completedModels / totalModels) * 100)
              : 0;

          // Group by batches for this client
          const batches = clientAssets.reduce(
            (acc: any, asset: any) => {
              const batchNum = asset.batch || 1;
              if (!acc[batchNum]) {
                acc[batchNum] = {
                  batchNumber: batchNum,
                  totalModels: 0,
                  completedModels: 0,
                  completionPercentage: 0,
                  status: "pending" as const,
                };
              }
              acc[batchNum].totalModels++;
              if (asset.status === "approved_by_client") {
                acc[batchNum].completedModels++;
              }
              return acc;
            },
            {} as Record<number, any>
          );

          // Calculate batch completion percentages
          Object.values(batches).forEach((batch: any) => {
            batch.completionPercentage =
              batch.totalModels > 0
                ? Math.round((batch.completedModels / batch.totalModels) * 100)
                : 0;
            batch.status =
              batch.completionPercentage === 100
                ? "completed"
                : batch.completedModels > 0
                  ? "in_progress"
                  : "pending";
          });

          const summaryData = {
            totalModels,
            completedModels,
            readyForReviewModels,
            pendingModels,
            inProgressModels: clientAssets.filter(
              (a: any) => a.status === "in_progress"
            ).length,
            revisionModels: clientAssets.filter(
              (a: any) => a.status === "revisions"
            ).length,
            completionPercentage,
            batches: Object.values(batches) as Array<{
              batchNumber: number;
              totalModels: number;
              completedModels: number;
              completionPercentage: number;
              status: "in_progress" | "completed" | "pending";
            }>,
          };

          // Send weekly status summary email
          const emailResult = await emailService.sendWeeklyStatusSummary(
            {
              clientName,
              summaryData,
              dashboardLink: `${request.nextUrl.origin}/client-review`,
              weekRange: `Week of ${new Date().toLocaleDateString()}`,
            },
            {
              from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
              to: clientEmail,
              subject: `Weekly Status Summary - ${clientName}`,
            }
          );

          if (emailResult.success) {
            emailsSent.push({
              client: clientName,
              email: clientEmail,
              messageId: emailResult.messageId,
            });
          } else {
            errors.push({
              client: clientName,
              error: emailResult.devMode
                ? "Email simulation mode"
                : "Unknown error",
            });
          }
        } catch (clientError) {
          errors.push({
            client: clientName,
            error:
              clientError instanceof Error
                ? clientError.message
                : "Unknown error",
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: "Weekly status summary cron job completed",
        totalClients: Object.keys(clientsMap).length,
        emailsSent: emailsSent.length,
        emailsSentDetails: emailsSent,
        errors: errors,
      });
    } catch (dbError) {
      return NextResponse.json(
        {
          error: "Database operation failed",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
