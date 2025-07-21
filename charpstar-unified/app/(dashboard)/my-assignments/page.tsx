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

import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
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

      // Get user's individual asset assignments
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          assigned_at,
          onboarding_assets!inner(*)
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        toast.error("Failed to fetch your assignments");
        return;
      }

      if (!assetAssignments || assetAssignments.length === 0) {
        setBatchSummaries([]);
        return;
      }

      // Extract assets from assignments
      const allAssets = assetAssignments
        .map((assignment) => ({
          ...assignment.onboarding_assets,
          assigned_at: assignment.assigned_at,
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
          });
        }

        const batch = batchMap.get(batchKey)!;
        batch.totalAssets++;

        if (
          asset.status === "approved" ||
          asset.status === "delivered_by_artist"
        ) {
          batch.completedAssets++;
        } else if (asset.status === "in_production") {
          batch.inProgressAssets++;
        } else if (asset.status === "not_started") {
          batch.pendingAssets++;
        } else if (asset.status === "revisions") {
          batch.revisionAssets++;
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
      <div className="flex flex-1 flex-col p-4 sm:p-6">
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
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="mb-6"></div>

      {/* Batch Summaries */}
      {batchSummaries.length > 0 ? (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">Your Batch Assignments</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchSummaries.map((summary) => (
              <Card
                key={`${summary.client}-${summary.batch}`}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewBatch(summary.client, summary.batch)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {summary.client} - Batch {summary.batch}
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
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
                        <span>{summary.pendingAssets} Pending</span>
                      </div>
                    </div>
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
