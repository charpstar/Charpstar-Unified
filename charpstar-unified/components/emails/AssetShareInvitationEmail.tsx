import React from "react";

interface AssetShareInvitationEmailProps {
  recipientName?: string;
  sharerName: string;
  sharerEmail: string;
  assetCount: number;
  shareLink: string;
  expiresAt: string;
  message?: string;
}

export default function AssetShareInvitationEmail({
  recipientName,
  sharerName,
  sharerEmail,
  assetCount,
  shareLink,
  expiresAt,
  message,
}: AssetShareInvitationEmailProps) {
  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatExpirationTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
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
          Review Request
        </h1>

        {/* Content */}
        <div
          style={{
            color: "#dddddd",
            fontSize: "16px",
            lineHeight: "1.5",
            marginBottom: "25px",
            textAlign: "left",
          }}
        >
          <p style={{ margin: "0 0 12px 0" }}>
            Hi {recipientName ? recipientName : "there"},
          </p>
          <p style={{ margin: "0 0 15px 0" }}>
            <strong>{sharerName}</strong> ({sharerEmail}) has requested your
            review of {assetCount} {assetCount === 1 ? "3D model" : "3D models"}.
          </p>

          {/* Asset Count Badge */}
          <div
            style={{
              backgroundColor: "#222222",
              padding: "15px",
              borderRadius: "6px",
              margin: "15px 0",
              border: "1px solid #333333",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#cccccc",
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              <strong>Models to Review:</strong>
            </div>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: "4px",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              {assetCount} {assetCount === 1 ? "Model" : "Models"}
            </div>
          </div>

          {/* Optional Message */}
          {message && (
            <div
              style={{
                backgroundColor: "#1a1a1a",
                padding: "15px",
                borderRadius: "6px",
                margin: "15px 0",
                border: "1px solid #333333",
              }}
            >
              <div
                style={{
                  color: "#cccccc",
                  fontSize: "13px",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Message from {sharerName}:
              </div>
              <div
                style={{
                  color: "#dddddd",
                  fontSize: "14px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {message}
              </div>
            </div>
          )}

          <p style={{ margin: "15px 0", color: "#cccccc", fontSize: "14px" }}>
            Click the button below to review the models. You can approve them or
            request revisions as needed.
          </p>
        </div>

        {/* CTA Button */}
        <a
          href={shareLink}
          style={{
            display: "inline-block",
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            padding: "14px 32px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "16px",
            margin: "10px 0 20px 0",
          }}
        >
          Review Models
        </a>

        {/* Expiration Notice */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            padding: "12px",
            borderRadius: "6px",
            margin: "20px 0",
            border: "1px solid #333333",
          }}
        >
          <p
            style={{
              margin: "0",
              color: "#fbbf24",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⏰</span>
            <span>
              This review link expires on{" "}
              <strong>
                {formatExpirationDate(expiresAt)} at{" "}
                {formatExpirationTime(expiresAt)}
              </strong>
            </span>
          </p>
        </div>

        {/* Instructions */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            padding: "15px",
            borderRadius: "6px",
            margin: "20px 0",
            border: "1px solid #333333",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#cccccc",
              fontSize: "13px",
              marginBottom: "10px",
              fontWeight: "bold",
            }}
          >
            What to expect:
          </div>
          <ul
            style={{
              color: "#dddddd",
              fontSize: "13px",
              margin: "0",
              paddingLeft: "20px",
              lineHeight: "1.8",
            }}
          >
            <li>View 3D models and reference images</li>
            <li>Approve models or request revisions</li>
            <li>Add comments or feedback</li>
            <li>No account required - just click the link</li>
          </ul>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #333333",
            paddingTop: "20px",
            marginTop: "30px",
          }}
        >
          <p
            style={{
              color: "#888888",
              fontSize: "13px",
              margin: "0 0 8px 0",
            }}
          >
            If you weren&apos;t expecting this review request, you can safely
            ignore this email or contact {sharerEmail} for more information.
          </p>
          <p
            style={{
              color: "#666666",
              fontSize: "12px",
              margin: "0",
            }}
          >
            © {new Date().getFullYear()} CharpstAR. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

