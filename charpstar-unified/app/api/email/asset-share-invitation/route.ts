import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import React from "react";
import AssetShareInvitationEmail from "@/components/emails/AssetShareInvitationEmail";

type Payload = {
  to: string;
  recipientName?: string;
  sharerName: string;
  sharerEmail: string;
  assetCount: number;
  shareLink: string;
  expiresAt: string;
  message?: string;
  subject?: string;
};

const sendViaResendHTTP = async (
  payload: Required<
    Pick<Payload, "to" | "sharerName" | "shareLink" | "assetCount">
  > &
    Partial<Payload>
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.EMAIL_FROM || "noreply@mail.charpstar.co";
  const subject =
    payload.subject ||
    `${payload.sharerName} has requested your review of ${payload.assetCount} ${payload.assetCount === 1 ? "model" : "models"}`;

  // Render the React email component to HTML
  const html = await render(
    AssetShareInvitationEmail({
      recipientName: payload.recipientName,
      sharerName: payload.sharerName,
      sharerEmail: payload.sharerEmail || "",
      assetCount: payload.assetCount,
      shareLink: payload.shareLink,
      expiresAt: payload.expiresAt || "",
      message: payload.message,
    })
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject,
      html,
    }),
  });

  // Resend HTTP API returns id in JSON body
  let id: string | undefined;
  let errorText: string | undefined;
  try {
    const json = (await res.json()) as { id?: string; error?: any };
    id = json?.id;
    if (!res.ok) {
      errorText =
        typeof json?.error === "string" ? json.error : JSON.stringify(json);
    }
  } catch {
    try {
      errorText = await res.text();
    } catch {}
  }

  return { ok: res.ok, id, status: res.status, error: errorText } as const;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;

    // Validate required fields
    if (
      !body?.to ||
      !body?.sharerName ||
      !body?.shareLink ||
      !body?.assetCount
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: to, sharerName, shareLink, assetCount",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if RESEND_API_KEY is configured
    if (!process.env.RESEND_API_KEY) {
      console.error(
        "[asset-share-invitation-email] RESEND_API_KEY not configured"
      );
      return NextResponse.json(
        {
          error: "Email service not configured",
          details: "RESEND_API_KEY environment variable is missing",
        },
        { status: 500 }
      );
    }

    // Try Resend SDK with React template first
    let ok = false;
    let provider: "resend-sdk" | "resend-http" | undefined;
    let messageId: string | undefined;
    let errorReason: string | undefined;

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const subject =
          body.subject ||
          `${body.sharerName} has requested your review of ${body.assetCount} ${body.assetCount === 1 ? "model" : "models"}`;
        const from = process.env.EMAIL_FROM || "noreply@mail.charpstar.co";

        console.log(
          "[asset-share-invitation-email] Attempting to send via Resend SDK",
          {
            to: body.to,
            from,
            subject,
          }
        );

        // Render React component to ensure it's properly formatted
        const emailComponent = AssetShareInvitationEmail({
          recipientName: body.recipientName,
          sharerName: body.sharerName,
          sharerEmail: body.sharerEmail || "",
          assetCount: body.assetCount,
          shareLink: body.shareLink,
          expiresAt: body.expiresAt || "",
          message: body.message,
        });

        const { data, error } = await resend.emails.send({
          from,
          to: [body.to],
          subject,
          react: emailComponent as React.ReactElement,
        });

        ok = !error;
        provider = "resend-sdk";
        messageId = data?.id as string | undefined;

        if (!ok && error) {
          errorReason = (error as any)?.message || String(error);
          console.error(
            "[asset-share-invitation-email] Resend SDK error:",
            error
          );
        } else {
          console.log(
            "[asset-share-invitation-email] Email sent successfully via Resend SDK",
            { messageId }
          );
        }
      } catch (e: any) {
        console.error(
          "[asset-share-invitation-email] Resend SDK exception:",
          e
        );
        errorReason = e?.message || String(e);
        // Fallback to HTTP API
        console.log(
          "[asset-share-invitation-email] Falling back to Resend HTTP API..."
        );
        const http = await sendViaResendHTTP(body);
        if (http && typeof http === "object") {
          ok = http.ok;
          provider = "resend-http";
          messageId = http.id;
          if (!ok) {
            errorReason = http.error || `status ${http.status}`;
          } else {
            console.log(
              "[asset-share-invitation-email] Email sent successfully via Resend HTTP API",
              { messageId }
            );
          }
        }
      }
    }

    if (!ok) {
      console.error("[asset-share-invitation-email] send failed", {
        provider,
        messageId,
        errorReason,
        to: body.to,
        from: process.env.EMAIL_FROM,
      });
      return NextResponse.json(
        {
          error: "Failed to send email",
          provider,
          messageId,
          reason: errorReason,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, provider, messageId });
  } catch (e: any) {
    console.error(
      "[asset-share-invitation-email] Unexpected error:",
      e,
      e?.stack
    );
    return NextResponse.json(
      { error: e?.message || "Failed to send invitation email" },
      { status: 500 }
    );
  }
}
