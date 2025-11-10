# Internal Reminders/Tickets System - Implementation Guide

## Overview

This document describes how to implement an internal reminder and task management system (similar to Jira tickets or sticky notes) that allows team members to create, assign, and manage internal reminders for various tasks.

## Use Cases

- **Task Reminders**: "Tomorrow morning, remind Onkar to fix Dometic model"
- **Deadline Reminders**: "Tomorrow EOD, I need to do pricing"
- **Action Items**: "Inform Arjun on Monday to start implementation"
- **Follow-ups**: "Follow up with Victor on Wednesday about project status"

## Database Schema

### 1. Create `internal_reminders` Table

```sql
-- Create internal_reminders table
CREATE TABLE IF NOT EXISTS public.internal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Information
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Assignment
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timing
  due_date TIMESTAMP WITH TIME ZONE,
  reminder_datetime TIMESTAMP WITH TIME ZONE, -- When to send the reminder notification
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  tags TEXT[], -- Array of tags like ['modeling', 'pricing', 'urgent']
  related_entity_type TEXT, -- 'asset', 'batch', 'invoice', 'user', etc.
  related_entity_id TEXT, -- ID of the related entity

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_reminders_assigned_to ON public.internal_reminders(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_reminders_created_by ON public.internal_reminders(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_reminders_status ON public.internal_reminders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_reminders_due_date ON public.internal_reminders(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_reminders_reminder_datetime ON public.internal_reminders(reminder_datetime) WHERE deleted_at IS NULL AND reminder_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_reminders_tags ON public.internal_reminders USING GIN(tags) WHERE deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.internal_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view reminders assigned to them or created by them
CREATE POLICY "Users can view their reminders"
  ON public.internal_reminders
  FOR SELECT
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  )
  AND deleted_at IS NULL;

-- Users can create reminders
CREATE POLICY "Users can create reminders"
  ON public.internal_reminders
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update reminders they created or are assigned to
CREATE POLICY "Users can update their reminders"
  ON public.internal_reminders
  FOR UPDATE
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = created_by
    OR auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- Users can delete (soft delete) reminders they created
CREATE POLICY "Users can delete their reminders"
  ON public.internal_reminders
  FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_internal_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_internal_reminders_updated_at
  BEFORE UPDATE ON public.internal_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_reminders_updated_at();
```

### 2. Update `notifications` Table Type

Add a new notification type to support reminder notifications:

```typescript
// In lib/notificationService.ts, add to NotificationData type:
type:
  | "asset_allocation"
  | "asset_completed"
  // ... existing types ...
  | "internal_reminder" // NEW
  | "reminder_due" // NEW - for when a reminder is due
  | "reminder_assigned" // NEW - when a reminder is assigned to someone
```

## Frontend Implementation

### 1. Create Reminder Service (`lib/reminderService.ts`)

