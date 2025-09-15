"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import {
  notificationService,
  NotificationData,
} from "@/lib/notificationService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2,
  Package,
  FileText,
  DollarSign,
  RefreshCw,
  MoreVertical,
  MessageSquare,
  Settings,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

// Using NotificationData interface from the notification service

const NotificationIcon = ({ type }: { type: string }) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    asset_allocation: Package,
    asset_completed: CheckCircle,
    deadline_reminder: Clock,
    qa_review: Eye,
    status_change: AlertTriangle,
    budget_alert: DollarSign,
    product_submission: FileText,
    revision_required: AlertTriangle,
    asset_approved: CheckCircle,
    client_review_ready: Eye,
    allocation_list_accepted: CheckCircle,
    allocation_list_declined: AlertTriangle,
    comment_reply: MessageSquare,
    annotation_reply: MessageSquare,
    default: Bell,
  };

  // Use the same icon colors as the bell notifications
  const getIconColor = (notificationType: string) => {
    switch (notificationType) {
      case "comment_reply":
        return "text-indigo-600 dark:text-indigo-400";
      case "annotation_reply":
        return "text-indigo-600 dark:text-indigo-400";
      case "asset_allocation":
        return "text-slate-600 dark:text-slate-400";
      case "asset_completed":
        return "text-slate-600 dark:text-slate-400";
      case "deadline_reminder":
        return "text-yellow-600 dark:text-yellow-400";
      case "qa_review":
        return "text-slate-600 dark:text-slate-400";
      case "status_change":
        return "text-slate-600 dark:text-slate-400";
      case "budget_alert":
        return "text-red-600 dark:text-red-400";
      case "product_submission":
        return "text-blue-600 dark:text-blue-400";
      case "revision_required":
        return "text-orange-600 dark:text-orange-400";
      case "asset_approved":
        return "text-green-600 dark:text-green-400";
      case "client_review_ready":
        return "text-slate-600 dark:text-slate-400";
      case "allocation_list_accepted":
        return "text-green-600 dark:text-green-400";
      case "allocation_list_declined":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const IconComponent = iconMap[type] || iconMap.default;
  return <IconComponent className={`h-4 w-4 ${getIconColor(type)}`} />;
};

const getNotificationColor = (type: string) => {
  // Using the exact same colors as the bell notifications with dark mode support
  switch (type) {
    case "comment_reply":
      return "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700";
    case "annotation_reply":
      return "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700";
    case "asset_allocation":
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "asset_completed":
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "deadline_reminder":
      return "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700";
    case "qa_review":
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "status_change":
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "budget_alert":
      return "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700";
    case "product_submission":
      return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700";
    case "revision_required":
      return "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700";
    case "asset_approved":
      return "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700";
    case "client_review_ready":
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "allocation_list_accepted":
      return "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700";
    case "allocation_list_declined":
      return "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700";
    default:
      return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700";
  }
};

const getLeftBorderColor = (type: string) => {
  // Get the appropriate left border color for each notification type
  switch (type) {
    case "asset_allocation":
      return "border-l-slate-500 dark:border-l-slate-400";
    case "asset_completed":
      return "border-l-slate-500 dark:border-l-slate-400";
    case "deadline_reminder":
      return "border-l-yellow-500 dark:border-l-yellow-400";
    case "qa_review":
      return "border-l-slate-500 dark:border-l-slate-400";
    case "status_change":
      return "border-l-slate-500 dark:border-l-slate-400";
    case "budget_alert":
      return "border-l-red-500 dark:border-l-red-400";
    case "product_submission":
      return "border-l-blue-500 dark:border-l-blue-400";
    case "revision_required":
      return "border-l-orange-500 dark:border-l-orange-400";
    case "asset_approved":
      return "border-l-green-500 dark:border-l-green-400";
    case "client_review_ready":
      return "border-l-slate-500 dark:border-l-slate-400";
    case "allocation_list_accepted":
      return "border-l-green-500 dark:border-l-green-400";
    case "allocation_list_declined":
      return "border-l-red-500 dark:border-l-red-400";
    default:
      return "border-l-gray-500 dark:border-l-gray-400";
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
};

const groupNotificationsByDate = (notifications: NotificationData[]) => {
  const groups: Record<string, NotificationData[]> = {};

  notifications.forEach((notification) => {
    const date = new Date(notification.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;

    if (date.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
      groupKey = "This Week";
    } else {
      groupKey = date.toLocaleDateString("default", {
        month: "long",
        year: "numeric",
      });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
  });

  return groups;
};

export default function NotificationsPage() {
  const user = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState("all");
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<
    Record<string, boolean>
  >({});

  // Role-specific notification types
  const getRoleSpecificNotificationTypes = (role: string | undefined) => {
    const allTypes = {
      asset_allocation: "When new assets are assigned to you",
      asset_completed: "When assets are marked as completed",
      deadline_reminder: "Reminders about upcoming deadlines",
      qa_review: "When assets are ready for QA review",
      status_change: "When asset status changes",
      budget_alert: "Budget and cost-related alerts",
      product_submission: "When products are submitted for review",
      revision_required: "When revisions are requested",
      asset_approved: "When assets are approved",
      client_review_ready: "When assets are ready for client review",
      allocation_list_accepted: "When allocation lists are accepted",
      allocation_list_declined: "When allocation lists are declined",
      comment_reply: "When someone replies to your comments",
      annotation_reply: "When someone replies to your annotations",
      pending_reply: "When QA replies to client comments need approval",
      reply_approved: "When your QA replies are approved",
      reply_rejected: "When your QA replies are rejected",
    };

    // Filter based on role
    switch (role) {
      case "modeler":
        return {
          asset_allocation: allTypes.asset_allocation,
          asset_completed: allTypes.asset_completed,
          deadline_reminder: allTypes.deadline_reminder,
          revision_required: allTypes.revision_required,
          asset_approved: allTypes.asset_approved,
          status_change: allTypes.status_change,
          comment_reply: allTypes.comment_reply,
          annotation_reply: allTypes.annotation_reply,
        };
      case "qa":
        return {
          qa_review: allTypes.qa_review,
          status_change: allTypes.status_change,
          comment_reply: allTypes.comment_reply,
          annotation_reply: allTypes.annotation_reply,
          reply_approved: allTypes.reply_approved,
          reply_rejected: allTypes.reply_rejected,
        };
      case "client":
        return {
          client_review_ready: allTypes.client_review_ready,
          asset_approved: allTypes.asset_approved,
          status_change: allTypes.status_change,
          comment_reply: allTypes.comment_reply,
          annotation_reply: allTypes.annotation_reply,
        };
      case "admin":
        return {
          product_submission: allTypes.product_submission,
          allocation_list_accepted: allTypes.allocation_list_accepted,
          allocation_list_declined: allTypes.allocation_list_declined,
          budget_alert: allTypes.budget_alert,
          status_change: allTypes.status_change,
          comment_reply: allTypes.comment_reply,
          annotation_reply: allTypes.annotation_reply,
          pending_reply: "When QA replies to client comments need approval",
        };
      default:
        return allTypes;
    }
  };

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      setRefreshing(true);

      const allNotifications = await notificationService.getAllNotifications(
        user.id
      );

      // Filter notifications based on user role
      const userRole = (user as any)?.metadata?.role as string | undefined;
      const roleSpecificTypes = Object.keys(
        getRoleSpecificNotificationTypes(userRole)
      );

      const filteredNotifications = allNotifications.filter((notification) =>
        roleSpecificTypes.includes(notification.type)
      );

      setNotifications(filteredNotifications);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNotificationPreferences = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("notification_type, enabled")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching preferences:", error);
        return;
      }

      // Convert array to object with default enabled state
      const preferences: Record<string, boolean> = {};
      data?.forEach((pref) => {
        preferences[pref.notification_type] = pref.enabled;
      });

      setNotificationPreferences(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    }
  };

  const updateNotificationPreference = async (
    notificationType: string,
    enabled: boolean
  ) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("notification_preferences").upsert({
        user_id: user.id,
        notification_type: notificationType,
        enabled: enabled,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNotificationPreferences((prev) => ({
        ...prev,
        [notificationType]: enabled,
      }));

      toast.success(
        `${enabled ? "Enabled" : "Disabled"} ${notificationType.replace(/_/g, " ")} notifications`
      );
    } catch (error) {
      console.error("Error updating preference:", error);
      toast.error("Failed to update notification preference");
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      fetchNotificationPreferences();
    }

    // Listen for global notification updates to refresh notifications
    const handler = () => {
      fetchNotifications();
    };
    window.addEventListener("notificationsUpdated", handler as EventListener);

    return () => {
      window.removeEventListener(
        "notificationsUpdated",
        handler as EventListener
      );
    };
  }, [user?.id]);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await notificationService.markNotificationsAsRead(notificationIds);

      setNotifications((prev) =>
        prev.map((notification) =>
          notificationIds.includes(notification.id!)
            ? { ...notification, read: true }
            : notification
        )
      );

      toast.success(`Marked ${notificationIds.length} notification(s) as read`);

      // Trigger global notification update to refresh bell notifications
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to mark notifications as read");
    }
  };

  const markAsUnread = async (notificationIds: string[]) => {
    try {
      await notificationService.markNotificationsAsUnread(notificationIds);

      setNotifications((prev) =>
        prev.map((notification) =>
          notificationIds.includes(notification.id!)
            ? { ...notification, read: false }
            : notification
        )
      );

      toast.success(
        `Marked ${notificationIds.length} notification(s) as unread`
      );

      // Trigger global notification update to refresh bell notifications
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to mark notifications as unread");
    }
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    try {
      console.log("[notifications] Request delete IDs:", notificationIds);
      await notificationService.deleteNotifications(notificationIds);

      setNotifications((prev) =>
        prev.filter(
          (notification) => !notificationIds.includes(notification.id!)
        )
      );

      setSelectedNotifications(new Set());
      toast.success(`Deleted ${notificationIds.length} notification(s)`);

      // Trigger global notification update to refresh bell notifications
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      // Refetch to be safe
      fetchNotifications();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to delete notifications");
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications
      .filter((n) => !n.read)
      .map((n) => n.id!);

    if (unreadNotifications.length === 0) {
      toast.info("All notifications are already read");
      return;
    }

    await markAsRead(unreadNotifications);
  };

  const handleSelectNotification = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleNavigateForNotification = async (
    notification: NotificationData
  ) => {
    try {
      // Mark as read first if unread
      if (!notification.read && notification.id) {
        await notificationService.markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }

      // Role-based override
      const role = (user as any)?.metadata?.role as string | undefined;
      const assetId =
        (notification.metadata as any)?.assetId ||
        (notification.metadata as any)?.assetIds?.[0];
      if (assetId && (role === "modeler" || role === "admin")) {
        const target = role === "modeler" ? "modeler-review" : "client-review";
        router.push(`/${target}/${assetId}?from=notification`);
        return;
      }

      // Type-based routing (mirrors bell)
      switch (notification.type) {
        case "comment_reply":
        case "annotation_reply": {
          const asset =
            notification.metadata?.assetId ||
            notification.metadata?.assetIds?.[0];
          const roleLc = (
            (user as any)?.metadata?.role as string | undefined
          )?.toLowerCase();
          if (asset) {
            if (roleLc === "modeler") {
              router.push(`/modeler-review/${asset}?from=reply-notification`);
            } else {
              router.push(`/client-review/${asset}?from=reply-notification`);
            }
          } else {
            // Fallback per role
            if (roleLc === "modeler") router.push("/my-assignments");
            else router.push("/client-review");
          }
          break;
        }
        case "asset_allocation":
          router.push("/pending-assignments");
          break;
        case "asset_completed":
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=completion-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "qa_review":
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/client-review/${notification.metadata.assetIds[0]}?from=qa-notification`
            );
          } else {
            router.push("/qa-review");
          }
          break;
        case "revision_required":
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=revision-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "asset_approved":
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=approval-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "client_review_ready":
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/client-review/${notification.metadata.assetIds[0]}?from=client-notification`
            );
          } else {
            router.push("/client-review");
          }
          break;
        case "status_change":
          router.push("/my-assignments");
          break;
        case "deadline_reminder":
          router.push("/pending-assignments");
          break;
        case "budget_alert":
          router.push("/production/cost-tracking");
          break;
        case "product_submission":
          if (notification.metadata?.client && notification.metadata?.batch) {
            router.push(
              `/admin-review?client=${encodeURIComponent(
                (notification.metadata as any).client
              )}&batch=${(notification.metadata as any).batch}`
            );
          } else {
            router.push("/admin-review");
          }
          break;
        case "allocation_list_accepted":
        case "allocation_list_declined":
          if (notification.metadata?.client && notification.metadata?.batch) {
            router.push(
              `/admin-review?client=${encodeURIComponent(
                (notification.metadata as any).client
              )}&batch=${(notification.metadata as any).batch}`
            );
          } else {
            router.push("/admin-review");
          }
          break;
        default:
          router.push("/my-assignments");
          break;
      }
    } catch (e) {
      console.error("Failed to navigate for notification:", e);
      router.push("/my-assignments");
    }
  };

  const handleSelectAll = () => {
    const allNotificationIds = filteredNotifications.map((n) => n.id!);
    setSelectedNotifications(new Set(allNotificationIds));
  };

  const handleDeselectAll = () => {
    setSelectedNotifications(new Set());
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      !searchTerm ||
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" || notification.type === filterType;

    const matchesRead =
      filterRead === "all" ||
      (filterRead === "read" && notification.read) ||
      (filterRead === "unread" && !notification.read);

    return matchesSearch && matchesType && matchesRead;
  });

  // Get unique notification types for filter
  const notificationTypes = [...new Set(notifications.map((n) => n.type))];

  // Get user role
  const userRole = (user as any)?.metadata?.role as string | undefined;

  const notificationTypeDescriptions =
    getRoleSpecificNotificationTypes(userRole);

  // Group notifications by date
  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  // Stats
  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalCount = notifications.length;

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied if no user
  if (!user) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            Please log in to view your notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            <h1 className="text-xl sm:text-3xl font-semibold text-foreground">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            View and manage all your notifications in one place
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={fetchNotifications}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="gap-2 w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
          >
            <RefreshCw
              className={`h-3 w-3 sm:h-4 sm:w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          <Button
            onClick={() => setShowPreferences(true)}
            variant="outline"
            size="sm"
            className="gap-2 w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Preferences</span>
            <span className="sm:hidden">Prefs</span>
          </Button>
          <Button
            onClick={markAllAsRead}
            variant="outline"
            size="sm"
            disabled={unreadCount === 0}
            className="gap-2 w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
          >
            <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Mark All Read</span>
            <span className="sm:hidden">Mark Read</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-full bg-blue-100">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              <p className="text-lg sm:text-2xl font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-full bg-red-100">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Unread</p>
              <p className="text-lg sm:text-2xl font-bold">{unreadCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-full bg-green-100">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Read</p>
              <p className="text-lg sm:text-2xl font-bold">
                {totalCount - unreadCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 text-sm sm:text-base h-8 sm:h-9"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="w-full">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full text-sm sm:text-base h-8 sm:h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {notificationTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full">
                <Select value={filterRead} onValueChange={setFilterRead}>
                  <SelectTrigger className="w-full text-sm sm:text-base h-8 sm:h-9">
                    <SelectValue placeholder="All notifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Notifications</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedNotifications.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <p className="text-xs sm:text-sm font-medium">
                  {selectedNotifications.size} notification(s) selected
                </p>
                <Button
                  onClick={handleDeselectAll}
                  variant="ghost"
                  size="sm"
                  className="text-xs sm:text-sm h-7 sm:h-8 w-full sm:w-auto"
                >
                  Deselect All
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  onClick={async () => {
                    const ids = Array.from(selectedNotifications);
                    // Toggle: if any selected are unread, mark all as read; otherwise mark all as unread
                    const anyUnread = notifications.some(
                      (n) => ids.includes(n.id!) && !n.read
                    );
                    if (anyUnread) {
                      await markAsRead(ids);
                    } else {
                      await markAsUnread(ids);
                    }
                    handleDeselectAll();
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs sm:text-sm h-7 sm:h-8 w-full sm:w-auto"
                >
                  <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Mark Read</span>
                  <span className="sm:hidden">Mark Read</span>
                </Button>
                <Button
                  onClick={() =>
                    deleteNotifications(Array.from(selectedNotifications))
                  }
                  variant="destructive"
                  size="sm"
                  className="gap-2 text-xs sm:text-sm h-7 sm:h-8 w-full sm:w-auto"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Delete</span>
                  <span className="sm:hidden">Delete</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Select All Button */}
      {filteredNotifications.length > 0 && selectedNotifications.size === 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            className="gap-2 text-xs sm:text-sm h-7 sm:h-8"
          >
            <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">
              Select All ({filteredNotifications.length})
            </span>
            <span className="sm:hidden">
              Select All ({filteredNotifications.length})
            </span>
          </Button>
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3 sm:space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-muted animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 sm:h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-2 sm:h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Bell className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              No notifications found
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              {searchTerm || filterType !== "all" || filterRead !== "all"
                ? "No notifications match your current filters."
                : "You don't have any notifications yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {Object.entries(groupedNotifications).map(
            ([dateGroup, groupNotifications]) => (
              <div key={dateGroup}>
                <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-muted-foreground">
                  {dateGroup}
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {groupNotifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={`transition-all duration-200 hover:shadow-md ${
                        !notification.read
                          ? `border-l-4 ${getLeftBorderColor(notification.type)} bg-blue-50/30 dark:bg-blue-900/20`
                          : ""
                      } ${
                        selectedNotifications.has(notification.id!)
                          ? "ring-2 ring-blue-500 bg-blue-50"
                          : ""
                      }`}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <input
                              type="checkbox"
                              checked={selectedNotifications.has(
                                notification.id!
                              )}
                              onChange={() =>
                                handleSelectNotification(notification.id!)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3 sm:h-4 sm:w-4"
                            />
                            <div
                              className={`p-1.5 sm:p-2 rounded-full ${getNotificationColor(notification.type)}`}
                            >
                              <NotificationIcon type={notification.type} />
                            </div>
                          </div>

                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() =>
                              handleNavigateForNotification(notification)
                            }
                          >
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <h4
                                  className={`font-medium text-sm sm:text-base ${!notification.read ? "font-semibold" : ""} line-clamp-2`}
                                >
                                  {notification.title}
                                </h4>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(notification.created_at)}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.type.replace(/_/g, " ")}
                                  </Badge>
                                  {!notification.read && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      New
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                                  >
                                    <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {notification.read ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        markAsUnread([notification.id!])
                                      }
                                      className="text-xs sm:text-sm"
                                    >
                                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                      Mark as Unread
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        markAsRead([notification.id!])
                                      }
                                      className="text-xs sm:text-sm"
                                    >
                                      <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                      Mark as Read
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      deleteNotifications([notification.id!])
                                    }
                                    className="text-red-600 text-xs sm:text-sm"
                                  >
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Notification Preferences Dialog */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 sm:pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                  Notification Preferences
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Choose which types of notifications you want to receive
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(false)}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[70vh] p-3 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {Object.keys(notificationTypeDescriptions).length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Bell className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">
                      No notifications available
                    </h3>
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Your role doesn&apos;t have access to any notification
                      types.
                    </p>
                  </div>
                ) : (
                  Object.entries(notificationTypeDescriptions).map(
                    ([type, description]) => (
                      <div
                        key={type}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-3 sm:gap-0"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`p-1.5 sm:p-2 rounded-full ${getNotificationColor(type)}`}
                          >
                            <NotificationIcon type={type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm sm:text-base">
                              {type
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </h4>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                              {description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {notificationPreferences[type] !== false
                              ? "On"
                              : "Off"}
                          </span>
                          <Button
                            variant={
                              notificationPreferences[type] !== false
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              updateNotificationPreference(
                                type,
                                notificationPreferences[type] === false
                              )
                            }
                            className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                          >
                            {notificationPreferences[type] !== false
                              ? "Disable"
                              : "Enable"}
                          </Button>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
