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
} from "lucide-react";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { BarChart, XAxis, YAxis, Bar } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { ChartTooltip } from "@/components/ui/display";
import { useActivities } from "@/hooks/use-activities";
import {
  Card,
  CardTitle,
  CardHeader,
  Separator,
  CardContent,
} from "@/components/ui/containers";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
          onClick={() => setIsSettingsOpen(true)}
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
                <Badge
                  variant="outline"
                  className="h-2 w-2 p-0 bg-green-500 border-green-500"
                ></Badge>
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
              <div className="text-xs text-success font-medium">
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
            onClick={() => setIsSettingsOpen(true)}
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

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </WidgetContainer>
  );
}

// Quick Actions Widget
export function QuickActionsWidget() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const user = useUser();
  const router = useRouter();

  const actions = [
    {
      name: user?.metadata?.role === "client" ? "Add Product" : "Upload Asset",
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
    },
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
          router.push("/client-review");
        }
      },
    },
    {
      name: "View Analytics",
      icon: TrendingUp,
      description: "See performance and usage analytics",
      action: () => {
        router.push("/analytics");
      },
    },
    {
      name: "Settings",
      icon: Settings,
      description: "Manage your account and preferences",
      action: () => {
        setIsSettingsOpen(true);
      },
    },
  ];

  return (
    <WidgetContainer>
      <div className="grid grid-cols-2 gap-4 min-h-[238px]">
        {actions.map((action) => (
          <Card
            key={action.name}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col justify-center"
            onClick={action.action}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{action.name}</p>
                {action.description && (
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                )}
              </div>
            </div>
          </Card>
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

const STATUS_LABELS = {
  in_production: "In Production",
  revisions: "Ready for Revision",
  approved: "Approved",
  delivered_by_artist: "Delivered by Artist",
};

type StatusKey = keyof typeof STATUS_LABELS;

const STATUS_COLORS: Record<StatusKey, string> = {
  in_production: "#FACC15", // yellow
  revisions: "#F87171", // red
  approved: "#4ADE80", // green
  delivered_by_artist: "#60A5FA", // blue
};

export function ModelStatusWidget() {
  const user = useUser();
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    in_production: 0,
    revisions: 0,
    approved: 0,
    delivered_by_artist: 0,
  });
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
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const status = row.status as StatusKey;
          if (status in newCounts) newCounts[status]++;
        }
        // For clients, combine approved and delivered_by_artist into approved
        if (user?.metadata?.role === "client") {
          newCounts.approved += newCounts.delivered_by_artist;
          newCounts.delivered_by_artist = 0;
        }
        setCounts(newCounts);
        setProducts(data);
      }
    }
    fetchStatusCounts();
  }, [user?.metadata?.client, user?.metadata?.role]);

  return (
    <Card className="p-6 rounded-lg shadow- bg-background w-full mx-auto flex flex-col items-center border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold mb-1 text-foreground">
          Total Models: {products.length}
        </CardTitle>
      </CardHeader>
      <p className="text-sm text-muted-foreground mb-4">
        Track the progress of your onboarding assets
      </p>
      {products.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <span className="text-4xl">🗂️</span>
          <div className="mt-2 font-medium">No models found yet.</div>
          <div className="text-xs">Upload your CSV to get started.</div>
        </div>
      ) : (
        <div className="w-full space-y-3">
          {(Object.entries(STATUS_LABELS) as [StatusKey, string][]).map(
            ([key, label]) => {
              // Hide "Delivered by Artist" for clients
              if (
                user?.metadata?.role === "client" &&
                key === "delivered_by_artist"
              ) {
                return null;
              }
              return (
                <div
                  key={key}
                  className="flex items-center gap-3  border-b border-border"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: STATUS_COLORS[key] }}
                  />
                  <span className="font-medium flex-1 text-sm">{label}</span>
                  <span className=" text-lg ">{counts[key]}</span>
                </div>
              );
            }
          )}
        </div>
      )}
    </Card>
  );
}

export function StatusPieChartWidget() {
  const user = useUser();
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    in_production: 0,
    revisions: 0,
    approved: 0,
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
          delivered_by_artist: 0,
        };
        for (const row of data) {
          const status = row.status as StatusKey;
          if (status in newCounts) newCounts[status]++;
        }
        // For clients, combine approved and delivered_by_artist into approved
        if (user?.metadata?.role === "client") {
          newCounts.approved += newCounts.delivered_by_artist;
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
      // Hide "Delivered by Artist" for clients
      if (user?.metadata?.role === "client" && key === "delivered_by_artist") {
        return false;
      }
      return true;
    })
    .map(([key, label]) => {
      const count = counts[key as StatusKey];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        name: label,
        value: count,
        percentage,
        key: key as StatusKey,
      };
    });

  return (
    <Card className="p-0  rounded-lg bg-background w-full mx-auto flex flex-col items-center pointer-events-none select-none border-0 shadow-none">
      <CardHeader className="!pb-0">
        <CardTitle className="text-lg font-semibold mb-1 text-foreground">
          Model Status Distribution
        </CardTitle>
      </CardHeader>

      {chartData.every((entry) => entry.value === 0) ? (
        <div className="py-8 text-center text-muted-foreground">
          <span className="text-4xl">📊</span>
          <div className="mt-2 font-medium">No data to display yet.</div>
          <div className="text-xs">
            Upload assets to see your status distribution.
          </div>
        </div>
      ) : (
        <CardContent className="!p-0">
          <div className="flex flex-row items-center gap-18 w-full justify-center select-none">
            <div className="w-64 h-64 drop-shadow-lg pointer-events-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                    isAnimationActive={true}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={STATUS_COLORS[entry.key]}
                      />
                    ))}
                  </Pie>
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
            <div className="flex flex-col gap-3 min-w-[160px] select-none">
              {chartData.map((entry, index) => (
                <>
                  <div key={entry.key} className="flex items-center gap-3">
                    <span
                      className="inline-block w-4 h-4 rounded-full"
                      style={{ background: STATUS_COLORS[entry.key] }}
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
