"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/interactive";

import { TeamInfoTooltip } from "@/components/production/TeamInfoTooltip";

import { supabase } from "@/lib/supabaseClient";
import {
  CloudUpload,
  TrendingUp,
  Calendar,
  Package,
  Search,
  Filter,
  Building,
  Users,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/utilities";
import type { DateRange } from "react-day-picker";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

interface BatchProgress {
  id: string;
  client: string;
  batch: number;
  totalModels: number;
  completedModels: number;
  startDate: string;
  deadline: string;
  completionPercentage: number;
  unassignedAssets: number;
  statusCounts: {
    in_production: number;
    revisions: number;
    approved: number;
    approved_by_client: number;
    delivered_by_artist: number;
  };
  assignedUsers: {
    modelers: Array<{ id: string; email: string; title?: string }>;
    qa: Array<{ id: string; email: string; title?: string }>;
  };
}

interface ModelerProgress {
  id: string;
  email: string;
  name?: string;
  totalAssigned: number;
  completedModels: number;
  inProgressModels: number;
  pendingModels: number;
  revisionModels: number;
  completionPercentage: number;
  assignedBatches: Array<{ client: string; batch: number }>;
  statusCounts: {
    in_production: number;
    revisions: number;
    approved: number;
    approved_by_client: number;
    delivered_by_artist: number;
  };
  completionStats: {
    averageHours: number;
    averageDays: number;
    averageMinutes: number;
    totalCompleted: number;
    fastestCompletion: number;
    slowestCompletion: number;
    fastestCompletionMinutes: number;
    slowestCompletionMinutes: number;
    revisionRate: number;
    totalRevisions: number;
  };
}

interface QAProgress {
  id: string;
  email: string;
  name?: string;
  totalAssigned: number;
  completedReviews: number;
  inProgressReviews: number;
  pendingReviews: number;
  revisionReviews: number;
  completionPercentage: number;
  assignedBatches: Array<{ client: string; batch: number }>;
  statusCounts: {
    in_production: number;
    revisions: number;
    approved: number;
    approved_by_client: number;
    delivered_by_artist: number;
  };
  reviewStats: {
    averageReviewTime: number;
    totalReviews: number;
    fastestReview: number;
    slowestReview: number;
    revisionRate: number;
    totalRevisions: number;
  };
  // New fields for enhanced QA statistics
  connectedModelers: Array<{
    id: string;
    email: string;
    name?: string;
    totalAssets: number;
    completedAssets: number;
    inProgressAssets: number;
    pendingAssets: number;
    revisionAssets: number;
    completionPercentage: number;
    clients: string[];
  }>;
  totalModelers: number;
  totalModelerAssets: number;
  totalModelerCompleted: number;
  modelerCompletionRate: number;
  // Chart data for the last 7 days
  chartData: Array<{
    date: string;
    reviewed: number;
    approved: number;
  }>;
  // Date range for chart data
  chartDateRange: DateRange;
}

// Helper function to check if deadline is overdue

export default function ProductionDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchProgress[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchProgress[]>([]);
  const [modelers, setModelers] = useState<ModelerProgress[]>([]);
  const [filteredModelers, setFilteredModelers] = useState<ModelerProgress[]>(
    []
  );
  const [qaUsers, setQAUsers] = useState<QAProgress[]>([]);
  const [filteredQAUsers, setFilteredQAUsers] = useState<QAProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoadingStates, setChartLoadingStates] = useState<
    Record<string, boolean>
  >({});
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{
    client: string;
    batch: number;
  } | null>(null);

  // Get state from URL params with defaults
  const searchTerm = searchParams.get("search") || "";
  const clientFilter = searchParams.get("client") || "all";
  const sortBy = searchParams.get("sort") || "client-batch-stable";

  // Get view mode from URL params, default to "batches"
  const viewMode =
    (searchParams.get("view") as
      | "batches"
      | "modelers"
      | "qa"
      | "pending-revisions") || "batches";

  // Function to handle view mode changes and update URL
  const handleViewModeChange = (
    newViewMode: "batches" | "modelers" | "qa" | "pending-revisions"
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newViewMode);
    router.push(`/production?${params.toString()}`);
  };

  // Function to handle search term changes and update URL
  const handleSearchChange = (newSearchTerm: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSearchTerm) {
      params.set("search", newSearchTerm);
    } else {
      params.delete("search");
    }
    router.push(`/production?${params.toString()}`);
  };

  // Function to handle client filter changes and update URL
  const handleClientFilterChange = (newClientFilter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newClientFilter !== "all") {
      params.set("client", newClientFilter);
    } else {
      params.delete("client");
    }
    router.push(`/production?${params.toString()}`);
  };

  // Function to handle sort changes and update URL
  const handleSortChange = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSortBy);
    router.push(`/production?${params.toString()}`);
  };

  useEffect(() => {
    document.title = "CharpstAR Platform - Production Dashboard";
  }, []);

  useEffect(() => {
    fetchBatchProgress();
  }, []);

  const fetchBatchProgress = async () => {
    try {
      setLoading(true);

      // Get all assets with batch information
      const { data: assetData, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("id, client, batch, created_at, status, delivery_date")
        .order("client");

      if (assetError) throw assetError;

      // Group by client and batch
      const batchMap = new Map<string, BatchProgress>();

      assetData?.forEach((asset) => {
        const client = asset.client;
        const batch = asset.batch || 1;
        const batchKey = `${client}-${batch}`;

        if (!batchMap.has(batchKey)) {
          batchMap.set(batchKey, {
            id: batchKey,
            client,
            batch,
            totalModels: 0,
            completedModels: 0,
            startDate: asset.created_at || new Date().toISOString(),
            deadline: asset.delivery_date || new Date().toISOString(),
            completionPercentage: 0,
            unassignedAssets: 0,
            statusCounts: {
              in_production: 0,
              revisions: 0,
              approved: 0,
              approved_by_client: 0,
              delivered_by_artist: 0,
            },
            assignedUsers: {
              modelers: [],
              qa: [],
            },
          });
        }

        const batchProgress = batchMap.get(batchKey)!;
        batchProgress.totalModels++;

        // Count by status
        if (asset.status) {
          if (asset.status in batchProgress.statusCounts) {
            batchProgress.statusCounts[
              asset.status as keyof typeof batchProgress.statusCounts
            ]++;
          }
        }

        // Count completed models (approved + approved_by_client + delivered)
        if (
          asset.status === "approved" ||
          asset.status === "approved_by_client" ||
          asset.status === "delivered_by_artist"
        ) {
          batchProgress.completedModels++;
        }
      });

      // Get assigned users for each batch from the asset assignments table
      const { data: assetAssignmentsData, error: assetAssignmentsError } =
        await supabase
          .from("asset_assignments")
          .select(
            `
            user_id,
            role,
            asset_id,
            onboarding_assets!inner(client, batch)
          `
          )
          .eq("role", "modeler");

      if (assetAssignmentsError) {
        console.error(
          "Error fetching asset assignments:",
          assetAssignmentsError
        );
      }

      // Get user details for assigned users
      const assignedUserIds = assetAssignmentsData?.map((a) => a.user_id) || [];
      let userDetails: any[] = [];

      if (assignedUserIds.length > 0) {
        const { data: userDetailsData, error: userDetailsError } =
          await supabase
            .from("profiles")
            .select("id, email, title")
            .in("id", assignedUserIds);

        if (userDetailsError) {
          console.error("Error fetching user details:", userDetailsError);
        } else {
          userDetails = userDetailsData || [];
        }
      }

      // Create a map of user details by ID
      const userDetailsMap = new Map(
        userDetails.map((user) => [user.id, user])
      );

      // Group assigned users by client and batch with assignment counts
      const batchUsersMap = new Map<string, { modelers: any[]; qa: any[] }>();

      // First, create a map to count assignments per user per batch
      const userAssignmentCounts = new Map<
        string,
        Map<string, { modeler: number; qa: number }>
      >();

      assetAssignmentsData?.forEach((assignment) => {
        const asset = assignment.onboarding_assets as any;
        if (assignment.role === "modeler" || assignment.role === "qa") {
          const batchKey = `${asset.client}-${asset.batch}`;
          const userId = assignment.user_id;

          if (!userAssignmentCounts.has(batchKey)) {
            userAssignmentCounts.set(batchKey, new Map());
          }

          const batchUserCounts = userAssignmentCounts.get(batchKey)!;
          if (!batchUserCounts.has(userId)) {
            batchUserCounts.set(userId, { modeler: 0, qa: 0 });
          }

          const userCounts = batchUserCounts.get(userId)!;
          if (assignment.role === "modeler") {
            userCounts.modeler++;
          } else if (assignment.role === "qa") {
            userCounts.qa++;
          }
        }
      });

      // Now create the final user lists with counts
      userAssignmentCounts.forEach((batchUserCounts, batchKey) => {
        if (!batchUsersMap.has(batchKey)) {
          batchUsersMap.set(batchKey, {
            modelers: [],
            qa: [],
          });
        }

        const batchUsers = batchUsersMap.get(batchKey)!;

        batchUserCounts.forEach((counts, userId) => {
          const userDetail = userDetailsMap.get(userId);
          const userInfo = {
            id: userId,
            email: userDetail?.email || "",
            title: userDetail?.title || "",
            assignmentCount: counts.modeler + counts.qa, // Total assignments for this user
          };

          if (counts.modeler > 0) {
            batchUsers.modelers.push({
              ...userInfo,
              modelerCount: counts.modeler,
            });
          }

          if (counts.qa > 0) {
            batchUsers.qa.push({
              ...userInfo,
              qaCount: counts.qa,
            });
          }
        });
      });

      // Get asset assignments to calculate unassigned assets
      const { data: assetAssignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("role", "modeler");

      if (assignmentsError) {
        console.error("Error fetching asset assignments:", assignmentsError);
      }

      // Calculate unassigned assets for each batch
      const assignedAssetIds = new Set(
        assetAssignments?.map((assignment) => assignment.asset_id) || []
      );

      // Calculate completion percentages and format dates
      const batchesArray = Array.from(batchMap.values()).map((batch) => {
        const batchKey = `${batch.client}-${batch.batch}`;
        const assignedUsers = batchUsersMap.get(batchKey) || {
          modelers: [],
          qa: [],
        };

        // Count unassigned assets for this batch
        const batchAssets =
          assetData?.filter(
            (asset) =>
              asset.client === batch.client && asset.batch === batch.batch
          ) || [];

        const unassignedCount = batchAssets.filter(
          (asset) => !assignedAssetIds.has(asset.id)
        ).length;

        return {
          ...batch,
          id: batchKey, // Add a unique identifier for stable sorting
          completionPercentage:
            batch.totalModels > 0
              ? Math.round((batch.completedModels / batch.totalModels) * 100)
              : 0,
          startDate: new Date(batch.startDate).toLocaleDateString(),
          deadline: new Date(batch.deadline).toLocaleDateString(),
          unassignedAssets: unassignedCount,
          assignedUsers,
        };
      });

      setBatches(batchesArray);
      setFilteredBatches(batchesArray);

      // Fetch modeler data
      await fetchModelerProgress(assetData || []);

      // Fetch QA data
      await fetchQAProgress();
    } catch {
      console.error("Error fetching client progress");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchModelerProgress = async (assetData: any[]) => {
    try {
      // Get all modelers from profiles table
      const { data: modelerDetails, error: userError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "modeler");

      if (userError) {
        console.error("Error fetching modeler details:", userError);
        return;
      }

      // Get all individual asset assignments for modelers
      const { data: assetAssignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select(
          `
            user_id,
            asset_id,
            onboarding_assets!inner(client, batch, status)
          `
        )
        .eq("role", "modeler");

      if (assignmentsError) {
        console.error("Error fetching asset assignments:", assignmentsError);
        return;
      }

      // Create modeler progress map
      const modelerMap = new Map<string, ModelerProgress>();

      // Initialize all modelers (even those without assignments)
      modelerDetails?.forEach((modeler) => {
        modelerMap.set(modeler.id, {
          id: modeler.id,
          email: modeler.email,
          name: modeler.title,
          totalAssigned: 0,
          completedModels: 0,
          inProgressModels: 0,
          pendingModels: 0,
          revisionModels: 0,
          completionPercentage: 0,
          assignedBatches: [],
          statusCounts: {
            in_production: 0,
            revisions: 0,
            approved: 0,
            approved_by_client: 0,
            delivered_by_artist: 0,
          },
          completionStats: {
            averageHours: 0,
            averageDays: 0,
            averageMinutes: 0,
            totalCompleted: 0,
            fastestCompletion: 0,
            slowestCompletion: 0,
            fastestCompletionMinutes: 0,
            slowestCompletionMinutes: 0,
            revisionRate: 0,
            totalRevisions: 0,
          },
        });
      });

      // Process individual asset assignments
      assetAssignments?.forEach((assignment) => {
        const modeler = modelerMap.get(assignment.user_id);
        if (!modeler) return;

        const asset = assignment.onboarding_assets as any;
        if (!asset) return;

        // Add to assigned batches (avoid duplicates)
        const batchKey = `${asset.client}-${asset.batch}`;
        const existingBatch = modeler.assignedBatches.find(
          (b) => `${b.client}-${b.batch}` === batchKey
        );
        if (!existingBatch) {
          modeler.assignedBatches.push({
            client: asset.client,
            batch: asset.batch,
          });
        }

        // Count this asset
        modeler.totalAssigned++;

        // Count by status
        if (asset.status) {
          if (asset.status in modeler.statusCounts) {
            modeler.statusCounts[
              asset.status as keyof typeof modeler.statusCounts
            ]++;
          }
        }

        // Count by category
        if (
          asset.status === "approved" ||
          asset.status === "approved_by_client"
        ) {
          modeler.completedModels++;
        } else if (asset.status === "in_production") {
          modeler.inProgressModels++;
        } else if (asset.status === "revisions") {
          modeler.revisionModels++;
        } else if (asset.status === "delivered_by_artist") {
          // delivered_by_artist is not counted as completed for modelers
          // It's shown separately in the status breakdown
        } else if (!asset.status || asset.status === "not_started") {
          modeler.pendingModels++;
        }
      });

      // Fetch completion statistics for each modeler
      for (const modeler of modelerMap.values()) {
        try {
          const { data: completionData, error: completionError } =
            await supabase
              .from("asset_assignments")
              .select(
                `
              start_time,
              end_time,
              asset_id,
              onboarding_assets!inner(status, revision_count)
            `
              )
              .eq("user_id", modeler.id)
              .eq("role", "modeler")
              .not("end_time", "is", null);

          if (!completionError && completionData && completionData.length > 0) {
            const completionTimes = completionData.map((assignment) => {
              const start = new Date(assignment.start_time);
              const end = new Date(assignment.end_time);
              return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
            });

            // Calculate revision stats
            const revisionData = completionData.map((assignment) => {
              const asset = assignment.onboarding_assets as any;
              return {
                status: asset.status,
                revisionCount: asset.revision_count || 0,
              };
            });

            const totalRevisions = revisionData.reduce(
              (sum, item) => sum + item.revisionCount,
              0
            );
            const revisionRate =
              completionTimes.length > 0
                ? (totalRevisions / completionTimes.length) * 100
                : 0;

            const totalHours = completionTimes.reduce(
              (sum, time) => sum + time,
              0
            );
            const avgHours = totalHours / completionTimes.length;
            const fastest = Math.min(...completionTimes);
            const slowest = Math.max(...completionTimes);

            modeler.completionStats = {
              averageHours: Math.round(avgHours * 100) / 100,
              averageDays: Math.round((avgHours / 24) * 100) / 100,
              averageMinutes: Math.round(avgHours * 60),
              totalCompleted: completionTimes.length,
              fastestCompletion: Math.round(fastest * 100) / 100,
              slowestCompletion: Math.round(slowest * 100) / 100,
              fastestCompletionMinutes: Math.round(fastest * 60),
              slowestCompletionMinutes: Math.round(slowest * 60),
              revisionRate: Math.round(revisionRate * 100) / 100,
              totalRevisions,
            };
          }
        } catch (error) {
          console.error(
            `Error fetching completion stats for modeler ${modeler.id}:`,
            error
          );
        }
      }

      // Calculate completion percentages
      modelerMap.forEach((modeler) => {
        // Only count approved and approved_by_client as completed for percentage calculation
        const completedCount =
          modeler.statusCounts.approved +
          modeler.statusCounts.approved_by_client;
        modeler.completionPercentage =
          modeler.totalAssigned > 0
            ? Math.round((completedCount / modeler.totalAssigned) * 100)
            : 0;
      });

      const modelersArray = Array.from(modelerMap.values());
      setModelers(modelersArray);
      setFilteredModelers(modelersArray);
    } catch (error) {
      console.error("Error fetching modeler progress:", error);
    }
  };

  // Fetch QA progress data
  const fetchQAProgress = async () => {
    try {
      // Get all QA users from profiles table
      const { data: qaDetails, error: userError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "qa");

      if (userError) {
        console.error("Error fetching QA details:", userError);
        return;
      }

      // Get all individual asset assignments for QA users
      const { data: assetAssignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select(
          `
            user_id,
            asset_id,
            onboarding_assets!inner(client, batch, status)
          `
        )
        .eq("role", "qa");

      if (assignmentsError) {
        console.error("Error fetching QA asset assignments:", assignmentsError);
        return;
      }

      // Create QA progress map
      const qaMap = new Map<string, QAProgress>();

      // Initialize all QA users (even those without assignments)
      qaDetails?.forEach((qa) => {
        qaMap.set(qa.id, {
          id: qa.id,
          email: qa.email,
          name: qa.title,
          totalAssigned: 0,
          completedReviews: 0,
          inProgressReviews: 0,
          pendingReviews: 0,
          revisionReviews: 0,
          completionPercentage: 0,
          assignedBatches: [],
          statusCounts: {
            in_production: 0,
            revisions: 0,
            approved: 0,
            approved_by_client: 0,
            delivered_by_artist: 0,
          },
          reviewStats: {
            averageReviewTime: 0,
            totalReviews: 0,
            fastestReview: 0,
            slowestReview: 0,
            revisionRate: 0,
            totalRevisions: 0,
          },
          // Initialize new fields
          connectedModelers: [],
          totalModelers: 0,
          totalModelerAssets: 0,
          totalModelerCompleted: 0,
          modelerCompletionRate: 0,
          chartData: [],
          chartDateRange: {
            from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 7 days ago
            to: new Date(), // today
          },
        });
      });

      // Process individual asset assignments
      assetAssignments?.forEach((assignment) => {
        const qaUser = qaMap.get(assignment.user_id);
        if (!qaUser) return;

        const asset = assignment.onboarding_assets as any;
        if (!asset) return;

        // Add to assigned batches (avoid duplicates)
        const batchKey = `${asset.client}-${asset.batch}`;
        const existingBatch = qaUser.assignedBatches.find(
          (b) => `${b.client}-${b.batch}` === batchKey
        );
        if (!existingBatch) {
          qaUser.assignedBatches.push({
            client: asset.client,
            batch: asset.batch,
          });
        }

        // Count this asset
        qaUser.totalAssigned++;

        // Count by status
        if (asset.status) {
          if (asset.status in qaUser.statusCounts) {
            qaUser.statusCounts[
              asset.status as keyof typeof qaUser.statusCounts
            ]++;
          }
        }

        // Count by category
        if (
          asset.status === "approved" ||
          asset.status === "approved_by_client"
        ) {
          qaUser.completedReviews++;
        } else if (asset.status === "delivered_by_artist") {
          qaUser.inProgressReviews++;
        } else if (asset.status === "revisions") {
          qaUser.revisionReviews++;
        } else if (!asset.status || asset.status === "not_started") {
          qaUser.pendingReviews++;
        }
      });

      // Calculate completion percentages
      qaMap.forEach((qaUser) => {
        qaUser.completionPercentage =
          qaUser.totalAssigned > 0
            ? Math.round((qaUser.completedReviews / qaUser.totalAssigned) * 100)
            : 0;
      });

      // Now fetch connected modelers and their statistics for each QA
      for (const qaUser of qaMap.values()) {
        // Get QA allocations to find connected modelers
        const { data: qaAllocations, error: allocationError } = await supabase
          .from("qa_allocations")
          .select("modeler_id")
          .eq("qa_id", qaUser.id);

        if (allocationError) {
          console.error("Error fetching QA allocations:", allocationError);
          continue;
        }

        if (!qaAllocations || qaAllocations.length === 0) {
          qaUser.totalModelers = 0;
          qaUser.totalModelerAssets = 0;
          qaUser.totalModelerCompleted = 0;
          qaUser.modelerCompletionRate = 0;
          continue;
        }

        const modelerIds = qaAllocations.map(
          (allocation) => allocation.modeler_id
        );

        // Get modeler details
        const { data: modelerDetails, error: modelerError } = await supabase
          .from("profiles")
          .select("id, email, title")
          .in("id", modelerIds);

        if (modelerError) {
          console.error("Error fetching modeler details:", modelerError);
          continue;
        }

        // Get assets assigned to these modelers
        const { data: modelerAssets, error: assetsError } = await supabase
          .from("asset_assignments")
          .select(
            `
            user_id,
            asset_id,
            onboarding_assets!inner(
              id,
              client,
              batch,
              status,
              created_at
            )
          `
          )
          .in("user_id", modelerIds)
          .eq("role", "modeler");

        if (assetsError) {
          console.error("Error fetching modeler assets:", assetsError);
          continue;
        }

        // Calculate modeler statistics
        const modelerStats = new Map();
        const clientSet = new Set<string>();

        modelerDetails?.forEach((modeler) => {
          modelerStats.set(modeler.id, {
            id: modeler.id,
            email: modeler.email,
            name: modeler.title,
            totalAssets: 0,
            completedAssets: 0,
            inProgressAssets: 0,
            pendingAssets: 0,
            revisionAssets: 0,
            completionPercentage: 0,
            clients: [],
          });
        });

        // Process modeler assets
        modelerAssets?.forEach((assignment) => {
          const modeler = modelerStats.get(assignment.user_id);
          if (!modeler) return;

          const asset = assignment.onboarding_assets as any;
          if (!asset) return;

          modeler.totalAssets++;
          clientSet.add(asset.client);

          if (!modeler.clients.includes(asset.client)) {
            modeler.clients.push(asset.client);
          }

          switch (asset.status) {
            case "approved":
              modeler.completedAssets++;
              break;
            case "in_production":
              modeler.inProgressAssets++;
              break;
            case "delivered_by_artist":
              modeler.pendingAssets++;
              break;
            case "revisions":
              modeler.revisionAssets++;
              break;
            default:
              modeler.pendingAssets++;
              break;
          }
        });

        // Calculate completion percentages for modelers
        modelerStats.forEach((modeler) => {
          modeler.completionPercentage =
            modeler.totalAssets > 0
              ? Math.round(
                  (modeler.completedAssets / modeler.totalAssets) * 100
                )
              : 0;
        });

        // Calculate overall QA statistics
        const connectedModelers = Array.from(modelerStats.values());
        const totalModelerAssets = connectedModelers.reduce(
          (sum, m) => sum + m.totalAssets,
          0
        );
        const totalModelerCompleted = connectedModelers.reduce(
          (sum, m) => sum + m.completedAssets,
          0
        );

        qaUser.connectedModelers = connectedModelers;
        qaUser.totalModelers = connectedModelers.length;
        qaUser.totalModelerAssets = totalModelerAssets;
        qaUser.totalModelerCompleted = totalModelerCompleted;
        qaUser.modelerCompletionRate =
          totalModelerAssets > 0
            ? Math.round((totalModelerCompleted / totalModelerAssets) * 100)
            : 0;

        // Generate chart data for the selected date range (optimized)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days total (including today)
        const today = new Date();

        const fromDateStr = sevenDaysAgo.toISOString().split("T")[0];
        const toDateStr = today.toISOString().split("T")[0];

        // Fetch all QA approvals for the date range
        const { data: approvals } = await supabase
          .from("qa_approvals")
          .select("approved_at")
          .eq("qa_id", qaUser.id)
          .gte("approved_at", fromDateStr + "T00:00:00")
          .lte("approved_at", toDateStr + "T23:59:59");

        // Fetch all QA comments for the date range
        const { data: comments } = await supabase
          .from("asset_comments")
          .select("created_at")
          .eq("created_by", qaUser.id)
          .gte("created_at", fromDateStr + "T00:00:00")
          .lte("created_at", toDateStr + "T23:59:59");

        // Fetch all QA revisions for the date range
        const { data: revisions } = await supabase
          .from("revision_history")
          .select("created_at")
          .eq("created_by", qaUser.id)
          .gte("created_at", fromDateStr + "T00:00:00")
          .lte("created_at", toDateStr + "T23:59:59");

        // Process data on client side
        const chartData: Array<{
          date: string;
          reviewed: number;
          approved: number;
        }> = [];
        const currentDate = new Date(sevenDaysAgo);

        while (currentDate <= today) {
          const dateStr = currentDate.toISOString().split("T")[0];

          // Count approvals for this date
          const dayApprovals =
            approvals?.filter((approval) =>
              approval.approved_at.startsWith(dateStr)
            ).length || 0;

          // Count comments for this date
          const dayComments =
            comments?.filter((comment) =>
              comment.created_at.startsWith(dateStr)
            ).length || 0;

          // Count revisions for this date
          const dayRevisions =
            revisions?.filter((revision) =>
              revision.created_at.startsWith(dateStr)
            ).length || 0;

          const reviewed = dayComments + dayRevisions;
          const approved = dayApprovals;

          chartData.push({
            date: dateStr,
            reviewed,
            approved,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }

        qaUser.chartData = chartData;
        qaUser.chartDateRange = {
          from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 7 days ago
          to: new Date(), // today
        };
      }

      const qaArray = Array.from(qaMap.values());
      setQAUsers(qaArray);
      setFilteredQAUsers(qaArray);
    } catch (error) {
      console.error("Error fetching QA progress:", error);
    }
  };

  // Filter and sort batches based on search term, client filter, and sort criteria
  useEffect(() => {
    let filtered = [...batches];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((batch) =>
        batch.client.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply client filter
    if (clientFilter !== "all") {
      filtered = filtered.filter((batch) => batch.client === clientFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "client-batch-stable":
          // Sort by client first, then by batch number
          const clientComparison = a.client.localeCompare(b.client);
          if (clientComparison !== 0) return clientComparison;
          return a.batch - b.batch;
        case "client-batch":
          // Sort by client first, then by batch number
          const clientComp = a.client.localeCompare(b.client);
          if (clientComp !== 0) return clientComp;
          return a.batch - b.batch;
        case "completion":
          return b.completionPercentage - a.completionPercentage;
        case "deadline":
          return (
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );
        case "unassigned":
          return b.unassignedAssets - a.unassignedAssets;
        default:
          return 0;
      }
    });

    setFilteredBatches(filtered);
  }, [batches, searchTerm, clientFilter, sortBy]);

  // Filter and sort modelers based on search term and sort criteria
  useEffect(() => {
    let filtered = [...modelers];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (modeler) =>
          modeler.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (modeler.name &&
            modeler.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "completion":
          return b.completionPercentage - a.completionPercentage;
        case "total-assigned":
          return b.totalAssigned - a.totalAssigned;
        case "completed":
          return b.completedModels - a.completedModels;
        case "name":
          return (a.name || a.email).localeCompare(b.name || b.email);
        default:
          return 0;
      }
    });

    setFilteredModelers(filtered);
  }, [modelers, searchTerm, sortBy]);

  // Filter and sort QA users based on search term and sort criteria
  useEffect(() => {
    let filtered = [...qaUsers];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (qaUser) =>
          qaUser.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (qaUser.name &&
            qaUser.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "completion":
          return b.completionPercentage - a.completionPercentage;
        case "total-assigned":
          return b.totalAssigned - a.totalAssigned;
        case "completed":
          return b.completedReviews - a.completedReviews;
        case "name":
          return (a.name || a.email).localeCompare(b.name || b.email);
        default:
          return 0;
      }
    });

    setFilteredQAUsers(filtered);
  }, [qaUsers, searchTerm, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_production":
        return "#FACC15"; // warning color
      case "revisions":
        return "#3B82F6"; // info color
      case "approved":
        return "#22C55E"; // success color
      case "approved_by_client":
        return "#10B981"; // emerald color
      case "delivered_by_artist":
        return "#A855F7"; // accent-purple color
      case "not_started":
        return "#EF4444"; // error color

      default:
        return "#FACC15"; // Default to in_production color
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_production":
        return "In Production";
      case "revisions":
        return "Ready for Revision";
      case "approved":
        return "Approved";
      case "approved_by_client":
        return "Approved by Client";
      case "delivered_by_artist":
        return "Delivered";

      default:
        return "In Production"; // Default to in_production label
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "approved_by_client":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "in_production":
        return "bg-warning-muted text-warning border-warning/20";
      case "revisions":
        return "bg-error-muted text-error border-error/20";
      case "delivered_by_artist":
        return "bg-accent-purple/10 text-accent-purple border-accent-purple/20";
      case "not_started":
        return "bg-error-muted text-error border-error/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleAdminReview = (clientName: string, batchNumber: number) => {
    router.push(
      `/admin-review?client=${encodeURIComponent(clientName)}&batch=${batchNumber}`
    );
  };

  const handleModelerAdminReview = (
    modelerId: string,
    modelerEmail: string
  ) => {
    router.push(
      `/admin-review?modeler=${modelerId}&email=${encodeURIComponent(modelerEmail)}`
    );
  };

  // Function to refetch chart data for a specific QA user
  const refetchQAChartData = async (qaUserId: string, dateRange: DateRange) => {
    if (!dateRange.from || !dateRange.to) return;

    // Set loading state for this specific QA user
    setChartLoadingStates((prev) => ({ ...prev, [qaUserId]: true }));

    // Optimized: Fetch all data in single queries and process on client side
    const fromDateStr = dateRange.from.toISOString().split("T")[0];
    const toDateStr = dateRange.to.toISOString().split("T")[0];

    // Fetch all QA approvals for the date range
    const { data: approvals } = await supabase
      .from("qa_approvals")
      .select("approved_at")
      .eq("qa_id", qaUserId)
      .gte("approved_at", fromDateStr + "T00:00:00")
      .lte("approved_at", toDateStr + "T23:59:59");

    // Fetch all QA comments for the date range
    const { data: comments } = await supabase
      .from("asset_comments")
      .select("created_at")
      .eq("created_by", qaUserId)
      .gte("created_at", fromDateStr + "T00:00:00")
      .lte("created_at", toDateStr + "T23:59:59");

    // Fetch all QA revisions for the date range
    const { data: revisions } = await supabase
      .from("revision_history")
      .select("created_at")
      .eq("created_by", qaUserId)
      .gte("created_at", fromDateStr + "T00:00:00")
      .lte("created_at", toDateStr + "T23:59:59");

    // Process data on client side
    const chartData: Array<{
      date: string;
      reviewed: number;
      approved: number;
    }> = [];
    const currentDate = new Date(dateRange.from);

    while (currentDate <= dateRange.to) {
      const dateStr = currentDate.toISOString().split("T")[0];

      // Count approvals for this date
      const dayApprovals =
        approvals?.filter((approval) =>
          approval.approved_at.startsWith(dateStr)
        ).length || 0;

      // Count comments for this date
      const dayComments =
        comments?.filter((comment) => comment.created_at.startsWith(dateStr))
          .length || 0;

      // Count revisions for this date
      const dayRevisions =
        revisions?.filter((revision) => revision.created_at.startsWith(dateStr))
          .length || 0;

      const approved = dayApprovals;
      // Approved products should always be counted as reviewed since QA reviews before approving
      const reviewed = dayComments + dayRevisions + dayApprovals;

      chartData.push({
        date: dateStr,
        reviewed,
        approved,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Update both QA users arrays
    setQAUsers((prev) =>
      prev.map((qa) =>
        qa.id === qaUserId
          ? { ...qa, chartData, chartDateRange: dateRange }
          : qa
      )
    );
    setFilteredQAUsers((prev) =>
      prev.map((qa) =>
        qa.id === qaUserId
          ? { ...qa, chartData, chartDateRange: dateRange }
          : qa
      )
    );

    // Clear loading state
    setChartLoadingStates((prev) => ({ ...prev, [qaUserId]: false }));
  };

  // Function to delete all assets in a batch
  const deleteBatchAssets = async (clientName: string, batchNumber: number) => {
    const batchKey = `${clientName}-${batchNumber}`;
    setDeletingBatch(batchKey);

    try {
      // First, get all asset IDs for this batch
      const { data: assets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select("id")
        .eq("client", clientName)
        .eq("batch", batchNumber);

      if (assetsError) {
        console.error("Error fetching assets:", assetsError);
        throw assetsError;
      }

      if (!assets || assets.length === 0) {
        console.log("No assets found for this batch");
        return;
      }

      const assetIds = assets.map((asset) => asset.id);

      // Get allocation list IDs that are linked to these assets
      const { data: assignments, error: assignmentsQueryError } = await supabase
        .from("asset_assignments")
        .select("allocation_list_id")
        .in("asset_id", assetIds)
        .not("allocation_list_id", "is", null);

      if (assignmentsQueryError) {
        console.error(
          "Error fetching asset assignments:",
          assignmentsQueryError
        );
        throw assignmentsQueryError;
      }

      // Extract unique allocation list IDs
      const allocationListIds = [
        ...new Set(
          assignments
            ?.map((assignment) => assignment.allocation_list_id)
            .filter(Boolean) || []
        ),
      ];

      // Delete related records in the correct order to maintain referential integrity

      // 1. Delete asset assignments
      const { error: assignmentsError } = await supabase
        .from("asset_assignments")
        .delete()
        .in("asset_id", assetIds);

      if (assignmentsError) {
        console.error("Error deleting asset assignments:", assignmentsError);
        throw assignmentsError;
      }

      // 2. Delete asset comments
      const { error: commentsError } = await supabase
        .from("asset_comments")
        .delete()
        .in("asset_id", assetIds);

      if (commentsError) {
        console.error("Error deleting asset comments:", commentsError);
        throw commentsError;
      }

      // 3. Delete revision history
      const { error: revisionError } = await supabase
        .from("revision_history")
        .delete()
        .in("asset_id", assetIds);

      if (revisionError) {
        console.error("Error deleting revision history:", revisionError);
        throw revisionError;
      }

      // 4. Delete QA approvals
      const { error: approvalsError } = await supabase
        .from("qa_approvals")
        .delete()
        .in("asset_id", assetIds);

      if (approvalsError) {
        console.error("Error deleting QA approvals:", approvalsError);
        throw approvalsError;
      }

      // 5. Delete allocation lists that are now empty (no more assets)
      if (allocationListIds.length > 0) {
        const { error: allocationListsError } = await supabase
          .from("allocation_lists")
          .delete()
          .in("id", allocationListIds);

        if (allocationListsError) {
          console.error(
            "Error deleting allocation lists:",
            allocationListsError
          );
          throw allocationListsError;
        }

        console.log(`Deleted ${allocationListIds.length} allocation lists`);
      }

      // 6. Finally, delete the assets themselves
      const { error: assetsDeleteError } = await supabase
        .from("onboarding_assets")
        .delete()
        .eq("client", clientName)
        .eq("batch", batchNumber);

      if (assetsDeleteError) {
        console.error("Error deleting assets:", assetsDeleteError);
        throw assetsDeleteError;
      }

      // Refresh the data
      await fetchBatchProgress();

      console.log(
        `Successfully deleted ${assetIds.length} assets from ${clientName} Batch ${batchNumber}`
      );

      // Close the dialog after successful deletion
      setDeleteDialogOpen(null);
    } catch (error) {
      console.error("Error deleting batch assets:", error);
      // You might want to show a toast notification here
    } finally {
      setDeletingBatch(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Production Dashboard</h1>
            <div className="flex items-center gap-4">
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="h-10 w-40 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center font-bold text-2xl gap-2 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "batches" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("batches")}
              className="text-xs"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Projects
            </Button>
            <Button
              variant={viewMode === "modelers" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("modelers")}
              className="text-xs"
            >
              <Building className="h-4 w-4 mr-1" />
              Modelers
            </Button>
            <Button
              variant={viewMode === "qa" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("qa")}
              className="text-xs"
            >
              <Users className="h-4 w-4 mr-1" />
              QA
            </Button>
            <Button
              variant={viewMode === "pending-revisions" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("pending-revisions")}
              className="text-xs"
            >
              Pending Revisions
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === "qa" && (
            <Button
              onClick={() => router.push("/production/qa-allocation")}
              variant="outline"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              QA Allocation
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              viewMode === "batches"
                ? "Search clients..."
                : viewMode === "modelers"
                  ? "Search modelers..."
                  : viewMode === "qa"
                    ? "Search QA users..."
                    : "Search assets..."
            }
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "batches" && (
            <>
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={clientFilter}
                onValueChange={handleClientFilterChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue>
                    {clientFilter === "all" ? "All Clients" : clientFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {Array.from(
                    new Set(batches.map((batch) => batch.client))
                  ).map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {viewMode === "batches" ? (
                <>
                  <SelectItem value="client-batch-stable">
                    Client → Batch (Stable)
                  </SelectItem>
                  <SelectItem value="client-batch">Client → Batch</SelectItem>
                  <SelectItem value="completion">
                    Completion % (Highest)
                  </SelectItem>
                  <SelectItem value="deadline">Deadline (Earliest)</SelectItem>
                  <SelectItem value="unassigned">
                    Unassigned Assets (Most)
                  </SelectItem>
                </>
              ) : viewMode === "modelers" ? (
                <>
                  <SelectItem value="completion">
                    Completion % (Highest)
                  </SelectItem>
                  <SelectItem value="total-assigned">
                    Total Assigned (Most)
                  </SelectItem>
                  <SelectItem value="completed">Completed (Most)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="completion">
                    Completion % (Highest)
                  </SelectItem>
                  <SelectItem value="total-assigned">
                    Total Assigned (Most)
                  </SelectItem>
                  <SelectItem value="completed">
                    Completed Reviews (Most)
                  </SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {viewMode === "batches" && (
            <>
              Showing {filteredBatches.length} of {batches.length} batches
            </>
          )}
          {viewMode === "modelers" && (
            <>
              Showing {filteredModelers.length} of {modelers.length} modelers
            </>
          )}
          {viewMode === "qa" && (
            <>
              Showing {filteredQAUsers.length} of {qaUsers.length} QA users
            </>
          )}
          {viewMode === "pending-revisions" && <>Pending revisions</>}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {viewMode === "batches" ? (
          // Batch Cards
          filteredBatches.map((batch) => {
            // Prepare chart data
            const chartData = Object.entries(batch.statusCounts)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_, count]) => count > 0)
              .map(([status, count]) => ({
                name: getStatusLabel(status),
                value: count,
                color: getStatusColor(status),
              }));

            const batchKey = `${batch.client}-${batch.batch}`;
            const isDeleting = deletingBatch === batchKey;

            return (
              <Card
                key={batch.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-semibold">
                        {batch.client} - Batch {batch.batch}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          batch.completionPercentage >= 80
                            ? "default"
                            : batch.completionPercentage >= 50
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-sm"
                      >
                        {batch.completionPercentage}%
                      </Badge>

                      {/* Delete Button */}
                      <Dialog
                        open={
                          deleteDialogOpen?.client === batch.client &&
                          deleteDialogOpen?.batch === batch.batch
                        }
                        onOpenChange={(open) => {
                          if (!open) setDeleteDialogOpen(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isDeleting}
                            onClick={() =>
                              setDeleteDialogOpen({
                                client: batch.client,
                                batch: batch.batch,
                              })
                            }
                          >
                            {isDeleting ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background h-fit">
                          <DialogHeader>
                            <DialogTitle>Delete Batch</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete all assets in{" "}
                              <strong>
                                {batch.client} - Batch {batch.batch}
                              </strong>
                              ?
                              <br />
                              <br />
                              This will permanently delete:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>{batch.totalModels} assets</li>
                                <li>All asset assignments</li>
                                <li>All comments and revision history</li>
                                <li>All QA approvals</li>
                                <li>
                                  All allocation lists containing these assets
                                </li>
                              </ul>
                              <br />
                              This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteDialogOpen(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() =>
                                deleteBatchAssets(batch.client, batch.batch)
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting ? "Deleting..." : "Delete Batch"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Chart */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Total Models:
                        </span>
                        <span className="font-semibold">
                          {batch.totalModels}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Assets Left to Assign:
                        </span>
                        <span
                          className={`font-semibold ${batch.unassignedAssets > 0 ? "text-warning" : "text-success"}`}
                        >
                          {batch.unassignedAssets}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Start Date:
                        </span>
                        <span className="font-medium">{batch.startDate}</span>
                      </div>

                      {/* Assigned Team Indicator */}
                      {(batch.assignedUsers.modelers.length > 0 ||
                        batch.assignedUsers.qa.length > 0) && (
                        <TeamInfoTooltip
                          modelers={batch.assignedUsers.modelers}
                          qa={batch.assignedUsers.qa}
                          clientName={batch.client}
                          batchNumber={batch.batch}
                        >
                          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <Users className="h-4 w-4" />
                            <span>
                              Team (
                              {batch.assignedUsers.modelers.length +
                                batch.assignedUsers.qa.length}
                              )
                            </span>
                          </div>
                        </TeamInfoTooltip>
                      )}

                      {/* Admin Review Button under Team */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-[150px] h-8 text-xs"
                        onClick={() =>
                          handleAdminReview(batch.client, batch.batch)
                        }
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Admin Review
                      </Button>
                    </div>

                    {/* Pie Chart */}
                    <div className="w-40 h-40 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            wrapperStyle={{ zIndex: 99999 }}
                            contentStyle={{
                              backgroundColor: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              zIndex: 99999,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Centered fraction label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-2 border-0 pointer-events-none">
                          <div className="text-2xl text-primary drop-shadow-sm pointer-events-none">
                            {batch.statusCounts.approved}/{batch.totalModels}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">
                            Approved
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Model Statistics
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(batch.statusCounts)
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .filter(([_, count]) => count > 0)
                        .map(([status, count]) => (
                          <div
                            key={status}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getStatusBadgeClass(status)}`}
                              >
                                {getStatusLabel(status)}
                              </Badge>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Modelers Accordion within this project */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Modelers Working on this Project
                    </p>
                    <div className="max-h-64 overflow-y-auto">
                      <Accordion
                        type="single"
                        collapsible
                        className="space-y-1"
                      >
                        {modelers
                          .filter((m) =>
                            m.assignedBatches.some(
                              (ab) =>
                                ab.client === batch.client &&
                                ab.batch === batch.batch
                            )
                          )
                          .map((m) => (
                            <AccordionItem key={m.id} value={m.id}>
                              <AccordionTrigger className="px-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {m.name || m.email.split("@")[0]}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {m.totalAssigned} assigned
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="text-xs text-muted-foreground space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span>Completed:</span>
                                    <span className="font-medium">
                                      {m.statusCounts.approved}
                                    </span>
                                    <span>• In Progress:</span>
                                    <span className="font-medium">
                                      {m.statusCounts.in_production}
                                    </span>
                                    <span>• Revisions:</span>
                                    <span className="font-medium">
                                      {m.statusCounts.revisions}
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={() =>
                                      handleModelerAdminReview(m.id, m.email)
                                    }
                                  >
                                    Admin Review
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                      </Accordion>
                    </div>
                  </div>
                  {/* Action Buttons */}
                </CardContent>
              </Card>
            );
          })
        ) : viewMode === "modelers" ? (
          // Modeler Cards
          filteredModelers.map((modeler) => {
            // Prepare chart data for modeler
            const chartData = Object.entries(modeler.statusCounts)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_, count]) => count > 0)
              .map(([status, count]) => ({
                name: getStatusLabel(status),
                value: count,
                color: getStatusColor(status),
              }));

            return (
              <Card
                key={modeler.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <CardTitle className="text-lg font-semibold text-muted-foreground">
                              {modeler.name || modeler.email.split("@")[0]}
                            </CardTitle>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="max-w-sm bg-background border border-border text-muted-foreground"
                        >
                          <div className="space-y-2">
                            <div className="font-semibold">
                              Completion Statistics
                            </div>
                            {modeler.completionStats.totalCompleted > 0 ? (
                              <>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Average Time:
                                  </span>{" "}
                                  {modeler.completionStats.averageMinutes}m (
                                  {modeler.completionStats.averageHours}h)
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Fastest:
                                  </span>{" "}
                                  {
                                    modeler.completionStats
                                      .fastestCompletionMinutes
                                  }
                                  m ({modeler.completionStats.fastestCompletion}
                                  h)
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Slowest:
                                  </span>{" "}
                                  {
                                    modeler.completionStats
                                      .slowestCompletionMinutes
                                  }
                                  m ({modeler.completionStats.slowestCompletion}
                                  h)
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Total Completed:
                                  </span>{" "}
                                  {modeler.completionStats.totalCompleted}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Revision Rate:
                                  </span>{" "}
                                  {modeler.completionStats.revisionRate}% (
                                  {modeler.completionStats.totalRevisions}{" "}
                                  revisions)
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No completed assignments yet
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Badge
                      variant={
                        modeler.completionPercentage >= 80
                          ? "default"
                          : modeler.completionPercentage >= 50
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-sm"
                    >
                      {modeler.completionPercentage}%
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Chart */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Total Assigned:
                        </span>
                        <span className="font-semibold">
                          {modeler.totalAssigned}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Assigned Batches:
                        </span>
                        <span className="font-medium">
                          {modeler.assignedBatches.length}
                        </span>
                      </div>

                      <div className="">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() =>
                            handleModelerAdminReview(modeler.id, modeler.email)
                          }
                        >
                          <ShieldCheck className="h-4 w-4 mr-1" />
                          Admin Review
                        </Button>
                      </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="w-40 h-40 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            wrapperStyle={{ zIndex: 99999 }}
                            contentStyle={{
                              backgroundColor: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              zIndex: 99999,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Asset Statistics
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(modeler.statusCounts)
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .filter(([_, count]) => count > 0)
                        .map(([status, count]) => (
                          <div
                            key={status}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getStatusBadgeClass(status)}`}
                              >
                                {getStatusLabel(status)}
                              </Badge>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Assigned Batches */}

                  {/* Admin Review Button */}
                </CardContent>
              </Card>
            );
          })
        ) : viewMode === "qa" ? (
          // QA Cards
          filteredQAUsers.map((qaUser) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const chartData = Object.entries(qaUser.statusCounts)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_, count]) => count > 0)
              .map(([status, count]) => ({
                name: getStatusLabel(status),
                value: count,
                color: getStatusColor(status),
              }));

            return (
              <Card
                key={qaUser.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CardTitle className="text-lg font-semibold text-muted-foreground">
                            {qaUser.name || qaUser.email.split("@")[0]}
                          </CardTitle>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="max-w-sm bg-background border border-border text-muted-foreground"
                        >
                          <div className="space-y-2">
                            <div className="font-semibold">
                              Completion Statistics
                            </div>
                            {qaUser.reviewStats.totalReviews > 0 ? (
                              <>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Average Time:
                                  </span>{" "}
                                  {qaUser.reviewStats.averageReviewTime}m
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Fastest:
                                  </span>{" "}
                                  {qaUser.reviewStats.fastestReview}m
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Slowest:
                                  </span>{" "}
                                  {qaUser.reviewStats.slowestReview}m
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Total Reviews:
                                  </span>{" "}
                                  {qaUser.reviewStats.totalReviews}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Revision Rate:
                                  </span>{" "}
                                  {qaUser.reviewStats.revisionRate}% (
                                  {qaUser.reviewStats.totalRevisions} revisions)
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No completed reviews yet
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Connected Modelers Summary Stats */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">
                      Connected Modelers Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 cursor-help">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Total Modelers:
                              </span>
                              <span className="font-semibold">
                                {qaUser.totalModelers}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-sm bg-background border border-border text-muted-foreground"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold">
                                Connected Modelers (
                                {qaUser.connectedModelers.length})
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Click on a modeler to view their allocations
                              </div>
                              {qaUser.connectedModelers.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {qaUser.connectedModelers.map((modeler) => (
                                    <div
                                      key={modeler.id}
                                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                                      onClick={() =>
                                        handleModelerAdminReview(
                                          modeler.id,
                                          modeler.email
                                        )
                                      }
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">
                                          {modeler.name || modeler.email}
                                        </div>
                                        <div className="text-muted-foreground">
                                          {modeler.totalAssets} assets •{" "}
                                          {modeler.completedAssets} completed •{" "}
                                          {modeler.completionPercentage}%
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {modeler.clients
                                          .slice(0, 2)
                                          .map((client, idx) => (
                                            <Badge
                                              key={idx}
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {client}
                                            </Badge>
                                          ))}
                                        {modeler.clients.length > 2 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            +{modeler.clients.length - 2}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  No modelers connected
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Total Assets:
                        </span>
                        <span className="font-semibold">
                          {qaUser.totalModelerAssets}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Completed:
                        </span>
                        <span className="font-medium text-success">
                          {qaUser.totalModelerCompleted}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Completion Rate:
                        </span>
                        <span className="font-medium text-primary">
                          {qaUser.modelerCompletionRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Activity Chart */}
                  {qaUser.chartData.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Activity Chart
                        </h4>
                        <DateRangePicker
                          value={qaUser.chartDateRange}
                          onChange={(newRange) => {
                            if (newRange?.from && newRange?.to) {
                              // Refetch chart data for the new date range
                              refetchQAChartData(qaUser.id, newRange);
                            }
                          }}
                          className="w-auto"
                        />
                      </div>
                      <div className="h-44">
                        {chartLoadingStates[qaUser.id] ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={qaUser.chartData}
                              margin={{
                                top: 5,
                                right: 5,
                                left: 5,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                              />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) =>
                                  new Date(value).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                }
                              />
                              <YAxis tick={{ fontSize: 10 }} />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: "var(--background)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                }}
                              />
                              <Bar
                                dataKey="reviewed"
                                fill="hsl(var(--chart-1))"
                                name="Reviewed"
                                radius={[2, 2, 0, 0]}
                              />
                              <Bar
                                dataKey="approved"
                                fill="hsl(var(--chart-2))"
                                name="Approved"
                                radius={[2, 2, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin Review Button */}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <PendingClientRevisionsPanel />
        )}
      </div>

      {/* Empty State */}
      {batches.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Batch Projects</h3>
          <p className="text-muted-foreground mb-4">
            No onboarding assets found. Start by uploading client data.
          </p>
          <Button className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            Upload Client Data
          </Button>
        </div>
      )}

      {/* No Search Results */}
      {batches.length > 0 && filteredBatches.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
          <p className="text-muted-foreground mb-4">
            No clients match your search criteria. Try adjusting your search or
            filters.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              handleSearchChange("");
              handleClientFilterChange("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}

function PendingClientRevisionsPanel() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/revisions/pending");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setItems(json.pending || []);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Pending Client Revisions
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="cursor-pointer"
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No pending revisions
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="space-y-2">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-2 border rounded bg-background text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {a.product_name} ({a.article_id})
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.client} • Latest Revision: R{a.latest_revision_number}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={async () => {
                        const res = await fetch("/api/revisions/forward", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ assetId: a.id }),
                        });
                        if (res.ok) refresh();
                      }}
                    >
                      Forward to Modeler
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
