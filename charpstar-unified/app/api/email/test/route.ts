import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testEmail, testType = "simple" } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: "Missing required field: testEmail" },
        { status: 400 }
      );
    }

    const results = [];

    switch (testType) {
      case "simple":
        try {
          const result = await emailService.testEmailService(testEmail);
          results.push({ testType: "simple", ...result });
        } catch (error) {
          results.push({
            testType: "simple",
            success: false,
            error: (error as Error).message,
          });
        }
        break;

      case "model-ready":
        try {
          const result = await emailService.sendModelReadyForReview(
            {
              clientName: "Test Client",
              modelName: "Test Model",
              modelerName: "Test Modeler",
              reviewLink: "https://example.com/review",
              batch: 1,
              deadline: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
            },
            {
              from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
              to: testEmail,
              subject: "Test Model Ready for Review",
            }
          );
          results.push({ testType: "model-ready", ...result });
        } catch (error) {
          results.push({
            testType: "model-ready",
            success: false,
            error: (error as Error).message,
          });
        }
        break;

      case "weekly-summary":
        try {
          const result = await emailService.sendWeeklyStatusSummary(
            {
              clientName: "Test Client",
              summaryData: {
                totalModels: 10,
                completedModels: 7,
                inProgressModels: 2,
                pendingModels: 1,
                revisionModels: 0,
                completionPercentage: 70,
                batches: [
                  {
                    batchNumber: 1,
                    totalModels: 5,
                    completedModels: 5,
                    completionPercentage: 100,
                    status: "completed",
                  },
                  {
                    batchNumber: 2,
                    totalModels: 5,
                    completedModels: 2,
                    completionPercentage: 40,
                    status: "in_progress",
                  },
                ],
              },
              dashboardLink: "https://example.com/dashboard",
              weekRange: "Week of Test",
            },
            {
              from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
              to: testEmail,
              subject: "Test Weekly Status Summary",
            }
          );
          results.push({
            testType: "weekly-summary",
            ...result,
          });
        } catch (error) {
          results.push({
            testType: "weekly-summary",
            success: false,
            error: (error as Error).message,
          });
        }
        break;

      case "batch-completion":
        try {
          const result = await emailService.sendBatchCompletion(
            {
              clientName: "Test Client",
              batchNumber: 1,
              completedModels: [
                {
                  name: "Test Model 1",
                  modelerName: "Test Modeler 1",
                  completedAt: new Date().toISOString(),
                },
                {
                  name: "Test Model 2",
                  modelerName: "Test Modeler 2",
                  completedAt: new Date().toISOString(),
                },
              ],
              totalModels: 2,
              completionDate: new Date().toISOString(),
              dashboardLink: "https://example.com/dashboard",
              nextBatchInfo: {
                batchNumber: 2,
                totalModels: 3,
                estimatedCompletion: new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toLocaleDateString(),
              },
            },
            {
              from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
              to: testEmail,
              subject: "Test Batch Completion",
            }
          );
          results.push({
            testType: "batch-completion",
            ...result,
          });
        } catch (error) {
          results.push({
            testType: "batch-completion",
            success: false,
            error: (error as Error).message,
          });
        }
        break;

      case "stale-models":
        try {
          const result = await emailService.sendStaleModelReminder(
            {
              clientName: "Test Client",
              staleModels: [
                {
                  name: "Stale Model 1",
                  modelerName: "Test Modeler 1",
                  status: "in_production",
                  lastUpdated: new Date(
                    Date.now() - 10 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                  daysPending: 10,
                  deadline: new Date(
                    Date.now() + 3 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                  reviewLink: "https://example.com/review/1",
                },
                {
                  name: "Stale Model 2",
                  modelerName: "Test Modeler 2",
                  status: "revisions",
                  lastUpdated: new Date(
                    Date.now() - 14 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                  daysPending: 14,
                  deadline: new Date(
                    Date.now() - 2 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                  reviewLink: "https://example.com/review/2",
                },
              ],
              dashboardLink: "https://example.com/dashboard",
            },
            {
              from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
              to: testEmail,
              subject: "Test Stale Model Reminder",
            }
          );
          results.push({ testType: "stale-models", ...result });
        } catch (error) {
          results.push({
            testType: "stale-models",
            success: false,
            error: (error as Error).message,
          });
        }
        break;

      case "all":
        // Test all email types
        const testTypes = [
          "simple",
          "model-ready",
          "weekly-summary",
          "batch-completion",
          "stale-models",
        ];

        for (const type of testTypes) {
          try {
            // Recursively call this endpoint for each test type
            const testResponse = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email/test`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testEmail, testType: type }),
              }
            );

            const testResult = await testResponse.json();
            results.push({ testType: type, ...testResult });
          } catch (error) {
            results.push({
              testType: type,
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
              "Invalid test type. Valid types: simple, model-ready, weekly-summary, batch-completion, stale-models, all",
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Email test completed for ${testType}`,
      results,
      developmentMode:
        process.env.NODE_ENV === "development" ||
        process.env.EMAIL_DEV_MODE === "true",
    });
  } catch (error) {
    console.error("Error in email test API:", error);
    return NextResponse.json(
      { error: "Failed to test email service" },
      { status: 500 }
    );
  }
}
