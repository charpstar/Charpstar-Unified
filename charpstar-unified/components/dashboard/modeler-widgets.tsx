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
  Users,
  MessageSquare,
} from "lucide-react";

// Simple Modeler Stats Widget
export function ModelerStatsWidget() {
  const user = useUser();
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
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
        setStats({ totalAssigned: 0, completed: 0, inProgress: 0, pending: 0 });
        return;
      }

      // Extract assets from assignments
      const allAssets = assetAssignments
        .map((assignment) => assignment.onboarding_assets)
        .filter(Boolean) as any[];

      // Calculate statistics - only count accepted assignments
      const acceptedAssignments = assetAssignments.filter(
        (assignment) => assignment.status === "accepted"
      );
      const acceptedAssets = acceptedAssignments
        .map((assignment) => assignment.onboarding_assets)
        .filter(Boolean) as any[];

      const totalAssigned = acceptedAssets.length;
      const completed = acceptedAssets.filter(
        (asset) =>
          asset.status === "approved" || asset.status === "delivered_by_artist"
      ).length;
      const inProgress = acceptedAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pending = acceptedAssets.filter(
        (asset) => asset.status === "not_started"
      ).length;

      setStats({ totalAssigned, completed, inProgress, pending });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[283px]">
        {[...Array(4)].map((_, i) => (
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
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Completed",
      value: loading ? "..." : stats.completed.toString(),
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "In Progress",
      value: loading ? "..." : stats.inProgress.toString(),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Pending",
      value: loading ? "..." : stats.pending.toString(),
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className="h-full flex flex-col min-h-[283px]">
      <h3 className="text-lg font-semibold mb-4">Assignment Overview</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 h-full">
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
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "not_started":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "revisions":
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return "bg-red-100 text-red-800 border-red-200";
      case 2:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 3:
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Earnings Widget with Chart
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

  useEffect(() => {
    if (user?.id) {
      fetchEarningsData();
    }
  }, [user?.id]);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);

      // First, let's debug by getting ALL assignments for this user
      const { data: allAssignments, error: allError } = await supabase
        .from("asset_assignments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      if (allError) {
        console.error("Error fetching all assignments:", allError);
        return;
      }

      // Let's also check what approved assets exist in the onboarding_assets table
      const { data: approvedAssets, error: approvedError } = await supabase
        .from("onboarding_assets")
        .select("id, status, created_at")
        .eq("status", "approved");
      if (approvedError) {
        console.error("Error fetching approved assets:", approvedError);
      }

      // Let's try a simpler query first - just get accepted assignments without the approved filter
      const { data: simpleAssignments, error: simpleError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          price,
          bonus,
          accepted_at,
          onboarding_assets!inner(
            id,
            status,
            created_at
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (simpleError) {
        console.error("Error fetching simple assignments:", simpleError);
      }

      // Now get user's accepted asset assignments with pricing - only for approved models
      // We'll filter for approved assets in the code instead of in the query
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          price,
          bonus,
          accepted_at,
          onboarding_assets!inner(
            id,
            status,
            created_at
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        return;
      }

      // Filter for approved assets in the code since the query join was causing issues
      let assignmentsToUse = (
        assetAssignments ||
        simpleAssignments ||
        []
      ).filter(
        (assignment: any) =>
          assignment.onboarding_assets &&
          assignment.onboarding_assets.status === "approved"
      );

      // If we still don't have any data, let's try a different approach
      if (!assignmentsToUse || assignmentsToUse.length === 0) {
        // Get all accepted assignments and then fetch asset details separately
        const { data: basicAssignments, error: basicError } = await supabase
          .from("asset_assignments")
          .select("asset_id, price, bonus, accepted_at")
          .eq("user_id", user?.id)
          .eq("role", "modeler")
          .eq("status", "accepted");

        if (basicAssignments && basicAssignments.length > 0) {
          // Get the asset IDs
          const assetIds = basicAssignments.map((a) => a.asset_id);

          // Fetch approved assets separately
          const { data: approvedAssetsData, error: assetsError } =
            await supabase
              .from("onboarding_assets")
              .select("id, status, created_at")
              .in("id", assetIds)
              .eq("status", "approved");

          if (approvedAssetsData && approvedAssetsData.length > 0) {
            // Combine the data
            assignmentsToUse = basicAssignments
              .map((assignment) => ({
                ...assignment,
                onboarding_assets: approvedAssetsData.find(
                  (asset) => asset.id === assignment.asset_id
                ),
              }))
              .filter(
                (assignment: any) => assignment.onboarding_assets
              ) as any[];
          }
        }
      }

      if (!assignmentsToUse || assignmentsToUse.length === 0) {
        setEarningsData({
          thisMonth: 0,
          lastMonth: 0,
          totalEarnings: 0,
          approvedThisMonth: 0,
          chartData: [],
        });
        return;
      }

      // Calculate earnings
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;
      let totalEarnings = 0;
      let approvedThisMonth = 0;

      // Group earnings by month for chart
      const monthlyEarnings: { [key: string]: number } = {};

      assignmentsToUse.forEach((assignment) => {
        const asset = assignment.onboarding_assets as any;
        const basePrice = assignment.price || 0;
        const bonus = assignment.bonus || 0;
        const totalPrice = basePrice * (1 + bonus / 100);

        // All assets in this query are already approved, so count all earnings
        totalEarnings += totalPrice;

        // Check if approved this month - use created_at (when status was set to approved) if available, otherwise use accepted_at
        const dateToUse = asset.created_at || assignment.accepted_at;
        if (dateToUse) {
          const approvedDate = new Date(dateToUse);
          if (
            approvedDate.getMonth() === currentMonth &&
            approvedDate.getFullYear() === currentYear
          ) {
            thisMonthEarnings += totalPrice;
            approvedThisMonth++;
          } else if (
            approvedDate.getMonth() === lastMonth &&
            approvedDate.getFullYear() === lastMonthYear
          ) {
            lastMonthEarnings += totalPrice;
          }

          // Add to monthly earnings for chart
          const monthKey = `${approvedDate.getFullYear()}-${String(approvedDate.getMonth() + 1).padStart(2, "0")}`;
          monthlyEarnings[monthKey] =
            (monthlyEarnings[monthKey] || 0) + totalPrice;
        }
      });

      // Generate chart data for last 12 months
      const chartData = [];
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const earnings = monthlyEarnings[monthKey] || 0;

        chartData.push({
          month: monthNames[date.getMonth()],
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

      setEarningsData(finalData);
    } catch (error) {
      console.error("Error fetching earnings data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col min-h-[400px]">
        <h3 className="text-lg font-semibold mb-4">Earnings & Performance</h3>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-[400px]">
      <h3 className="text-lg font-semibold mb-4">Earnings & Performance</h3>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              This month's earnings
            </p>
            <p className="text-2xl font-bold text-cyan-600">
              €{earningsData.thisMonth.toLocaleString()}
            </p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Approved this month
            </p>
            <p className="text-2xl font-bold">
              {earningsData.approvedThisMonth}
            </p>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[250px]">
        <Card className="p-4 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Earnings</h4>
              <div className="w-4 h-4 bg-muted rounded-full flex items-center justify-center">
                <span className="text-xs">i</span>
              </div>
            </div>
            <div className="text-sm text-cyan-600 font-medium">12 months</div>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Selected period</p>
              <p className="text-sm font-semibold">
                €{earningsData.thisMonth.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-sm font-semibold">
                €{(earningsData.totalEarnings / 12).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lifetime</p>
              <p className="text-sm font-semibold">
                €{earningsData.totalEarnings.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earningsData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `€${value}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm text-cyan-600">
                            €{payload[0].value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="earnings"
                  stroke="#0891b2"
                  strokeWidth={2}
                  dot={{ fill: "#0891b2", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "#0891b2", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
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
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Modeler Review",
      description: "Upload GLB files and communicate with QA",
      icon: MessageSquare,
      action: () => router.push("/modeler-review"),
      color: "bg-green-50 text-green-600",
    },
    {
      title: "View Guidelines",
      description: "Quality standards & requirements",
      icon: FileText,
      action: () => router.push("/guidelines"),
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "Model Viewer",
      description: "View 3D models in the Charpstar viewer",
      icon: Eye,
      action: () => window.open("https://viewer.charpstar.co/", "_blank"),
      color: "bg-orange-50 text-orange-600",
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
              <div
                className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center`}
              >
                <action.icon className="h-5 w-5" />
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
