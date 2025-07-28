"use client";

import { useUser } from "@/contexts/useUser";
import { useToast } from "@/components/ui/utilities";
import { AvatarPicker } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { ThemeSwitcherCard } from "@/components/ui/utilities";
import { Shield } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
} from "react";
import React from "react";
import { DraggableDashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { OnboardingDashboard } from "@/components/dashboard/onboarding-dashboard";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ModelStatusWidget,
  StatusPieChartWidget,
} from "@/components/dashboard/dashboard-widgets";
import { ClientDashboardTour } from "@/components/dashboard/client-dashboard-tour";
import {
  ModelerStatsWidget,
  ModelerEarningsWidget,
  ModelerQuickActionsWidget,
} from "@/components/dashboard/modeler-widgets";
import { PendingAssignmentsWidget } from "@/components/dashboard/pending-assignments-widget";
import ErrorBoundary from "@/components/dashboard/error-boundary";

// Lazy load heavy dashboard widgets
const LazyTotalModelsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.TotalModelsWidget,
  }))
);
const LazyCategoriesWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.CategoriesWidget,
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
  const user = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get avatar from user metadata (same as nav-user)
  const userAvatar = user?.metadata?.avatar_url || null;

  // Add a fallback for when metadata is not loaded yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  useEffect(() => {
    document.title = "CharpstAR Platform - Dashboard";
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const fetchStats = async () => {
          const response = await fetch("/api/dashboard/stats");
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

  useEffect(() => {
    if (searchParams.get("refreshUser") === "1") {
      // Option 1: Hard reload (guaranteed fresh user)
      window.location.replace("/dashboard");
      // Option 2: If you have refetchUser, call it here instead
      // await refetchUser();
      // router.replace("/dashboard");
    }
  }, [searchParams, router]);

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
  const defaultLayout = useMemo(() => {
    const isAdmin = user?.metadata?.role === "admin";
    const isClient = user?.metadata?.role === "client";
    const isModeler = user?.metadata?.role === "modeler";

    const baseWidgets = [
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
                  {isAdmin && <Shield className="h-4 w-4 text-primary" />}
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
        position: { x: 1, y: 0 },
        visible: true,
        content: (
          <Suspense
            fallback={
              <div className="h-32 bg-muted animate-pulse rounded-lg" />
            }
          >
            {isModeler ? (
              <ErrorBoundary>
                <ModelerQuickActionsWidget />
              </ErrorBoundary>
            ) : (
              <LazyQuickActionsWidget />
            )}
          </Suspense>
        ),
      },
      // Insert ModelStatusWidget and StatusPieChartWidget for clients only
      ...(isClient
        ? [
            {
              id: "model-status",
              title: "Model Status",
              type: "custom" as const,
              size: "medium" as const,
              position: { x: 0, y: 1 },
              visible: true,
              content: <ModelStatusWidget />,
            },
            {
              id: "status-pie-chart",
              title: "Model Status Chart",
              type: "custom" as const,
              size: "medium" as const,
              position: { x: 1, y: 1 },
              visible: true,
              content: <StatusPieChartWidget />,
            },
          ]
        : []),
      // Insert modeler-specific widgets
      ...(isModeler
        ? [
            {
              id: "modeler-stats",
              title: "My Statistics",
              type: "custom" as const,
              size: "large" as const,
              position: { x: 0, y: 1 },
              visible: true,
              content: (
                <ErrorBoundary>
                  <ModelerStatsWidget />
                </ErrorBoundary>
              ),
            },
            {
              id: "pending-assignments",
              title: "Pending Assignments",
              type: "custom" as const,
              size: "medium" as const,
              position: { x: 1, y: 1 },
              visible: true,
              content: (
                <ErrorBoundary>
                  <PendingAssignmentsWidget />
                </ErrorBoundary>
              ),
            },

            {
              id: "modeler-earnings",
              title: "Earnings Overview",
              type: "custom" as const,
              size: "large" as const,
              position: { x: 1, y: 2 },
              visible: true,
              content: (
                <ErrorBoundary>
                  <ModelerEarningsWidget />
                </ErrorBoundary>
              ),
            },
          ]
        : []),
    ];

    // Admin-only widgets
    const adminWidgets = isAdmin
      ? [
          {
            id: "stats-models",
            title: "Total Models",
            type: "custom" as const,
            size: "medium" as const,
            position: { x: 0, y: 1 },
            visible: true,
            content: (
              <Suspense
                fallback={
                  <div className="h-48 bg-muted animate-pulse rounded-lg" />
                }
              >
                <LazyTotalModelsWidget />
              </Suspense>
            ),
          },
          {
            id: "stats-categories",
            title: "Categories",
            type: "custom" as const,
            size: "medium" as const,
            position: { x: 1, y: 1 },
            visible: true,
            content: (
              <Suspense
                fallback={
                  <div className="h-48 bg-muted animate-pulse rounded-lg" />
                }
              >
                <LazyCategoriesWidget stats={stats} />
              </Suspense>
            ),
          },
          {
            id: "activity",
            title: "Recent Activity",
            type: "custom" as const,
            size: "large" as const,
            position: { x: 0, y: 2 },
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
            position: { x: 1, y: 2 },
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
            position: { x: 2, y: 2 },
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
        ]
      : [];

    return [...baseWidgets, ...adminWidgets];
  }, [
    user?.email,
    user?.metadata?.role,
    stats,
    handleAvatarChange,
    userAvatar,
  ]);

  if (!user) {
    return <DashboardSkeleton />;
  }

  // Show onboarding dashboard if user is still in onboarding
  if (user?.metadata?.onboarding === true) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="container mx-auto p-6 space-y-6">
          <OnboardingDashboard />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Add the dashboard tour component for clients */}
        {user?.metadata?.role === "client" && !user?.metadata?.onboarding && (
          <ClientDashboardTour />
        )}

        <DraggableDashboard defaultLayout={defaultLayout} />

        {/* Admin widgets are rendered separately */}
      </div>
    </Suspense>
  );
}
