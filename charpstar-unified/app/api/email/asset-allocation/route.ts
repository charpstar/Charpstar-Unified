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
  <div style="margin: 0; padding: 0; background: #000;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; padding: 40px 0;">
      <tr>
        <td style="text-align: center;">
          <table width="480" cellpadding="0" cellspacing="0" border="0" style="background-color: #111111; border: 1px solid #222222; border-radius: 8px; padding: 30px; font-family: 'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; text-align: center;">
            <tr style="text-align: center;">
              <td height="195" style="background: url('https://tpamckewerybqzhhhqqp.supabase.co/storage/v1/object/public/maillogo/6%20(1).png') no-repeat center center; background-size: contain; height: 195px; width: 100%; max-width: 240px; display: block; text-align: center; margin: 0 auto;">
                &nbsp;
              </td>
            </tr>
            
            <tr>
              <td style="color: #fff; font-size: 24px; font-weight: bold; padding-bottom: 16px;">
                New Allocation Assigned!
              </td>
            </tr>
            
            <tr>
              <td style="color: #ddd; font-size: 16px; line-height: 1.6;">
                <p>Hello there,</p>
                <p>
                  You have been assigned a new allocation for <strong>${data.client ? escapeHtml(data.client) : "a client"}</strong>!<br />
                  Please review the details below and log in to your dashboard to get started.
                </p>
              </td>
            </tr>
            
            <tr>
              <td style="color: #fff; font-size: 18px; font-weight: 600; padding-top: 20px; padding-bottom: 12px;">
                Allocation Details
              </td>
            </tr>
            
            ${
              data.allocationListName
                ? `
            <tr>
              <td style="color: #ddd; font-size: 14px; padding-bottom: 8px;">
                <strong>List:</strong> ${escapeHtml(data.allocationListName)}${data.allocationListNumber != null ? ` (#${data.allocationListNumber})` : ""}
              </td>
            </tr>
            `
                : ""
            }
            
            ${
              deadlineText
                ? `
            <tr>
              <td style="color: #ddd; font-size: 14px; padding-bottom: 8px;">
                <strong>Deadline:</strong> ${deadlineText}
              </td>
            </tr>
            `
                : ""
            }
            
            ${
              typeof data.bonus === "number"
                ? `
            <tr>
              <td style="color: #ddd; font-size: 14px; padding-bottom: 8px;">
                <strong>Bonus:</strong> ${data.bonus}%
              </td>
            </tr>
            `
                : ""
            }
            
            ${
              Array.isArray(data.assetNames) && data.assetNames.length > 0
                ? `
            <tr>
              <td style="color: #ddd; font-size: 14px; padding-bottom: 8px;">
                <strong>Assets:</strong> ${data.assetNames.length} assigned
              </td>
            </tr>
            `
                : ""
            }
            
            <tr>
              <td style="text-align: center; padding: 24px 0;">
                <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background-color: #ffffff; border-radius: 6px; text-align: center;">
                      <a href="${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-family: 'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; color: #000000; text-decoration: none; border-radius: 6px; border: 1px solid #222222; font-weight: 600;">
                        View Dashboard
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <tr>
              <td style="color: #999; font-size: 13px; padding-top: 30px;">
                <div style="max-width: 360px; margin: 0 auto;">
                  If you have any questions about this allocation, please contact our team.<br />
                  Log in to your dashboard to view full details and start working.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
