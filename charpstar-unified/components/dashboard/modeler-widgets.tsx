"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Card } from "@/components/ui/containers";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Eye,
  Package,
  FileText,
} from "lucide-react";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Simple Modeler Stats Widget
export function ModelerStatsWidget() {
  const user = useUser();
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
    waitingForApproval: 0,
    inProgress: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchStats();
    }
  }, [user?.id]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get user's individual asset assignments
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          status,
          onboarding_assets!inner(*)
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        return;
      }

      if (!assetAssignments || assetAssignments.length === 0) {
        setStats({
          totalAssigned: 0,
          completed: 0,
          waitingForApproval: 0,
          inProgress: 0,
          pending: 0,
        });
        return;
      }

      // Calculate statistics - only count accepted assignments
      const acceptedAssignments = assetAssignments.filter(
        (assignment) => assignment.status === "accepted"
      );
      const acceptedAssets = acceptedAssignments
        .map((assignment) => assignment.onboarding_assets)
        .filter(Boolean) as any[];

      const totalAssigned = acceptedAssets.length;
      const completed = acceptedAssets.filter(
        (asset) => asset.status === "approved"
      ).length;
      const waitingForApproval = acceptedAssets.filter(
        (asset) => asset.status === "delivered_by_artist"
      ).length;
      const inProgress = acceptedAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pending = acceptedAssets.filter(
        (asset) => asset.status === "not_started"
      ).length;

      setStats({
        totalAssigned,
        completed,
        waitingForApproval,
        inProgress,
        pending,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 min-h-[320px]">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gradient-to-br from-muted/50 to-muted animate-pulse rounded-2xl"
          />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Assigned",
      value: stats.totalAssigned,
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bgColor:
        "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50",
      borderColor: "border-blue-200 dark:border-blue-800",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      description: "Assets assigned to you",
      trend: "positive" as const,
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor:
        "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50",
      borderColor: "border-indigo-200 dark:border-indigo-800",
      iconBg: "bg-indigo-500 dark:bg-indigo-600",
      description: "Currently working on",
      trend: "attention" as const,
    },
    {
      title: "Waiting for Approval",
      value: stats.waitingForApproval,
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor:
        "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50",
      borderColor: "border-amber-200 dark:border-amber-800",
      iconBg: "bg-amber-500 dark:bg-amber-600",
      description: "Awaiting feedback",
      trend: "attention" as const,
    },
    {
      title: "Completed",
      value: stats.completed,
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor:
        "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      description: "Successfully finished",
      trend: "positive" as const,
    },
    {
      title: "Pending",
      value: stats.pending,
      icon: RotateCcw,
      color: "text-red-600 dark:text-red-400",
      bgColor:
        "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50",
      borderColor: "border-red-200 dark:border-red-800",
      iconBg: "bg-red-500 dark:bg-red-600",
      description: "Not started yet",
      trend: "attention" as const,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            Assignment Overview
          </h3>
          <p className="text-sm text-muted-foreground">
            Track your current workload and progress
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`
              group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ease-out
              hover:scale-105 hover:shadow-xl hover:shadow-black/5
              ${stat.bgColor} ${stat.borderColor}
              ${loading ? "animate-pulse" : ""}
            `}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-20 h-20 transform rotate-45 translate-x-8 -translate-y-8 bg-current rounded-full"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 transform -rotate-45 -translate-x-6 translate-y-6 bg-current rounded-full"></div>
            </div>

            {/* Content */}
            <div className="relative p-6 h-full flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-xl ${stat.iconBg} shadow-lg shadow-black/10`}
                >
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                {!loading && stat.trend === "positive" && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded-full">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span className="text-xs font-medium text-emerald-700">
                      +
                    </span>
                  </div>
                )}
                {!loading && stat.trend === "attention" && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-rose-100 rounded-full">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                    <span className="text-xs font-medium text-rose-700">!</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <p
                  className={`text-3xl font-bold ${stat.color} transition-all duration-300 group-hover:scale-110`}
                >
                  {stat.value}
                </p>
                <div>
                  <p className="text-sm font-semibold text-foreground/80 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
              </div>

              {/* Progress Bar for In Progress */}
              {!loading &&
                stat.title === "In Progress" &&
                stats.inProgress > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>
                        {Math.round(
                          (stats.inProgress / stats.totalAssigned) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-muted/30 dark:bg-muted/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${(stats.inProgress / stats.totalAssigned) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

              {/* Hover Effect Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            {/* Bottom Accent */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 ${stat.iconBg} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left`}
            ></div>
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      {!loading && (
        <div className="mt-6 p-4 bg-gradient-to-r from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30 rounded-xl border border-border/50 dark:border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 dark:bg-indigo-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">
                  In Progress
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">
                  Pending Review
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {stats.totalAssigned > 0
                  ? Math.round((stats.completed / stats.totalAssigned) * 100)
                  : 0}
                % Complete
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.completed} of {stats.totalAssigned} assets
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Assigned Models Widget
export function AssignedModelsWidget() {
  const router = useRouter();
  const user = useUser();
  const [assignedAssets, setAssignedAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchAssignedAssets();
    }
  }, [user?.id]);

  const fetchAssignedAssets = async () => {
    try {
      setLoading(true);

      // Get user's individual asset assignments
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          onboarding_assets!inner(*)
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .order("onboarding_assets.priority", { ascending: true })
        .limit(5);

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        return;
      }

      if (!assetAssignments || assetAssignments.length === 0) {
        setAssignedAssets([]);
        return;
      }

      // Extract assets from assignments
      const assets = assetAssignments
        .map((assignment) => assignment.onboarding_assets)
        .filter(Boolean) as any[];

      setAssignedAssets(assets);
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "delivered_by_artist":
        return <Clock className="h-4 w-4 text-accent-purple" />;
      case "in_production":
        return <Clock className="h-4 w-4 text-warning" />;
      case "not_started":
        return <AlertCircle className="h-4 w-4 text-error" />;
      case "revisions":
        return <RotateCcw className="h-4 w-4 text-info" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-4 min-h-[283px]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Assigned Models</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/my-assignments")}
        >
          View All
        </Button>
      </div>

      <div className="space-y-3 h-full flex flex-col">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 flex-1">
              <div className="animate-pulse space-y-3 h-full flex flex-col justify-center">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </Card>
          ))
        ) : assignedAssets.length === 0 ? (
          <Card className="p-4 text-center flex-1 flex flex-col justify-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No assigned models</p>
          </Card>
        ) : (
          assignedAssets.map((asset) => (
            <Card
              key={asset.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer flex-1"
              onClick={() => router.push(`/modeler-review/${asset.id}`)}
            >
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(asset.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{asset.product_name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {asset.client} - Batch {asset.batch}
                      </span>
                      <span>•</span>
                      <span>{asset.category}</span>
                      {asset.subcategory && (
                        <>
                          <span>•</span>
                          <span>{asset.subcategory}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getPriorityClass(asset.priority)}`}
                  >
                    Priority {asset.priority}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/modeler-review/${asset.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/display/chart";

// Modeler Earnings Widget with Chart
export function ModelerEarningsWidget() {
  const user = useUser();
  const [earningsData, setEarningsData] = useState({
    thisMonth: 0,
    lastMonth: 0,
    totalEarnings: 0,
    approvedThisMonth: 0,
    chartData: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchEarningsData();
    }
  }, [user?.id, refreshTrigger]);

  // Listen for allocation list approval/unapproval events
  useEffect(() => {
    const handleAllocationListStatusChange = () => {
      setRefreshTrigger((prev) => prev + 1);
    };

    // Listen for custom events when allocation lists are approved or unapproved
    window.addEventListener(
      "allocationListApproved",
      handleAllocationListStatusChange
    );
    window.addEventListener(
      "allocationListUnapproved",
      handleAllocationListStatusChange
    );

    // Also listen for asset status changes that might affect allocation lists
    window.addEventListener(
      "assetStatusChanged",
      handleAllocationListStatusChange
    );

    return () => {
      window.removeEventListener(
        "allocationListApproved",
        handleAllocationListStatusChange
      );
      window.removeEventListener(
        "allocationListUnapproved",
        handleAllocationListStatusChange
      );
      window.removeEventListener(
        "assetStatusChanged",
        handleAllocationListStatusChange
      );
    };
  }, []);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);

      // First, let's check if there are any allocation lists at all for this user
      const {} = await supabase
        .from("allocation_lists")
        .select("id, name, status, approved_at")
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      // Get user's allocation lists with pricing - only for approved lists
      const { data: allocationLists, error: listsError } = await supabase
        .from("allocation_lists")
        .select(
          `
          id,
          name,
          bonus,
          deadline,
          status,
          approved_at,
          asset_assignments!inner(
            asset_id,
            price,
            onboarding_assets!inner(
              id,
              status
            )
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "approved");

      if (listsError) {
        console.error("Error fetching allocation lists:", listsError);
        return;
      }

      if (!allocationLists || allocationLists.length === 0) {
        setEarningsData({
          thisMonth: 0,
          lastMonth: 0,
          totalEarnings: 0,
          approvedThisMonth: 0,
          chartData: [],
        });
        return;
      }

      // Filter allocation lists to only include those where ALL assets are approved
      const fullyApprovedLists = allocationLists.filter((list: any) => {
        // Check if all assets in this list are approved
        // Both "approved" and "approved_by_client" count as approved for earnings
        return list.asset_assignments.every(
          (assignment: any) =>
            assignment.onboarding_assets?.status === "approved" ||
            assignment.onboarding_assets?.status === "approved_by_client"
        );
      });

      // Calculate earnings from fully approved allocation lists only
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;
      let totalEarnings = 0;
      let approvedThisMonth = 0;

      // Group earnings by day for chart
      const dailyData = new Map<string, number>();

      fullyApprovedLists.forEach((list: any) => {
        const listEarnings = list.asset_assignments.reduce(
          (sum: number, assignment: any) => sum + (assignment.price || 0),
          0
        );

        // Check if work was completed before deadline to determine if bonus applies
        let bonusAmount = 0;
        let totalListEarnings = listEarnings;

        if (list.approved_at && list.deadline) {
          const approvedDate = new Date(list.approved_at);
          const deadlineDate = new Date(list.deadline);

          // Only apply bonus if work was completed before or on the deadline
          if (approvedDate <= deadlineDate) {
            bonusAmount = listEarnings * (list.bonus / 100);
            totalListEarnings = listEarnings + bonusAmount;
          } else {
          }
        } else {
        }

        totalEarnings += totalListEarnings;

        // Check if approved this month
        if (list.approved_at) {
          const approvedDate = new Date(list.approved_at);
          const approvedMonth = approvedDate.getMonth();
          const approvedYear = approvedDate.getFullYear();

          if (approvedMonth === currentMonth && approvedYear === currentYear) {
            thisMonthEarnings += totalListEarnings;
            approvedThisMonth++;
          } else if (
            approvedMonth === lastMonth &&
            approvedYear === lastMonthYear
          ) {
            lastMonthEarnings += totalListEarnings;
          }

          // Add to daily chart data
          const dayKey = `${approvedYear}-${String(approvedMonth + 1).padStart(2, "0")}-${String(approvedDate.getDate()).padStart(2, "0")}`;
          dailyData.set(
            dayKey,
            (dailyData.get(dayKey) || 0) + totalListEarnings
          );
        }
      });

      // Generate chart data for last 15 days
      const chartData = [];

      for (let i = 14; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const earnings = dailyData.get(dayKey) || 0;

        chartData.push({
          day: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          earnings: Math.round(earnings * 100) / 100, // Round to 2 decimal places
          date: dayKey,
          fullDate: date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        });
      }

      const finalData = {
        thisMonth: Math.round(thisMonthEarnings * 100) / 100,
        lastMonth: Math.round(lastMonthEarnings * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        approvedThisMonth,
        chartData,
      };

      setEarningsData(finalData);
    } catch (error) {
      console.error("Error fetching earnings data:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    earnings: {
      label: "Earnings",
      color: "var(--color-chart-1)",
    },
  } satisfies ChartConfig;

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col min-h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 bg-muted rounded-lg w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-muted rounded-lg w-64 animate-pulse"></div>
          </div>
          <div className="h-8 bg-muted rounded-full w-24 animate-pulse"></div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full h-48 bg-gradient-to-br from-muted/50 to-muted animate-pulse rounded-2xl"></div>
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30 rounded-xl border border-border/50 dark:border-border/30">
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate trend percentage
  const trendPercentage =
    earningsData.lastMonth > 0
      ? (
          ((earningsData.thisMonth - earningsData.lastMonth) /
            earningsData.lastMonth) *
          100
        ).toFixed(1)
      : "0.0";

  const isTrendingUp = earningsData.thisMonth > earningsData.lastMonth;

  return (
    <div className="h-full flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            Earnings & Performance
          </h3>
          <p className="text-sm text-muted-foreground">
            Your earnings over the last 15 days
          </p>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 mb-6">
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 dark:border-border/30 bg-gradient-to-br from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30 p-6 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          <div className="relative">
            {earningsData.chartData.length > 0 ? (
              <ChartContainer className="h-48" config={chartConfig}>
                <LineChart
                  accessibilityLayer
                  data={earningsData.chartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground) / 0.2)"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{
                      fontSize: 12,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "hsl(var(--chart-1))",
                      strokeWidth: 2,
                      strokeDasharray: "5 5",
                    }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      color: "#1f2937",
                    }}
                    labelStyle={{
                      color: "#6b7280",
                      fontWeight: "600",
                    }}
                    formatter={(value: any) => [`€${value}`, "Earnings"]}
                  />
                  {/* Reference line for average earnings */}
                  {earningsData.chartData.length > 0 && (
                    <ReferenceLine
                      y={
                        earningsData.chartData.reduce(
                          (sum, item) => sum + item.earnings,
                          0
                        ) / earningsData.chartData.length
                      }
                      stroke="hsl(var(--muted-foreground) / 0.4)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                  )}
                  <Line
                    dataKey="earnings"
                    type="monotone"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={3}
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">€</span>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    No Earnings Data
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Complete and get approved assignments to see your earnings
                    chart
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Hover Effect Overlay */}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-auto">
        <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30 rounded-xl border border-border/50 dark:border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">
                  This Month
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">
                  Last Month
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {isTrendingUp ? "↗ Trending up" : "↘ Trending down"} by{" "}
                  {trendPercentage}%
                </span>
                <div
                  className={`w-2 h-2 rounded-full ${isTrendingUp ? "bg-emerald-500 dark:bg-emerald-400" : "bg-red-500 dark:bg-red-400"} animate-pulse`}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                €{earningsData.totalEarnings.toLocaleString()} total earnings
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/30 dark:border-border/20">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                €{earningsData.thisMonth.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                €{earningsData.lastMonth.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Last Month</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {earningsData.approvedThisMonth}
              </p>
              <p className="text-xs text-muted-foreground">Approved Lists</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Quick Actions Widget
export function ModelerQuickActionsWidget() {
  const router = useRouter();

  const actions = [
    {
      title: "My Assignments",
      description: "View your assigned assets and batches",
      icon: Package,
      action: () => router.push("/my-assignments"),
      color: "from-blue-500 to-blue-600",
      hoverColor: "from-blue-600 to-blue-700",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "View Guidelines",
      description: "Quality standards & requirements",
      icon: FileText,
      action: () => router.push("/guidelines"),
      color: "from-amber-500 to-amber-600",
      hoverColor: "from-amber-600 to-amber-700",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Model Viewer",
      description: "View 3D models in the Charpstar viewer",
      icon: Eye,
      action: () => window.open("https://viewer.charpstar.co/", "_blank"),
      color: "from-purple-500 to-purple-600",
      hoverColor: "from-purple-600 to-purple-700",
      iconBg: "bg-purple-100 dark:bg-purple-900/50",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="h-full flex flex-col flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            Quick Actions
          </h3>
          <p className="text-sm text-muted-foreground">
            Access your most important tools and workflows
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {actions.map((action, index) => (
          <div
            key={index}
            className={`group relative overflow-hidden rounded-2xl border border-border/50 dark:border-border/30 bg-gradient-to-br from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30 p-6 transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 cursor-pointer ${
              action.title === "Model Viewer" ? "col-span-2" : ""
            }`}
            onClick={action.action}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-current/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative flex flex-col justify-center h-full">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-3 rounded-xl ${action.iconBg} shadow-lg shadow-black/10 dark:shadow-black/20`}
                >
                  <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-foreground mb-1">
                    {action.title}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </div>

              <div className="mt-auto">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r ${action.color} hover:${action.hoverColor} text-white rounded-lg transition-all duration-300 ease-out group-hover:scale-105 shadow-lg shadow-black/20 dark:shadow-black/40`}
                >
                  <span className="text-sm font-medium">Open</span>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Hover Effect Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-current/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Bottom Accent */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${action.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left`}
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
}
