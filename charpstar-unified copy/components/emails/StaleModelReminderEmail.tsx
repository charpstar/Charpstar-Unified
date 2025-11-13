import React from "react";

interface StaleModelReminderEmailProps {
  clientName: string;
  staleModels: Array<{
    name: string;
    modelerName: string;
    status: string;
    lastUpdated: string;
    daysPending: number;
    deadline?: string;
    reviewLink: string;
  }>;
  dashboardLink: string;
}

export default function StaleModelReminderEmail({
  clientName,
  staleModels,
  dashboardLink,
}: StaleModelReminderEmailProps) {
  const getUrgencyColor = (daysPending: number) => {
    if (daysPending >= 14) return "#ef4444"; // Red
    if (daysPending >= 10) return "#f59e0b"; // Orange
    return "#6b7280"; // Gray
  };

  const getUrgencyText = (daysPending: number) => {
    if (daysPending >= 14) return "Critical";
    if (daysPending >= 10) return "High";
    return "Medium";
  };

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
          Action Required
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
            {staleModels.length} model{staleModels.length > 1 ? "s" : ""} need
            {staleModels.length === 1 ? "s" : ""} your attention.
          </p>

          {/* Stale Models */}
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
              <strong>Models Pending Review:</strong>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "space-between",
              }}
            >
              {staleModels.slice(0, 6).map((model, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: "1",
                    minWidth: "140px",
                    padding: "10px",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "4px",
                    marginBottom: "8px",
                    fontSize: "12px",
                    border: `2px solid ${getUrgencyColor(model.daysPending)}20`,
                  }}
                >
                  <div
                    style={{
                      color: "#cccccc",
                      fontWeight: "600",
                      marginBottom: "4px",
                      textAlign: "center",
                    }}
                  >
                    {model.name}
                  </div>
                  <div
                    style={{
                      color: "#999999",
                      fontSize: "10px",
                      marginBottom: "6px",
                      textAlign: "center",
                    }}
                  >
                    {model.modelerName}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        color: getUrgencyColor(model.daysPending),
                        fontWeight: "600",
                        fontSize: "14px",
                        marginBottom: "2px",
                      }}
                    >
                      {model.daysPending}d
                    </div>
                    <div style={{ color: "#999999", fontSize: "9px" }}>
                      {getUrgencyText(model.daysPending)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {staleModels.length > 6 && (
              <div
                style={{
                  color: "#999999",
                  fontSize: "12px",
                  textAlign: "center",
                  marginTop: "10px",
                }}
              >
                +{staleModels.length - 6} more models
              </div>
            )}
          </div>

          {/* Summary Stats */}
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
              <strong>Summary:</strong>
            </div>
            <div style={{ color: "#cccccc", fontSize: "12px" }}>
              {staleModels.filter((m) => m.daysPending >= 14).length} critical •
              {
                staleModels.filter(
                  (m) => m.daysPending >= 10 && m.daysPending < 14
                ).length
              }{" "}
              high priority •
              {staleModels.filter((m) => m.daysPending < 10).length} medium
              priority
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div style={{ marginBottom: "20px" }}>
          <a
            href={dashboardLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              padding: "12px 25px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              borderRadius: "6px",
              border: "1px solid #dc2626",
            }}
          >
            Review Now
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
