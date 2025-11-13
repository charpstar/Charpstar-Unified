import React from "react";

interface TeamInvitationEmailProps {
  invitedEmail: string;
  clientName: string;
  role: string;
  signupLink: string;
  inviterName?: string;
  expiresAt: string;
}

export default function TeamInvitationEmail({
  clientName,
  role,
  signupLink,
  inviterName,
  expiresAt,
}: TeamInvitationEmailProps) {
  const getRoleName = (roleValue: string) => {
    switch (roleValue) {
      case "client":
        return "Team Member";
      case "modeler":
        return "3D Modeler";
      case "qa":
        return "Quality Assurance";
      case "admin":
        return "Administrator";
      default:
        return roleValue;
    }
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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
          You&apos;re Invited to Join {clientName}
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
          <p style={{ margin: "0 0 12px 0" }}>Hi there,</p>
          <p style={{ margin: "0 0 15px 0" }}>
            {inviterName ? (
              <>
                <strong>{inviterName}</strong> from{" "}
                <strong>{clientName}</strong> has invited you to join their team
                on CharpstAR.
              </>
            ) : (
              <>
                You&apos;ve been invited to join <strong>{clientName}</strong>{" "}
                on CharpstAR.
              </>
            )}
          </p>

          {/* Role Badge */}
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
                color: "#cccccc",
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              <strong>Your Role:</strong>
            </div>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                padding: "6px 12px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              {getRoleName(role)}
            </div>
          </div>

          <p style={{ margin: "15px 0", color: "#cccccc", fontSize: "14px" }}>
            Click the button below to set up your account and get started.
          </p>
        </div>

        {/* CTA Button */}
        <a
          href={signupLink}
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
          Accept Invitation & Sign Up
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
              This invitation expires on{" "}
              <strong>{formatExpirationDate(expiresAt)}</strong>
            </span>
          </p>
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
            If you weren&apos;t expecting this invitation, you can safely ignore
            this email.
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
