import * as React from "react";

export interface InvitationEmailProps {
  invitationLink?: string;
}

export function InvitationEmail(props: InvitationEmailProps) {
  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      <table
        width="100%"
        bgcolor="#ffffff"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ padding: "40px 0" }}
      >
        <tr>
          <td align="center">
            <table
              width="480"
              bgcolor="#111111"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              style={{
                border: "1px solid #222222",
                borderRadius: "8px",
                padding: "30px",
                fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
                textAlign: "center",
              }}
            >
              <tr style={{ textAlign: "center" }}>
                <td
                  height="195"
                  align="center"
                  style={{
                    background:
                      "url('https://tpamckewerybqzhhhqqp.supabase.co/storage/v1/object/public/maillogo/6%20(1).png') no-repeat center center",
                    backgroundSize: "contain",
                    height: "195px",
                    width: "100%",
                    maxWidth: "240px",
                    display: "block",
                  }}
                >
                  &nbsp;
                </td>
              </tr>

              <tr>
                <td
                  style={{
                    color: "#fff",
                    fontSize: "24px",
                    fontWeight: "bold",
                    paddingBottom: "16px",
                  }}
                >
                  You&apos;re Invited!
                </td>
              </tr>
              <tr>
                <td
                  style={{ color: "#ddd", fontSize: "16px", lineHeight: "1.6" }}
                >
                  <p>Hello,</p>
                  <p>
                    We are excited to invite you to join{" "}
                    <strong>CharpstAR</strong>!<br />
                    Click the button below to start your onboarding and set up
                    your account.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style={{ padding: "24px 0" }}>
                  {/* BULLETPROOF BUTTON */}
                  <table border={0} cellSpacing={0} cellPadding={0}>
                    <tr>
                      <td
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "6px",
                          textAlign: "center",
                        }}
                      >
                        <a
                          href={props.invitationLink || "#"}
                          target="_blank"
                          style={{
                            display: "inline-block",
                            padding: "14px 32px",
                            fontSize: "16px",
                            fontFamily:
                              "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
                            color: "#000000",
                            textDecoration: "none",
                            borderRadius: "6px",
                            border: "1px solid #222222",
                            fontWeight: "600",
                          }}
                        >
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>
                  {/* /BULLETPROOF BUTTON */}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    color: "#999",
                    fontSize: "13px",
                    paddingTop: "30px",
                  }}
                >
                  <div style={{ maxWidth: "360px", margin: "0 auto" }}>
                    If you did not expect this invitation, you can safely ignore
                    this message.
                    <br />
                    For questions or support, contact our team.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  );
}
