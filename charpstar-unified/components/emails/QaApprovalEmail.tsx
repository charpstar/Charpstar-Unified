import React from "react";

interface QaApprovalEmailProps {
  clientName: string;
  modelName: string;

  approverRole: "QA Team" | "Admin Team";
  reviewLink: string;
  batch?: number;
  deadline?: string;
}

export default function QaApprovalEmail({
  clientName,
  modelName,

  approverRole,
  reviewLink,
  batch,
  deadline,
}: QaApprovalEmailProps) {
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
            fontSize: "24px",
            fontWeight: "bold",
            margin: "0 0 15px 0",
          }}
        >
          Model Approved for Review
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
            Hello {clientName},
          </p>
          <p style={{ margin: "0 0 15px 0", color: "#dddddd" }}>
            Great news! Your 3D model <strong>&ldquo;{modelName}&rdquo;</strong>{" "}
            has been approved by our {approverRole.toLowerCase()} and is now
            ready for your review.
          </p>

          {/* Model Details Box */}
          <div
            style={{
              backgroundColor: "#222222",
              padding: "15px",
              borderRadius: "6px",
              margin: "15px 0",
              border: "1px solid #333333",
              textAlign: "left",
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              Model Details:
            </div>
            <div
              style={{ color: "#cccccc", fontSize: "14px", lineHeight: "1.6" }}
            >
              <div>• Model: {modelName}</div>
              <div>• Role: {approverRole}</div>
              {batch && <div>• Batch: #{batch}</div>}
              {deadline && (
                <div>• Deadline: {new Date(deadline).toLocaleDateString()}</div>
              )}
            </div>
          </div>

          <p style={{ margin: "15px 0 0 0" }}>
            Please review the model and provide your feedback. You can approve
            it or request any necessary revisions.
          </p>
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
          <p style={{ margin: "0 0 8px 0" }}>
            If you have any questions or need assistance, please don&apos;t
            hesitate to contact our support team.
          </p>
          <p style={{ margin: "0" }}>
            Best regards,
            <br />
            The CharpstAR Team
          </p>
        </div>
      </div>
    </div>
  );
}
