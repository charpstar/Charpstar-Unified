import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    // Simple authentication check - you might want to add proper API key authentication
    // For now, allow calls without auth for testing. In production, add proper auth:
    // const authHeader = request.headers.get("authorization");
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Run the monthly invoice deadline reminder check
    await notificationService.sendMonthlyInvoiceDeadlineReminders();

    return NextResponse.json({
      success: true,
      message:
        "Monthly invoice deadline reminders checked and sent successfully",
    });
  } catch (error) {
    console.error("Error in monthly invoice deadline reminders API:", error);
    return NextResponse.json(
      { error: "Failed to process monthly invoice deadline reminders" },
      { status: 500 }
    );
  }
}
