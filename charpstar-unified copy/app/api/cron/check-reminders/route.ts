import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";

export async function GET(request: NextRequest) {
  // Verify this is called by your cron service (add auth header check)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find reminders that should be sent now (within next 5 minutes)
    const { data: reminders, error } = await supabase
      .from("internal_reminders")
      .select("*")
      .eq("status", "pending")
      .is("deleted_at", null)
      .not("reminder_datetime", "is", null)
      .gte("reminder_datetime", now.toISOString())
      .lte("reminder_datetime", fiveMinutesFromNow.toISOString());

    if (error) throw error;

    // Send notifications for each reminder
    for (const reminder of reminders || []) {
      await notificationService.sendReminderNotification({
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        assigned_to: reminder.assigned_to,
        priority: reminder.priority,
        due_date: reminder.due_date,
        reminder_datetime: reminder.reminder_datetime,
      });
    }

    return NextResponse.json({
      success: true,
      remindersChecked: reminders?.length || 0,
    });
  } catch (error: any) {
    console.error("Error checking reminders:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
