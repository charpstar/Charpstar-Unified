"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";

import {
  Package,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Target,
  Building,
  CheckCircle,
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
  waitingOnApprovalAssets: number;
  notStartedAssets: number;
  completionPercentage: number;
  deliveryDate?: string | null;
  urgentAssets: number;
  assetIds: string[];
}

export default function QAAssignmentsPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  const [batchSummaries, setBatchSummaries] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "CharpstAR Platform - QA Assignments";
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchQAAssets();
    }
  }, [user?.id]);

  const fetchQAAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // Get all QA-handled assets from onboarding_assets
      const { data: qaAssets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select(
          `
          id,
          product_name,
          status,
          priority,
          client,
          batch,
          delivery_date,
          created_at
        `
        )
        .or(
          "qa_team_handles_model.eq.true,pricing_option_id.eq.qa_team_handles_model"
        );

      if (assetsError) {
        console.error("Error fetching QA assets:", assetsError);
        toast.error("Failed to fetch QA assignments");
        return;
      }

      if (!qaAssets || qaAssets.length === 0) {
        setBatchSummaries([]);
        return;
      }

      // Group assets by client first, then by batch within each client
      const clientMap = new Map<string, Map<number, BatchSummary>>();

      qaAssets.forEach((asset: any) => {
        const clientKey = asset.client;
        const batchNumber = asset.batch;

        if (!clientMap.has(clientKey)) {
          clientMap.set(clientKey, new Map());
        }

        const batchMap = clientMap.get(clientKey)!;

        if (!batchMap.has(batchNumber)) {
          batchMap.set(batchNumber, {
            client: asset.client,
            batch: asset.batch,
            totalAssets: 0,
            completedAssets: 0,
            inProgressAssets: 0,
            pendingAssets: 0,
            revisionAssets: 0,
            waitingOnApprovalAssets: 0,
            notStartedAssets: 0,
            completionPercentage: 0,
            deliveryDate: asset.delivery_date,
            urgentAssets: 0,
            assetIds: [],
          });
        }

        const batch = batchMap.get(batchNumber)!;
        batch.totalAssets++;
        batch.assetIds.push(asset.id);

        // Count assets by status
        switch (asset.status) {
          case "approved":
          case "approved_by_client":
            batch.completedAssets++;
            break;
          case "in_production":
            batch.inProgressAssets++;
            break;
          case "delivered_by_artist":
            batch.waitingOnApprovalAssets++;
            break;
          case "revisions":
          case "client_revision":
            batch.revisionAssets++;
            break;
          case "not_started":
            batch.notStartedAssets++;
            break;
        }

        // Count urgent assets (priority 1)
        if (asset.priority === 1) {
          batch.urgentAssets++;
        }
      });

      // Flatten the client-batch structure and calculate completion percentages
      const processedSummaries: BatchSummary[] = [];

      clientMap.forEach((batchMap) => {
        batchMap.forEach((batch) => {
          processedSummaries.push({
            ...batch,
            completionPercentage:
              batch.totalAssets > 0
                ? Math.round((batch.completedAssets / batch.totalAssets) * 100)
                : 0,
          });
        });
      });

      setBatchSummaries(processedSummaries);
    } catch (error) {
      console.error("Error fetching QA assets:", error);
      toast.error("Failed to fetch QA assignments");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const handleViewBatch = (client: string, batch: number, filter?: string) => {
    const url = `/qa-assignments/${encodeURIComponent(client)}/${batch}`;
    if (filter) {
      router.push(`${url}?filter=${filter}`);
    } else {
      router.push(url);
    }
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
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-8 bg-gray-200 rounded" />
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2" />
          </div>
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

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied only after user context has loaded and user doesn't have access
  if (!user || user.metadata?.role !== "qa") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for QA team members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Package className="h-3 w-3" />
            QA Assignments
          </Badge>
        </div>
      </div>

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
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed Assets
                </p>
                <p className="text-2xl font-bold text-success">
                  {batchSummaries.reduce(
                    (sum, batch) => sum + batch.completedAssets,
                    0
                  )}
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
                <Package className="h-5 w-5 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Assets
                </p>
                <p className="text-2xl font-bold text-accent-purple">
                  {batchSummaries.reduce(
                    (sum, batch) => sum + batch.totalAssets,
                    0
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Batch Summaries */}
      {loading ? (
        <div className="mb-6 ">
          <h2 className="text-xl font-semibold mb-4">Batch Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <BatchSummarySkeleton key={i} />
            ))}
          </div>
        </div>
      ) : batchSummaries.length > 0 ? (
        <div className="mb-6 ">
          <h2 className="text-xl font-semibold mb-4">QA-Handled Models</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchSummaries.map((batch) => (
              <Card
                key={`${batch.client}-${batch.batch}`}
                className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-black/5"
                onClick={() => handleViewBatch(batch.client, batch.batch)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {batch.client}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Batch {batch.batch}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span className="font-medium">
                          {batch.completionPercentage}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                          style={{
                            width: `${batch.completionPercentage}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-background border border-border/60 p-2 text-center">
                        <div className="text-xs text-muted-foreground">
                          Total
                        </div>
                        <div className="text-sm font-semibold">
                          {batch.totalAssets}
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/60 p-2 text-center">
                        <div className="text-xs text-emerald-700 dark:text-emerald-300">
                          Completed
                        </div>
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {batch.completedAssets}
                        </div>
                      </div>
                      <div className="rounded-lg bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/60 p-2 text-center">
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          In Progress
                        </div>
                        <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          {batch.inProgressAssets}
                        </div>
                      </div>
                      <div className="rounded-lg bg-purple-50/60 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/60 p-2 text-center">
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                          Waiting
                        </div>
                        <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                          {batch.waitingOnApprovalAssets}
                        </div>
                      </div>
                    </div>

                    {/* Footer chips */}
                    <div className="flex flex-wrap gap-2">
                      {batch.revisionAssets > 0 && (
                        <Badge className="inline-flex items-center gap-1 rounded-full bg-error-muted px-2 py-1 text-[11px] font-medium text-error">
                          <AlertCircle className="h-3 w-3" />{" "}
                          {batch.revisionAssets} revisions
                        </Badge>
                      )}
                      {batch.urgentAssets > 0 && (
                        <Badge
                          className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/20 px-2 py-1 text-[11px] font-medium text-orange-700 dark:text-orange-300 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-800/30 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewBatch(
                              batch.client,
                              batch.batch,
                              "urgent"
                            );
                          }}
                        >
                          <Target className="h-3 w-3" /> {batch.urgentAssets}{" "}
                          urgent
                        </Badge>
                      )}
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
          <h3 className="text-lg font-semibold mb-2">No QA-Handled Models</h3>
          <p className="text-muted-foreground mb-4">
            There are no QA-handled models assigned yet. Check back later or
            contact your administrator.
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