```typescript
import { supabase } from "./supabaseClient";

export interface InternalReminder {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  reminder_datetime?: string;
  completed_at?: string;
  tags?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
  updated_at: string;

  // Joined data (from profiles table)
  created_by_profile?: {
    email: string;
    title?: string;
  };
  assigned_to_profile?: {
    email: string;
    title?: string;
  };
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  due_date?: string;
  reminder_datetime?: string;
  tags?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  status?: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  due_date?: string;
  reminder_datetime?: string;
  tags?: string[];
}

class ReminderService {
  async createReminder(
    userId: string,
    input: CreateReminderInput
  ): Promise<InternalReminder> {
    const { data, error } = await supabase
      .from("internal_reminders")
      .insert({
        ...input,
        created_by: userId,
        status: "pending",
        priority: input.priority || "medium",
      })
      .select(
        `
        *,
        created_by_profile:profiles!internal_reminders_created_by_fkey(id, email, title),
        assigned_to_profile:profiles!internal_reminders_assigned_to_fkey(id, email, title)
      `
      )
      .single();

    if (error) throw error;
    return data;
  }

  async getReminders(
    userId: string,
    filters?: {
      status?: string;
      assigned_to?: string;
      created_by?: string;
      priority?: string;
    }
  ): Promise<InternalReminder[]> {
    let query = supabase
      .from("internal_reminders")
      .select(
        `
        *,
        created_by_profile:profiles!internal_reminders_created_by_fkey(id, email, title),
        assigned_to_profile:profiles!internal_reminders_assigned_to_fkey(id, email, title)
      `
      )
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to);
    }
    if (filters?.created_by) {
      query = query.eq("created_by", filters.created_by);
    }
    if (filters?.priority) {
      query = query.eq("priority", filters.priority);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateReminder(
    reminderId: string,
    userId: string,
    input: UpdateReminderInput
  ): Promise<InternalReminder> {
    // Check if user has permission to update
    const { data: existing } = await supabase
      .from("internal_reminders")
      .select("created_by, assigned_to")
      .eq("id", reminderId)
      .single();

    if (
      !existing ||
      (existing.created_by !== userId && existing.assigned_to !== userId)
    ) {
      throw new Error("Unauthorized");
    }

    const updateData: any = { ...input };

    // If marking as completed, set completed_at
    if (input.status === "completed" && !existing.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    // If un-completing, clear completed_at
    else if (input.status !== "completed" && existing.completed_at) {
      updateData.completed_at = null;
    }

    const { data, error } = await supabase
      .from("internal_reminders")
      .update(updateData)
      .eq("id", reminderId)
      .select(
        `
        *,
        created_by_profile:profiles!internal_reminders_created_by_fkey(id, email, title),
        assigned_to_profile:profiles!internal_reminders_assigned_to_fkey(id, email, title)
      `
      )
      .single();

    if (error) throw error;
    return data;
  }

  async deleteReminder(reminderId: string, userId: string): Promise<void> {
    // Soft delete
    const { error } = await supabase
      .from("internal_reminders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("created_by", userId); // Only creator can delete

    if (error) throw error;
  }

  async getUpcomingReminders(
    userId: string,
    hoursAhead: number = 24
  ): Promise<InternalReminder[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("internal_reminders")
      .select(
        `
        *,
        created_by_profile:profiles!internal_reminders_created_by_fkey(id, email, title),
        assigned_to_profile:profiles!internal_reminders_assigned_to_fkey(id, email, title)
      `
      )
      .eq("assigned_to", userId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .gte("reminder_datetime", now.toISOString())
      .lte("reminder_datetime", future.toISOString())
      .order("reminder_datetime", { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

export const reminderService = new ReminderService();
```

### 2. Create Reminders Page (`app/(dashboard)/reminders/page.tsx`)

Create a dedicated page for viewing and managing reminders:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, InternalReminder } from "@/lib/reminderService";
import { CreateReminderModal } from "@/components/reminders/CreateReminderModal";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/interactive";
import { Plus, Filter } from "lucide-react";

export default function RemindersPage() {
  const user = useUser();
  const [reminders, setReminders] = useState<InternalReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchReminders = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const filters: any = {};
      if (activeTab === "assigned") {
        filters.assigned_to = user.id;
      } else if (activeTab === "created") {
        filters.created_by = user.id;
      } else if (activeTab !== "all") {
        filters.status = activeTab;
      }

      const data = await reminderService.getReminders(user.id, filters);
      setReminders(data);
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [user?.id, activeTab]);

  const filteredReminders = reminders.filter((r) => {
    if (activeTab === "all") return true;
    if (activeTab === "assigned") return r.assigned_to === user?.id;
    if (activeTab === "created") return r.created_by === user?.id;
    return r.status === activeTab;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Internal Reminders</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tasks and reminders
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Reminder
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
          <TabsTrigger value="created">Created by Me</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div>Loading...</div>
          ) : filteredReminders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No reminders found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onUpdate={fetchReminders}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <CreateReminderModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchReminders}
        />
      )}
    </div>
  );
}
```

### 3. Create Reminder Components

#### `components/reminders/ReminderCard.tsx`

A card component to display individual reminders with actions:

```typescript
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { InternalReminder } from "@/lib/reminderService";
import { format } from "date-fns";
import { Clock, User, Tag, CheckCircle, X, Edit } from "lucide-react";

interface ReminderCardProps {
  reminder: InternalReminder;
  onUpdate: () => void;
}

