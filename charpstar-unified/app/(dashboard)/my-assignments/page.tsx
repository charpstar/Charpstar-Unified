"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";

import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Calendar,
  TrendingUp,
  Target,
  Building,
} from "lucide-react";
import { toast } from "sonner";

interface BatchSummary {
  client: string;
  batch: number;
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
  completionPercentage: number;
  assignedAt: string;
  deliveryDate?: string;
  totalEarnings: number;
  completedEarnings: number;
  pendingEarnings: number;
  urgentAssets: number;
}

export default function MyAssignmentsPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  const [batchSummaries, setBatchSummaries] = useState<BatchSummary[]>([]);

  useEffect(() => {
    document.title = "CharpstAR Platform - My Assignments";
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchAssignedAssets();
    }
  }, [user?.id]);

  const fetchAssignedAssets = async () => {
    try {
      startLoading();

      // Get user's individual asset assignments - only accepted ones
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          assigned_at,
          status,
          price,
          bonus,
          onboarding_assets!inner(
            id,
            product_name,
            status,
            priority,
            client,
            batch,
            delivery_date,
            created_at
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted"); // Only show accepted assignments

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        toast.error("Failed to fetch your assignments");
        return;
      }

      if (!assetAssignments || assetAssignments.length === 0) {
        setBatchSummaries([]);
        return;
      }

      // Extract assets from assignments with pricing data
      const allAssets = assetAssignments
        .map((assignment) => ({
          ...assignment.onboarding_assets,
          assigned_at: assignment.assigned_at,
          price: assignment.price || 0,
          bonus: assignment.bonus || 0,
        }))
        .filter(Boolean) as any[];

      // Create batch summaries by grouping assets
      const batchMap = new Map<string, BatchSummary>();

      allAssets.forEach((asset) => {
        const batchKey = `${asset.client}-${asset.batch}`;

        if (!batchMap.has(batchKey)) {
          batchMap.set(batchKey, {
            client: asset.client,
            batch: asset.batch,
            totalAssets: 0,
            completedAssets: 0,
            inProgressAssets: 0,
            pendingAssets: 0,
            revisionAssets: 0,
            completionPercentage: 0,
            assignedAt: asset.assigned_at,
            deliveryDate: asset.delivery_date,
            totalEarnings: 0,
            completedEarnings: 0,
            pendingEarnings: 0,
            urgentAssets: 0,
          });
        }

        const batch = batchMap.get(batchKey)!;
        batch.totalAssets++;

        // Calculate earnings
        const assetEarnings = asset.price || 0;
        batch.totalEarnings += assetEarnings;

        // Check for urgent assets (priority 1 or delivery date within 3 days)
        const isUrgent =
          asset.priority === 1 ||
          (asset.delivery_date &&
            new Date(asset.delivery_date) <=
              new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
        if (isUrgent) {
          batch.urgentAssets++;
        }

        if (
          asset.status === "approved" ||
          asset.status === "delivered_by_artist"
        ) {
          batch.completedAssets++;
          batch.completedEarnings += assetEarnings;
        } else if (asset.status === "in_production") {
          batch.inProgressAssets++;
          batch.pendingEarnings += assetEarnings;
        } else if (asset.status === "not_started") {
          batch.pendingAssets++;
          batch.pendingEarnings += assetEarnings;
        } else if (asset.status === "revisions") {
          batch.revisionAssets++;
          batch.pendingEarnings += assetEarnings;
        }
      });

      // Calculate completion percentages
      batchMap.forEach((batch) => {
        batch.completionPercentage =
          batch.totalAssets > 0
            ? Math.round((batch.completedAssets / batch.totalAssets) * 100)
            : 0;
      });

      setBatchSummaries(Array.from(batchMap.values()));
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
      toast.error("Failed to fetch your assignments");
    } finally {
      stopLoading();
    }
  };

  const handleViewBatch = (client: string, batch: number) => {
    router.push(`/my-assignments/${encodeURIComponent(client)}/${batch}`);
  };

  if (!user) {
    return null;
  }

  if (user.metadata?.role !== "modeler") {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for modelers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Assignments</h1>
        <p className="text-muted-foreground">
          Manage your assigned batches and track your progress
        </p>
      </div>

      {/* Summary Cards */}
      {batchSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Batches
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {batchSummaries.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Potential Earnings
                </p>
                <p className="text-2xl font-medium text-green-600">
                  €
                  {batchSummaries
                    .reduce((sum, batch) => sum + batch.totalEarnings, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Urgent Assets
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {batchSummaries.reduce(
                    (sum, batch) => sum + batch.urgentAssets,
                    0
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed Earnings
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  €
                  {batchSummaries
                    .reduce((sum, batch) => sum + batch.completedEarnings, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Batch Summaries */}
      {batchSummaries.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Batch Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchSummaries.map((summary) => (
              <Card
                key={`${summary.client}-${summary.batch}`}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleViewBatch(summary.client, summary.batch)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">
                        {summary.client}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        Batch {summary.batch}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Progress
                        </span>
                        <span className="font-semibold">
                          {summary.completionPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${summary.completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Earnings Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Earnings
                        </span>
                        <span className="font-semibold text-green-600">
                          €{summary.totalEarnings.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        €{summary.completedEarnings.toFixed(2)} completed
                      </div>
                    </div>

                    {/* Deadline Section */}
                    {summary.deliveryDate && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Delivery Date</span>
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(summary.deliveryDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {/* Asset Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-blue-600" />
                        <span>{summary.totalAssets} Total</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span>{summary.completedAssets} Done</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-600" />
                        <span>{summary.inProgressAssets} In Progress</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-red-600" />
                        <span>
                          {summary.revisionAssets > 0
                            ? `${summary.revisionAssets} Sent for Revisions`
                            : summary.pendingAssets > 0
                              ? `${summary.pendingAssets} Pending`
                              : "0 Pending"}
                        </span>
                      </div>
                    </div>

                    {/* Urgent Assets Warning */}
                    {summary.urgentAssets > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                        <Target className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-700">
                          {summary.urgentAssets} urgent asset
                          {summary.urgentAssets !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Batch Assignments</h3>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t been assigned to any batches yet. Check back later
            or contact your administrator.
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
