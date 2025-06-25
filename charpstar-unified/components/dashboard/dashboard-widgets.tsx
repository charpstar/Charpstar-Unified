"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/feedback";
import {
  Users,
  TrendingUp,
  Activity,
  Settings,
  FileText,
  Calendar,
  Target,
  Zap,
  Package,
} from "lucide-react";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { BarChart, XAxis, YAxis, Bar } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { ChartTooltip } from "@/components/ui/display";

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
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={user?.avatar_url} />
          <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">{user?.name || "User Name"}</h3>
          <p className="text-sm text-muted-foreground">
            {user?.email || "user@example.com"}
          </p>
          <Badge variant="secondary" className="mt-1">
            {user?.role || "Member"}
          </Badge>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Profile Completion</span>
          <span>85%</span>
        </div>
        <Progress value={85} className="h-2" />
      </div>
    </div>
  );
}

// Quick Actions Widget
export function QuickActionsWidget() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const actions = [
    {
      name: "Upload Asset",
      icon: FileText,
      action: () => (window.location.href = "/asset-library/upload"),
    },
    {
      name: "Create Model",
      icon: Target,
      action: () => (window.location.href = "/3d-editor"),
    },
    {
      name: "View Analytics",
      icon: TrendingUp,
      action: () => (window.location.href = "/analytics"),
    },
    {
      name: "Settings",
      icon: Settings,
      action: () => setIsSettingsOpen(true),
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
            className="h-55 p-4 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
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
  const activities = [
    {
      id: 1,
      action: "Uploaded new 3D model",
      time: "2 hours ago",
      type: "upload",
    },
    {
      id: 2,
      action: "Updated profile settings",
      time: "4 hours ago",
      type: "settings",
    },
    {
      id: 3,
      action: "Viewed analytics dashboard",
      time: "1 day ago",
      type: "view",
    },
    {
      id: 4,
      action: "Created new project",
      time: "2 days ago",
      type: "create",
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "upload":
        return <FileText className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      case "view":
        return <Activity className="h-4 w-4" />;
      case "create":
        return <Target className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <WidgetContainer>
      <WidgetHeader title="Recent Activity" icon={Activity} />
      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activity.action}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}

// Performance Widget
export function PerformanceWidget() {
  const metrics = [
    { name: "Models Created", value: 24, target: 30, color: "bg-blue-500" },
    { name: "Assets Uploaded", value: 156, target: 200, color: "bg-green-500" },
    {
      name: "Projects Completed",
      value: 8,
      target: 12,
      color: "bg-purple-500",
    },
  ];

  return (
    <WidgetContainer spacing="lg">
      <WidgetHeader title="Performance Metrics" icon={TrendingUp} />
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{metric.name}</span>
              <span>
                {metric.value}/{metric.target}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${metric.color}`}
                style={{ width: `${(metric.value / metric.target) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}

// Calendar Widget
export function CalendarWidget() {
  const events = [
    { id: 1, title: "Team Meeting", date: "Today", time: "2:00 PM" },
    { id: 2, title: "Project Review", date: "Tomorrow", time: "10:00 AM" },
    { id: 3, title: "Client Call", date: "Dec 15", time: "3:30 PM" },
  ];

  return (
    <WidgetContainer>
      <WidgetHeader title="Upcoming Events" icon={Calendar} />
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {event.date} at {event.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}

// System Status Widget
export function SystemStatusWidget() {
  const systems = [
    { name: "3D Editor", status: "online", uptime: "99.9%" },
    { name: "Asset Library", status: "online", uptime: "99.8%" },
    { name: "Analytics", status: "online", uptime: "99.7%" },
    { name: "API", status: "online", uptime: "99.9%" },
  ];

  return (
    <WidgetContainer>
      <WidgetHeader title="System Status" icon={Target} />
      <div className="space-y-2">
        {systems.map((system) => (
          <div
            key={system.name}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
          >
            <div className="flex items-center space-x-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  system.status === "online" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm">{system.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {system.uptime}
            </span>
          </div>
        ))}
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
        <div className="h-32 w-full">
          <BarChart data={chartData} height={150} width={460}>
            <XAxis
              dataKey="date"
              fontSize={10}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              fontSize={10}
              width={30}
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
              }}
            />
            <Bar
              dataKey="users"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              barSize={8}
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
        <div className="h-32 w-full">
          <BarChart data={chartData} height={150} width={460}>
            <XAxis
              dataKey="date"
              fontSize={10}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              fontSize={10}
              width={30}
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
              }}
            />
            <Bar
              dataKey="models"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              barSize={8}
            />
          </BarChart>
        </div>
      </div>
    </WidgetContainer>
  );
}
