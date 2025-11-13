import React from "react";

interface ModelReadyForReviewEmailProps {
  clientName: string;
  modelName: string;
  modelerName: string;
  reviewLink: string;
  batch?: number;
  deadline?: string;
}

export default function ModelReadyForReviewEmail({
  clientName,
  modelName,
  modelerName,
  reviewLink,
  batch,
  deadline,
}: ModelReadyForReviewEmailProps) {
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
          padding: "40px",
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
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0 0 15px 0",
          }}
        >
          Model Ready
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
          <p style={{ margin: "0 0 15px 0" }}>
            <strong>&ldquo;{modelName}&rdquo;</strong> is ready for review.
          </p>
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ color: "#cccccc", fontSize: "14px" }}>
                <strong>Modeler:</strong> {modelerName}
              </div>
              {batch && (
                <div style={{ color: "#cccccc", fontSize: "14px" }}>
                  <strong>Batch:</strong> #{batch}
                </div>
              )}
              {deadline && (
                <div style={{ color: "#cccccc", fontSize: "14px" }}>
                  <strong>Due:</strong>{" "}
                  {new Date(deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div style={{ marginBottom: "30px" }}>
          <a
            href={reviewLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              backgroundColor: "#ffffff",
              color: "#000000",
              padding: "14px 32px",
              fontSize: "16px",
              fontWeight: "600",
              textDecoration: "none",
              borderRadius: "6px",
              border: "1px solid #222222",
            }}
          >
            Review Model
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
