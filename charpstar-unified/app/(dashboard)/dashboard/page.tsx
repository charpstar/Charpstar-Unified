"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useUser } from "@/contexts/useUser";
import { Badge } from "@/components/ui/feedback";
import { Package, Shield, Target } from "lucide-react";
import { ThemeSwitcherCard } from "@/components/ui/utilities";
import { supabase } from "@/lib/supabaseClient";
import React from "react";
import { AvatarPicker } from "@/components/ui/inputs";
import { useToast } from "@/components/ui/utilities";
import { DraggableDashboard } from "@/components/dashboard";
import { useLoadingState } from "@/hooks/useLoadingState";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import {
  StatsWidget,
  QuickActionsWidget,
  ActivityWidget,
  NewUsersChartWidget,
  NewModelsChartWidget,
} from "@/components/dashboard";

interface User {
  id: string;
  email: string;
  name: string;
  analytics_profile_id?: string;
  metadata?: {
    analytics_profile_id?: string;
    role?: string;
    client_config?: string;
    avatar_url?: string;
  };
}

interface DashboardStats {
  totalModels: number;
  totalCategories: number;
  totalMaterials: number;
  totalColors: number;
}

interface AnalyticsProfile {
  id: string;
  projectid: string;
  datasetid: string;
  tablename: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const user = useUser() as User | null;
  const { toast } = useToast();
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { withLoading } = useLoadingState({ showGlobalLoading: true });

  // Development flag to force loading state for skeleton testing
  const FORCE_LOADING = process.env.NODE_ENV === "development" && false; // Set to true to force loading
  // Alternative: Use URL parameter ?skeleton=true to force loading
  const urlParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const FORCE_LOADING_VIA_URL = urlParams.get("skeleton") === "true";

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
      await withLoading(async () => {
        const fetchStats = async () => {
          try {
            const { data: assets } = await supabase
              .from("assets")
              .select("id, category, material, color");

            if (assets) {
              const categories = new Set(assets.map((asset) => asset.category));
              const materials = new Set(assets.map((asset) => asset.material));
              const colors = new Set(assets.map((asset) => asset.color));

              setStats({
                totalModels: assets.length,
                totalCategories: categories.size,
                totalMaterials: materials.size,
                totalColors: colors.size,
              });
            }
          } catch (error) {
            console.error("Error fetching stats:", error);
          }
        };

        const fetchAnalyticsProfile = async () => {
          if (!user?.analytics_profile_id) return;

          try {
            const { data: analytics } = await supabase
              .from("analytics_profiles")
              .select("*")
              .eq("id", user.analytics_profile_id)
              .single();

            if (analytics) {
              setAnalyticsProfile(analytics);
            }
          } catch (error) {
            console.error("Error fetching analytics profile:", error);
          }
        };

        await Promise.all([fetchStats(), fetchAnalyticsProfile()]);
      });
      setLoading(false);
    };

    fetchDashboardData();
  }, [user?.analytics_profile_id]);

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
        content: <QuickActionsWidget />,
      },
      {
        id: "stats-models",
        title: "Total Models",
        type: "stats" as const,
        size: "small" as const,
        position: { x: 0, y: 1 },
        visible: true,
        content: (
          <StatsWidget
            title="Total Models"
            value={stats?.totalModels?.toString() || "0"}
            icon={Package}
          />
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
          <StatsWidget
            title="Categories"
            value={stats?.totalCategories?.toString() || "0"}
            icon={Target}
          />
        ),
      },
      {
        id: "activity",
        title: "Recent Activity",
        type: "custom" as const,
        size: "large" as const,
        position: { x: 2, y: 1 },
        visible: true,
        content: <ActivityWidget />,
      },

      {
        id: "new-users-chart",
        title: "New Users Chart",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 0, y: 4 },
        visible: true,
        content: <NewUsersChartWidget />,
      },
      {
        id: "new-models-chart",
        title: "New Models Chart",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 2, y: 4 },
        visible: true,
        content: <NewModelsChartWidget />,
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
    ]
  );

  if (loading || FORCE_LOADING || FORCE_LOADING_VIA_URL) {
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
