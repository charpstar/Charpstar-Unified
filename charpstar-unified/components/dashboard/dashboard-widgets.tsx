"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAssets } from "@/hooks/use-assets";
import { useUser } from "@/contexts/useUser";
import { Button } from "@/components/ui/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { Badge, Progress } from "@/components/ui/feedback";
import {
  Users,
  TrendingUp,
  Activity,
  Settings,
  FileText,
  Upload,
  Plus,
  Edit,
  Trash2,
  Eye,
  LogIn,
  LogOut,
  Download,
  Share2,
  FileDown,
  FileUp,
  Package,
  Folder,
  Cog,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { BarChart, XAxis, YAxis, Bar } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { ChartTooltip } from "@/components/ui/display";
import { useActivities } from "@/hooks/use-activities";
import { Card, Separator, CardContent } from "@/components/ui/containers";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { STATUS_LABELS, type StatusKey } from "@/lib/constants";

// QA-style header used across widgets for consistent look
function QAHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-muted/35 rounded-full">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-sm text-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

// Helper function to get status color CSS variable
const getStatusColor = (status: StatusKey): string => {
  const statusColorMap = {
    in_production: "var(--status-in-production)",
    revisions: "var(--status-revisions)",
    approved: "var(--status-approved)",
    approved_by_client: "var(--status-approved-by-client)",
    delivered_by_artist: "var(--status-delivered-by-artist)",
  };
  return statusColorMap[status];
};

// Simple count-up animation for numbers
function useCountUp(targetValue: number, durationMs = 700) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const previousRef = React.useRef(0);
  const isAnimatingRef = React.useRef(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const startValue = previousRef.current;
    const endValue = targetValue;

    // If values are the same, don't animate
    if (startValue === endValue) return;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If already animating, wait a bit before starting new animation
    if (isAnimatingRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (!isAnimatingRef.current) {
          // Start animation after a short delay
          startAnimation(startValue, endValue, durationMs);
        }
        timeoutRef.current = null;
      }, 100);
      return;
    }

    startAnimation(startValue, endValue, durationMs);
  }, [targetValue, durationMs]);

  const startAnimation = (
    startValue: number,
    endValue: number,
    durationMs: number
  ) => {
    isAnimatingRef.current = true;
    const startTime = performance.now();

    let rafId: number | null = null;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startValue + (endValue - startValue) * eased);
      setDisplayValue(next);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        previousRef.current = endValue;
        isAnimatingRef.current = false;
      }
    };
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    rafId = requestAnimationFrame(tick);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return displayValue;
}

