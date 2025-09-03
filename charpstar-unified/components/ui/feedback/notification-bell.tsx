"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  Clock,
  ClipboardCheck,
  X,
  ArrowRight,
  AlertTriangle,
  Eye,
  UserPlus,
  FileText,
  RotateCcw,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import {
  notificationService,
  NotificationData,
} from "@/lib/notificationService";
import { useUser } from "@/contexts/useUser";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const user = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Check if user is in onboarding mode
  const isInOnboarding =
    user?.metadata?.onboarding === true && user?.metadata?.role === "client";
  const hasCompletedCsvUpload = user?.metadata?.csv_uploaded === true;
  const isOnboardingClient =
    user?.metadata?.role === "client" && !hasCompletedCsvUpload;

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const unreadNotifications =
        await notificationService.getUnreadNotifications(user.id);

      // Filter out any notifications that might have been marked as read
      const trulyUnread = unreadNotifications.filter((n) => !n.read);

      setNotifications(trulyUnread);
      setUnreadCount(trulyUnread.length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    // Listen for global notification updates to refresh immediately
    const handler = () => {
      fetchNotifications();
    };
    window.addEventListener("notificationsUpdated", handler as EventListener);
    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "notificationsUpdated",
        handler as EventListener
      );
    };
  }, [user?.id]);

  // Hide notifications if user is in onboarding mode (after all hooks)
  if (isInOnboarding || isOnboardingClient) {
    return null;
  }

  const markAsRead = async (notificationId: string) => {
    if (!notificationId) return;
    try {
      await notificationService.markNotificationAsRead(notificationId);

      // Remove the notification from the local state immediately
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Refresh notifications to ensure we have the latest state

      await fetchNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const promises = notifications
        .filter((n) => n.id)
        .map((n) => notificationService.markNotificationAsRead(n.id!));
      await Promise.all(promises);
      setNotifications([]);
      setUnreadCount(0);

      // Refresh notifications to ensure we have the latest state
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    // Mark notification as read first
    if (notification.id) {
      await markAsRead(notification.id);
    }

    // Close the notification popover
    setOpen(false);

    // Smart navigation based on notification type:
    // - asset_allocation: Go to pending assignments (new work)
    // - asset_completed: Go to my-assignments (view completed work)
    // - qa_review: Go to specific asset review page if available
    // - status_change: Go to my-assignments (view status updates)
    // - deadline_reminder: Go to pending assignments (view deadlines)
    // - budget_alert: Go to cost tracking page
    try {
      switch (notification.type) {
        case "asset_allocation":
          // Navigate to pending assignments page for new asset allocations
          router.push("/pending-assignments");
          break;
        case "asset_completed":
          // Navigate to specific asset if we have asset ID, otherwise to my-assignments
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=completion-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "qa_review":
          // Navigate to client-review page (which QA users can access) if we have asset ID
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/client-review/${notification.metadata.assetIds[0]}?from=qa-notification`
            );
          } else {
            router.push("/qa-review");
          }
          break;
        case "revision_required":
          // Navigate to modeler review page for revision
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=revision-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "asset_approved":
          // Navigate to modeler review page or my-assignments
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/modeler-review/${notification.metadata.assetIds[0]}?from=approval-notification`
            );
          } else {
            router.push("/my-assignments");
          }
          break;
        case "client_review_ready":
          // Navigate to client review page
          if (notification.metadata?.assetIds?.[0]) {
            router.push(
              `/client-review/${notification.metadata.assetIds[0]}?from=client-notification`
            );
          } else {
            router.push("/client-review");
          }
          break;
        case "status_change":
          // Navigate to my-assignments page to see status changes
          router.push("/my-assignments");
          break;
        case "deadline_reminder":
          // Navigate to pending assignments page to see upcoming deadlines
          router.push("/pending-assignments");
          break;
        case "budget_alert":
          // Navigate to cost tracking page for budget alerts
          router.push("/production/cost-tracking");
          break;
        case "product_submission":
          // Navigate to admin-review page with client and batch filters
          if (notification.metadata?.client && notification.metadata?.batch) {
            router.push(
              `/admin-review?client=${encodeURIComponent(notification.metadata.client)}&batch=${notification.metadata.batch}`
            );
          } else {
            // Fallback to admin-review page without filters
            router.push("/admin-review");
          }
          break;
        case "allocation_list_accepted":
        case "allocation_list_declined":
          // Navigate to admin-review page with client and batch filters
          if (notification.metadata?.client && notification.metadata?.batch) {
            router.push(
              `/admin-review?client=${encodeURIComponent(notification.metadata.client)}&batch=${notification.metadata.batch}`
            );
          } else {
            // Fallback to admin-review page without filters
            router.push("/admin-review");
          }
          break;
        default:
          // Default to my-assignments page
          router.push("/my-assignments");
          break;
      }
    } catch (error) {
      console.error("Error navigating to notification page:", error);
      // Fallback to my-assignments page
      router.push("/my-assignments");
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-4 w-4";
    switch (type) {
      case "asset_allocation":
        return <UserPlus className={iconClass} />;
      case "asset_completed":
        return <CheckCircle className={iconClass} />;
      case "deadline_reminder":
        return <Clock className={iconClass} />;
      case "qa_review":
        return <ClipboardCheck className={iconClass} />;
      case "status_change":
        return <ArrowRight className={iconClass} />;
      case "budget_alert":
        return <AlertTriangle className={iconClass} />;
      case "product_submission":
        return <FileText className={iconClass} />;
      case "revision_required":
        return <RotateCcw className={iconClass} />;
      case "asset_approved":
        return <ThumbsUp className={iconClass} />;
      case "client_review_ready":
        return <Eye className={iconClass} />;
      case "allocation_list_accepted":
        return <CheckCircle className={iconClass} />;
      case "allocation_list_declined":
        return <X className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  const getNotificationColor = (type: string) => {
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

  const getNotificationIconColor = (type: string) => {
    switch (type) {
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

  if (!user?.id) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-medium"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 shadow-lg border-0 rounded-lg"
        align="end"
      >
        <div className="p-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-8 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                No unread notifications
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 ${getNotificationColor(notification.type)} hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer group`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 mt-0.5 ${getNotificationIconColor(notification.type)}`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm leading-5 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {format(
                                new Date(notification.created_at),
                                "MMM d, h:mm a"
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                                Click to navigate
                              </span>
                              <ArrowRight className="h-3 w-3 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
