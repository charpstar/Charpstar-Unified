"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Check,
  Target,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  X,
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

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const user = useUser();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const unreadNotifications =
        await notificationService.getUnreadNotifications(user.id);
      setNotifications(unreadNotifications);
      setUnreadCount(unreadNotifications.length);
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
    return () => clearInterval(interval);
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    if (!notificationId) return;
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
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
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-4 w-4";
    switch (type) {
      case "asset_allocation":
        return <Target className={iconClass} />;
      case "asset_completed":
        return <CheckCircle className={iconClass} />;
      case "deadline_reminder":
        return <Clock className={iconClass} />;
      case "qa_review":
        return <Search className={iconClass} />;
      case "status_change":
        return <RefreshCw className={iconClass} />;
      default:
        return <AlertCircle className={iconClass} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "asset_allocation":
        return "bg-blue-50 border-l-blue-500 text-blue-900";
      case "asset_completed":
        return "bg-green-50 border-l-green-500 text-green-900";
      case "deadline_reminder":
        return "bg-amber-50 border-l-amber-500 text-amber-900";
      case "qa_review":
        return "bg-purple-50 border-l-purple-500 text-purple-900";
      case "status_change":
        return "bg-orange-50 border-l-orange-500 text-orange-900";
      default:
        return "bg-gray-50 border-l-gray-500 text-gray-900";
    }
  };

  const getNotificationIconColor = (type: string) => {
    switch (type) {
      case "asset_allocation":
        return "text-blue-600";
      case "asset_completed":
        return "text-green-600";
      case "deadline_reminder":
        return "text-amber-600";
      case "qa_review":
        return "text-purple-600";
      case "status_change":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  if (!user?.id) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative p-2 hover:bg-gray-100 transition-colors ${className}`}
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
      <PopoverContent className="w-96 p-0 shadow-lg border-0" align="end">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Notifications</h3>
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
                  className="text-xs h-8 px-2 text-gray-600 hover:text-gray-900"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">
                No unread notifications
              </p>
              <p className="text-xs text-gray-500 mt-1">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 ${getNotificationColor(notification.type)} hover:bg-white transition-colors cursor-pointer`}
                  onClick={() => notification.id && markAsRead(notification.id)}
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
                          <p className="text-sm text-gray-700 leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">
                              {format(
                                new Date(notification.created_at),
                                "MMM d, h:mm a"
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
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
