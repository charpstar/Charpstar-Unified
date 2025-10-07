import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json();

    if (!testEmail) {
      return NextResponse.json(
        { error: "Test email address is required" },
        { status: 400 }
      );
    }

    // Test data for QA approval email
    const testData = {
      clientName: "Test Client",
      modelName: "Test Model 3D",
      approverName: "John QA Tester",
      approverRole: "QA Team" as const,
      reviewLink: "https://charpstar.co/client-review/test-asset-id",
      batch: 1,
      deadline: "2024-12-31",
    };

    const config = {
      from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
      to: testEmail,
      subject: "Test: QA Approval Email - Test Model 3D",
    };

    const result = await emailService.sendQaApprovalNotification(
      testData,
      config
    );

    return NextResponse.json({
      success: true,
      message: "QA approval test email sent successfully",
      result,
    });
  } catch (error) {
    console.error("Error sending QA approval test email:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
