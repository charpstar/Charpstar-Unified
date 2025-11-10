"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, CreateReminderInput } from "@/lib/reminderService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface CreateReminderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  id: string;
  email: string;
  title?: string;
}

export function CreateReminderModal({
  open,
  onClose,
  onSuccess,
}: CreateReminderModalProps) {
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    priority: "medium",
    tags: [],
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("role", ["admin", "qa"])
        .order("email");

      if (error) throw error;
      // Filter out users with title "Manager"
      setUsers((data || []).filter((u) => u.title?.toLowerCase() !== "manager"));
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !formData.title) return;

    setLoading(true);
    try {
      await reminderService.createReminder(user.id, formData);
      toast.success("Reminder created successfully");
      onSuccess();
      onClose();
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        tags: [],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create reminder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Reminder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={formData.assigned_to || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    assigned_to: value === "none" ? undefined : value,
                  })
                }
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.title || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date?.slice(0, 16) || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    due_date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="reminder_datetime">Reminder Date/Time</Label>
              <Input
                id="reminder_datetime"
                type="datetime-local"
                value={formData.reminder_datetime?.slice(0, 16) || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reminder_datetime: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Create Reminder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
