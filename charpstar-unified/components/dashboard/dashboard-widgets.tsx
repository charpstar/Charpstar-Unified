"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAssets } from "@/hooks/use-assets";
import { useUser } from "@/contexts/useUser";
import { Button } from "@/components/ui/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { STATUS_LABELS, type StatusKey } from "@/lib/constants";

// QA-style header used across widgets for consistent look

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
    <div className="relative">
      {/* Enhanced Widget Container with Multi-Layer Depth */}
      <div className="relative bg-card rounded-3xl shadow-[0_8px_32px_hsl(var(--background),0.08)] dark:shadow-[0_8px_32px_hsl(var(--background),0.3)]">
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

        {/* Header with enhanced styling and depth */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Profile</h3>
              <p className="text-sm text-muted-foreground">
                Your account overview
              </p>
            </div>
          </div>
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
        </div>

        <div className="p-6 pt-2 space-y-6">
          {/* Profile Header - Enhanced with Multi-Layer Depth */}
          <div className="group relative">
            {/* Multi-layer background for depth */}
            <div className="absolute inset-0 bg-muted/30 rounded-2xl" />
            <div className="absolute inset-0 bg-background/50 rounded-2xl" />

            {/* Main profile card with enhanced depth */}
            <div className="relative bg-card/50 rounded-2xl p-6 border border-border/50 shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300">
              {/* Inner highlight for depth */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="relative flex items-start gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-[0_4px_16px_hsl(var(--primary),0.1)]">
                    <AvatarImage
                      src={user?.avatar_url || user?.metadata?.avatar_url}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center shadow-sm">
                    <span className="text-xs text-white">✓</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg truncate text-foreground">
                      {userName}
                    </h3>
                    <span className="text-2xl">{roleData.icon}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {userEmail}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        userRole === "admin" ? "destructive" : "secondary"
                      }
                      className="text-xs"
                    >
                      {roleData.title}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      {roleData.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom accent line with enhanced animation */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20 rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left" />
            </div>
          </div>

          {/* Role Description - Enhanced with depth */}
          <div className="group relative">
            <div className="absolute inset-0 bg-muted/20 rounded-xl" />
            <div className="relative bg-card/30 rounded-xl p-4 border border-border/30">
              <p className="text-sm text-muted-foreground">
                {roleData.description}
              </p>
            </div>
          </div>

          {/* Stats Grid - Enhanced with Multi-Layer Depth */}
          <div className="grid grid-cols-3 gap-3">
            {roleData.stats.map((stat, index) => (
              <div key={index} className="group relative">
                {/* Multi-layer background for depth */}
                <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                <div className="absolute inset-0 bg-background/30 rounded-xl" />

                {/* Main stat card with enhanced depth */}
                <div className="relative bg-card/30 rounded-xl p-4 text-center border border-border/30 shadow-[0_2px_12px_hsl(var(--background),0.04)] dark:shadow-[0_2px_12px_hsl(var(--background),0.2)] hover:shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:hover:shadow-[0_4px_20px_hsl(var(--background),0.3)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="text-lg font-bold text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {stat.label}
                  </div>
                  <div className="text-xs text-success font-medium">
                    {stat.trend}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity - Enhanced with Multi-Layer Depth */}
          <div className="group relative">
            {/* Multi-layer background for depth */}
            <div className="absolute inset-0 bg-muted/30 rounded-2xl" />
            <div className="absolute inset-0 bg-background/50 rounded-2xl" />

            {/* Main activity card with enhanced depth */}
            <div className="relative bg-card/50 rounded-2xl p-4 border border-border/50 shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300">
              {/* Inner highlight for depth */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="relative flex items-center gap-3 mb-2">
                <div className="p-2 bg-muted rounded-lg">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Recent Activity
                </span>
              </div>
              <p className="relative text-sm text-muted-foreground">
                {roleData.recentActivity}
              </p>

              {/* Bottom accent line with enhanced animation */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20 rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left" />
            </div>
          </div>

          {/* Role Overview for Admins - Enhanced with depth */}
          {userRole === "admin" && roleData.roleOverview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Platform Overview
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* QA Overview - Enhanced */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                  <div className="relative bg-card/30 rounded-xl p-4 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🔍</span>
                      <span className="text-sm font-medium text-foreground">
                        Quality Assurance
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {roleData.roleOverview.qa.totalUsers} users
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.qa.modelsReviewed}
                        </div>
                        <div className="text-muted-foreground">Reviewed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.qa.issuesFound}
                        </div>
                        <div className="text-muted-foreground">Issues</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.qa.approvalRate}
                        </div>
                        <div className="text-muted-foreground">Approval</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modelers Overview - Enhanced */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                  <div className="relative bg-card/30 rounded-xl p-4 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎨</span>
                      <span className="text-sm font-medium text-foreground">
                        3D Modelers
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {roleData.roleOverview.modelers.totalUsers} users
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.modelers.modelsCreated}
                        </div>
                        <div className="text-muted-foreground">Created</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.modelers.categories}
                        </div>
                        <div className="text-muted-foreground">Categories</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.modelers.avgQuality}
                        </div>
                        <div className="text-muted-foreground">Quality</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customers Overview - Enhanced */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                  <div className="relative bg-card/30 rounded-xl p-4 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">👤</span>
                      <span className="text-sm font-medium text-foreground">
                        Customers
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {roleData.roleOverview.client.totalUsers} users
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.client.modelsViewed}
                        </div>
                        <div className="text-muted-foreground">Viewed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.client.downloads}
                        </div>
                        <div className="text-muted-foreground">Downloads</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {roleData.roleOverview.client.favorites}
                        </div>
                        <div className="text-muted-foreground">Favorites</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions - Enhanced with depth */}
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
      </div>
    </div>
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
    ...(user?.metadata?.role !== "qa" ? [] : []),
    // Settings - hide for QA users
    ...(user?.metadata?.role !== "qa" ? [] : []),
  ];

  return (
    <div className="relative h-full ">
      {/* Enhanced Widget Container with Multi-Layer Depth */}
      <div className="relative min-h-full bg-card rounded-3xl shadow-[0_8px_32px_hsl(var(--background),0.08)] dark:shadow-[0_8px_32px_hsl(var(--background),0.3)]">
        {/* Inner shadow for depth */}
        <div className="absolute inset-0  min-h-full rounded-3xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

        {/* Header with enhanced styling and depth */}
        <div className="flex items-center gap-3 p-6 pb-4 min-h-full">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Quick Actions</h3>
            <p className="text-sm text-muted-foreground">
              Common tools and workflows
            </p>
          </div>
        </div>

        <div className="p-6 pt-22 min-h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((action) => {
              const spanTwoCols =
                user?.metadata?.role === "admin" &&
                action.name === "View Analytics";
              return (
                <div
                  key={action.name}
                  className={`group relative ${spanTwoCols ? "sm:col-span-2" : ""}`}
                >
                  {/* Multi-layer background for depth */}
                  <div className="absolute inset-0 bg-muted/30 rounded-2xl" />
                  <div className="absolute inset-0 bg-background/50 rounded-2xl" />

                  {/* Main action card with enhanced depth */}
                  <div
                    className="relative bg-card/50 rounded-2xl p-6 border border-border/50 shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                    onClick={action.action}
                  >
                    {/* Inner highlight for depth */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                    <div className="relative flex items-center gap-4 mb-4">
                      <div className="relative">
                        <div className="p-3 bg-muted rounded-xl shadow-[0_4px_16px_hsl(var(--background),0.1)]">
                          <action.icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="absolute inset-0 bg-muted/40 rounded-xl blur-sm -z-10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-foreground mb-1">
                          {action.name}
                        </h4>
                        {action.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {action.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Enhanced action button with depth */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                      <div className="relative bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-xl p-3 transition-all duration-200 group-hover:scale-105">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm font-medium text-primary">
                            Open
                          </span>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom accent line with enhanced animation */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20 rounded-b-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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

      let query = supabase
        .from("onboarding_assets")
        .select("id, status, article_id, product_name");

      // Filter by user's companies
      if (
        Array.isArray(user.metadata.client) &&
        user.metadata.client.length > 0
      ) {
        query = query.in("client", user.metadata.client);
      }

      const { data, error } = await query;
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

      let query = supabase.from("onboarding_assets").select("id, status");

      // Filter by user's companies
      if (
        Array.isArray(user.metadata.client) &&
        user.metadata.client.length > 0
      ) {
        query = query.in("client", user.metadata.client);
      }

      const { data, error } = await query;
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
    <div className="relative">
      {/* Enhanced Widget Container with Depth */}
      <div className="relative bg-card rounded-3xl shadow-[0_8px_32px_hsl(var(--background),0.08)] dark:shadow-[0_8px_32px_hsl(var(--background),0.3)]">
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

        {/* Header with enhanced styling */}
        <div className="flex items-center gap-3  p-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Model Status Distribution
            </h3>
            <p className="text-sm text-muted-foreground">
              Your assets by status
            </p>
          </div>
        </div>

        {chartData.every((entry) => entry.value === 0) ? (
          <div className="text-center py-12 px-6">
            <div className="relative mb-6">
              <div className="p-6 bg-muted/50 rounded-3xl mx-auto w-fit">
                <Activity className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="absolute inset-0 bg-muted/40 rounded-3xl blur-sm -z-10" />
            </div>
            <div className="text-lg font-semibold text-foreground mb-2">
              No data to display yet
            </div>
            <div className="text-sm text-muted-foreground">
              Upload assets to see your status distribution
            </div>
          </div>
        ) : (
          <div className="p-6 min-h-full">
            <div className="group relative">
              {/* Background layers for depth */}
              <div className="absolute inset-0 bg-muted/30 rounded-2xl" />
              <div className="absolute inset-0 bg-background/50 rounded-2xl" />

              {/* Main content card */}
              <div className="relative bg-card/50 rounded-2xl p-6 border border-border/50 shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)]">
                {/* Inner highlight */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                <div className="flex flex-col lg:flex-row items-center justify-center gap-8 h-full">
                  {/* Enhanced Chart Section */}
                  <div className="relative">
                    {/* Chart background with depth */}
                    <div className="absolute inset-0 bg-muted/20 rounded-full scale-110" />
                    <div className="relative w-64 h-64 p-4">
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
                          {/* Enhanced center text */}
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
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 12,
                              boxShadow:
                                "0 8px 32px hsl(var(--background), 0.2)",
                              fontSize: 14,
                              color: "hsl(var(--foreground))",
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
                  </div>

                  {/* Enhanced Legend Section */}
                  <div className="relative flex flex-col gap-4 min-w-[200px]">
                    <div className="absolute inset-0 bg-muted/20 rounded-xl" />
                    <div className="relative bg-card/30 rounded-xl p-4 border border-border/30">
                      <div className="space-y-3">
                        {chartData.map((entry, index) => (
                          <div key={entry.key} className="group/item">
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors duration-200">
                              <div className="relative">
                                <span
                                  className="inline-block w-4 h-4 rounded-full shadow-sm"
                                  style={{ background: entry.color as string }}
                                />
                                <div
                                  className="absolute inset-0 rounded-full opacity-20 blur-sm"
                                  style={{ background: entry.color as string }}
                                />
                              </div>
                              <span className="font-medium text-sm text-foreground flex-1">
                                {entry.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {entry.value}
                                </span>
                                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                  {entry.percentage}%
                                </span>
                              </div>
                            </div>
                            {index !== chartData.length - 1 && (
                              <div className="h-px bg-border/30 mx-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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

      let query = supabase
        .from("onboarding_assets")
        .select("id, product_name, article_id, status, created_at")
        .order("created_at", { ascending: false });

      // Filter by user's companies
      if (
        Array.isArray(user.metadata.client) &&
        user.metadata.client.length > 0
      ) {
        query = query.in("client", user.metadata.client);
      }

      const { data, error } = await query;

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
    <div className="relative">
      {/* Enhanced Widget Container with Depth */}
      <div className="relative bg-card rounded-3xl  shadow-[0_8px_32px_hsl(var(--background),0.08)] dark:shadow-[0_8px_32px_hsl(var(--background),0.3)]">
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

        {/* Header with enhanced styling */}
        <div className="flex items-center gap-3 p-6 ">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Action Center</h3>
            <p className="text-sm text-muted-foreground">
              What needs your attention
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 ">
          {/* Overall Completion - Enhanced with depth */}
          <div className="group relative">
            {/* Background layers for depth */}
            <div className="absolute inset-0 bg-muted/50 rounded-2xl" />
            <div className="absolute inset-0 bg-background/80 rounded-2xl" />

            {/* Main card with enhanced shadows */}
            <div className="relative bg-card rounded-2xl p-6 border border-border shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300">
              {/* Inner highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Overall Completion
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Project progress overview
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">
                    {completionPct}%
                  </div>
                  <div className="text-xs text-muted-foreground">completed</div>
                </div>
              </div>

              {/* Enhanced progress bar */}
              <div className="relative">
                <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_2px_8px_hsl(var(--primary),0.2)]"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-background/20 to-transparent" />
              </div>
            </div>
          </div>

          {/* New Uploads Section - Enhanced with depth */}
          <div className="group relative">
            {/* Background layers */}
            <div className="absolute inset-0 bg-muted/50 rounded-2xl" />
            <div className="absolute inset-0 bg-background/80 rounded-2xl" />

            <div
              className="relative bg-card rounded-2xl p-6 border border-border shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
              onClick={() => router.push("/client-review?status=approved")}
            >
              {/* Inner highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      New Uploads
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Items awaiting your review
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold border border-primary/20">
                    {waitingForApproval.length}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </div>
              ) : waitingForApproval.length === 0 ? (
                <div className="text-center py-6">
                  <div className="p-3 bg-muted/50 rounded-xl mx-auto w-fit mb-3">
                    <Settings className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nothing pending
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All caught up!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  {waitingForApproval.map((a) => (
                    <div
                      key={a.id}
                      className="group/item relative bg-muted/30 rounded-xl p-3 border border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/client-review?status=approved");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {a.product_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {a.article_id}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Enhanced action button */}
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full bg-background/50 hover:bg-background border-border hover:border-border/80 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/client-review?status=approved");
                  }}
                >
                  Review All Items
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

      // Fetch asset statuses (excluding transferred assets)
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("status")
        .eq("transferred", false);

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
          .select("id")
          .eq("transferred", false);

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
      iconBg: string;
      accentBar: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    unallocated: {
      iconBg: "bg-red-500/90 dark:bg-red-600/80",
      accentBar: "bg-red-500 dark:bg-red-400",
      icon: AlertTriangle,
    },
    not_started: {
      iconBg: "bg-gray-500/90 dark:bg-gray-600/80",
      accentBar: "bg-gray-500 dark:bg-gray-400",
      icon: Package,
    },
    in_production: {
      iconBg: "bg-indigo-500/90 dark:bg-indigo-600/80",
      accentBar: "bg-indigo-500 dark:bg-indigo-400",
      icon: Activity,
    },
    revisions: {
      iconBg: "bg-amber-500/90 dark:bg-amber-600/80",
      accentBar: "bg-amber-500 dark:bg-amber-400",
      icon: RotateCcw,
    },
    client_revision: {
      iconBg: "bg-red-500/90 dark:bg-red-600/80",
      accentBar: "bg-red-500 dark:bg-red-400",
      icon: Eye,
    },
    approved: {
      iconBg: "bg-blue-500/90 dark:bg-blue-600/80",
      accentBar: "bg-blue-500 dark:bg-blue-400",
      icon: CheckCircle,
    },
    approved_by_client: {
      iconBg: "bg-emerald-500/90 dark:bg-emerald-600/80",
      accentBar: "bg-emerald-500 dark:bg-emerald-400",
      icon: ShieldCheck,
    },
    delivered_by_artist: {
      iconBg: "bg-purple-500/90 dark:bg-purple-600/80",
      accentBar: "bg-purple-500 dark:bg-purple-400",
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
      <div
        onClick={handleClick}
        className="group relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300
          bg-gradient-to-br from-card/80 to-card/60
          shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
          hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
          hover:translate-y-[-2px]
          dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
          dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
          border border-border/20"
      >
        <div className="flex items-center gap-4">
          <div
            className={`relative p-3 rounded-xl ${style.iconBg} 
            shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
            dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]
            group-hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.15)]
            transition-shadow duration-300`}
          >
            <Icon className="h-5 w-5 text-white relative z-10" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
              {item.label}
            </span>
            <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-primary/50 to-transparent transition-all duration-300 rounded-full mt-0.5" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold text-foreground tabular-nums
            drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]
            group-hover:drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]
            transition-all duration-300"
          >
            {animatedValue}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">
            Production Pipeline
          </h3>
          <p className="text-sm text-muted-foreground">
            Overview of asset statuses
          </p>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <StatusStatCard key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
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

  if (loading) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Folder className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Client Queues</h3>
            <p className="text-sm text-muted-foreground">
              New uploads grouped by client
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const visible = showAll ? clientQueue : clientQueue.slice(0, 5);
  const totalAssets = clientQueue.reduce((sum, g) => sum + g.count, 0);

  const ClientQueueCard: React.FC<{
    item: { client: string; count: number; batches: number[] };
  }> = ({ item }) => {
    const animatedCount = useCountUp(item.count);
    return (
      <div
        onClick={() =>
          router.push(`/admin-review?client=${encodeURIComponent(item.client)}`)
        }
        className="group relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300
          bg-gradient-to-br from-card/80 to-card/60
          shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
          hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
          hover:translate-y-[-2px]
          dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
          dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
          border border-border/50"
      >
        <div className="flex items-center gap-4">
          <div
            className="relative p-3 rounded-xl bg-muted 
            shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
            dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]
            group-hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.15)]
            transition-shadow duration-300"
          >
            <Folder className="h-5 w-5 text-foreground relative z-10" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors block truncate">
              {item.client}
            </span>
            <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-primary/50 to-transparent transition-all duration-300 rounded-full mt-0.5" />
            {item.batches.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Batches: {item.batches.join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold text-foreground tabular-nums
            drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]
            group-hover:drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]
            transition-all duration-300"
          >
            {animatedCount}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
            <Folder className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Client Queues</h3>
          <p className="text-sm text-muted-foreground">
            New uploads grouped by client
          </p>
        </div>
      </div>
      {clientQueue.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No new uploads</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {visible.map((item) => (
              <ClientQueueCard key={item.client} item={item} />
            ))}
          </div>
          {clientQueue.length > 5 && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAll((v) => !v)}
                className="w-full gap-1.5"
              >
                {showAll ? (
                  <>
                    Show less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show all ({clientQueue.length}){" "}
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
          {totalAssets > 0 && (
            <div
              className="mt-4 p-4 rounded-xl relative overflow-hidden
              bg-gradient-to-br from-muted/80 to-muted/40
              shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
              dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2)]
              border border-border"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-1.5 rounded-lg bg-muted shadow-inner">
                    <Package className="h-4 w-4 text-foreground drop-shadow-sm" />
                  </div>
                  <span className="text-sm font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                    Total Assets
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-medium pl-8">
                  {totalAssets} assets pending from {clientQueue.length} clients
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
      <div className="h-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">QA Statistics</h3>
            <p className="text-sm text-muted-foreground">Performance metrics</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const qaStatsItems = [
    {
      title: "Total QAs",
      count: stats.totalQAs,
      animatedCount: animatedTotalQAs,
      color: "text-foreground",
      bg: "bg-muted",
      icon: Users,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Total Reviews",
      count: stats.totalReviews,
      animatedCount: animatedTotalReviews,
      color: "text-foreground",
      bg: "bg-muted",
      icon: Eye,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Total Approvals",
      count: stats.totalApprovals,
      animatedCount: animatedTotalApprovals,
      color: "text-foreground",
      bg: "bg-muted",
      icon: CheckCircle,
      action: () => router.push("/qa-statistics"),
    },
    {
      title: "Avg Reviews/QA",
      count: stats.averageReviewsPerQA,
      animatedCount: animatedAverageReviews,
      color: "text-foreground",
      bg: "bg-muted",
      icon: TrendingUp,
      action: () => router.push("/qa-statistics"),
    },
  ];

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">QA Statistics</h3>
          <p className="text-sm text-muted-foreground">Performance metrics</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {qaStatsItems.map((item) => (
          <div
            key={item.title}
            onClick={item.action}
            className="group relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300
              bg-gradient-to-br from-card/80 to-card/60
              shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
              hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
              hover:translate-y-[-2px]
              dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
              dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
              border border-border/20"
          >
            <div className="flex items-center gap-4">
              <div
                className={`relative p-3 rounded-xl ${item.bg} 
                shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
                dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]
                group-hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.15)]
                transition-shadow duration-300`}
              >
                <item.icon className={`h-5 w-5 ${item.color} relative z-10`} />
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                  {item.title}
                </span>
                <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-primary/50 to-transparent transition-all duration-300 rounded-full mt-0.5" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-2xl font-bold ${item.color} tabular-nums
                drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]
                group-hover:drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]
                transition-all duration-300`}
              >
                {item.animatedCount}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
            </div>
          </div>
        ))}
        {stats.topQA.email && stats.topQA.email !== "No QAs" && (
          <div
            className="mt-4 p-4 rounded-xl relative overflow-hidden
            bg-gradient-to-br from-muted/80 to-muted/40
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
            dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2)]
            border border-border"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-1.5 rounded-lg bg-muted shadow-inner">
                  <ShieldCheck className="h-4 w-4 text-foreground drop-shadow-sm" />
                </div>
                <span className="text-sm font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Top Performer
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-medium pl-8">
                {stats.topQA.email} • {stats.topQA.reviews} reviews •{" "}
                {stats.topQA.approvals} approvals
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Client Asset Count Widget
export function ClientAssetCountWidget() {
  const user = useUser();
  const [assetCounts, setAssetCounts] = useState<{
    [companyName: string]: {
      current: number;
      limit: number;
      changeLimit: number;
      changesUsed: number;
      changesRemaining: number;
    };
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientAssetCounts = async () => {
      if (!user?.metadata?.client) return;
      setLoading(true);

      try {
        const clientCompanies = Array.isArray(user.metadata.client)
          ? user.metadata.client
          : [user.metadata.client];

        // Get contract limits for each company
        const { data: contracts, error: contractsError } = await supabase
          .from("clients")
          .select("name, models_in_contract, change_percentage")
          .in("name", clientCompanies);

        if (contractsError) throw contractsError;

        // Query onboarding_assets table - count all except where transferred = true
        const { data: onboardingData, error: onboardingError } = await supabase
          .from("onboarding_assets")
          .select("client, transferred")
          .in("client", clientCompanies);

        if (onboardingError) throw onboardingError;

        // Query assets table - count all except where active = false
        const { data: assetsData, error: assetsError } = await supabase
          .from("assets")
          .select("client, active")
          .in("client", clientCompanies);

        if (assetsError) throw assetsError;

        // Get current year's asset changes
        const currentYear = new Date().getFullYear();
        const { data: changesData, error: changesError } = await supabase
          .from("asset_changes")
          .select("client, change_count")
          .in("client", clientCompanies)
          .eq("year", currentYear);

        if (changesError) throw changesError;

        // Count assets per company
        const counts: {
          [companyName: string]: {
            current: number;
            limit: number;
            changeLimit: number;
            changesUsed: number;
            changesRemaining: number;
          };
        } = {};

        clientCompanies.forEach((companyName) => {
          // Debug: Log the data for this company
          const companyOnboardingData = onboardingData?.filter(
            (item) => item.client === companyName
          );
          const companyAssetsData = assetsData?.filter(
            (item) => item.client === companyName
          );
          console.log(
            `Company: ${companyName}, Onboarding data:`,
            companyOnboardingData
          );
          console.log(
            `Company: ${companyName}, Assets data:`,
            companyAssetsData
          );

          // Filter onboarding_assets: exclude where transferred = true
          const onboardingCount =
            onboardingData?.filter(
              (item) =>
                item.client === companyName &&
                (item.transferred === false || item.transferred === null)
            ).length || 0;

          // Filter assets: exclude where active = false
          const assetsCount =
            assetsData?.filter(
              (item) =>
                item.client === companyName &&
                (item.active === true || item.active === null)
            ).length || 0;

          const contract = contracts?.find((c) => c.name === companyName);
          const changesUsed =
            changesData?.find((c) => c.client === companyName)?.change_count ||
            0;

          // Calculate change limit based on percentage of contract models
          const changeLimit =
            contract?.models_in_contract && contract?.change_percentage
              ? Math.floor(
                  (contract.models_in_contract * contract.change_percentage) /
                    100
                )
              : 0;

          counts[companyName] = {
            current: onboardingCount + assetsCount,
            limit: contract?.models_in_contract || 0,
            changeLimit,
            changesUsed,
            changesRemaining: Math.max(0, changeLimit - changesUsed),
          };
        });

        setAssetCounts(counts);
      } catch (error) {
        console.error("Error fetching client asset counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientAssetCounts();
  }, [user?.metadata?.client]);

  if (loading) {
    return (
      <WidgetContainer>
        <WidgetHeader title="Asset Usage" icon={Package} />
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </WidgetContainer>
    );
  }

  const totalCurrent = Object.values(assetCounts).reduce(
    (sum, count) => sum + count.current,
    0
  );
  const totalLimit = Object.values(assetCounts).reduce(
    (sum, count) => sum + count.limit,
    0
  );
  const totalChangeLimit = Object.values(assetCounts).reduce(
    (sum, count) => sum + count.changeLimit,
    0
  );
  const totalChangesUsed = Object.values(assetCounts).reduce(
    (sum, count) => sum + count.changesUsed,
    0
  );
  const totalChangesRemaining = Object.values(assetCounts).reduce(
    (sum, count) => sum + count.changesRemaining,
    0
  );
  const usagePercentage =
    totalLimit > 0 ? Math.round((totalCurrent / totalLimit) * 100) : 0;

  return (
    <div className="relative">
      {/* Enhanced Widget Container with Global CSS Variables */}
      <div className="relative bg-card rounded-3xl p-6  shadow-[0_8px_32px_hsl(var(--background),0.08)] dark:shadow-[0_8px_32px_hsl(var(--background),0.3)] ">
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

        {/* Header with global styling */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Asset Usage</h3>
            <p className="text-sm text-muted-foreground">
              Your contract overview
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Overall Usage - Using global variables */}
          <div className="group relative">
            {/* Background layers for depth */}
            <div className="absolute inset-0 bg-muted/50 rounded-2xl" />
            <div className="absolute inset-0 bg-background/80 rounded-2xl" />

            {/* Main card with global shadows */}
            <div className="relative bg-card rounded-2xl p-6 border border-border shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300">
              {/* Inner highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Total Usage
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Active models in your contract
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">
                    {usagePercentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    utilization
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-3xl font-bold text-foreground mb-1">
                  {totalCurrent}{" "}
                  <span className="text-lg font-medium text-muted-foreground">
                    / {totalLimit}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">models used</div>
              </div>

              {/* Enhanced progress bar */}
              <div className="relative">
                <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_2px_8px_hsl(var(--primary),0.2)]"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-background/20 to-transparent" />
              </div>
            </div>
          </div>

          {/* Changes Summary - Using global variables */}
          {totalChangeLimit > 0 && (
            <div className="group relative">
              {/* Background layers */}
              <div className="absolute inset-0 bg-muted/50 rounded-2xl" />
              <div className="absolute inset-0 bg-background/80 rounded-2xl" />

              <div className="relative bg-card rounded-2xl p-6 border border-border shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:shadow-[0_4px_20px_hsl(var(--background),0.2)] group-hover:shadow-[0_8px_32px_hsl(var(--background),0.12)] dark:group-hover:shadow-[0_8px_32px_hsl(var(--background),0.3)] transition-all duration-300">
                {/* Inner highlight */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-xl">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        Annual Changes
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Free changes per year
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">
                      {totalChangeLimit > 0
                        ? Math.round(
                            (totalChangesUsed / totalChangeLimit) * 100
                          )
                        : 0}
                      %
                    </div>
                    <div className="text-xs text-muted-foreground">used</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {totalChangesUsed}{" "}
                    <span className="text-lg font-medium text-muted-foreground">
                      / {totalChangeLimit}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {totalChangesRemaining} changes remaining this year
                  </div>
                </div>

                {/* Enhanced progress bar */}
                <div className="relative">
                  <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_2px_8px_hsl(var(--primary),0.2)]"
                      style={{
                        width: `${totalChangeLimit > 0 ? (totalChangesUsed / totalChangeLimit) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-background/20 to-transparent" />
                </div>
              </div>
            </div>
          )}

          {/* Per Company Breakdown - Using global variables */}
          <div className="space-y-3">
            {Object.entries(assetCounts).map(([companyName, counts]) => (
              <div
                key={companyName}
                className="group relative bg-card rounded-xl p-4 border border-border shadow-[0_2px_12px_hsl(var(--background),0.04)] dark:shadow-[0_2px_12px_hsl(var(--background),0.2)] hover:shadow-[0_4px_20px_hsl(var(--background),0.08)] dark:hover:shadow-[0_4px_20px_hsl(var(--background),0.3)] transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Subtle inner shadow */}
                <div className="absolute inset-0 rounded-xl shadow-[inset_0_1px_0_hsl(var(--background),0.1)] dark:shadow-[inset_0_1px_0_hsl(var(--background),0.05)] pointer-events-none" />

                <div className="relative flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                      <div className="text-sm font-semibold text-foreground">
                        {companyName}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {counts.current} / {counts.limit} models
                    </div>
                    {counts.changeLimit > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Changes: {counts.changesUsed} / {counts.changeLimit}{" "}
                        used ({counts.changesRemaining} remaining)
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground mb-1">
                      {counts.limit > 0
                        ? Math.round((counts.current / counts.limit) * 100)
                        : 0}
                      %
                    </div>
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: `${counts.limit > 0 ? Math.min((counts.current / counts.limit) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {Object.keys(assetCounts).length === 0 && (
            <div className="text-center py-8">
              <div className="relative mb-4">
                <div className="p-4 bg-muted rounded-2xl mx-auto w-fit">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="absolute inset-0 bg-muted/40 rounded-2xl blur-sm -z-10" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                No asset data available
              </p>
              <p className="text-xs text-muted-foreground">
                Contact your administrator to set up your contract
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
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
      <div className="h-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <DollarSign className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Cost Summary</h3>
            <p className="text-sm text-muted-foreground">Production costs</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const costStatsItems = [
    {
      title: "Total Cost",
      count: stats.totalCost,
      animatedCount: animatedTotalCost,
      color: "text-foreground",
      bg: "bg-muted",
      icon: DollarSign,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
    {
      title: "Monthly Avg",
      count: stats.monthlyAverage,
      animatedCount: animatedMonthlyAverage,
      color: "text-foreground",
      bg: "bg-muted",
      icon: TrendingUp,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
    {
      title: "Completed Assets",
      count: stats.totalCompletedAssets,
      animatedCount: animatedCompletedAssets,
      color: "text-foreground",
      bg: "bg-muted",
      icon: CheckCircle,
      action: () => router.push("/production/cost-tracking"),
    },
    {
      title: "Cost/Asset",
      count: stats.costEfficiency,
      animatedCount: animatedCostEfficiency,
      color: "text-foreground",
      bg: "bg-muted",
      icon: BarChart3,
      action: () => router.push("/production/cost-tracking"),
      prefix: "€",
    },
  ];

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Cost Summary</h3>
          <p className="text-sm text-muted-foreground">Production costs</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {costStatsItems.map((item) => (
          <div
            key={item.title}
            onClick={item.action}
            className="group relative flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300
              bg-gradient-to-br from-card/80 to-card/60
              shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
              hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
              hover:translate-y-[-2px]
              dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
              dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
              border border-border/50"
          >
            <div className="flex items-center gap-4">
              <div
                className={`relative p-3 rounded-xl ${item.bg} 
                shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
                dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]
                group-hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.15)]
                transition-shadow duration-300`}
              >
                <item.icon className={`h-5 w-5 ${item.color} relative z-10`} />
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                  {item.title}
                </span>
                <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-primary/50 to-transparent transition-all duration-300 rounded-full mt-0.5" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-2xl font-bold ${item.color} tabular-nums
                drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]
                group-hover:drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]
                transition-all duration-300`}
              >
                {item.prefix || ""}
                {item.animatedCount}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
            </div>
          </div>
        ))}
        {stats.topModelerEmail && (
          <div
            className="mt-4 p-4 rounded-xl relative overflow-hidden
            bg-gradient-to-br from-muted/80 to-muted/40
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
            dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2)]
            border border-border"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-1.5 rounded-lg bg-muted shadow-inner">
                  <DollarSign className="h-4 w-4 text-foreground drop-shadow-sm" />
                </div>
                <span className="text-sm font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Highest Cost
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-medium pl-8">
                {stats.topModelerEmail} • €{stats.topModelerCost} total cost
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UnallocatedModelersWidget() {
  const router = useRouter();
  const [unallocatedModelers, setUnallocatedModelers] = useState<
    Array<{ id: string; email: string; title?: string; created_at: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUnallocatedModelers = async () => {
      try {
        setLoading(true);

        // Get all modelers
        const { data: allModelers, error: modelersError } = await supabase
          .from("profiles")
          .select("id, email, title, created_at")
          .eq("role", "modeler")
          .order("created_at", { ascending: false });

        if (modelersError) {
          console.error("Error fetching modelers:", modelersError);
          setUnallocatedModelers([]);
          setLoading(false);
          return;
        }

        if (!allModelers || allModelers.length === 0) {
          setUnallocatedModelers([]);
          setLoading(false);
          return;
        }

        // Get all active allocation lists (status != "approved" or status is null)
        // Query allocation lists for modelers
        const { data: allLists, error: listsError } = await supabase
          .from("allocation_lists")
          .select("user_id, status")
          .eq("role", "modeler")
          .not("user_id", "is", null);

        if (listsError) {
          console.error("Error fetching allocation lists:", listsError);
          // Don't fail completely - just assume all lists are approved if query fails
          // This way we show all modelers (better to show more than less)
          setUnallocatedModelers(allModelers);
          setLoading(false);
          return;
        }

        // Filter to only active lists (status is null or status != "approved")
        const activeLists = (allLists || []).filter(
          (list) => !list.status || list.status !== "approved"
        );

        // Get set of modeler IDs who have active allocation lists
        const allocatedModelerIds = new Set(
          (activeLists || []).map((list) => list.user_id).filter(Boolean)
        );

        // Find modelers who don't have any active allocation lists
        const unallocated = allModelers.filter(
          (modeler) => modeler.id && !allocatedModelerIds.has(modeler.id)
        );

        setUnallocatedModelers(unallocated);
      } catch (error) {
        console.error("Error fetching unallocated modelers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUnallocatedModelers();
  }, []);

  // Calculate derived values - must be before any conditional returns to satisfy Rules of Hooks
  const count = unallocatedModelers.length;
  const animatedCount = useCountUp(count);

  if (loading) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Unallocated Modelers
            </h3>
            <p className="text-sm text-muted-foreground">
              Modelers without active allocation lists
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Unallocated Modelers
            </h3>
            <p className="text-sm text-muted-foreground">
              Modelers without active allocation lists
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center p-8 rounded-xl bg-muted/50 border border-border">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              All modelers have active allocation lists
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">
            Unallocated Modelers
          </h3>
          <p className="text-sm text-muted-foreground">
            Modelers without active allocation lists
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {animatedCount}
          </span>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto pr-2 -mr-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {unallocatedModelers.map((modeler) => (
          <button
            key={modeler.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (modeler.id && router) {
                router.push(`/production/allocate?modeler=${modeler.id}`);
              }
            }}
            className="w-full group relative flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-all duration-200
              hover:bg-muted/50 active:bg-muted
              border border-transparent hover:border-border/50
              text-left"
          >
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={undefined} />
              <AvatarFallback className="bg-muted text-foreground text-[10px]">
                {modeler.email
                  ? modeler.email.split("@")[0]?.slice(0, 2).toUpperCase() ||
                    "??"
                  : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground block truncate">
                {modeler.email || "Unknown"}
              </span>
              {modeler.title && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {modeler.title}
                </p>
              )}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}
