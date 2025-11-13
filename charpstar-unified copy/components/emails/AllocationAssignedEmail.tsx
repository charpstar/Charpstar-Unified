import * as React from "react";
import { getBaseUrl } from "@/lib/urlUtils";

export interface AllocationAssignedEmailProps {
  modelerName?: string;
  client?: string;
  allocationName?: string;
  allocationNumber?: number;
  assetNames?: string[];
  deadline?: string;
  bonus?: number;
}

export function AllocationAssignedEmail(props: AllocationAssignedEmailProps) {
  const deadlineText = props.deadline
    ? new Date(props.deadline).toLocaleDateString()
    : undefined;

  return (
    <div style={{ margin: 0, padding: 0, background: "#000" }}>
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ backgroundColor: "#ffffff", padding: "40px 0" }}
      >
        <tr>
          <td style={{ textAlign: "center" }}>
            <table
              width="480"
              style={{
                backgroundColor: "#111111",
                border: "1px solid #222222",
                borderRadius: "8px",
                padding: "30px",
                fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
                textAlign: "center",
              }}
              cellPadding={0}
              cellSpacing={0}
              border={0}
            >
              <tr style={{ textAlign: "center" }}>
                <td
                  height="195"
                  style={{
                    textAlign: "center",
                    background:
                      "url('https://tpamckewerybqzhhhqqp.supabase.co/storage/v1/object/public/maillogo/6%20(1).png') no-repeat center center",
                    backgroundSize: "contain",
                    height: "195px",
                    width: "100%",
                    maxWidth: "240px",
                    display: "block",
                    margin: "0 auto",
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
                  New Allocation Assigned!
                </td>
              </tr>

              <tr>
                <td
                  style={{ color: "#ddd", fontSize: "16px", lineHeight: 1.6 }}
                >
                  <p>Hello {props.modelerName || "there"},</p>
                  <p>
                    You have been assigned a new allocation for{" "}
                    <strong>{props.client || "a client"}</strong>!<br />
                    Please review the details below and log in to your dashboard
                    to get started.
                  </p>
                </td>
              </tr>

              {/* Allocation Details */}
              <tr>
                <td
                  style={{
                    color: "#fff",
                    fontSize: "18px",
                    fontWeight: "600",
                    paddingTop: "20px",
                    paddingBottom: "12px",
                  }}
                >
                  Allocation Details
                </td>
              </tr>

              {props.allocationName && (
                <tr>
                  <td
                    style={{
                      color: "#ddd",
                      fontSize: "14px",
                      paddingBottom: "8px",
                    }}
                  >
                    <strong>List:</strong> {props.allocationName}
                    {props.allocationNumber != null
                      ? ` (#${props.allocationNumber})`
                      : ""}
                  </td>
                </tr>
              )}

              {deadlineText && (
                <tr>
                  <td
                    style={{
                      color: "#ddd",
                      fontSize: "14px",
                      paddingBottom: "8px",
                    }}
                  >
                    <strong>Deadline:</strong> {deadlineText}
                  </td>
                </tr>
              )}

              {typeof props.bonus === "number" && (
                <tr>
                  <td
                    style={{
                      color: "#ddd",
                      fontSize: "14px",
                      paddingBottom: "8px",
                    }}
                  >
                    <strong>Bonus:</strong> {props.bonus}%
                  </td>
                </tr>
              )}

              {Array.isArray(props.assetNames) &&
                props.assetNames.length > 0 && (
                  <tr>
                    <td
                      style={{
                        color: "#ddd",
                        fontSize: "14px",
                        paddingBottom: "8px",
                      }}
                    >
                      <strong>Assets:</strong> {props.assetNames.length}{" "}
                      assigned
                    </td>
                  </tr>
                )}

              <tr>
                <td style={{ textAlign: "center", padding: "24px 0" }}>
                  {/* BULLETPROOF BUTTON */}
                  <table
                    border={0}
                    cellSpacing={0}
                    cellPadding={0}
                    style={{ margin: "0 auto" }}
                  >
                    <tr>
                      <td
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "6px",
                          textAlign: "center",
                        }}
                      >
                        <a
                          href={getBaseUrl()}
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
                          View Dashboard
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
                    If you have any questions about this allocation, please
                    contact our team.
                    <br />
                    Log in to your dashboard to view full details and start
                    working.
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
