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
  AlertTriangle,
  DollarSign,
  BarChart3,
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
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

// Helper function to get status color CSS variable
const getStatusColor = (status: StatusKey): string => {
  const statusColorMap = {
    not_started: "var(--status-not-started)",
    in_production: "var(--status-in-production)",
    revisions: "var(--status-revisions)",
    client_revision: "#DC2626", // red color for client revisions
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1">
        {actions.map((action) => {
          const spanTwoCols =
            user?.metadata?.role === "admin" &&
            action.name === "View Analytics";
          return (
            <div
              key={action.name}
              className={`group relative overflow-hidden rounded-2xl border border-border/50 dark:border-border/30 bg-gradient-to-t from-current/5 to-transparent dark:from-muted/20 dark:to-muted/30 p-4 sm:p-6 transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 cursor-pointer ${spanTwoCols ? "sm:col-span-2" : ""}`}
              onClick={action.action}
            >
              <div className="absolute inset-0 opacity-5"></div>

              <div className="relative flex items-center gap-3 sm:gap-4 mb-2">
                <div
                  className={`p-2 sm:p-3 rounded-xl ${action.iconBg} shadow-lg shadow-black/10 flex-shrink-0`}
                >
                  <action.icon
                    className={`h-4 w-4 sm:h-5 sm:w-5 ${action.iconColor}`}
                  />
                </div>
                <div className="flex-1 min-w-0 p-1 sm:p-2">
                  <p className="text-sm sm:text-base font-semibold truncate">
                    {action.name}
                  </p>
                  {action.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {action.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 sm:mt-3">
                <div
                  className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-3 bg-gradient-to-r ${action.color} hover:${action.hoverColor} text-white rounded-lg transition-all duration-300 ease-out group-hover:scale-105 shadow-lg shadow-black/10`}
                >
                  <span className="text-xs sm:text-sm font-medium leading-none">
                    Open
                  </span>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div
                className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${action.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left`}
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
    not_started: 0,
    in_production: 0,
    revisions: 0,
    client_revision: 0,
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
          not_started: 0,
          in_production: 0,
          revisions: 0,
          client_revision: 0,
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
    not_started: 0,
    in_production: 0,
    revisions: 0,
    client_revision: 0,
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
          not_started: 0,
          in_production: 0,
          revisions: 0,
          client_revision: 0,
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
      // Hide "not_started" and "revisions" statuses as they'll be merged into "in_production"
      if (key === "not_started" || key === "revisions") {
        return false;
      }
      // Hide "Delivered by Artist" for clients since it's shown as "In Production"
      if (user?.metadata?.role === "client" && key === "delivered_by_artist") {
        return false;
      }
      return true;
    })
    .map(([key, label]) => {
      let count = counts[key as StatusKey];

      // Merge "not_started" and "revisions" into "in_production"
      if (key === "in_production") {
        count += counts.not_started + counts.revisions;
      }

      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const displayLabel =
        user?.metadata?.role === "client" && key === "approved"
          ? "New Uploads"
          : label;
      const color =
        user?.metadata?.role === "client" && key === "approved"
          ? "#22C55E"
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
          <span className="text-4xl">📊</span>
          <div className="mt-2 font-medium">No data to display yet.</div>
          <div className="text-xs">
            Upload assets to see your status distribution.
          </div>
        </div>
      ) : (
        <CardContent className=" w-full">
          <div className="group relative overflow-hidden rounded-2xl    w-full flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="absolute inset-0 opacity-5"></div>
            <div className="relative w-64 h-64 pr-6  pointer-events-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    cornerRadius={8}
                    isAnimationActive={true}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color as string}
                      />
                    ))}
                  </Pie>
                  {/* Center text showing total assets */}
                  <text
                    x="50%"
                    y="45%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-3xl font-bold fill-foreground"
                  >
                    {total}
                  </text>
                  <text
                    x="50%"
                    y="55%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-sm fill-muted-foreground"
                  >
                    Total Assets
                  </text>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      fontSize: 14,
                      color: "#111827",
                    }}
                    formatter={(value: number, name: string) => {
                      const entry = chartData.find(
                        (item) => item.name === name
                      );
                      const percentage = entry ? entry.percentage : 0;
                      return [`${percentage}%`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="relative flex flex-col pl-4 gap-3 min-w-[160px] select-none">
              {chartData.map((entry, index) => (
                <>
                  <div key={entry.key} className="flex items-center gap-3">
                    <span
                      className="inline-block w-4 h-4 rounded-full"
                      style={{ background: entry.color as string }}
                    />
                    <span className="font-medium text-sm flex-1">
                      {entry.name}
                    </span>
                    <span className="pl-6 font-medium">
                      {entry.percentage}%
                    </span>
                  </div>
                  {index !== chartData.length - 1 && (
                    <Separator className="w-full" />
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
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const revisions = data.filter(
          (a) => a.status === "revisions" || a.status === "client_revision"
        );
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
    <Card className="p-0 rounded-2xl bg-transparent  ">
      <div className="w-full px-4 pt-4">
        <QAHeader
          icon={Settings}
          title="Action Center"
          subtitle="What needs your attention"
        />
      </div>
      <CardContent className="space-y-4">
        <div className="group relative overflow-hidden rounded-2xl   bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 p-4">
          <div className="absolute inset-0 opacity-5"></div>
          <div className="relative flex items-center justify-between">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              Overall completion
            </div>
            <div className="text-sm font-semibold">{completionPct}%</div>
          </div>
          <div className="mt-2">
            <Progress value={completionPct} className="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div
            className="group relative overflow-hidden rounded-2xl  bg-gradient-to-br from-green-80 to-green-100 dark:from-green-950/50 dark:to-green-900/50 p-3 cursor-pointer"
            onClick={() => router.push("/client-review?status=approved")}
          >
            <div className="absolute inset-0 opacity-5 w-full h-full"></div>
            <div className="flex items-center justify-between mb-2 w-full">
              <div className="text-sm font-medium">New Uploads</div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {waitingForApproval.length}
              </Badge>
            </div>
            {loading ? (
              <div className="h-16 bg-muted animate-pulse rounded" />
            ) : waitingForApproval.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nothing pending
              </div>
            ) : (
              <div className="space-y-2 w-full">
                {waitingForApproval.map((a) => (
                  <div
                    key={a.id}
                    className="group/item relative flex items-center justify-between text-sm cursor-pointer"
                    onClick={() =>
                      router.push("/client-review?status=approved")
                    }
                  >
                    <div className="truncate w-full">
                      <div className="font-medium truncate max-w-[180px]">
                        {a.product_name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
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
                variant="outline"
                className=""
                onClick={() => router.push("/client-review?status=approved")}
              >
                Review all
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
    not_started: 0,
    in_production: 0,
    revisions: 0,
    client_revision: 0,
    approved: 0,
    approved_by_client: 0,
    delivered_by_artist: 0,
  });
  const [unallocatedCount, setUnallocatedCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fetchedRef = React.useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return; // avoid double-invoke in React 18 StrictMode
    fetchedRef.current = true;
    const fetchCounts = async () => {
      setLoading(true);

      // Fetch asset statuses
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("status");

      if (!error && data) {
        const next: Record<StatusKey, number> = {
          not_started: 0,
          in_production: 0,
          revisions: 0,
          client_revision: 0,
          approved: 0,
          approved_by_client: 0,
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const raw = (row.status || "") as string;
          const mapped = raw as StatusKey;
          if (mapped in next) next[mapped]++;
        }
        setCounts(next);
      }

      // Fetch unallocated assets count
      const { data: assignedAssets, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("role", "modeler");

      if (!assignmentError && assignedAssets) {
        const assignedAssetIds = assignedAssets.map((a) => a.asset_id);

        const { data: allAssets, error: allAssetsError } = await supabase
          .from("onboarding_assets")
          .select("id");

        if (!allAssetsError && allAssets) {
          const unallocated = allAssets.filter(
            (asset) => !assignedAssetIds.includes(asset.id)
          );
          setUnallocatedCount(unallocated.length);
        }
      }

      setLoading(false);
    };
    fetchCounts();
  }, []);

  const items: Array<{
    key: StatusKey | "unallocated";
    label: string;
    color: string;
    value: number;
  }> = [
    {
      key: "unallocated",
      label: "Not Allocated",
      color: "#dc2626",
      value: unallocatedCount,
    },
    {
      key: "not_started",
      label: STATUS_LABELS.not_started,
      color: getStatusColor("not_started"),
      value: counts.not_started,
    },
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
      key: "client_revision",
      label: STATUS_LABELS.client_revision,
      color: getStatusColor("client_revision"),
      value: counts.client_revision,
    },
    {
      key: "approved",
      label: "New Upload",
      color: "#22C55E",
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
    StatusKey | "unallocated",
    {
      bgGradient: string;
      border: string;
      iconBg: string;
      accentBar: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    unallocated: {
      bgGradient:
        "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50",
      border: "border-red-200 dark:border-none",
      iconBg: "bg-red-500 dark:bg-red-600",
      accentBar: "bg-red-500 dark:bg-red-600",
      icon: AlertTriangle,
    },
    not_started: {
      bgGradient:
        "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/50",
      border: "border-gray-200 dark:border-none",
      iconBg: "bg-gray-500 dark:bg-gray-600",
      accentBar: "bg-gray-500 dark:bg-gray-600",
      icon: Package,
    },
    in_production: {
      bgGradient:
        "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50",
      border: "border-indigo-200 dark:border-none",
      iconBg: "bg-indigo-500 dark:bg-indigo-600",
      accentBar: "bg-indigo-500 dark:bg-indigo-600",
      icon: Activity,
    },
    revisions: {
      bgGradient:
        "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50",
      border: "border-amber-200 dark:border-none",
      iconBg: "bg-amber-500 dark:bg-amber-600",
      accentBar: "bg-amber-500 dark:bg-amber-600",
      icon: RotateCcw,
    },
    client_revision: {
      bgGradient:
        "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50",
      border: "border-red-200 dark:border-none",
      iconBg: "bg-red-500 dark:bg-red-600",
      accentBar: "bg-red-500 dark:bg-red-600",
      icon: Eye,
    },
    approved: {
      bgGradient:
        "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50",
      border: "border-blue-200 dark:border-none",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      accentBar: "bg-blue-500 dark:bg-blue-600",
      icon: CheckCircle,
    },
    approved_by_client: {
      bgGradient:
        "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50",
      border: "border-emerald-200 dark:border-none",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      accentBar: "bg-emerald-500 dark:bg-emerald-600",
      icon: ShieldCheck,
    },
    delivered_by_artist: {
      bgGradient:
        "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50",
      border: "border-purple-200 dark:border-none",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      accentBar: "bg-purple-500 dark:bg-purple-600",
      icon: Package,
    },
  };

  const StatusStatCard: React.FC<{
    item: {
      key: StatusKey | "unallocated";
      label: string;
      color: string;
      value: number;
    };
  }> = ({ item }) => {
    const animatedValue = useCountUp(item.value);
    const handleClick = () => {
      if (item.key === "unallocated") {
        router.push("/admin-review?status=unallocated");
      } else {
        const statusParam = item.key;
        router.push(`/admin-review?status=${encodeURIComponent(statusParam)}`);
      }
    };
    const style = statusStyles[item.key] || statusStyles.in_production;
    const Icon = style.icon;
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`cursor-pointer group relative overflow-hidden rounded-lg border transition-all duration-200 ease-out hover:shadow-md ${style.bgGradient} ${style.border} p-2 text-left focus:outline-none focus:ring-2 focus:ring-primary/20 h-16`}
        title={`View ${item.label}`}
      >
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-12 h-12 transform rotate-45 translate-x-4 -translate-y-4 bg-current rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 transform -rotate-45 -translate-x-3 translate-y-3 bg-current rounded-full"></div>
        </div>

        <div className="relative flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            <div
              className={`p-1 rounded ${style.iconBg} shadow-sm shadow-black/10`}
            >
              <Icon className="h-3 w-3 text-white" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground leading-tight">
                {item.label}
              </div>
              <div className="text-lg font-bold text-foreground leading-tight">
                {animatedValue}
              </div>
            </div>
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-muted animate-pulse rounded-md cursor-pointer"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mt-2">
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
      <div className="group relative overflow-hidden rounded-2xl  border-indigo-200  bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50 p-3 transition-all duration-300 ease-out">
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

export function QAStatisticsWidget() {
  const [stats, setStats] = useState({
    totalQAs: 0,
    totalReviews: 0,
    totalApprovals: 0,
    averageReviewsPerQA: 0,
    averageApprovalsPerQA: 0,
    topQA: { email: "", reviews: 0, approvals: 0 },
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Use hooks at the top level to avoid Rules of Hooks violations
  const animatedTotalQAs = useCountUp(stats.totalQAs);
  const animatedTotalReviews = useCountUp(stats.totalReviews);
  const animatedTotalApprovals = useCountUp(stats.totalApprovals);
  const animatedAverageReviews = useCountUp(stats.averageReviewsPerQA);

  useEffect(() => {
    const fetchQAStats = async () => {
      try {
        // Calculate date range for last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        // 1. Get all QA users
        const { data: qaUsers, error: qaError } = await supabase
          .from("profiles")
          .select("id, email, title")
          .eq("role", "qa");

        if (qaError) throw qaError;

        if (!qaUsers || qaUsers.length === 0) {
          setStats({
            totalQAs: 0,
            totalReviews: 0,
            totalApprovals: 0,
            averageReviewsPerQA: 0,
            averageApprovalsPerQA: 0,
            topQA: { email: "No QAs", reviews: 0, approvals: 0 },
          });
          setLoading(false);
          return;
        }

        const qaIds = qaUsers.map((qa) => qa.id);

        // 2. Get revision history (QA sends for revision) for all QAs
        const { data: revisionHistory, error: revisionError } = await supabase
          .from("revision_history")
          .select("created_at, created_by")
          .in("created_by", qaIds)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        if (revisionError) throw revisionError;

        // 3. Get comments made by QAs
        const { data: qaComments, error: commentError } = await supabase
          .from("asset_comments")
          .select("created_at, created_by")
          .in("created_by", qaIds)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        if (commentError) throw commentError;

        // 4. Get annotations made by QAs
        const { data: qaAnnotations, error: annotationError } = await supabase
          .from("asset_annotations")
          .select("created_at, created_by")
          .in("created_by", qaIds)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        if (annotationError) throw annotationError;

        // 5. Get approval activities from activity log
        const { data: approvalActivities, error: approvalError } =
          await supabase
            .from("activity_log")
            .select("created_at, user_id, metadata")
            .in("user_id", qaIds)
            .eq("resource_type", "asset")
            .eq("type", "update")
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString());

        if (approvalError) throw approvalError;

        // Process data for each QA
        const qaStatsMap = new Map();
        qaUsers.forEach((qa) => {
          qaStatsMap.set(qa.id, {
            email: qa.email,
            reviews: 0,
            approvals: 0,
          });
        });

        // Count revision actions (reviews that resulted in revisions)
        revisionHistory?.forEach((revision) => {
          const qaStats = qaStatsMap.get(revision.created_by);
          if (qaStats) {
            qaStats.reviews += 1;
          }
        });

        // Count comments (review actions)
        qaComments?.forEach((comment) => {
          const qaStats = qaStatsMap.get(comment.created_by);
          if (qaStats) {
            qaStats.reviews += 1;
          }
        });

        // Count annotations (review actions)
        qaAnnotations?.forEach((annotation) => {
          const qaStats = qaStatsMap.get(annotation.created_by);
          if (qaStats) {
            qaStats.reviews += 1;
          }
        });

        // Count approvals from activity log
        approvalActivities?.forEach((activity: any) => {
          const newStatus = activity?.metadata?.new_status;
          if (
            newStatus === "approved" ||
            newStatus === "client_approved" ||
            newStatus === "delivered_by_artist"
          ) {
            const qaStats = qaStatsMap.get(activity.user_id);
            if (qaStats) {
              qaStats.reviews += 1;
              qaStats.approvals += 1;
            }
          }
        });

        // Calculate totals and find top QA
        let totalReviews = 0;
        let totalApprovals = 0;
        let topQA = { email: "", reviews: 0, approvals: 0 };

        qaStatsMap.forEach((qaStats) => {
          totalReviews += qaStats.reviews;
          totalApprovals += qaStats.approvals;

          if (qaStats.reviews > topQA.reviews) {
            topQA = qaStats;
          }
        });

        setStats({
          totalQAs: qaUsers.length,
          totalReviews,
          totalApprovals,
          averageReviewsPerQA:
            qaUsers.length > 0 ? Math.round(totalReviews / qaUsers.length) : 0,
          averageApprovalsPerQA:
            qaUsers.length > 0
              ? Math.round(totalApprovals / qaUsers.length)
              : 0,
          topQA,
        });
      } catch (error) {
        console.error("Error fetching QA stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQAStats();
  }, []);

  if (loading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="QA Statistics" icon={ShieldCheck} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </WidgetContainer>
    );
  }

  const qaStatsItems = [
    {
      title: "Total QAs",
      count: stats.totalQAs,
      animatedCount: animatedTotalQAs,
      color: "text-info",
      bg: "bg-info-muted",
      icon: Users,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Total Reviews",
      count: stats.totalReviews,
      animatedCount: animatedTotalReviews,
      color: "text-accent-purple",
      bg: "bg-purple-500/20",
      icon: Eye,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Total Approvals",
      count: stats.totalApprovals,
      animatedCount: animatedTotalApprovals,
      color: "text-success",
      bg: "bg-success-muted",
      icon: CheckCircle,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Avg Reviews/QA",
      count: stats.averageReviewsPerQA,
      animatedCount: animatedAverageReviews,
      color: "text-warning",
      bg: "bg-warning-muted",
      icon: TrendingUp,
      action: () => router.push("/qa-statistics"),
    },
  ];

  return (
    <WidgetContainer>
      <WidgetHeader title="QA Statistics" icon={ShieldCheck} />
      <div className="space-y-3">
        {qaStatsItems.map((item) => (
          <div
            key={item.title}
            onClick={item.action}
            className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-accent border border-border cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-sm font-medium">{item.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${item.color}`}>
                {item.animatedCount}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
        {stats.topQA.email && stats.topQA.email !== "No QAs" && (
          <div className="mt-3 p-3 bg-info-muted rounded-lg border border-info">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-foreground">
                Top Performer
              </span>
            </div>
            <p className="text-xs text-info">
              {stats.topQA.email} • {stats.topQA.reviews} reviews •{" "}
              {stats.topQA.approvals} approvals
            </p>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}

export function CostSummaryWidget() {
  const [stats, setStats] = useState({
    totalCost: 0,
    monthlyAverage: 0,
    topModelerCost: 0,
    topModelerEmail: "",
    totalCompletedAssets: 0,
    totalPendingAssets: 0,
    costEfficiency: 0, // cost per completed asset
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Use hooks at the top level to avoid Rules of Hooks violations
  const animatedTotalCost = useCountUp(stats.totalCost);
  const animatedMonthlyAverage = useCountUp(stats.monthlyAverage);
  const animatedCompletedAssets = useCountUp(stats.totalCompletedAssets);
  const animatedCostEfficiency = useCountUp(stats.costEfficiency);

  useEffect(() => {
    const fetchCostStats = async () => {
      try {
        // Get all asset assignments for modelers
        const { data: assignments, error: assignmentsError } = await supabase
          .from("asset_assignments")
          .select("user_id, asset_id, price, allocation_list_id")
          .eq("role", "modeler");

        if (assignmentsError) throw assignmentsError;

        // Get modeler profiles
        const modelerIds = [
          ...new Set(assignments?.map((a) => a.user_id) || []),
        ];
        const { data: modelerProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", modelerIds)
          .eq("role", "modeler");

        if (profilesError) throw profilesError;

        // Create a map of modeler IDs to emails
        const modelerEmailMap = new Map(
          modelerProfiles?.map((profile) => [profile.id, profile.email]) || []
        );

        // Get allocation lists for bonus information
        const allocationListIds = [
          ...new Set(
            assignments
              ?.map((a) => a.allocation_list_id)
              .filter((id) => id !== null) || []
          ),
        ];
        const { data: allocationLists, error: listsError } = await supabase
          .from("allocation_lists")
          .select("id, bonus")
          .in("id", allocationListIds);

        if (listsError) throw listsError;

        // Create a map of allocation list IDs to bonus percentages
        const allocationBonusMap = new Map(
          allocationLists?.map((list) => [list.id, list.bonus || 0]) || []
        );

        // Get asset statuses to determine completed vs pending
        const assetIds = assignments?.map((a) => a.asset_id) || [];
        const { data: assets, error: assetsError } = await supabase
          .from("onboarding_assets")
          .select("id, status, created_at")
          .in("id", assetIds);

        if (assetsError) throw assetsError;

        // Calculate costs and stats
        let totalCost = 0;
        let totalCompletedAssets = 0;
        let totalPendingAssets = 0;
        const modelerCosts = new Map<string, { email: string; cost: number }>();
        const monthlyCosts = new Map<string, number>();

        assignments?.forEach((assignment) => {
          const asset = assets?.find((a) => a.id === assignment.asset_id);
          if (!asset) return;

          const basePrice = assignment.price || 0;
          const bonusPercentage =
            allocationBonusMap.get(assignment.allocation_list_id) || 0;
          const bonusAmount = (basePrice * bonusPercentage) / 100;
          const totalAssignmentCost = basePrice + bonusAmount;

          totalCost += totalAssignmentCost;

          // Track modeler costs
          const modelerKey = assignment.user_id;
          const modelerEmail =
            modelerEmailMap.get(assignment.user_id) || "Unknown";
          if (!modelerCosts.has(modelerKey)) {
            modelerCosts.set(modelerKey, { email: modelerEmail, cost: 0 });
          }
          modelerCosts.get(modelerKey)!.cost += totalAssignmentCost;

          // Track monthly costs
          if (asset.created_at) {
            const monthKey = new Date(asset.created_at)
              .toISOString()
              .substring(0, 7); // YYYY-MM
            monthlyCosts.set(
              monthKey,
              (monthlyCosts.get(monthKey) || 0) + totalAssignmentCost
            );
          }

          // Count completed vs pending assets
          if (
            asset.status === "approved" ||
            asset.status === "approved_by_client" ||
            asset.status === "delivered_by_artist"
          ) {
            totalCompletedAssets++;
          } else {
            totalPendingAssets++;
          }
        });

        // Find top modeler by cost
        let topModelerCost = 0;
        let topModelerEmail = "";
        modelerCosts.forEach((modeler) => {
          if (modeler.cost > topModelerCost) {
            topModelerCost = modeler.cost;
            topModelerEmail = modeler.email;
          }
        });

        // Calculate monthly average
        const monthlyAverage =
          monthlyCosts.size > 0
            ? Array.from(monthlyCosts.values()).reduce(
                (sum, cost) => sum + cost,
                0
              ) / monthlyCosts.size
            : 0;

        // Calculate cost efficiency (cost per completed asset)
        const costEfficiency =
          totalCompletedAssets > 0 ? totalCost / totalCompletedAssets : 0;

        setStats({
          totalCost: Math.round(totalCost),
          monthlyAverage: Math.round(monthlyAverage),
          topModelerCost: Math.round(topModelerCost),
          topModelerEmail,
          totalCompletedAssets,
          totalPendingAssets,
          costEfficiency: Math.round(costEfficiency * 100) / 100, // Round to 2 decimal places
        });
      } catch (error) {
        console.error("Error fetching cost stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCostStats();
  }, []);

  if (loading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="Cost Summary" icon={DollarSign} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </WidgetContainer>
    );
  }

  const costStatsItems = [
    {
      title: "Total Cost",
      count: stats.totalCost,
      animatedCount: animatedTotalCost,
      color: "text-red-600",
      bg: "bg-red-500/20",
      icon: DollarSign,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
    {
      title: "Monthly Avg",
      count: stats.monthlyAverage,
      animatedCount: animatedMonthlyAverage,
      color: "text-blue-600",
      bg: "bg-blue-500/20",
      icon: TrendingUp,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
    {
      title: "Completed Assets",
      count: stats.totalCompletedAssets,
      animatedCount: animatedCompletedAssets,
      color: "text-green-600",
      bg: "bg-green-500/20",
      icon: CheckCircle,
      action: () => router.push("/production/cost-tracking"),
    },
    {
      title: "Cost/Asset",
      count: stats.costEfficiency,
      animatedCount: animatedCostEfficiency,
      color: "text-purple-600",
      bg: "bg-purple-500/20",
      icon: BarChart3,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
  ];

  return (
    <WidgetContainer>
      <WidgetHeader title="Cost Summary" icon={DollarSign} />
      <div className="space-y-3">
        {costStatsItems.map((item) => (
          <div
            key={item.title}
            onClick={item.action}
            className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-accent border border-border cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-sm font-medium">{item.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${item.color}`}>
                {item.prefix || ""}
                {item.animatedCount}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
        {stats.topModelerEmail && (
          <div className="mt-3 p-3 bg-error-muted rounded-lg border border-error">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-error" />
              <span className="text-sm font-medium text-foreground">
                Highest Cost
              </span>
            </div>
            <p className="text-xs text-error">
              {stats.topModelerEmail} • €{stats.topModelerCost} total cost
            </p>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
