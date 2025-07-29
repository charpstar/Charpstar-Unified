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
  ArrowLeft,
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
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
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

      // Group assets by client and batch
      const batchMap = new Map<string, BatchSummary>();

      assetAssignments.forEach((assignment: any) => {
        const asset = assignment.onboarding_assets;
        const key = `${asset.client}-${asset.batch}`;

        if (!batchMap.has(key)) {
          batchMap.set(key, {
            client: asset.client,
            batch: asset.batch,
            totalAssets: 0,
            completedAssets: 0,
            inProgressAssets: 0,
            pendingAssets: 0,
            revisionAssets: 0,
            completionPercentage: 0,
            assignedAt: assignment.assigned_at,
            deliveryDate: asset.delivery_date,
            totalEarnings: 0,
            completedEarnings: 0,
            pendingEarnings: 0,
            urgentAssets: 0,
          });
        }

        const batch = batchMap.get(key)!;
        batch.totalAssets++;

        // Calculate earnings (bonus only applies if completed before deadline)
        const baseEarnings = assignment.price || 0;
        const bonus = assignment.bonus || 0;
        const totalEarnings = baseEarnings * (1 + bonus / 100);

        batch.totalEarnings += totalEarnings;

        // Count assets by status
        switch (asset.status) {
          case "approved":
            batch.completedAssets++;
            batch.completedEarnings += totalEarnings;
            break;
          case "in_production":
            batch.inProgressAssets++;
            batch.pendingEarnings += totalEarnings;
            break;
          case "delivered_by_artist":
            batch.pendingEarnings += totalEarnings;
            break;
          case "revisions":
            batch.revisionAssets++;
            batch.pendingEarnings += totalEarnings;
            break;
          case "not_started":
            batch.pendingAssets++;
            batch.pendingEarnings += totalEarnings;
            break;
        }

        // Count urgent assets (priority 1)
        if (asset.priority === 1) {
          batch.urgentAssets++;
        }
      });

      // Calculate completion percentages
      const processedSummaries = Array.from(batchMap.values()).map((batch) => ({
        ...batch,
        completionPercentage:
          batch.totalAssets > 0
            ? Math.round((batch.completedAssets / batch.totalAssets) * 100)
            : 0,
      }));

      setBatchSummaries(processedSummaries);
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
      toast.error("Failed to fetch your assignments");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const handleViewBatch = (client: string, batch: number) => {
    router.push(`/my-assignments/${encodeURIComponent(client)}/${batch}`);
  };

  // Skeleton loading component
  const BatchSummarySkeleton = () => (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-4 bg-gray-200 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress skeleton */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-8 bg-gray-200 rounded" />
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2" />
          </div>

          {/* Earnings skeleton */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>

          {/* Deadline skeleton */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>

          {/* Asset stats skeleton */}
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-3 w-3 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user || user.metadata?.role !== "modeler") {
    return (
      <div className="container mx-auto p-6 space-y-6">
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
    <div className="container mx-auto p-6 pt-22 space-y-6">
      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <div className="h-5 w-5 bg-gray-300 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : batchSummaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-muted rounded-lg">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Batches
                </p>
                <p className="text-2xl font-bold text-info">
                  {batchSummaries.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-muted rounded-lg">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Potential Earnings
                </p>
                <p className="text-2xl font-medium text-success">
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
                <Target className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Urgent Assets
                </p>
                <p className="text-2xl font-bold text-warning">
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
              <div className="p-2 bg-accent-purple/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed Earnings
                </p>
                <p className="text-2xl font-bold text-accent-purple">
                  €
                  {batchSummaries
                    .reduce((sum, batch) => sum + batch.completedEarnings, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Batch Summaries */}
      {loading ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Batch Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <BatchSummarySkeleton key={i} />
            ))}
          </div>
        </div>
      ) : batchSummaries.length > 0 ? (
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
                        <span className="font-semibold text-success">
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
                        <Package className="h-3 w-3 text-info" />
                        <span>{summary.totalAssets} Total</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span>{summary.completedAssets} Done</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-warning" />
                        <span>{summary.inProgressAssets} In Progress</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-error" />
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
                        <Target className="h-4 w-4 text-warning" />
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
