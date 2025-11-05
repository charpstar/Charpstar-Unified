"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { reminderService, InternalReminder } from "@/lib/reminderService";
import { CreateReminderModal } from "@/components/reminders/CreateReminderModal";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { Card, CardContent } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/interactive";
import { Plus } from "lucide-react";

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
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading reminders...</p>
              </CardContent>
            </Card>
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
