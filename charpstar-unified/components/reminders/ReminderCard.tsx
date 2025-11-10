"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { InternalReminder, reminderService } from "@/lib/reminderService";
import { format } from "date-fns";
import { Clock, User, Tag, CheckCircle, Edit, Trash2 } from "lucide-react";
import { useUser } from "@/contexts/useUser";
import { toast } from "sonner";

interface ReminderCardProps {
  reminder: InternalReminder;
  onUpdate: () => void;
}

export function ReminderCard({ reminder, onUpdate }: ReminderCardProps) {
  const user = useUser();
  const [loading, setLoading] = useState(false);

  const priorityColors = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    medium:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const statusColors = {
    pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    in_progress:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const handleMarkComplete = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await reminderService.updateReminder(reminder.id, user.id, {
        status: "completed",
      });
      toast.success("Reminder marked as complete");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to update reminder");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    setLoading(true);
    try {
      await reminderService.deleteReminder(reminder.id, user.id);
      toast.success("Reminder deleted");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete reminder");
    } finally {
      setLoading(false);
    }
  };

  const canEdit =
    user?.id === reminder.created_by || user?.id === reminder.assigned_to;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{reminder.title}</h3>
            {reminder.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {reminder.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Badge className={priorityColors[reminder.priority]}>
              {reminder.priority}
            </Badge>
            <Badge className={statusColors[reminder.status]}>
              {reminder.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          {reminder.assigned_to_profile && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>Assigned to: {reminder.assigned_to_profile.email}</span>
            </div>
          )}
          {reminder.due_date && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                Due: {format(new Date(reminder.due_date), "MMM dd, yyyy")}
              </span>
            </div>
          )}
          {reminder.reminder_datetime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                Remind:{" "}
                {format(new Date(reminder.reminder_datetime), "MMM dd, h:mm a")}
              </span>
            </div>
          )}
          {reminder.tags && reminder.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              <div className="flex gap-1">
                {reminder.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {reminder.status !== "completed" && (
              <Button size="sm" onClick={handleMarkComplete} disabled={loading}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            {reminder.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // TODO: Implement edit modal
                  toast.info("Edit functionality coming soon");
                }}
                disabled={loading}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {user?.id === reminder.created_by && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
