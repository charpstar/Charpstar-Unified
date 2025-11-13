"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, InternalReminder } from "@/lib/reminderService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export function RemindersWidget() {
  const user = useUser();
  const [reminders, setReminders] = useState<InternalReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchReminders = async () => {
      try {
        const data = await reminderService.getUpcomingReminders(user.id, 24);
        setReminders(data);
      } catch (error) {
        console.error("Failed to fetch upcoming reminders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, [user?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upcoming Reminders</span>
          <Link
            href="/reminders"
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming reminders</p>
        ) : (
          <div className="space-y-3">
            {reminders.slice(0, 5).map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start justify-between p-2 rounded-lg border"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{reminder.title}</p>
                  {reminder.reminder_datetime && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {format(
                        new Date(reminder.reminder_datetime),
                        "MMM dd, h:mm a"
                      )}
                    </div>
                  )}
                </div>
                <Badge variant="outline">{reminder.priority}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
