import React from "react";
import useSWR, { mutate } from "swr";
import { supabase } from "@/lib/supabaseClient";

interface Activity {
  id: string;
  action: string;
  description?: string;
  type: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user_email?: string;
  user_role?: string;
}

interface UseActivitiesOptions {
  limit?: number;
  offset?: number;
  type?: string;
  resource_type?: string;
  realtime?: boolean;
}

const fetcher = async (url: string) => {
  console.log("Activity fetcher called with URL:", url);

  const response = await fetch(url, {
    credentials: "include", // Include cookies for authentication
  });

  console.log("Activity fetcher response status:", response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Activity fetcher error:", errorData);
    throw new Error(errorData.error || "Failed to fetch activities");
  }

  const data = await response.json();
  console.log(
    "Activity fetcher success, activities count:",
    data.activities?.length || 0
  );
  return data.activities as Activity[];
};

export function useActivities(options: UseActivitiesOptions = {}) {
  const {
    limit = 10,
    offset = 0,
    type,
    resource_type,
    realtime = true,
  } = options;

  // Build query parameters
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (type) params.append("type", type);
  if (resource_type) params.append("resource_type", resource_type);

  const {
    data: activities,
    error,
    isLoading,
    mutate: refreshActivities,
  } = useSWR(`/api/activity/log?${params.toString()}`, fetcher, {
    refreshInterval: realtime ? 50000 : 0, // Refresh every 5 seconds if realtime is enabled
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  // Set up real-time subscription if enabled
  React.useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
        },
        (payload) => {
          // Refresh the activities when a new activity is logged
          refreshActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, refreshActivities]);

  // Helper function to format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  };

  // Helper function to get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "upload":
        return "Upload";
      case "create":
        return "Plus";
      case "update":
        return "Edit";
      case "delete":
        return "Trash2";
      case "view":
        return "Eye";
      case "settings":
        return "Settings";
      case "login":
        return "LogIn";
      case "logout":
        return "LogOut";
      case "download":
        return "Download";
      case "share":
        return "Share2";
      case "export":
        return "FileDown";
      case "import":
        return "FileUp";
      default:
        return "Activity";
    }
  };

  return {
    activities: activities || [],
    error,
    isLoading,
    refreshActivities,
    formatTimeAgo,
    getActivityIcon,
  };
}

// Hook for fetching activities for a specific user
export function useUserActivities(
  userId: string,
  options: UseActivitiesOptions = {}
) {
  const {
    data: activities,
    error,
    isLoading,
    mutate: refreshActivities,
  } = useSWR(
    userId
      ? `/api/activity/log?user_id=${userId}&${new URLSearchParams({
          limit: (options.limit || 10).toString(),
          offset: (options.offset || 0).toString(),
        })}`
      : null,
    fetcher,
    {
      refreshInterval: options.realtime ? 5000 : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    activities: activities || [],
    error,
    isLoading,
    refreshActivities,
  };
}

// Hook for fetching recent activities (last 24 hours)
export function useRecentActivities(limit: number = 20) {
  const {
    data: activities,
    error,
    isLoading,
    mutate: refreshActivities,
  } = useSWR(`/api/activity/log?limit=${limit}&recent=true`, fetcher, {
    refreshInterval: 3000, // Refresh every 3 seconds for recent activities
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  return {
    activities: activities || [],
    error,
    isLoading,
    refreshActivities,
  };
}
