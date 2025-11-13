import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const {
      clientName,
      modelName,
      approverName,
      approverRole,
      reviewLink,
      batch,
      deadline,
      to,
      subject,
    } = await request.json();

    if (!clientName || !modelName || !to) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await emailService.sendQaApprovalNotification(
      {
        clientName,
        modelName,
        approverName: approverName || "QA Team",
        approverRole: approverRole || "QA Team",
        reviewLink,
        batch,
        deadline,
      },
      {
        from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
        to,
        subject: subject || `Model Approved for Review - ${modelName}`,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in send-qa-approval API:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