// Unified Widget Header Component
interface WidgetHeaderProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function WidgetHeader({
  title,
  icon: Icon,
  children,
  className = "",
}: WidgetHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h4 className="font-medium text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// Unified Widget Container Component
interface WidgetContainerProps {
  children: React.ReactNode;
  spacing?: "sm" | "md" | "lg";
  className?: string;
}

export function WidgetContainer({
  children,
  spacing = "md",
  className = "",
}: WidgetContainerProps) {
  const spacingClasses = {
    sm: "space-y-2",
    md: "space-y-3",
    lg: "space-y-4",
  };

  return (
    <div className={`${spacingClasses[spacing]} ${className}`}>{children}</div>
  );
}

// Stats Widget
export function StatsWidget({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {change && <p className="text-xs text-success">{change}</p>}
      </div>
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-6 w-6 text-primary" />
      </div>
    </div>
  );
}

// Profile Widget
export function ProfileWidget({ user }: { user?: any }) {
  const router = useRouter();

  // Helper function to get role-specific metadata
  const getRoleMetadata = (role: string) => {
    switch (role?.toLowerCase()) {
      case "qa":
        return {
          icon: "🔍",
          title: "Quality Assurance",
          description: "Review and validate 3D models",
          stats: [
            { label: "Models Reviewed", value: "24", trend: "+12%" },
            { label: "Issues Found", value: "8", trend: "-3%" },
            { label: "Approval Rate", value: "92%", trend: "+5%" },
          ],
          recentActivity: "Reviewed ArtwoodTest model",
          status: "active",
        };
      case "modeler":
        return {
          icon: "🎨",
          title: "3D Modeler",
          description: "Create and optimize 3D assets",
          stats: [
            { label: "Models Created", value: "156", trend: "+23%" },
            { label: "Categories", value: "12", trend: "+2" },
            { label: "Avg Quality", value: "4.8/5", trend: "+0.2" },
          ],
          recentActivity: "Uploaded new furniture model",
          status: "active",
        };
      case "client":
        return {
          icon: "👤",
          title: "client",
          description: "Browse and visualize 3D models",
          stats: [
            { label: "Models Viewed", value: "89", trend: "+15%" },
            { label: "Downloads", value: "23", trend: "+8%" },
            { label: "Favorites", value: "12", trend: "+3" },
          ],
          recentActivity: "Downloaded chair model",
          status: "active",
        };
      case "admin":
        return {
          icon: "⚙️",
          title: "Administrator",
          description: "Manage platform and users",
          stats: [
            { label: "Users Managed", value: "45", trend: "+5" },
            { label: "System Health", value: "98%", trend: "+2%" },
            { label: "Active Sessions", value: "23", trend: "+7" },
          ],
          recentActivity: "Updated user permissions",
          status: "active",
          roleOverview: {
            qa: {
              totalUsers: 8,
              modelsReviewed: 156,
              issuesFound: 23,
              approvalRate: "94%",
            },
            modelers: {
              totalUsers: 12,
              modelsCreated: 342,
              categories: 18,
              avgQuality: "4.7/5",
            },
            client: {
              totalUsers: 25,
              modelsViewed: 1247,
              downloads: 389,
              favorites: 156,
            },
          },
        };
      default:
        return {
          icon: "👤",
          title: "User",
          description: "Platform user",
          stats: [
            { label: "Models Viewed", value: "12", trend: "+2" },
            { label: "Downloads", value: "3", trend: "+1" },
            { label: "Favorites", value: "5", trend: "+1" },
          ],
          recentActivity: "Browsed asset library",
          status: "active",
        };
    }
  };

  const roleData = getRoleMetadata(user?.metadata?.role);
  const userName = user?.name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "user@example.com";
  const userRole = user?.metadata?.role || "user";

  return (
    <WidgetContainer>
      <WidgetHeader title="Profile" icon={Users}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const userMenu = document.querySelector(
              '[data-tour="user-profile"]'
            );
            if (userMenu) {
              (userMenu as HTMLElement).click();
            }
          }}
          className="h-9 w-9 p-0 hover:bg-primary/10 rounded-lg transition-all duration-200 hover:scale-105 group"
        >
          <div className="relative">
            <Cog className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
            <div className="absolute inset-0 rounded-full bg-primary/0 group-hover:bg-primary/5 transition-all duration-200" />
          </div>
        </Button>
      </WidgetHeader>

      <div className="space-y-4">
        {/* Profile Header */}
        <div className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 p-4">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-20 h-20 transform rotate-45 translate-x-8 -translate-y-8 bg-current rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 transform -rotate-45 -translate-x-6 translate-y-6 bg-current rounded-full"></div>
          </div>
          <div className="relative flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage
                  src={user?.avatar_url || user?.metadata?.avatar_url}
                />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                <span className="text-xs text-white">✓</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">{userName}</h3>
                <span className="text-2xl">{roleData.icon}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{userEmail}</p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={userRole === "admin" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {roleData.title}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="h-2 w-2 p-0 bg-green-500 border-green-500"
                  ></Badge>
                  {roleData.status}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 dark:bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left"></div>
        </div>

        {/* Role Description */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">
            {roleData.description}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {roleData.stats.map((stat, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/50 p-3 text-center transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]"
            >
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 right-0 w-10 h-10 transform rotate-45 translate-x-6 -translate-y-6 bg-current rounded-full"></div>
              </div>
              <div className="text-lg font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-success font-medium">
                {stat.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50 p-3">
          <div className="absolute inset-0 opacity-5"></div>
          <div className="relative flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              Recent Activity
            </span>
          </div>
          <p className="relative text-sm text-muted-foreground">
            {roleData.recentActivity}
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 dark:bg-indigo-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left"></div>
        </div>

        {/* Role Overview for Admins */}
        {userRole === "admin" && roleData.roleOverview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Platform Overview
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* QA Overview */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔍</span>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Quality Assurance
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {roleData.roleOverview.qa.totalUsers} users
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-info">
                      {roleData.roleOverview.qa.modelsReviewed}
                    </div>
                    <div className="text-info">Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-info">
                      {roleData.roleOverview.qa.issuesFound}
                    </div>
                    <div className="text-info">Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-info">
                      {roleData.roleOverview.qa.approvalRate}
                    </div>
                    <div className="text-info">Approval</div>
                  </div>
                </div>
              </div>

              {/* Modelers Overview */}
              <div className="p-3 bg-success-muted rounded-lg border border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎨</span>
                  <span className="text-sm font-medium text-success">
                    3D Modelers
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {roleData.roleOverview.modelers.totalUsers} users
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-success">
                      {roleData.roleOverview.modelers.modelsCreated}
                    </div>
                    <div className="text-success">Created</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-success">
                      {roleData.roleOverview.modelers.categories}
                    </div>
                    <div className="text-success">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-success">
                      {roleData.roleOverview.modelers.avgQuality}
                    </div>
                    <div className="text-success">Quality</div>
                  </div>
                </div>
              </div>

              {/* Customers Overview */}
              <div className="p-3 bg-accent-purple rounded-lg border border-accent-purple/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👤</span>
                  <span className="text-sm font-medium text-accent-purple">
                    Customers
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {roleData.roleOverview.client.totalUsers} users
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-accent-purple">
                      {roleData.roleOverview.client.modelsViewed}
                    </div>
                    <div className="text-accent-purple">Viewed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-accent-purple">
                      {roleData.roleOverview.client.downloads}
                    </div>
                    <div className="text-accent-purple">Downloads</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-accent-purple">
                      {roleData.roleOverview.client.favorites}
                    </div>
                    <div className="text-accent-purple">Favorites</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs group hover:bg-primary/5 transition-all duration-200"
            onClick={() => {
              const userMenu = document.querySelector(
                '[data-tour="user-profile"]'
              );
              if (userMenu) {
                (userMenu as HTMLElement).click();
              }
            }}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <Cog className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                <div className="absolute inset-0 rounded-full bg-primary/0 group-hover:bg-primary/5 transition-all duration-200" />
              </div>
              <span className="font-medium">Settings</span>
            </div>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs group hover:bg-primary/5 transition-all duration-200"
            onClick={() => router.push("/asset-library")}
          >
            <div className="flex items-center gap-2">
              <Folder className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
              <span className="font-medium">Library</span>
            </div>
          </Button>
        </div>
      </div>
    </WidgetContainer>
  );
}

// Quick Actions Widget
export function QuickActionsWidget() {
  const user = useUser();
  const router = useRouter();

  const actions = [
    // Upload Asset/Add Product - hide for QA users
    ...(user?.metadata?.role !== "qa"
      ? [
          {
            name:
              user?.metadata?.role === "client"
                ? "Add Product"
                : "Upload Asset",
            icon: FileText,
            description:
              user?.metadata?.role === "client"
                ? "Add a new product to your catalog"
                : "Upload a new 3D asset to the library",
            action: () => {
              if (user?.metadata?.role === "client") {
                router.push("/add-products");
              } else {
                router.push("/asset-library/upload");
              }
            },
            color:
              user?.metadata?.role === "client"
                ? "from-violet-500 to-violet-600"
                : "from-purple-500 to-purple-600",
            hoverColor:
              user?.metadata?.role === "client"
                ? "from-violet-600 to-violet-700"
                : "from-purple-600 to-purple-700",
            iconBg:
              user?.metadata?.role === "client"
                ? "bg-violet-100 dark:bg-violet-900/50"
                : "bg-purple-100 dark:bg-purple-900/50",
            iconColor:
              user?.metadata?.role === "client"
                ? "text-violet-600 dark:text-violet-400"
                : "text-purple-600 dark:text-purple-400",
          },
        ]
      : []),
    {
      name:
        user?.metadata?.role === "admin"
          ? "Asset Library"
          : user?.metadata?.role === "qa"
            ? "QA Review"
            : "Reviews",
      icon: Folder,
      description:
        user?.metadata?.role === "admin"
          ? "Browse and manage all assets"
          : user?.metadata?.role === "qa"
            ? "Review assets assigned to you for QA"
            : "Review assets awaiting your feedback",
      action: () => {
        if (user?.metadata?.role === "admin") {
          router.push("/asset-library");
        } else if (user?.metadata?.role === "qa") {
          router.push("/qa-review");
        } else {
          router.push("/client-review?status=approved");
        }
      },
      color:
        user?.metadata?.role === "admin"
          ? "from-indigo-500 to-indigo-600"
          : user?.metadata?.role === "qa"
            ? "from-amber-500 to-amber-600"
            : "from-blue-500 to-blue-600",
      hoverColor:
        user?.metadata?.role === "admin"
          ? "from-indigo-600 to-indigo-700"
          : user?.metadata?.role === "qa"
            ? "from-amber-600 to-amber-700"
            : "from-blue-600 to-blue-700",
      iconBg:
        user?.metadata?.role === "admin"
          ? "bg-indigo-100 dark:bg-indigo-900/50"
          : user?.metadata?.role === "qa"
            ? "bg-amber-100 dark:bg-amber-900/50"
            : "bg-blue-100 dark:bg-blue-900/50",
      iconColor:
        user?.metadata?.role === "admin"
          ? "text-indigo-600 dark:text-indigo-400"
          : user?.metadata?.role === "qa"
            ? "text-amber-600 dark:text-amber-400"
            : "text-blue-600 dark:text-blue-400",
    },
    // View Analytics - hide for QA users
    ...(user?.metadata?.role !== "qa"
      ? [
          {
            name: "View Analytics",
            icon: TrendingUp,
            description: "See performance and usage analytics",
            action: () => {
              router.push("/analytics");
            },
            color: "from-emerald-500 to-emerald-600",
            hoverColor: "from-emerald-600 to-emerald-700",
            iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
            iconColor: "text-emerald-600 dark:text-emerald-400",
          },
        ]
      : []),
    // Settings - hide for QA users
    ...(user?.metadata?.role !== "qa" ? [] : []),
  ];

  return (
    <WidgetContainer>
      <QAHeader
        icon={Settings}
        title="Quick Actions"
        subtitle="Common tools and workflows"
      />
      <div className="grid grid-cols-2 gap-4 flex-1">
        {actions.map((action) => {
          const spanTwoCols =
            user?.metadata?.role === "admin" &&
            action.name === "View Analytics";
          return (
            <div
              key={action.name}
              className={` relative overflow-hidden rounded-2xl p-6 bg-foreground/5 transition-all duration-300 ease-out   hover:shadow-black/5 dark:hover:shadow-white/5 cursor-pointer  ${spanTwoCols ? "col-span-2" : ""}`}
              onClick={action.action}
            >
              <div className="absolute inset-0 opacity-5"></div>

              <div className="relative flex items-center gap-4 mb-2">
                <div
                  className={`p-3 rounded-full bg-foreground/5 shadow-lg shadow-black/30`}
                >
                  <action.icon className={`h-4 w-4 text-muted/80`} />
                </div>
                <div className="flex-1 min-w-0 p-2">
                  <p className="text-base font-semibold truncate text-muted/80">
                    {action.name}
                  </p>
                  {action.description && (
                    <p className="text-sm text-muted/60">
                      {action.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 Action Center p-3 bg-foreground/5 text-white rounded-lg transition-all duration-300 ease-out group- shadow-lg shadow-black/10 cursor-pointer`}
                >
                  <Button
                    variant="ghost"
                    className="text-sm font-medium leading-none text-muted/80 cursor-pointer size-2"
                  >
                    Open
                  </Button>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div
                className={`absolute bottom-0 left-0 right-0 h-1 bg-foreground/5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left`}
              ></div>
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}

// Activity Widget
export function ActivityWidget() {
  const { activities, isLoading, error, formatTimeAgo, getActivityIcon } =
    useActivities({
      limit: 8,
      realtime: true,
    });

  // Helper function to get Lucide React icon component
  const getActivityIconComponent = (iconName: string) => {
    const iconMap: {
      [key: string]: React.ComponentType<{ className?: string }>;
    } = {
      Upload,
      Plus,
      Edit,
      Trash2,
      Eye,
      Settings,
      LogIn,
      LogOut,
      Download,
      Share2,
      FileDown,
      FileUp,
      Activity,
    };

    return iconMap[iconName] || Activity;
  };

  if (isLoading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="Recent Activity" icon={Activity} />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50 animate-pulse"
            >
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </WidgetContainer>
    );
  }

  if (error) {
    return (
      <WidgetContainer>
        <WidgetHeader title="Recent Activity" icon={Activity} />
        <div className="text-center py-4 text-muted-foreground">
          <p>Failed to load activities</p>
          <p className="text-xs">Please try refreshing the page</p>
        </div>
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer>
      <WidgetHeader title="Recent Activity" icon={Activity} />
      <div className="space-y-2 max-h-[225px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p>No recent activity</p>
            <p className="text-xs">
              Activities will appear here as you use the app
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                {React.createElement(
                  getActivityIconComponent(getActivityIcon(activity.type)),
                  { className: "h-4 w-4 text-primary" }
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {activity.action}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatTimeAgo(activity.created_at)}</span>
                  {activity.user_email && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="truncate font-medium">
                          {activity.user_email}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </WidgetContainer>
  );
}

// New Users Chart Widget
export function NewUsersChartWidget() {
  const [chartData, setChartData] = React.useState<
    { date: string; users: number }[]
  >([]);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [chartWidth, setChartWidth] = React.useState(420);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateChartWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Better responsive width calculation for small screens
        const padding = window.innerWidth < 640 ? 20 : 40; // Less padding on mobile
        const maxWidth =
          window.innerWidth < 640 ? containerWidth - padding : 420;
        setChartWidth(
          Math.max(200, Math.min(maxWidth, containerWidth - padding))
        );
      }
    };

    updateChartWidth();
    window.addEventListener("resize", updateChartWidth);
    return () => window.removeEventListener("resize", updateChartWidth);
  }, []);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const { data: users } = await supabase
          .from("profiles")
          .select("created_at")
          .gte(
            "created_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          );

        const days = Array.from({ length: 30 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toISOString().slice(0, 10);
        });

        const usersByDay = days.map(
          (date) =>
            users?.filter(
              (u: { created_at: string }) => u.created_at.slice(0, 10) === date
            ).length || 0
        );

        setChartData(
          days.map((date, i) => ({
            date,
            users: usersByDay[i],
          }))
        );
        setTotalUsers(users?.length || 0);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="New Users (30d)" icon={Users} />
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer>
      <WidgetHeader title="New Users (30d)" icon={Users} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">{totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total new users</div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="h-32 w-full " ref={containerRef}>
          <BarChart
            data={chartData}
            height={190}
            width={chartWidth}
            className="w-full"
            margin={{
              top: 5,
              right: window.innerWidth < 640 ? 5 : 10,
              left: window.innerWidth < 640 ? 5 : 10,
              bottom: 20,
            }}
          >
            <XAxis
              dataKey="date"
              fontSize={window.innerWidth < 640 ? 8 : 10}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={window.innerWidth < 640 ? 2 : 5}
              tickFormatter={(value) => {
                const date = new Date(value);
                return window.innerWidth < 640
                  ? date.toLocaleDateString("en-US", {
                      month: "numeric",
                      day: "numeric",
                    })
                  : date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
              }}
            />
            <YAxis
              allowDecimals={false}
              fontSize={window.innerWidth < 640 ? 8 : 10}
              width={window.innerWidth < 640 ? 20 : 30}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: window.innerWidth < 640 ? "10px" : "12px",
              }}
            />
            <Bar
              dataKey="users"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              barSize={window.innerWidth < 640 ? 6 : 8}
            />
          </BarChart>
        </div>
      </div>
    </WidgetContainer>
  );
}

// New Models Chart Widget
export function NewModelsChartWidget() {
  const [chartData, setChartData] = React.useState<
    { date: string; models: number }[]
  >([]);
  const [totalModels, setTotalModels] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [chartWidth, setChartWidth] = React.useState(420);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateChartWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Better responsive width calculation for small screens
        const padding = window.innerWidth < 640 ? 20 : 40; // Less padding on mobile
        const maxWidth =
          window.innerWidth < 640 ? containerWidth - padding : 420;
        setChartWidth(
          Math.max(200, Math.min(maxWidth, containerWidth - padding))
        );
      }
    };

    updateChartWidth();
    window.addEventListener("resize", updateChartWidth);
    return () => window.removeEventListener("resize", updateChartWidth);
  }, []);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const { data: models } = await supabase
          .from("assets")
          .select("created_at")
          .gte(
            "created_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          );

        const days = Array.from({ length: 30 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toISOString().slice(0, 10);
        });

        const modelsByDay = days.map(
          (date) =>
            models?.filter(
              (m: { created_at: string }) => m.created_at.slice(0, 10) === date
            ).length || 0
        );

        setChartData(
          days.map((date, i) => ({
            date,
            models: modelsByDay[i],
          }))
        );
        setTotalModels(models?.length || 0);
      } catch (error) {
        console.error("Error fetching model data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="New Models (30d)" icon={Package} />
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer>
      <WidgetHeader title="New Models (30d)" icon={Package} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">{totalModels}</div>
            <div className="text-sm text-muted-foreground">
              Total new models
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="h-32 w-full overflow-hidden" ref={containerRef}>
          <BarChart
            data={chartData}
            height={150}
            width={chartWidth}
            className="w-full"
            margin={{
              top: 5,
              right: window.innerWidth < 640 ? 5 : 10,
              left: window.innerWidth < 640 ? 5 : 10,
              bottom: 20,
            }}
          >
            <XAxis
              dataKey="date"
              fontSize={window.innerWidth < 640 ? 8 : 10}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={window.innerWidth < 640 ? 2 : 5}
              tickFormatter={(value) => {
                const date = new Date(value);
                return window.innerWidth < 640
                  ? date.toLocaleDateString("en-US", {
                      month: "numeric",
                      day: "numeric",
                    })
                  : date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
              }}
            />
            <YAxis
              allowDecimals={false}
              fontSize={window.innerWidth < 640 ? 8 : 10}
              width={window.innerWidth < 640 ? 20 : 30}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: window.innerWidth < 640 ? "10px" : "12px",
              }}
            />
            <Bar
              dataKey="models"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              barSize={window.innerWidth < 640 ? 6 : 8}
            />
          </BarChart>
        </div>
      </div>
    </WidgetContainer>
  );
}

// Enhanced Total Models Widget
export function TotalModelsWidget() {
  const { assets, totalCount, loading: assetsLoading } = useAssets();

  return (
    <WidgetContainer>
      <WidgetHeader title="Total Models" icon={Package} />

      <div className="space-y-">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-primary">
              {assetsLoading ? (
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              ) : (
                totalCount?.toLocaleString()
              )}
            </div>
            <div className="text-sm text-muted-foreground">Total 3D models</div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>

        {(() => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const recentCount = assets.filter(
            (asset) => new Date(asset.created_at) >= sevenDaysAgo
          ).length;

          return recentCount > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                {recentCount} new in last 7 days
              </span>
            </div>
          ) : null;
        })()}
      </div>
    </WidgetContainer>
  );
}

// Enhanced Categories Widget
export function CategoriesWidget({ stats }: { stats?: any }) {
  const { filterOptions, loading } = useAssets();

  return (
    <WidgetContainer>
      <WidgetHeader title="Categories" icon={Folder} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-primary">
              {loading ? (
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              ) : (
                filterOptions.categories.length
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Unique categories
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Folder className="h-6 w-6 text-primary" />
          </div>
        </div>

        {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Top Categories
            </div>
            {stats.categoryBreakdown.slice(0, 3).map((cat: any) => (
              <div
                key={cat.category}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm truncate">{cat.category}</span>
                </div>
                <span className="text-sm font-medium">{cat.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}

export function ModelStatusWidget() {
  const user = useUser();
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    in_production: 0,
    revisions: 0,
    approved: 0,
    approved_by_client: 0,
    delivered_by_artist: 0,
  });
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStatusCounts() {
      if (!user?.metadata?.client) return;
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id, status, article_id, product_name")
        .eq("client", user.metadata.client);
      if (!error && data) {
        const newCounts: Record<StatusKey, number> = {
          in_production: 0,
          revisions: 0,
          approved: 0,
          approved_by_client: 0,
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const rawStatus = (row.status || "") as string;
          const mapped = (
            rawStatus === "not_started" ? "in_production" : rawStatus
          ) as StatusKey;
          if (mapped in newCounts) newCounts[mapped]++;
        }

        // Add detailed counting debug

        for (const row of data) {
          const status = (row.status || "") as string;

          const mapped = (
            status === "not_started" ? "in_production" : status
          ) as StatusKey;
          if (mapped in newCounts) {
          } else {
          }
        }

        // For clients, show delivered_by_artist as "In Production" instead of "Waiting for Approval"
        // This gives clients a cleaner view without internal workflow statuses
        if (user?.metadata?.role === "client") {
          newCounts.in_production += newCounts.delivered_by_artist;
          newCounts.delivered_by_artist = 0;
        }

        setCounts(newCounts);
        setProducts(data);
      }
    }
    fetchStatusCounts();
  }, [user?.metadata?.client, user?.metadata?.role]);

  return null;
}

export function StatusPieChartWidget() {
  const user = useUser();
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    in_production: 0,
    revisions: 0,
    approved: 0,
    approved_by_client: 0,
    delivered_by_artist: 0,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchStatusCounts() {
      if (!user?.metadata?.client) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id, status")
        .eq("client", user.metadata.client);
      if (!error && data) {
        const newCounts: Record<StatusKey, number> = {
          in_production: 0,
          revisions: 0,
          approved: 0,
          approved_by_client: 0,
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const rawStatus = (row.status || "") as string;
          const mapped = (
            rawStatus === "not_started" ? "in_production" : rawStatus
          ) as StatusKey;
          if (mapped in newCounts) newCounts[mapped]++;
        }

        // Add detailed counting debug

        for (const row of data) {
          const status = row.status as StatusKey;

          if (status in newCounts) {
          } else {
          }
        }

        // For clients, show delivered_by_artist as "In Production" instead of "Waiting for Approval"
        // This gives clients a cleaner view without internal workflow statuses
        if (user?.metadata?.role === "client") {
          newCounts.in_production += newCounts.delivered_by_artist;
          newCounts.delivered_by_artist = 0;
        }

        setCounts(newCounts);
      }
      setLoading(false);
    }
    fetchStatusCounts();
  }, [user?.metadata?.client, user?.metadata?.role]);

  // Calculate total for percentage calculation
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const chartData = Object.entries(STATUS_LABELS)
    .filter(([key]) => {
      // Hide "Delivered by Artist" for clients since it's shown as "In Production"
      if (user?.metadata?.role === "client" && key === "delivered_by_artist") {
        return false;
      }
      return true;
    })
    .map(([key, label]) => {
      const count = counts[key as StatusKey];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const displayLabel =
        user?.metadata?.role === "client" && key === "approved"
          ? "New Upload"
          : label;
      const color =
        user?.metadata?.role === "client" && key === "approved"
          ? "#1b22e833"
          : getStatusColor(key as StatusKey);
      return {
        name: displayLabel,
        value: count,
        percentage,
        key: key as StatusKey,
        color,
      };
    });

  return (
    <Card className="p-0 rounded-2xl bg-transparent w-full mx-auto flex flex-col items-center border-0 shadow-none">
      <div className="w-full px-4 pt-4 text-primary">
        <QAHeader
          icon={Activity}
          title="Model Status Distribution "
          subtitle="Your assets by status"
        />
      </div>

      {chartData.every((entry) => entry.value === 0) ? (
        <div className=" text-center text-muted-foreground">
          <span className="text-2xl">📊</span>
          <div className="mt-2 font-medium">No data to display yet.</div>
          <div className="text-xs">
            Upload assets to see your status distribution.
          </div>
        </div>
      ) : (
        <CardContent className=" w-full">
          <div className="group relative overflow-hidden rounded-2xl p-8 w-full grid grid-cols-2 items-center justify-center gap-6">
            <div className="absolute inset-0 opacity-5 bg-foreground/5 rounded-2xl"></div>

            {/* Left Column */}
            <div className="relative flex flex-col gap-3 min-w-[160px] select-none">
              {chartData
                .slice(0, Math.ceil(chartData.length / 2))
                .map((entry, index) => (
                  <>
                    <div
                      key={entry.key}
                      className="flex flex-col md:flex-row items-center gap-3"
                    >
                      <span
                        className="inline-block w-4 h-4 rounded-full"
                        style={{ background: entry.color as string }}
                      />
                      <span className="font-medium text-sm flex-1 text-muted/80">
                        {entry.name}
                      </span>
                      <span className="pl-6 font-medium text-muted/80">
                        {entry.percentage}%
                      </span>
                    </div>
                    {index !== Math.ceil(chartData.length / 2) - 1 && (
                      <Separator className="w-full bg-muted/40" />
                    )}
                  </>
                ))}
            </div>

            {/* Right Column */}
            <div className="relative flex flex-col gap-3 min-w-[60px] select-none">
              {chartData
                .slice(Math.ceil(chartData.length / 2))
                .map((entry, index) => (
                  <>
                    <div
                      key={entry.key}
                      className="flex flex-col md:flex-row items-center gap-3"
                    >
                      <span
                        className="inline-block w-4 h-4 rounded-full"
                        style={{ background: entry.color as string }}
                      />
                      <span className="font-medium text-sm flex-1 text-muted/80">
                        {entry.name}
                      </span>
                      <span className="pl-6 font-medium text-muted/80">
                        {entry.percentage}%
                      </span>
                    </div>
                    {index !==
                      chartData.slice(Math.ceil(chartData.length / 2)).length -
                        1 && (
                      <Separator className="w-full hidden md:block bg-muted/40" />
                    )}
                  </>
                ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Client-focused action center widget
export function ClientActionCenterWidget() {
  const user = useUser();
  const router = useRouter();
  const [waitingForApproval, setWaitingForApproval] = useState<any[]>([]);
  const [readyForRevision, setReadyForRevision] = useState<any[]>([]);
  const [totals, setTotals] = useState({ total: 0, approved_by_client: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClientQueues = async () => {
      if (!user?.metadata?.client) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id, product_name, article_id, status, created_at")
        .eq("client", user.metadata.client)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const waiting = data.filter((a) => a.status === "approved");
        const revisions = data.filter((a) => a.status === "revisions");
        const approvedByClient = data.filter(
          (a) => a.status === "approved_by_client"
        );

        setWaitingForApproval(waiting.slice(0, 5));
        setReadyForRevision(revisions.slice(0, 5));
        setTotals({
          total: data.length,
          approved_by_client: approvedByClient.length,
        });
      }
      setLoading(false);
    };

    fetchClientQueues();
  }, [user?.metadata?.client]);

  const completionPct = totals.total
    ? Math.round((totals.approved_by_client / totals.total) * 100)
    : 0;

  return (
    <Card className="p-0 rounded-2xl bg-transparent border-0 shadow-none">
      <div className="w-full px-4 pt-4">
        <QAHeader
          icon={Settings}
          title="Action Center"
          subtitle="What needs your attention"
        />
      </div>
      <CardContent className="space-y-4">
        <div className="group relative overflow-hidden rounded-2xl   p-4">
          <div className="absolute inset-0  bg-foreground/5 rounded-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div className="text-sm text-muted/90">Overall completion</div>
            <div className="text-sm font-semibold text-muted/80">
              {completionPct}%
            </div>
          </div>
          <div className="mt-2">
            <Progress value={completionPct} className="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="group relative overflow-hidden rounded-2xl  p-3 cursor-pointer"
            onClick={() => router.push("/client-review")}
          >
            <div className="absolute inset-0  bg-foreground/5 rounded-2xl"></div>
            <div className="flex items-center justify-between mb-2 text-muted/90 hover:text-muted/100">
              <div className="text-sm font-medium">New Upload</div>
              <Badge variant="default" className="bg-muted/35 text-foreground">
                {waitingForApproval.length}
              </Badge>
            </div>
            {loading ? (
              <div className="h-16 bg-muted animate-pulse rounded" />
            ) : waitingForApproval.length === 0 ? (
              <div className="text-xs text-muted/80">Nothing pending</div>
            ) : (
              <div className="space-y-2">
                {waitingForApproval.map((a) => (
                  <div
                    key={a.id}
                    className="group/item relative flex items-center justify-between text-sm cursor-pointer hover:text-muted/90"
                    onClick={() => router.push("/client-review")}
                  >
                    <div className="truncate">
                      <div className="font-medium truncate max-w-[180px]">
                        {a.product_name}
                      </div>
                      <div className="text-xs text-muted/90 font-mono">
                        {a.article_id}
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push("/client-review")}
                className="text-muted/90 hover:text-muted/100"
              >
                Review all
              </Button>
            </div>
          </div>

          <div
            className="group relative overflow-hidden rounded-2xl  p-3 cursor-pointer"
            onClick={() => router.push("/client-review")}
          >
            <div className="absolute inset-0  bg-foreground/5 rounded-2xl"></div>
            <div className="flex items-center justify-between mb-2 text-muted/90 hover:text-muted/100">
              <div className="text-sm font-medium">Ready for Revision</div>
              <Badge variant="default" className="bg-muted/35 text-foreground">
                {readyForRevision.length}
              </Badge>
            </div>
            {loading ? (
              <div className="h-16 bg-muted animate-pulse rounded" />
            ) : readyForRevision.length === 0 ? (
              <div className="text-xs text-muted/90">
                No revisions requested
              </div>
            ) : (
              <div className="space-y-2">
                {readyForRevision.map((a) => (
                  <div
                    key={a.id}
                    className="group/item relative flex items-center justify-between text-sm cursor-pointer hover:text-muted/90"
                    onClick={() => router.push("/client-review")}
                  >
                    <div className="truncate">
                      <div className="font-medium truncate max-w-[180px]">
                        {a.product_name}
                      </div>
                      <div className="text-xs text-muted/90 font-mono">
                        {a.article_id}
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                className="text-muted/90 hover:text-muted/100"
                onClick={() => router.push("/dashboard/client-review")}
              >
                Open review
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Admin widgets
export function AdminPipelineWidget() {
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    in_production: 0,
    revisions: 0,
    approved: 0,
    approved_by_client: 0,
    delivered_by_artist: 0,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fetchedRef = React.useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return; // avoid double-invoke in React 18 StrictMode
    fetchedRef.current = true;
    const fetchCounts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("status");
      if (!error && data) {
        const next: Record<StatusKey, number> = {
          in_production: 0,
          revisions: 0,
          approved: 0,
          approved_by_client: 0,
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const raw = (row.status || "") as string;
          const mapped = (
            raw === "not_started" ? "in_production" : raw
          ) as StatusKey;
          if (mapped in next) next[mapped]++;
        }
        setCounts(next);
      }
      setLoading(false);
    };
    fetchCounts();
  }, []);

  const items: Array<{
    key: StatusKey;
    label: string;
    color: string;
    value: number;
  }> = [
    {
      key: "in_production",
      label: STATUS_LABELS.in_production,
      color: getStatusColor("in_production"),
      value: counts.in_production,
    },
    {
      key: "revisions",
      label: STATUS_LABELS.revisions,
      color: getStatusColor("revisions"),
      value: counts.revisions,
    },
    {
      key: "approved",
      label: "New Upload",
      color: "#1b22e833",
      value: counts.approved,
    },
    {
      key: "approved_by_client",
      label: STATUS_LABELS.approved_by_client,
      color: getStatusColor("approved_by_client"),
      value: counts.approved_by_client,
    },
  ];

  const statusStyles: Record<
    StatusKey,
    {
      bgGradient: string;
      border: string;
      iconBg: string;
      accentBar: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    in_production: {
      bgGradient:
        "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50",
      border: "border-indigo-200 dark:border-indigo-800",
      iconBg: "bg-indigo-500 dark:bg-indigo-600",
      accentBar: "bg-indigo-500 dark:bg-indigo-600",
      icon: Activity,
    },
    revisions: {
      bgGradient:
        "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50",
      border: "border-amber-200 dark:border-amber-800",
      iconBg: "bg-amber-500 dark:bg-amber-600",
      accentBar: "bg-amber-500 dark:bg-amber-600",
      icon: RotateCcw,
    },
    approved: {
      bgGradient:
        "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50",
      border: "border-blue-200 dark:border-blue-800",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      accentBar: "bg-blue-500 dark:bg-blue-600",
      icon: CheckCircle,
    },
    approved_by_client: {
      bgGradient:
        "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50",
      border: "border-emerald-200 dark:border-emerald-800",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      accentBar: "bg-emerald-500 dark:bg-emerald-600",
      icon: ShieldCheck,
    },
    delivered_by_artist: {
      bgGradient:
        "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50",
      border: "border-purple-200 dark:border-purple-800",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      accentBar: "bg-purple-500 dark:bg-purple-600",
      icon: Package,
    },
  };

  const StatusStatCard: React.FC<{
    item: { key: StatusKey; label: string; color: string; value: number };
  }> = ({ item }) => {
    const animatedValue = useCountUp(item.value);
    const handleClick = () => {
      const statusParam = item.key;
      router.push(`/admin-review?status=${encodeURIComponent(statusParam)}`);
    };
    const style = statusStyles[item.key] || statusStyles.in_production;
    const Icon = style.icon;
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ease-out hover:shadow-md ${style.bgGradient} ${style.border} p-3 text-left focus:outline-none focus:ring-2 focus:ring-primary/20`}
        title={`View ${item.label}`}
      >
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-20 h-20 transform rotate-45 translate-x-8 -translate-y-8 bg-current rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 transform -rotate-45 -translate-x-6 translate-y-6 bg-current rounded-full"></div>
        </div>

        <div className="relative flex items-start justify-between mb-1">
          <div
            className={`p-2 rounded-lg ${style.iconBg} shadow-md shadow-black/10`}
          >
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="relative">
          <div className="text-xs text-muted-foreground mb-0.5">
            {item.label}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {animatedValue}
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${style.accentBar} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left`}
        ></div>
      </button>
    );
  };

  return (
    <Card className="p-4 rounded-lg bg-muted-background border-0 shadow-none h-full  ">
      <QAHeader
        icon={Activity}
        title="Production Pipeline"
        subtitle="Overview of asset statuses"
      />
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 mt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2 mt-2">
          {items.map((item) => (
            <StatusStatCard key={item.key} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdminQueuesWidget() {
  const router = useRouter();
  const [clientQueue, setClientQueue] = useState<
    Array<{ client: string; count: number; batches: number[] }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchQueues = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id, client, batch, status, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const map = new Map<
          string,
          { client: string; count: number; batches: number[] }
        >();
        data.forEach((a) => {
          const key = a.client || "Unknown";
          if (!map.has(key)) {
            map.set(key, { client: key, count: 0, batches: [] });
          }
          const entry = map.get(key)!;
          entry.count += 1;
          if (typeof a.batch === "number" && !entry.batches.includes(a.batch)) {
            entry.batches.push(a.batch);
          }
        });
        const grouped = Array.from(map.values()).map((g) => ({
          ...g,
          batches: g.batches.sort((a, b) => a - b),
        }));
        setClientQueue(grouped);
      }
      setLoading(false);
    };
    fetchQueues();
  }, []);

  const List = () => {
    const visible = showAll ? clientQueue : clientQueue.slice(0, 5);
    return (
      <div className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50 p-3 transition-all duration-300 ease-out">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-20 h-20 transform rotate-45 translate-x-8 -translate-y-8 bg-current rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 transform -rotate-45 -translate-x-6 translate-y-6 bg-current rounded-full"></div>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">New Uploads</div>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
            {clientQueue.length}
          </Badge>
        </div>
        {loading ? (
          <div className="h-16 bg-muted animate-pulse rounded" />
        ) : clientQueue.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nothing here</div>
        ) : (
          <div className="space-y-1">
            {visible.map((g) => (
              <div
                key={g.client}
                className="group/item relative text-sm cursor-pointer rounded px-2 py-2 transition-all duration-200 hover:shadow-sm hover:-translate-y-[1px]"
                onClick={() =>
                  router.push(
                    `/admin-review?client=${encodeURIComponent(g.client)}`
                  )
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{g.client}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.count} assets
                      {g.batches.length > 0
                        ? ` • Batches: ${g.batches.join(", ")}`
                        : ""}
                    </div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500/60 transform scale-x-0 group-hover/item:scale-x-100 transition-transform duration-300 ease-out"></div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {clientQueue.length > 5 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAll((v) => !v)}
              className="gap-1"
            >
              {showAll ? (
                <>
                  Show less <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show all <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4 rounded-lg bg-muted-background border-0 shadow-none">
      <QAHeader
        icon={Folder}
        title="Client Queues"
        subtitle="New uploads grouped by client"
      />
      <div className="grid grid-cols-1 gap-4 mt-3">
        <List />
      </div>
    </Card>
  );
}
