"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useUser } from "@/contexts/useUser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { createClient } from "@/utils/supabase/client";
import {
  Package,
  TrendingUp,
  ChartBar,
  User2,
  Shield,
  Box,
  PackageSearch,
  Users,
  Activity,
  Calendar,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ThemeSwitcherCard } from "@/components/ui/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { supabase } from "@/lib/supabaseClient";
import React from "react";
import { ChartContainer, ChartTooltip } from "@/components/ui/display";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { EditorThemePicker, AvatarPicker } from "@/components/ui/inputs";
import { useToast } from "@/components/ui/utilities";
import { DraggableDashboard } from "@/components/dashboard";
import {
  StatsWidget,
  ProfileWidget,
  QuickActionsWidget,
  ActivityWidget,
  PerformanceWidget,
  CalendarWidget,
  SystemStatusWidget,
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

interface UserProfile {
  id: string;
  role: string;
  user_id: string;
  avatar_url?: string | null;
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

type StatCardProps = { title: string; value: number; icon: React.ReactNode };
function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="bg-background rounded shadow p-4 flex items-center space-x-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="font-bold text-lg">{value}</div>
      </div>
    </div>
  );
}

type ChartDatum = { date: string; uploads: number; registrations: number };
function AdminDashboardWidgets() {
  const [chartData, setChartData] = React.useState<ChartDatum[]>([]);
  const [modelCount, setModelCount] = React.useState(0);
  const [userCount, setUserCount] = React.useState(0);

  React.useEffect(() => {
    async function fetchData() {
      const { data: uploads } = await supabase
        .from("assets")
        .select("created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      const { data: users } = await supabase
        .from("profiles")
        .select("created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      const uploadsByDay = days.map(
        (date) =>
          uploads?.filter((u) => u.created_at.slice(0, 10) === date).length || 0
      );
      const usersByDay = days.map(
        (date) =>
          users?.filter((u) => u.created_at.slice(0, 10) === date).length || 0
      );
      setChartData(
        days.map((date, i) => ({
          date,
          uploads: uploadsByDay[i],
          registrations: usersByDay[i],
        }))
      );
      setModelCount(uploads?.length || 0);
      setUserCount(users?.length || 0);
    }
    fetchData();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-background rounded-lg shadow p-4 flex flex-col border border-border">
        <StatCard title="Models Uploaded (7d)" value={modelCount} icon="📦" />
        <div className="mt-2">
          <ChartContainer
            config={{ uploads: { label: "Uploads", color: "#6366f1" } }}
          >
            <BarChart data={chartData} height={60}>
              <XAxis dataKey="date" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={24} />
              <ChartTooltip />
              <Bar dataKey="uploads" fill="var(--primary)" barSize={7} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
      <div className="bg-background rounded-lg shadow p-4 flex flex-col border border-border">
        <StatCard title="New Users (7d)" value={userCount} icon="👤" />
        <div className="mt-2">
          <ChartContainer
            config={{
              registrations: { label: "Registrations", color: "#22c55e" },
            }}
          >
            <BarChart data={chartData} height={60}>
              <XAxis dataKey="date" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={24} />
              <ChartTooltip />
              <Bar dataKey="registrations" fill="var(--primary)" barSize={7} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const user = useUser() as User | null;
  const { toast } = useToast();

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
    // Show avatar popup for first 5 seconds only on first visit
    const hasSeenAvatarPopup = localStorage.getItem("hasSeenAvatarPopup");

    if (!hasSeenAvatarPopup) {
      setShowAvatarPopup(true);

      const timer = setTimeout(() => {
        setShowAvatarPopup(false);
        // Mark as seen in localStorage
        localStorage.setItem("hasSeenAvatarPopup", "true");
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, []);

  useEffect(() => {
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

    Promise.all([fetchStats(), fetchAnalyticsProfile()]).finally(() =>
      setLoading(false)
    );
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    // Use "default" variant for all roles to get bg-primary color
    return "default";
  };

  const renderAvatar = () => {
    if (displayAvatar) {
      return (
        <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border border-border">
          <AvatarImage src={displayAvatar} />
          <AvatarFallback className="bg-primary/10 text-muted-foreground text-base sm:text-lg">
            {getInitials(user?.email || "")}
          </AvatarFallback>
        </Avatar>
      );
    }

    return (
      <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border border-border">
        <AvatarFallback className="bg-primary/10 text-muted-foreground text-base sm:text-lg">
          {getInitials(user?.email || "")}
        </AvatarFallback>
      </Avatar>
    );
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
                {showAvatarPopup && (
                  <div className="absolute -top-6 left-8 z-50 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>👋 Click to customize your avatar!</span>
                        <button
                          onClick={() => setShowAvatarPopup(false)}
                          className="text-primary-foreground/70 hover:text-primary-foreground"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="absolute -bottom-1 left-4 w-2 h-2 bg-primary transform rotate-45"></div>
                    </div>
                  </div>
                )}
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
              <EditorThemePicker />
            </div>
          </div>
        ),
      },
      {
        id: "quick-actions",
        title: "",
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
        id: "performance",
        title: "Performance",
        type: "custom" as const,
        size: "medium" as const,
        position: { x: 0, y: 2 },
        visible: true,
        content: <PerformanceWidget />,
      },
      {
        id: "calendar",
        title: "Calendar",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 2, y: 2 },
        visible: true,
        content: <CalendarWidget />,
      },
      {
        id: "system-status",
        title: "System Status",
        type: "custom" as const,
        size: "small" as const,
        position: { x: 3, y: 2 },
        visible: true,
        content: <SystemStatusWidget />,
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
      showAvatarPopup,
      handleAvatarChange,
      displayAvatar,
    ]
  );

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User2 className="h-4 w-4" />
                  User Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="text-base sm:text-lg font-medium">
                        {user?.email || "User"}
                      </p>
                      <div className="flex items-center justify-center sm:justify-start gap-2 bg-primary">
                        <Badge
                          variant={
                            getRoleBadgeVariant(user?.metadata?.role || "") as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline"
                          }
                        >
                          {(user?.metadata?.role || "User")
                            .charAt(0)
                            .toUpperCase() +
                            (user?.metadata?.role || "User").slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <DraggableDashboard defaultLayout={defaultLayout}>
        {/* Admin widgets are rendered separately */}
        {user?.metadata?.role === "admin" && (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4">
            <AdminDashboardWidgets />
          </div>
        )}
      </DraggableDashboard>
    </div>
  );
}