export function ReminderCard({ reminder, onUpdate }: ReminderCardProps) {
  const priorityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const statusColors = {
    pending: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

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
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {reminder.assigned_to_profile && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>Assigned to: {reminder.assigned_to_profile.email}</span>
            </div>
          )}
          {reminder.due_date && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Due: {format(new Date(reminder.due_date), "MMM dd, yyyy")}</span>
            </div>
          )}
          {reminder.tags && reminder.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              <div className="flex gap-1">
                {reminder.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          {reminder.status !== "completed" && (
            <Button
              size="sm"
              onClick={() => {
                // Handle mark as complete
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          )}
          <Button size="sm" variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### `components/reminders/CreateReminderModal.tsx`

A modal for creating new reminders with date/time pickers:

```typescript
"use client";

import { useState } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, CreateReminderInput } from "@/lib/reminderService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/interactive";
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

interface CreateReminderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateReminderModal({
  open,
  onClose,
  onSuccess,
}: CreateReminderModalProps) {
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    priority: "medium",
    tags: [],
  });

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
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2"
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
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date?.slice(0, 16) || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  })
                }
              />
            </div>
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
                  reminder_datetime: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
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
```

### 4. Integrate with Notification System

Update `lib/notificationService.ts` to send notifications when reminders are created or become due:

```typescript
// Add to NotificationService class

async sendReminderNotification(reminder: InternalReminder): Promise<void> {
  if (!reminder.assigned_to) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", reminder.assigned_to)
    .single();

  if (!profile) return;

  await this.createNotification({
    recipient_id: profile.id,
    recipient_email: profile.email,
    type: "internal_reminder",
    title: `Reminder: ${reminder.title}`,
    message: reminder.description || reminder.title,
    metadata: {
      reminder_id: reminder.id,
      priority: reminder.priority,
      due_date: reminder.due_date,
    },
    read: false,
  });
}
```

### 5. Create Background Job for Reminder Notifications

Create a cron job or scheduled function to check for reminders that are due:

```typescript
// app/api/cron/check-reminders/route.ts

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
      await notificationService.sendReminderNotification(reminder);
    }

    return NextResponse.json({
      success: true,
      remindersChecked: reminders?.length || 0,
    });
  } catch (error: any) {
    console.error("Error checking reminders:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 6. Add Quick Reminder Widget to Dashboard

Create a widget to show upcoming reminders on the dashboard:

```typescript
// components/dashboard/RemindersWidget.tsx

"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, InternalReminder } from "@/lib/reminderService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export function RemindersWidget() {
  const user = useUser();
  const [reminders, setReminders] = useState<InternalReminder[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    reminderService.getUpcomingReminders(user.id, 24).then(setReminders);
  }, [user?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upcoming Reminders</span>
          <Link href="/reminders" className="text-sm text-primary hover:underline">
            View All
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
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
```

## Implementation Steps

1. **Database Setup**

   - Run the SQL migration to create the `internal_reminders` table
   - Update notification types in `notificationService.ts`

2. **Backend Services**

   - Create `lib/reminderService.ts` with all CRUD operations
   - Update `lib/notificationService.ts` to handle reminder notifications
   - Create the cron job endpoint for checking due reminders

3. **Frontend Components**

   - Create reminder page at `app/(dashboard)/reminders/page.tsx`
   - Create `ReminderCard` component
   - Create `CreateReminderModal` component
   - Create `RemindersWidget` for dashboard

4. **Integration**

   - Add reminders widget to dashboard layouts
   - Update navigation to include reminders link
   - Set up cron job (using Vercel Cron, Supabase Edge Functions, or similar)

5. **Testing**
   - Test creating reminders with various dates/times
   - Test assignment and notifications
   - Test status updates and filtering
   - Verify cron job sends notifications at correct times

## Features Summary

- ✅ Create reminders with title, description, priority, due dates
- ✅ Assign reminders to team members
- ✅ Set reminder date/time for notifications
- ✅ Filter by status, assigned to, created by
- ✅ Tags for categorization
- ✅ Status tracking (pending, in_progress, completed, cancelled)
- ✅ Priority levels (low, medium, high, urgent)
- ✅ Automatic notifications when reminders are due
- ✅ Dashboard widget for upcoming reminders
- ✅ Link reminders to related entities (assets, batches, etc.)

This system provides a complete internal reminder/ticketing solution similar to Jira tickets or sticky notes, integrated with your existing notification system and user management.
