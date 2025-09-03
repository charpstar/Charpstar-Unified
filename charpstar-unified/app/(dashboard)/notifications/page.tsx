"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { toast } from "sonner";

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
    default: Bell,
  };

  // Use the same icon colors as the bell notifications
  const getIconColor = (notificationType: string) => {
    switch (notificationType) {
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
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState("all");
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      setRefreshing(true);

      const allNotifications = await notificationService.getAllNotifications(
        user.id
      );
      setNotifications(allNotifications);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-3xl font-semibold text-foreground">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            View and manage all your notifications in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchNotifications}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={markAllAsRead}
            variant="outline"
            size="sm"
            disabled={unreadCount === 0}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <Clock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unread</p>
              <p className="text-2xl font-bold">{unreadCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Read</p>
              <p className="text-2xl font-bold">{totalCount - unreadCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
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
            <div className="w-48">
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger>
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
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedNotifications.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium">
                  {selectedNotifications.size} notification(s) selected
                </p>
                <Button onClick={handleDeselectAll} variant="ghost" size="sm">
                  Deselect All
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => markAsRead(Array.from(selectedNotifications))}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark Read
                </Button>
                <Button
                  onClick={() =>
                    markAsUnread(Array.from(selectedNotifications))
                  }
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Mark Unread
                </Button>
                <Button
                  onClick={() =>
                    deleteNotifications(Array.from(selectedNotifications))
                  }
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
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
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Select All ({filteredNotifications.length})
          </Button>
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No notifications found
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || filterType !== "all" || filterRead !== "all"
                ? "No notifications match your current filters."
                : "You don't have any notifications yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(
            ([dateGroup, groupNotifications]) => (
              <div key={dateGroup}>
                <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                  {dateGroup}
                </h3>
                <div className="space-y-3">
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
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedNotifications.has(
                                notification.id!
                              )}
                              onChange={() =>
                                handleSelectNotification(notification.id!)
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div
                              className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}
                            >
                              <NotificationIcon type={notification.type} />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h4
                                  className={`font-medium ${!notification.read ? "font-semibold" : ""}`}
                                >
                                  {notification.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
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
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {notification.read ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        markAsUnread([notification.id!])
                                      }
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      Mark as Unread
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        markAsRead([notification.id!])
                                      }
                                    >
                                      <CheckCheck className="h-4 w-4 mr-2" />
                                      Mark as Read
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      deleteNotifications([notification.id!])
                                    }
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
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
    </div>
  );
}
