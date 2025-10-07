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

    console.log("🔄 Starting weekly status summary cron job...");

    const emailsSent = [];
    const errors = [];

    try {
      // Get all assets for "Adam AB" client
      const { data: adamAssets, error: assetsError } = await supabaseAdmin
        .from("onboarding_assets")
        .select("*")
        .eq("client", "Adam AB");

      if (assetsError) {
        console.error("Error fetching assets:", assetsError);
        return NextResponse.json(
          { error: "Failed to fetch assets", details: assetsError.message },
          { status: 500 }
        );
      }

      // Group assets by client (only Adam AB)
      const clientsMap =
        adamAssets && adamAssets.length > 0
          ? {
              "Adam AB": adamAssets,
            }
          : {};

      console.log(
        `📊 Found ${Object.keys(clientsMap).length} clients with assets`
      );

      // Process each client
      for (const [clientName, clientAssets] of Object.entries(clientsMap)) {
        try {
          // For testing, use hardcoded email since no profile exists
          const testEmail = "awadin16@gmail.com"; // Change this to your test email
          console.log(`📧 Using test email for ${clientName}: ${testEmail}`);

          // Calculate summary data for this client
          const totalModels = clientAssets.length;
          const completedModels = clientAssets.filter(
            (a: any) => a.status === "approved_by_client"
          ).length;
          const inProgressModels = clientAssets.filter(
            (a: any) => a.status === "in_progress"
          ).length;
          const pendingModels = clientAssets.filter(
            (a: any) => a.status === "not_started"
          ).length;
          const revisionModels = clientAssets.filter(
            (a: any) =>
              a.status === "revisions" || a.status === "client_revision"
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
            inProgressModels,
            pendingModels,
            revisionModels,
            completionPercentage,
            batches: Object.values(batches) as Array<{
              batchNumber: number;
              totalModels: number;
              completedModels: number;
              completionPercentage: number;
              status: "in_progress" | "completed" | "pending";
            }>,
          };

          console.log(`📊 Summary for ${clientName}:`, summaryData);

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
              to: testEmail,
              subject: `Weekly Status Summary - ${clientName}`,
            }
          );

          if (emailResult.success) {
            console.log(
              `✅ Weekly status summary sent to ${testEmail} for ${clientName}`
            );
            emailsSent.push({
              client: clientName,
              email: testEmail,
              messageId: emailResult.messageId,
            });
          } else {
            console.error(
              `❌ Failed to send weekly status summary to ${testEmail} for ${clientName}`
            );
            errors.push({
              client: clientName,
              error: emailResult.devMode
                ? "Email simulation mode"
                : "Unknown error",
            });
          }
        } catch (clientError) {
          console.error(
            `❌ Error processing client ${clientName}:`,
            clientError
          );
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
      console.error("Database error:", dbError);
      return NextResponse.json(
        {
          error: "Database operation failed",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
