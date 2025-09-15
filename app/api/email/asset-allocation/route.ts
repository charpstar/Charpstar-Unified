import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { AllocationAssignedEmail } from "@/components/emails/AllocationAssignedEmail";

type Payload = {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  modelerName?: string;
  client?: string;
  allocationListName?: string;
  allocationListNumber?: number;
  assetNames?: string[];
  deadline?: string;
  bonus?: number;
};

const sendViaResend = async (
  payload: Required<Pick<Payload, "to">> & Partial<Payload>
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const subject =
    payload.subject ||
    `New Allocation Assigned${payload.client ? ` - ${payload.client}` : ""}`;

  const html =
    payload.html ||
    defaultHtml({
      client: payload.client,
      allocationListName: payload.allocationListName,
      allocationListNumber: payload.allocationListNumber,
      assetNames: payload.assetNames,
      deadline: payload.deadline,
      bonus: payload.bonus,
    });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: payload.to, subject, html }),
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

const sendViaSendGrid = async (
  payload: Required<Pick<Payload, "to">> & Partial<Payload>
) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;
  const from = process.env.EMAIL_FROM || "noreply@charpstar.com";
  const subject =
    payload.subject ||
    `New Allocation Assigned${payload.client ? ` - ${payload.client}` : ""}`;
  const htmlContent =
    payload.html ||
    defaultHtml({
      client: payload.client,
      allocationListName: payload.allocationListName,
      allocationListNumber: payload.allocationListNumber,
      assetNames: payload.assetNames,
      deadline: payload.deadline,
      bonus: payload.bonus,
    });
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/html", value: htmlContent }],
    }),
  });
  // SendGrid returns 202 and x-message-id header
  const id =
    res.headers.get("x-message-id") ||
    res.headers.get("X-Message-Id") ||
    undefined;
  return { ok: res.ok, id };
};

const defaultHtml = (data: Partial<Payload>) => {
  const deadlineText = data.deadline
    ? new Date(data.deadline).toLocaleDateString()
    : undefined;
  return `
  <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; color:#0f172a;">
    <h2 style="margin:0 0 8px">You have a new allocation</h2>
    ${data.client ? `<p style="margin:4px 0;">Client: <strong>${escapeHtml(data.client)}</strong></p>` : ""}
    ${data.allocationListName ? `<p style="margin:4px 0;">List: <strong>${escapeHtml(data.allocationListName)}</strong>${data.allocationListNumber != null ? ` (#${data.allocationListNumber})` : ""}</p>` : ""}
    ${deadlineText ? `<p style="margin:4px 0;">Deadline: <strong>${deadlineText}</strong></p>` : ""}
    ${typeof data.bonus === "number" ? `<p style="margin:4px 0;">Bonus: <strong>${data.bonus}%</strong></p>` : ""}
    ${
      Array.isArray(data.assetNames) && data.assetNames.length
        ? `
      <p style="margin:8px 0 4px;">Assets:</p>
      <ul style="margin:0; padding-left:18px;">
        ${data.assetNames
          .slice(0, 15)
          .map((n) => `<li>${escapeHtml(n)}</li>`)
          .join("")}
      </ul>
      ${data.assetNames.length > 15 ? `<p style="margin-top:6px; color:#475569;">and ${data.assetNames.length - 15} more…</p>` : ""}
    `
        : ""
    }
    <p style="margin-top:12px; color:#475569;">Log in to your dashboard to view details.</p>
  </div>`;
};

const escapeHtml = (s?: string) =>
  (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c] as string
  );

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    if (!body?.to) {
      return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
    }

    // Try providers in order: SendGrid -> Resend
    let ok = false;
    let provider: "sendgrid" | "resend-sdk" | "resend-http" | undefined;
    let messageId: string | undefined;
    let errorReason: string | undefined;
    if (process.env.SENDGRID_API_KEY) {
      const sg = await sendViaSendGrid(body as any);
      if (sg && typeof sg === "object") {
        ok = sg.ok;
        provider = "sendgrid";
        messageId = sg.id;
      }
    }
    if (!ok && process.env.RESEND_API_KEY) {
      // Prefer React template when using Resend SDK for richer rendering
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const subject =
          body.subject ||
          `New Allocation Assigned${body.client ? ` - ${body.client}` : ""}`;
        const from = process.env.EMAIL_FROM || "noreply@charpstar.com";
        const { data, error } = await resend.emails.send({
          from,
          to: [body.to],
          subject,
          react: AllocationAssignedEmail({
            modelerName: body.modelerName,
            client: body.client,
            allocationName: body.allocationListName,
            allocationNumber: body.allocationListNumber,
            assetNames: body.assetNames,
            deadline: body.deadline,
            bonus: body.bonus,
          }) as React.ReactElement,
        });
        ok = !error;
        provider = "resend-sdk";
        messageId = data?.id as string | undefined;
        if (!ok && error) {
          errorReason = (error as any)?.message || String(error);
        }
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e: any) {
        const http = await sendViaResend(body as any);
        if (http && typeof http === "object") {
          ok = http.ok;
          provider = "resend-http";
          messageId = http.id;
          if (!ok) {
            errorReason = http.error || `status ${http.status}`;
          }
        }
      }
    }

    if (!ok) {
      console.error("[email] send failed", {
        provider,
        messageId,
        errorReason,
      });
      return NextResponse.json(
        {
          error: "No email provider configured or request failed",
          provider,
          messageId,
          reason: errorReason,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, provider, messageId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
