import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/lib/notificationService";

export async function POST(request: NextRequest) {
  try {
    // Simple authentication check - you might want to add proper API key authentication
    const authHeader = request.headers.get("authorization");

    // For now, allow calls without auth for testing. In production, add proper auth:
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    console.log("🔔 Deadline reminder API called");

    // Run the deadline reminder check
    await notificationService.sendDeadlineReminders();

    return NextResponse.json({
      success: true,
      message: "Deadline reminders checked and sent successfully",
    });
  } catch (error) {
    console.error("Error in deadline reminders API:", error);
    return NextResponse.json(
      { error: "Failed to process deadline reminders" },
      { status: 500 }
    );
  }
}
