import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { InvitationEmail } from "@/components/emails/InvitationEmail";

type Payload = {
  to: string;
  subject?: string;
  invitationLink?: string;
};

const sendViaResend = async (
  payload: Required<Pick<Payload, "to">> & Partial<Payload>
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.EMAIL_FROM || "noreply@charpstar.com";
  const subject = payload.subject || "You're Invited to Join Us!";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>You're Invited to Join Us!</title>
  </head>
  <body style="margin:0; padding:0; background:#000;">
    <table width="100%" bgcolor="#ffffff" cellpadding="0" cellspacing="0" border="0" style="padding:40px 0;">
      <tr>
        <td align="center">
          <table width="480" bgcolor="#111111" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #222222; border-radius:8px; padding:30px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; text-align:center;">
            <tr align="center">
              <td
                height="195"
                align="center"
                style="
                  background: url('https://tpamckewerybqzhhhqqp.supabase.co/storage/v1/object/public/maillogo/6%20(1).png') no-repeat center center;
                  background-size: contain;
                  height: 195px;
                  width: 100%;
                  max-width: 240px;
                  display: block;
                  text-align: center;
                "
              >
                &nbsp;
              </td>
            </tr>

            <tr>
              <td style="color:#fff; font-size:24px; font-weight:bold; padding-bottom:16px;">
                You're Invited!
              </td>
            </tr>
            <tr>
              <td style="color:#ddd; font-size:16px; line-height:1.6;">
                <p>Hello,</p>
                <p>
                  We are excited to invite you to join <strong>CharpstAR</strong>!<br />
                  Click the button below to start your onboarding and set up your account.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <!-- BULLETPROOF BUTTON -->
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td bgcolor="#ffffff" style="border-radius:6px; text-align:center;">
                      <a href="${payload.invitationLink || "#"}" target="_blank"
                        style="display:inline-block; padding:14px 32px; font-size:16px; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; color:#000000; text-decoration:none; border-radius:6px; border:1px solid #222222; font-weight:600;">
                        Accept Invitation
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- /BULLETPROOF BUTTON -->
              </td>
            </tr>
            <tr>
              <td style="color:#999; font-size:13px; padding-top:30px;">
                <div style="max-width:360px; margin:0 auto;">
                  If you did not expect this invitation, you can safely ignore this message.<br />
                  For questions or support, contact our team.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    if (!body?.to) {
      return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
    }

    // Try Resend first
    let ok = false;
    let provider: "resend-sdk" | "resend-http" | undefined;
    let messageId: string | undefined;
    let errorReason: string | undefined;

    if (process.env.RESEND_API_KEY) {
      // Try Resend SDK with React template first
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const subject = body.subject || "You're Invited to Join Us!";
        const from = process.env.EMAIL_FROM || "noreply@charpstar.com";

        const { data, error } = await resend.emails.send({
          from,
          to: [body.to],
          subject,
          react: InvitationEmail({
            invitationLink: body.invitationLink,
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
        // Fallback to HTTP API
        const http = await sendViaResend(body);
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
      console.error("[invitation-email] send failed", {
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
      { error: e?.message || "Failed to send invitation email" },
      { status: 500 }
    );
  }
}
