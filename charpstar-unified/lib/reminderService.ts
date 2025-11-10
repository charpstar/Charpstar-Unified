import { supabase } from "./supabaseClient";
import { notificationService } from "./notificationService";

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
    id: string;
    email: string;
    title?: string;
  };
  assigned_to_profile?: {
    id: string;
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
    const { data: reminder, error } = await supabase
      .from("internal_reminders")
      .insert({
        ...input,
        created_by: userId,
        status: "pending",
        priority: input.priority || "medium",
      })
      .select("*")
      .single();

    if (error) throw error;

    // Fetch profile data separately
    const [createdByProfile, assignedToProfile] = await Promise.all([
      reminder.created_by
        ? supabase
            .from("profiles")
            .select("id, email, title")
            .eq("id", reminder.created_by)
            .single()
        : Promise.resolve({ data: null, error: null }),
      reminder.assigned_to
        ? supabase
            .from("profiles")
            .select("id, email, title")
            .eq("id", reminder.assigned_to)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const result: InternalReminder = {
      ...reminder,
      created_by_profile: createdByProfile.data || undefined,
      assigned_to_profile: assignedToProfile.data || undefined,
    };

    // Send notification if reminder is assigned to someone
    if (result.assigned_to && assignedToProfile.data && createdByProfile.data) {
      try {
        await notificationService.sendReminderAssignedNotification(
          result.id,
          result.title,
          result.assigned_to,
          assignedToProfile.data.email,
          createdByProfile.data.email
        );
      } catch (notificationError) {
        console.error("Failed to send reminder assigned notification:", notificationError);
        // Don't fail the creation if notification fails
      }
    }

    return result;
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
      .select("*")
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

    const { data: reminders, error } = await query;
    if (error) throw error;

    // Fetch profile data for all reminders
    const userIds = new Set<string>();
    reminders?.forEach((r) => {
      if (r.created_by) userIds.add(r.created_by);
      if (r.assigned_to) userIds.add(r.assigned_to);
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, title")
      .in("id", Array.from(userIds));

    const profilesMap = new Map(
      profiles?.map((p) => [p.id, p]) || []
    );

    return (reminders || []).map((r) => ({
      ...r,
      created_by_profile: profilesMap.get(r.created_by),
      assigned_to_profile: r.assigned_to
        ? profilesMap.get(r.assigned_to)
        : undefined,
    }));
  }

  async updateReminder(
    reminderId: string,
    userId: string,
    input: UpdateReminderInput
  ): Promise<InternalReminder> {
    // Check if user has permission to update
    const { data: existing } = await supabase
      .from("internal_reminders")
      .select("created_by, assigned_to, completed_at")
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

    const { data: reminder, error } = await supabase
      .from("internal_reminders")
      .update(updateData)
      .eq("id", reminderId)
      .select("*")
      .single();

    if (error) throw error;

    // Fetch profile data
    const [createdByProfile, assignedToProfile] = await Promise.all([
      reminder.created_by
        ? supabase
            .from("profiles")
            .select("id, email, title")
            .eq("id", reminder.created_by)
            .single()
        : Promise.resolve({ data: null, error: null }),
      reminder.assigned_to
        ? supabase
            .from("profiles")
            .select("id, email, title")
            .eq("id", reminder.assigned_to)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    return {
      ...reminder,
      created_by_profile: createdByProfile.data || undefined,
      assigned_to_profile: assignedToProfile.data || undefined,
    };
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

    const { data: reminders, error } = await supabase
      .from("internal_reminders")
      .select("*")
      .eq("assigned_to", userId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .not("reminder_datetime", "is", null)
      .gte("reminder_datetime", now.toISOString())
      .lte("reminder_datetime", future.toISOString())
      .order("reminder_datetime", { ascending: true });

    if (error) throw error;

    // Fetch profile data
    const userIds = new Set<string>();
    reminders?.forEach((r) => {
      if (r.created_by) userIds.add(r.created_by);
      if (r.assigned_to) userIds.add(r.assigned_to);
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, title")
      .in("id", Array.from(userIds));

    const profilesMap = new Map(
      profiles?.map((p) => [p.id, p]) || []
    );

    return (reminders || []).map((r) => ({
      ...r,
      created_by_profile: profilesMap.get(r.created_by),
      assigned_to_profile: r.assigned_to
        ? profilesMap.get(r.assigned_to)
        : undefined,
    }));
  }
}

export const reminderService = new ReminderService();
