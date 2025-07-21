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

      // Calculate statistics
      const totalAssigned = allAssets.length;
      const completed = allAssets.filter(
        (asset) =>
          asset.status === "approved" || asset.status === "delivered_by_artist"
      ).length;
      const inProgress = allAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pending = allAssets.filter(
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

// Simple Earnings Widget
export function ModelerEarningsWidget() {
  return (
    <div className="h-full flex flex-col min-h-[283px]">
      <h3 className="text-lg font-semibold mb-4">Earnings Overview</h3>
      <div className="grid grid-cols-3 gap-4 flex-1 h-full">
        <Card className="p-4 flex flex-col  justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Total Earnings
            </p>
            <p className="text-2xl font-bold">$1,250</p>
          </div>
        </Card>
        <Card className="p-4 flex flex-col justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              This Month
            </p>
            <p className="text-2xl font-bold text-green-600">$375</p>
          </div>
        </Card>
        <Card className="p-4 flex flex-col justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Last Month
            </p>
            <p className="text-2xl font-bold">$312</p>
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
      title: "Contact Support",
      description: "Get help when needed",
      icon: Users,
      action: () => window.open("mailto:support@charpstar.com"),
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
