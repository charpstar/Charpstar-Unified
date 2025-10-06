import React from "react";

interface WeeklyStatusSummaryEmailProps {
  clientName: string;
  summaryData: {
    totalModels: number;
    completedModels: number;
    inProgressModels: number;
    pendingModels: number;
    revisionModels: number;
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
            backgroundSize: "contain",
            height: "180px",
            width: "100%",
            maxWidth: "400px",
            margin: "0 auto 40px auto",
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
          <p style={{ margin: "0 0 12px 0" }}>Hi {clientName},</p>
          <p style={{ margin: "0 0 20px 0" }}>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div style={{ textAlign: "center", flex: "1", minWidth: "80px" }}>
                <div
                  style={{
                    color: "#10b981",
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  {summaryData.completedModels}
                </div>
                <div style={{ color: "#cccccc", fontSize: "12px" }}>Done</div>
              </div>
              <div style={{ textAlign: "center", flex: "1", minWidth: "80px" }}>
                <div
                  style={{
                    color: "#f59e0b",
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  {summaryData.inProgressModels}
                </div>
                <div style={{ color: "#cccccc", fontSize: "12px" }}>
                  In Progress
                </div>
              </div>
              <div style={{ textAlign: "center", flex: "1", minWidth: "80px" }}>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  {summaryData.pendingModels}
                </div>
                <div style={{ color: "#cccccc", fontSize: "12px" }}>
                  Pending
                </div>
              </div>
            </div>

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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "15px",
                }}
              >
                {summaryData.batches.slice(0, 3).map((batch) => (
                  <div
                    key={batch.batchNumber}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: "1",
                      minWidth: "80px",
                      padding: "8px",
                      backgroundColor: "#1a1a1a",
                      borderRadius: "4px",
                    }}
                  >
                    <span style={{ color: "#cccccc", fontSize: "12px" }}>
                      Batch #{batch.batchNumber}
                    </span>
                    <span
                      style={{
                        color:
                          batch.status === "completed"
                            ? "#10b981"
                            : batch.status === "in_progress"
                              ? "#f59e0b"
                              : "#6b7280",
                        fontWeight: "600",
                        fontSize: "16px",
                      }}
                    >
                      {batch.completionPercentage}%
                    </span>
                  </div>
                ))}
              </div>
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
