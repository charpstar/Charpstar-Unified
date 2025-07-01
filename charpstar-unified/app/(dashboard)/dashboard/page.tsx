"use client";

import { useUser } from "@/contexts/useUser";
import { useToast } from "@/components/ui/utilities";
import { AvatarPicker } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { ThemeSwitcherCard } from "@/components/ui/utilities";
import { Shield, Package, Target } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
} from "react";
import React from "react";
import { DraggableDashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/ui/skeletons";

// Lazy load heavy dashboard widgets
const LazyStatsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.StatsWidget,
  }))
);
const LazyQuickActionsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.QuickActionsWidget,
  }))
);
const LazyActivityWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.ActivityWidget,
  }))
);
const LazyNewUsersChartWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.NewUsersChartWidget,
  }))
);
const LazyNewModelsChartWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.NewModelsChartWidget,
  }))
);

interface DashboardStats {
  totalModels: number;
  totalCategories: number;
  totalMaterials: number;
  totalColors: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const user = useUser();
  const { toast } = useToast();
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get avatar from user metadata (same as nav-user)
  const userAvatar = user?.metadata?.avatar_url || null;

  // Add a fallback for when metadata is not loaded yet
  const [fallbackAvatar, setFallbackAvatar] = useState<string | null>(null);

  // Fetch avatar as fallback if metadata is not available
  useEffect(() => {
    if (!user?.id || user?.metadata?.avatar_url !== undefined) {
      setFallbackAvatar(null);
      return;
    }

    // Only fetch if we don't have metadata yet
    const fetchFallbackAvatar = async () => {
      try {
        const response = await fetch(`/api/users/avatar?user_id=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setFallbackAvatar(data.avatar_url);
        }
      } catch (error) {
        console.error("Error fetching fallback avatar:", error);
      }
    };

    fetchFallbackAvatar();
  }, [user?.id, user?.metadata?.avatar_url]);

  // Use fallback avatar if metadata avatar is not available
  const displayAvatar = user?.metadata?.avatar_url || fallbackAvatar;

  useEffect(() => {
    document.title = "CharpstAR Platform - Dashboard";
  }, []);

  useEffect(() => {
    // Show avatar popup for first 3 seconds only on first visit
    const hasSeenAvatarPopup = localStorage.getItem("hasSeenAvatarPopup");

    if (!hasSeenAvatarPopup) {
      setShowAvatarPopup(true);

      // Clear any existing timer
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }

      // Set new timer
      popupTimerRef.current = setTimeout(() => {
        setShowAvatarPopup(false);
        // Mark as seen in localStorage
        localStorage.setItem("hasSeenAvatarPopup", "true");
      }, 3000);

      return () => {
        if (popupTimerRef.current) {
          clearTimeout(popupTimerRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const fetchStats = async () => {
          const response = await fetch("/api/dashboard/layout");
          if (response.ok) {
            const data = await response.json();
            setStats(data);
          }
        };

        await fetchStats();
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  // Memoize the handleAvatarChange function to prevent recreation on every render
  const handleAvatarChange = useCallback(
    async (avatarUrl: string | null) => {
      if (!user?.id) return;

      try {
        const response = await fetch("/api/users/avatar", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            avatar_url: avatarUrl,
            user_id: user.id,
          }),
        });
        if (response.ok) {
          // Dispatch avatar update event for other components
          window.dispatchEvent(new CustomEvent("avatarUpdated"));
          toast({
            title: "Avatar updated!",
            description: "Your avatar has been updated successfully.",
          });
        } else {
          throw new Error("Failed to update avatar");
        }
      } catch (error) {
        console.error("Error updating avatar:", error);
        toast({
          title: "Error updating avatar",
          description: "Failed to update your avatar. Please try again.",
          variant: "destructive",
        });
      }
    },
    [user?.id, toast]
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getRoleBadgeVariant = (role: string) => {
    // Use "default" variant for all roles to get bg-primary color
    return "default";
  };

  // Memoize the default dashboard layout to prevent recreation on every render
  const defaultLayout = useMemo(
    () => [
      {
        id: "profile",
        title: "Profile",
        type: "profile" as const,
        size: "medium" as const,
        position: { x: 0, y: 0 },
        visible: true,
        content: (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative">
                <AvatarPicker
                  currentAvatar={userAvatar || undefined}
                  onAvatarChange={handleAvatarChange}
                />
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-base sm:text-lg font-medium">
                  {user?.email || "User"}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Badge
                    variant={
                      getRoleBadgeVariant(user?.metadata?.role || "") as
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline"
                    }
                  >
                    {(user?.metadata?.role || "User").charAt(0).toUpperCase() +
                      (user?.metadata?.role || "User").slice(1)}
                  </Badge>
                  {user?.metadata?.role === "admin" && (
                    <Shield className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <ThemeSwitcherCard />
            </div>
          </div>
        ),
      },
      {
        id: "quick-actions",
        title: "Quick Actions",
        type: "actions" as const,
        size: "medium" as const,
        position: { x: 2, y: 0 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-32 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyQuickActionsWidget />
          </Suspense>
        ),
      },
      {
        id: "stats-models",
        title: "Total Models",
        type: "stats" as const,
        size: "small" as const,
        position: { x: 0, y: 1 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyStatsWidget
              title="Total Models"
              value={stats?.totalModels?.toString() || "0"}
              icon={Package}
            />
          </Suspense>
        ),
      },
      {
        id: "stats-categories",
        title: "Categories",
        type: "stats" as const,
        size: "small" as const,
        position: { x: 1, y: 1 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyStatsWidget
              title="Categories"
              value={stats?.totalCategories?.toString() || "0"}
              icon={Target}
            />
          </Suspense>
        ),
      },
      {
        id: "activity",
        title: "Recent Activity",
        type: "custom" as const,
        size: "large" as const,
        position: { x: 2, y: 1 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyActivityWidget />
          </Suspense>
        ),
      },

      {
        id: "new-users-chart",
        title: "New Users Chart",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 0, y: 4 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyNewUsersChartWidget />
          </Suspense>
        ),
      },
      {
        id: "new-models-chart",
        title: "New Models Chart",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 2, y: 4 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyNewModelsChartWidget />
          </Suspense>
        ),
      },
    ],
    [
      user?.email,
      user?.metadata?.avatar_url,
      user?.metadata?.role,
      stats?.totalModels,
      stats?.totalCategories,
      handleAvatarChange,
      displayAvatar,
      userAvatar,
    ]
  );

  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <DraggableDashboard defaultLayout={defaultLayout} />

        {/* Avatar Popup - rendered outside the memoized layout */}
        {showAvatarPopup && (
          <div className="fixed top-35 left-40 z-50 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span>👋 Click to customize your avatar!</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAvatarPopup(false);
                    localStorage.setItem("hasSeenAvatarPopup", "true");
                    // Clear the timer if it's still running
                    if (popupTimerRef.current) {
                      clearTimeout(popupTimerRef.current);
                    }
                  }}
                  className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary transform rotate-45"></div>
            </div>
          </div>
        )}

        {/* Admin widgets are rendered separately */}
      </div>
    </Suspense>
  );
}
