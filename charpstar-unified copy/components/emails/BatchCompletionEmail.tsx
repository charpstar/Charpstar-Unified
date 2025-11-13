import React from "react";

interface BatchCompletionEmailProps {
  clientName: string;
  batchNumber: number;
  completedModels: Array<{
    name: string;
    modelerName: string;
    completedAt: string;
  }>;
  totalModels: number;
  completionDate: string;
  dashboardLink: string;
  nextBatchInfo?: {
    batchNumber: number;
    totalModels: number;
    estimatedCompletion?: string;
  };
}

export default function BatchCompletionEmail({
  clientName,
  batchNumber,
  completedModels,
  totalModels,
  dashboardLink,
  nextBatchInfo,
}: BatchCompletionEmailProps) {
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
          Batch #{batchNumber} Complete!
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
            <strong>Batch #{batchNumber}</strong> is complete with {totalModels}{" "}
            models ready for review.
          </p>

          {/* Completed Models */}
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
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "15px",
              }}
            >
              <strong>Completed Models:</strong>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "space-between",
              }}
            >
              {completedModels.slice(0, 6).map((model, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: "1",
                    minWidth: "120px",
                    padding: "8px",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "4px",
                    marginBottom: "8px",
                    fontSize: "12px",
                  }}
                >
                  <span
                    style={{
                      color: "#cccccc",
                      fontWeight: "600",
                      marginBottom: "4px",
                    }}
                  >
                    {model.name}
                  </span>
                  <span style={{ color: "#999999", fontSize: "11px" }}>
                    {model.modelerName}
                  </span>
                </div>
              ))}
            </div>
            {completedModels.length > 6 && (
              <div
                style={{
                  color: "#999999",
                  fontSize: "12px",
                  textAlign: "center",
                  marginTop: "10px",
                }}
              >
                +{completedModels.length - 6} more models
              </div>
            )}
          </div>

          {/* Next Batch Info */}
          {nextBatchInfo && (
            <div
              style={{
                backgroundColor: "#1a1a1a",
                padding: "15px",
                borderRadius: "6px",
                margin: "15px 0",
                border: "1px solid #444444",
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  marginBottom: "8px",
                }}
              >
                <strong>Next: Batch #{nextBatchInfo.batchNumber}</strong>
              </div>
              <div style={{ color: "#cccccc", fontSize: "12px" }}>
                {nextBatchInfo.totalModels} models •
                {nextBatchInfo.estimatedCompletion &&
                  ` ETA: ${nextBatchInfo.estimatedCompletion}`}
              </div>
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
            Review Models
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
