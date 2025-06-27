"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Users,
  TrendingUp,
  Activity,
  Settings,
  FileText,
  Zap,
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
} from "lucide-react";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { BarChart, XAxis, YAxis, Bar } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { ChartTooltip } from "@/components/ui/display";
import { useActivities } from "@/hooks/use-activities";

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
        {change && (
          <p className="text-xs text-green-600 dark:text-green-400">{change}</p>
        )}
      </div>
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-6 w-6 text-primary" />
      </div>
    </div>
  );
}

// Profile Widget
export function ProfileWidget({ user }: { user?: any }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      case "customer":
        return {
          icon: "👤",
          title: "Customer",
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
            customers: {
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

  // Debug logging to help identify the issue
  console.log("ProfileWidget - user object:", user);
  console.log("ProfileWidget - user.metadata:", user?.metadata);
  console.log("ProfileWidget - user.metadata?.role:", user?.metadata?.role);
  console.log("ProfileWidget - detected role:", userRole);
  console.log("ProfileWidget - roleData:", roleData);
  console.log("ProfileWidget - is admin check:", userRole === "admin");
  console.log("ProfileWidget - roleData.roleOverview:", roleData.roleOverview);

  return (
    <WidgetContainer>
      <WidgetHeader title="Profile" icon={Users}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSettingsOpen(true)}
          className="h-8 w-8 p-0 hover:bg-primary/10"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </WidgetHeader>

      <div className="space-y-4">
        {/* Profile Header */}
        <div className="flex items-start gap-4">
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
            <p className="text-sm text-muted-foreground truncate mb-2">
              {userEmail}
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant={userRole === "admin" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {roleData.title}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                {roleData.status}
              </div>
            </div>
          </div>
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
              className="text-center p-3 bg-card border border-border rounded-lg"
            >
              <div className="text-lg font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                {stat.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Recent Activity
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {roleData.recentActivity}
          </p>
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
                    <div className="font-semibold text-blue-700 dark:text-blue-300">
                      {roleData.roleOverview.qa.modelsReviewed}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400">
                      Reviewed
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-700 dark:text-blue-300">
                      {roleData.roleOverview.qa.issuesFound}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400">
                      Issues
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-700 dark:text-blue-300">
                      {roleData.roleOverview.qa.approvalRate}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400">
                      Approval
                    </div>
                  </div>
                </div>
              </div>

              {/* Modelers Overview */}
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎨</span>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    3D Modelers
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {roleData.roleOverview.modelers.totalUsers} users
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-green-700 dark:text-green-300">
                      {roleData.roleOverview.modelers.modelsCreated}
                    </div>
                    <div className="text-green-600 dark:text-green-400">
                      Created
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-700 dark:text-green-300">
                      {roleData.roleOverview.modelers.categories}
                    </div>
                    <div className="text-green-600 dark:text-green-400">
                      Categories
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-700 dark:text-green-300">
                      {roleData.roleOverview.modelers.avgQuality}
                    </div>
                    <div className="text-green-600 dark:text-green-400">
                      Quality
                    </div>
                  </div>
                </div>
              </div>

              {/* Customers Overview */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👤</span>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Customers
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {roleData.roleOverview.customers.totalUsers} users
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {roleData.roleOverview.customers.modelsViewed}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400">
                      Viewed
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {roleData.roleOverview.customers.downloads}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400">
                      Downloads
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {roleData.roleOverview.customers.favorites}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400">
                      Favorites
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-3 w-3 mr-1" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => (window.location.href = "/asset-library")}
          >
            <Folder className="h-3 w-3 mr-1" />
            Library
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </WidgetContainer>
  );
}

// Quick Actions Widget
export function QuickActionsWidget() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const actions = [
    {
      name: "Upload Asset",
      icon: FileText,
      action: () => {
        window.location.href = "/asset-library/upload";
      },
    },
    {
      name: "Asset Library",
      icon: Folder,
      action: () => {
        window.location.href = "/asset-library";
      },
    },
    {
      name: "View Analytics",
      icon: TrendingUp,
      action: () => {
        window.location.href = "/analytics";
      },
    },
    {
      name: "Settings",
      icon: Settings,
      action: () => {
        setIsSettingsOpen(true);
      },
    },
  ];

  return (
    <WidgetContainer>
      <WidgetHeader title="Quick Actions" icon={Zap} />
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Button
            key={action.name}
            variant="outline"
            size="sm"
            className="h-55 p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={action.action}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-sm font-medium">{action.name}</span>
          </Button>
        ))}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
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

  // Debug logging
  React.useEffect(() => {
    console.log("ActivityWidget - activities:", activities);
    console.log("ActivityWidget - isLoading:", isLoading);
    console.log("ActivityWidget - error:", error);
  }, [activities, isLoading, error]);

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
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
