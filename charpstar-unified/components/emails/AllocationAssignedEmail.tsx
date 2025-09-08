import * as React from "react";

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
    <div
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        lineHeight: 1.6,
        color: "#0f172a",
      }}
    >
      <h2 style={{ margin: "0 0 8px" }}>
        {props.modelerName ? `Hi ${props.modelerName},` : "Hi,"}
      </h2>
      <p>You have a new allocation.</p>
      {props.client && (
        <p style={{ margin: "4px 0" }}>
          Client: <strong>{props.client}</strong>
        </p>
      )}
      {props.allocationName && (
        <p style={{ margin: "4px 0" }}>
          List: <strong>{props.allocationName}</strong>
          {props.allocationNumber != null
            ? ` (#${props.allocationNumber})`
            : ""}
        </p>
      )}
      {deadlineText && (
        <p style={{ margin: "4px 0" }}>
          Deadline: <strong>{deadlineText}</strong>
        </p>
      )}
      {typeof props.bonus === "number" && (
        <p style={{ margin: "4px 0" }}>
          Bonus: <strong>{props.bonus}%</strong>
        </p>
      )}
      {Array.isArray(props.assetNames) && props.assetNames.length > 0 && (
        <>
          <p style={{ margin: "8px 0 4px" }}>Assets:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {props.assetNames.slice(0, 15).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          {props.assetNames.length > 15 && (
            <p style={{ marginTop: 6, color: "#475569" }}>
              and {props.assetNames.length - 15} more…
            </p>
          )}
        </>
      )}
      <p style={{ marginTop: 12, color: "#475569" }}>
        Log in to your dashboard to view details.
      </p>
    </div>
  );
}
