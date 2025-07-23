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

import { TeamInfoTooltip } from "@/components/production/TeamInfoTooltip";

import { supabase } from "@/lib/supabaseClient";
import {
  CloudUpload,
  TrendingUp,
  Calendar,
  Clock,
  Package,
  Search,
  Filter,
  Building,
  Users,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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

export default function ProductionDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchProgress[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchProgress[]>([]);
  const [modelers, setModelers] = useState<ModelerProgress[]>([]);
  const [filteredModelers, setFilteredModelers] = useState<ModelerProgress[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Get state from URL params with defaults
  const searchTerm = searchParams.get("search") || "";
  const clientFilter = searchParams.get("client") || "all";
  const sortBy = searchParams.get("sort") || "client-batch-stable";

  // Get view mode from URL params, default to "batches"
  const viewMode =
    (searchParams.get("view") as "batches" | "modelers") || "batches";

  // Function to handle view mode changes and update URL
  const handleViewModeChange = (newViewMode: "batches" | "modelers") => {
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

        // Count completed models (approved + delivered)
        if (
          asset.status === "approved" ||
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
    } catch (error) {
      console.error("Error fetching client progress:", error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchModelerProgress = async (assetData: any[]) => {
    try {
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

      // Get modeler user details
      const modelerIds = [
        ...new Set(assetAssignments?.map((a) => a.user_id) || []),
      ];
      const { data: modelerDetails, error: userError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", modelerIds);

      if (userError) {
        console.error("Error fetching modeler details:", userError);
        return;
      }

      // Create modeler progress map
      const modelerMap = new Map<string, ModelerProgress>();

      // Initialize modelers
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
          asset.status === "delivered_by_artist"
        ) {
          modeler.completedModels++;
        } else if (asset.status === "in_production") {
          modeler.inProgressModels++;
        } else if (asset.status === "revisions") {
          modeler.revisionModels++;
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
              averageHours: Math.round(avgHours * 10) / 10,
              averageDays: Math.round((avgHours / 24) * 10) / 10,
              averageMinutes: Math.round(avgHours * 60),
              totalCompleted: completionTimes.length,
              fastestCompletion: Math.round(fastest * 10) / 10,
              slowestCompletion: Math.round(slowest * 10) / 10,
              fastestCompletionMinutes: Math.round(fastest * 60),
              slowestCompletionMinutes: Math.round(slowest * 60),
              revisionRate: Math.round(revisionRate * 10) / 10,
              totalRevisions: totalRevisions,
            };
          }
        } catch (error) {
          console.error(
            `Error fetching completion stats for ${modeler.email}:`,
            error
          );
        }
      }

      // Calculate completion percentages
      const modelersArray = Array.from(modelerMap.values()).map((modeler) => ({
        ...modeler,
        completionPercentage:
          modeler.totalAssigned > 0
            ? Math.round(
                (modeler.completedModels / modeler.totalAssigned) * 100
              )
            : 0,
      }));

      setModelers(modelersArray);
      setFilteredModelers(modelersArray);
    } catch (error) {
      console.error("Error fetching modeler progress:", error);
    }
  };

  // Filter and sort batches based on search term, client filter, and sort criteria
  useEffect(() => {
    if (viewMode === "batches") {
      let filtered = batches;

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
          case "client-batch":
          case "client-batch-stable":
            // Sort by client name first, then by batch number (stable order)
            const clientComparison = a.client.localeCompare(b.client);
            if (clientComparison !== 0) return clientComparison;
            return a.batch - b.batch;

          case "batch-client":
            // Sort by batch number first, then by client name
            const batchComparison = a.batch - b.batch;
            if (batchComparison !== 0) return batchComparison;
            return a.client.localeCompare(b.client);

          case "completion-high":
            // Sort by completion percentage (highest first)
            return b.completionPercentage - a.completionPercentage;

          case "completion-low":
            // Sort by completion percentage (lowest first)
            return a.completionPercentage - b.completionPercentage;

          case "total-models-high":
            // Sort by total models (highest first)
            return b.totalModels - a.totalModels;

          case "total-models-low":
            // Sort by total models (lowest first)
            return a.totalModels - b.totalModels;

          case "deadline-asc":
            // Sort by deadline (earliest first)
            return (
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            );

          case "deadline-desc":
            // Sort by deadline (latest first)
            return (
              new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
            );

          case "start-date-asc":
            // Sort by start date (earliest first)
            return (
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            );

          case "start-date-desc":
            // Sort by start date (latest first)
            return (
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            );

          default:
            return 0;
        }
      });

      setFilteredBatches(filtered);
    } else {
      // Filter and sort modelers
      let filtered = modelers;

      // Apply search filter
      if (searchTerm) {
        filtered = filtered.filter(
          (modeler) =>
            modeler.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (modeler.name &&
              modeler.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      // Apply sorting for modelers
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "completion-high":
            return b.completionPercentage - a.completionPercentage;
          case "completion-low":
            return a.completionPercentage - b.completionPercentage;
          case "total-models-high":
            return b.totalAssigned - a.totalAssigned;
          case "total-models-low":
            return a.totalAssigned - b.totalAssigned;
          case "name":
            return (a.name || a.email).localeCompare(b.name || b.email);
          default:
            return b.completionPercentage - a.completionPercentage;
        }
      });

      setFilteredModelers(filtered);
    }
  }, [batches, modelers, searchTerm, clientFilter, sortBy, viewMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_production":
        return "#FACC15";
      case "revisions":
        return "#F87171";
      case "approved":
        return "#4ADE80";
      case "delivered_by_artist":
        return "#60A5FA";

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
      case "delivered_by_artist":
        return "Delivered";

      default:
        return "In Production"; // Default to in_production label
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

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-12">
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
    <div className="flex flex-1 flex-col p-4 sm:p-12">
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => router.push("/production/allocate")}
            className="bg-green-600 hover:bg-green-700"
          >
            <Package className="h-4 w-4 mr-2" />
            Allocate Assets
          </Button>
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
                : "Search modelers..."
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
                  <SelectItem value="batch-client">Batch → Client</SelectItem>
                  <SelectItem value="completion-high">
                    Completion % (High to Low)
                  </SelectItem>
                  <SelectItem value="completion-low">
                    Completion % (Low to High)
                  </SelectItem>
                  <SelectItem value="total-models-high">
                    Total Models (High to Low)
                  </SelectItem>
                  <SelectItem value="total-models-low">
                    Total Models (Low to High)
                  </SelectItem>
                  <SelectItem value="deadline-asc">
                    Deadline (Earliest First)
                  </SelectItem>
                  <SelectItem value="deadline-desc">
                    Deadline (Latest First)
                  </SelectItem>
                  <SelectItem value="start-date-asc">
                    Start Date (Earliest First)
                  </SelectItem>
                  <SelectItem value="start-date-desc">
                    Start Date (Latest First)
                  </SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="completion-high">
                    Completion % (High to Low)
                  </SelectItem>
                  <SelectItem value="completion-low">
                    Completion % (Low to High)
                  </SelectItem>
                  <SelectItem value="total-models-high">
                    Total Models (High to Low)
                  </SelectItem>
                  <SelectItem value="total-models-low">
                    Total Models (Low to High)
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
          Showing{" "}
          {viewMode === "batches"
            ? filteredBatches.length
            : filteredModelers.length}{" "}
          of {viewMode === "batches" ? batches.length : modelers.length}{" "}
          {viewMode === "batches" ? "batches" : "modelers"}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {viewMode === "batches"
          ? // Batch Cards
            filteredBatches
              .sort((a, b) => {
                // Always sort by client first, then by batch number for consistent display
                const clientComparison = a.client.localeCompare(b.client);
                if (clientComparison !== 0) return clientComparison;
                return a.batch - b.batch;
              })
              .map((batch) => {
                // Prepare chart data
                const chartData = Object.entries(batch.statusCounts)
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  .filter(([_, count]) => count > 0)
                  .map(([status, count]) => ({
                    name: getStatusLabel(status),
                    value: count,
                    color: getStatusColor(status),
                  }));

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
                              className={`font-semibold ${batch.unassignedAssets > 0 ? "text-orange-600" : "text-green-600"}`}
                            >
                              {batch.unassignedAssets}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Start Date:
                            </span>
                            <span className="font-medium">
                              {batch.startDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Deadline:
                            </span>
                            <span className="font-medium">
                              {batch.deadline}
                            </span>
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
                          <div
                            className="flex w-[150px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            onClick={() =>
                              handleAdminReview(batch.client, batch.batch)
                            }
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Admin Review</span>
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
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
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
                                {batch.statusCounts.approved}/
                                {batch.totalModels}
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
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor: getStatusColor(status),
                                    }}
                                  />
                                  <span className="text-muted-foreground">
                                    {getStatusLabel(status)}
                                  </span>
                                </div>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                    </CardContent>
                  </Card>
                );
              })
          : // Modeler Cards
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
                                    m (
                                    {modeler.completionStats.fastestCompletion}
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
                                    m (
                                    {modeler.completionStats.slowestCompletion}
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

                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Completed:
                          </span>
                          <span className="font-medium text-green-600">
                            {modeler.completedModels}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            In Progress:
                          </span>
                          <span className="font-medium text-orange-600">
                            {modeler.inProgressModels}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Pending:
                          </span>
                          <span className="font-medium text-red-600">
                            {modeler.pendingModels}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Revisions:
                          </span>
                          <span className="font-medium text-blue-600">
                            {modeler.revisionModels}
                          </span>
                        </div>
                        <div className="">
                          <div
                            className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            onClick={() =>
                              handleModelerAdminReview(
                                modeler.id,
                                modeler.email
                              )
                            }
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Admin Review</span>
                          </div>
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
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
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
                              {modeler.completedModels}/{modeler.totalAssigned}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">
                              Completed
                            </div>
                          </div>
                        </div>
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
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: getStatusColor(status),
                                  }}
                                />
                                <span className="text-muted-foreground">
                                  {getStatusLabel(status)}
                                </span>
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
            })}
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
