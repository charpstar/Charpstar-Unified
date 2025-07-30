"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Eye,
  Package,
  FileText,
  MessageSquare,
} from "lucide-react";

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 min-h-[283px]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Assigned",
      value: loading ? "..." : stats.totalAssigned.toString(),
      icon: Package,
      color: "text-info",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed",
      value: loading ? "..." : stats.completed.toString(),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-green-50",
    },
    {
      title: "Waiting for Approval",
      value: loading ? "..." : stats.waitingForApproval.toString(),
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-orange-50",
    },
    {
      title: "In Progress",
      value: loading ? "..." : stats.inProgress.toString(),
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-orange-50",
    },
    {
      title: "Pending",
      value: loading ? "..." : stats.pending.toString(),
      icon: AlertCircle,
      color: "text-error",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className="h-full flex flex-col min-h-[283px]">
      <h3 className="text-lg font-semibold mb-4">Assignment Overview</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1 h-full">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-4 flex flex-col justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>
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

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return "bg-error-muted text-error border-error/20";
      case 2:
        return "bg-warning-muted text-warning border-warning/20";
      case 3:
        return "bg-success-muted text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground border-border";
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
                    className={`text-xs ${getPriorityColor(asset.priority)}`}
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

import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/display/chart";

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
      console.log("Allocation list status changed, refreshing earnings data");
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
      console.log("Fetching earnings data for user:", user?.id);

      // First, let's check if there are any allocation lists at all for this user
      const { data: allLists, error: allListsError } = await supabase
        .from("allocation_lists")
        .select("id, name, status, approved_at")
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      console.log("All allocation lists for user:", allLists);
      console.log("Allocation lists error:", allListsError);

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

      console.log("Allocation lists found:", allocationLists?.length || 0);
      console.log("Allocation lists data:", allocationLists);

      if (!allocationLists || allocationLists.length === 0) {
        console.log("No allocation lists found, setting empty data");
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
        return list.asset_assignments.every(
          (assignment: any) =>
            assignment.onboarding_assets?.status === "approved"
        );
      });

      console.log("Fully approved lists:", fullyApprovedLists.length);
      console.log("Total lists:", allocationLists.length);

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
            console.log(
              `Bonus applied for list ${list.id}: ${bonusAmount} (completed before deadline)`
            );
          } else {
            console.log(
              `No bonus for list ${list.id}: completed after deadline (approved: ${approvedDate.toISOString()}, deadline: ${deadlineDate.toISOString()})`
            );
          }
        } else {
          console.log(
            `No bonus for list ${list.id}: missing approved_at or deadline`
          );
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
        });
      }

      const finalData = {
        thisMonth: Math.round(thisMonthEarnings * 100) / 100,
        lastMonth: Math.round(lastMonthEarnings * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        approvedThisMonth,
        chartData,
      };

      console.log("Calculated earnings data:", finalData);
      console.log("This month earnings:", thisMonthEarnings);
      console.log("Total earnings:", totalEarnings);
      console.log("Approved this month:", approvedThisMonth);

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
      <Card>
        <CardHeader>
          <CardTitle>Earnings & Performance</CardTitle>
          <CardDescription>Loading your earnings data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Earnings & Performance</CardTitle>
        <CardDescription>Your earnings over the last 15 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={earningsData.chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="earnings"
              type="monotone"
              stroke="#0891b2"
              strokeWidth={3}
              dot={{ fill: "#0891b2", strokeWidth: 2, r: 4 }}
              activeDot={{
                r: 6,
                stroke: "#0891b2",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none text-muted-foreground font-sm">
              {isTrendingUp ? "Trending up" : "Trending down"} by{" "}
              {trendPercentage}% this month
              <TrendingUp
                className={`h-4 w-4 ${isTrendingUp ? "" : "rotate-180"}`}
              />
            </div>
            <div className=" flex items-center gap-2 leading-none font-medium">
              Total earnings: €{earningsData.totalEarnings.toLocaleString()}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
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
    },
    {
      title: "Modeler Review",
      description: "Upload GLB files and communicate with QA",
      icon: MessageSquare,
      action: () => router.push("/modeler-review"),
    },
    {
      title: "View Guidelines",
      description: "Quality standards & requirements",
      icon: FileText,
      action: () => router.push("/guidelines"),
    },
    {
      title: "Model Viewer",
      description: "View 3D models in the Charpstar viewer",
      icon: Eye,
      action: () => window.open("https://viewer.charpstar.co/", "_blank"),
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-4 min-h-[238px]">
        {actions.map((action, index) => (
          <Card
            key={index}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col justify-center"
            onClick={action.action}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{action.title}</p>
                <p className="text-sm text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
