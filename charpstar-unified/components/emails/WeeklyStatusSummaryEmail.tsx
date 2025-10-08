import React from "react";

interface WeeklyStatusSummaryEmailProps {
  clientName: string;
  summaryData: {
    totalModels: number;
    completedModels: number;
    readyForReviewModels: number;
    pendingModels: number;
    completionPercentage: number;
    batches: Array<{
      batchNumber: number;
      totalModels: number;
      completedModels: number;
      completionPercentage: number;
      status: "in_progress" | "completed" | "pending";
    }>;
  };
  dashboardLink: string;
  weekRange: string;
}

export default function WeeklyStatusSummaryEmail({
  clientName,
  summaryData,
  dashboardLink,
  weekRange,
}: WeeklyStatusSummaryEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          backgroundColor: "#111111",
          padding: "30px",
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            background:
              'url("https://tpamckewerybqzhhhqqp.supabase.co/storage/v1/object/public/maillogo/6%20(1).png") no-repeat center center',
            backgroundSize: "120% auto",
            height: "120px",
            width: "100%",
            maxWidth: "300px",
            margin: "0 auto 15px auto",
            display: "block",
          }}
        />

        {/* Header */}
        <h1
          style={{
            color: "#ffffff",
            fontSize: "22px",
            fontWeight: "bold",
            margin: "0 0 15px 0",
          }}
        >
          Weekly Summary
        </h1>

        {/* Content */}
        <div
          style={{
            color: "#dddddd",
            fontSize: "16px",
            lineHeight: "1.5",
            marginBottom: "25px",
          }}
        >
          <p style={{ margin: "0 0 12px 0", color: "#dddddd" }}>
            Hi {clientName},
          </p>
          <p style={{ margin: "0 0 20px 0", color: "#dddddd" }}>
            Here&apos;s your project status for {weekRange}:
          </p>

          {/* Quick Stats */}
          <div
            style={{
              backgroundColor: "#222222",
              padding: "20px",
              borderRadius: "6px",
              margin: "15px 0",
              border: "1px solid #333333",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tr>
                <td
                  style={{ textAlign: "center", padding: "20px", width: "33%" }}
                >
                  <div
                    style={{
                      color: "#10b981",
                      fontSize: "32px",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    {summaryData.completedModels}
                  </div>
                  <div style={{ color: "#cccccc", fontSize: "13px" }}>
                    Completed
                  </div>
                </td>
                <td
                  style={{ textAlign: "center", padding: "20px", width: "33%" }}
                >
                  <div
                    style={{
                      color: "#3b82f6",
                      fontSize: "32px",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    {summaryData.readyForReviewModels}
                  </div>
                  <div style={{ color: "#cccccc", fontSize: "13px" }}>
                    Ready for Review
                  </div>
                </td>
                <td
                  style={{ textAlign: "center", padding: "20px", width: "33%" }}
                >
                  <div
                    style={{
                      color: "#f59e0b",
                      fontSize: "32px",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    {summaryData.pendingModels}
                  </div>
                  <div style={{ color: "#cccccc", fontSize: "13px" }}>
                    Pending
                  </div>
                </td>
              </tr>
            </table>

            {/* Progress Bar */}
            <div
              style={{
                marginTop: "15px",
                backgroundColor: "#333333",
                borderRadius: "10px",
                height: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  backgroundColor: "#10b981",
                  height: "100%",
                  width: `${summaryData.completionPercentage}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                color: "#cccccc",
                fontSize: "12px",
                textAlign: "center",
                marginTop: "8px",
              }}
            >
              {summaryData.completionPercentage}% Complete
            </div>
          </div>

          {/* Batch Summary */}
          {summaryData.batches.length > 0 && (
            <div
              style={{
                backgroundColor: "#222222",
                padding: "15px",
                borderRadius: "6px",
                margin: "15px 0",
                border: "1px solid #333333",
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  marginBottom: "10px",
                }}
              >
                <strong>Batches:</strong>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tr>
                  {summaryData.batches.slice(0, 3).map((batch) => (
                    <td
                      key={batch.batchNumber}
                      style={{
                        textAlign: "center",
                        padding: "15px",
                        width: `${100 / Math.min(summaryData.batches.length, 3)}%`,
                        backgroundColor: "#1a1a1a",
                        borderRadius: "6px",
                        margin: "0 5px",
                      }}
                    >
                      <div
                        style={{
                          color: "#cccccc",
                          fontSize: "13px",
                          marginBottom: "8px",
                        }}
                      >
                        Batch #{batch.batchNumber}
                      </div>
                      <div
                        style={{
                          color:
                            batch.status === "completed"
                              ? "#10b981"
                              : batch.status === "in_progress"
                                ? "#f59e0b"
                                : "#6b7280",
                          fontWeight: "bold",
                          fontSize: "22px",
                          marginTop: "4px",
                        }}
                      >
                        {batch.completionPercentage}%
                      </div>
                    </td>
                  ))}
                </tr>
              </table>
              {summaryData.batches.length > 3 && (
                <div
                  style={{
                    color: "#999999",
                    fontSize: "12px",
                    textAlign: "center",
                  }}
                >
                  +{summaryData.batches.length - 3} more batches
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div style={{ marginBottom: "20px" }}>
          <a
            href={dashboardLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              backgroundColor: "#ffffff",
              color: "#000000",
              padding: "12px 25px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              borderRadius: "6px",
              border: "1px solid #222222",
            }}
          >
            View Dashboard
          </a>
        </div>

        {/* Footer */}
        <div
          style={{
            color: "#999999",
            fontSize: "12px",
            borderTop: "1px solid #333333",
            paddingTop: "15px",
          }}
        >
          <p style={{ margin: "0" }}>Questions? Just reply to this email.</p>
        </div>
      </div>
    </div>
  );
}
