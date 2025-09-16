"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge, Progress } from "@/components/ui/feedback";
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

import { TeamInfoTooltip } from "@/components/production/TeamInfoTooltip";

import { supabase } from "@/lib/supabaseClient";
import {
  CloudUpload,
  TrendingUp,
  Calendar,
  Package,
  Search,
  Building,
  Users,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
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
    approved_by_client: number;
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

interface ClientSummary {
  name: string;
  totalBatches: number;
  totalModels: number;
  completedModels: number;
  completionPercentage: number;
  unassignedAssets: number;
  statusCounts: {
    in_production: number;
    revisions: number;
    approved: number;
    approved_by_client: number;
  };
  assignedUsers: {
    modelers: number;
    qa: number;
  };
  averageProgress: number;
  batches: Array<{
    batch: number;
    totalModels: number;
    completionPercentage: number;
    startDate: string;
  }>;
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
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientSummary[]>([]);
  const [batches, setBatches] = useState<BatchProgress[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchProgress[]>([]);
  const [modelers, setModelers] = useState<ModelerProgress[]>([]);
  const [filteredModelers, setFilteredModelers] = useState<ModelerProgress[]>(
    []
  );
  const [qaUsers, setQAUsers] = useState<QAProgress[]>([]);
  const [filteredQAUsers, setFilteredQAUsers] = useState<QAProgress[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loadingStates, setLoadingStates] = useState({
    clients: false,
    batches: false,
    modelers: false,
    qa: false,
    fetchingData: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [chartLoadingStates, setChartLoadingStates] = useState<
    Record<string, boolean>
  >({});

  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{
    client: string;
    batch: number;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Show 12 items per page

  // Cache for data to avoid refetching
  const [dataCache, setDataCache] = useState<{
    assets: any[] | null;
    assetAssignments: any[] | null;
    profiles: any[] | null;
    lastFetched: number | null;
    viewMode: string | null;
    page: number | null;
  }>({
    assets: null,
    assetAssignments: null,
    profiles: null,
    lastFetched: null,
    viewMode: null,
    page: null,
  });

  // Cache duration (2 minutes for better performance)
  const CACHE_DURATION = 2 * 60 * 1000;

  // Get state from URL params with defaults
  const searchTerm = searchParams.get("search") || "";
  const clientFilter = searchParams.get("client") || "all";
  const sortBy = searchParams.get("sort") || "";

  // Get view mode from URL params, default to "clients"
  const viewMode =
    (searchParams.get("view") as "clients" | "batches" | "modelers" | "qa") ||
    "clients";

  // Get selected client from URL params
  const selectedClient = searchParams.get("client") || null;

  // Function to invalidate cache when data changes

  // Function to handle view mode changes and update URL
  const handleViewModeChange = (
    newViewMode: "clients" | "batches" | "modelers" | "qa"
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newViewMode);
    // Clear client selection when changing view modes
    if (newViewMode !== "batches") {
      params.delete("client");
    }
    router.push(`/production?${params.toString()}`);
  };

  // Function to handle client selection and show batches
  const handleClientSelect = (clientName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "batches");
    params.set("client", clientName);
    router.push(`/production?${params.toString()}`);
  };

  // Function to go back to clients view
  const handleBackToClients = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "clients");
    params.delete("client");
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

  // Check if cached data is still valid for current view and page
  const isCacheValid = () => {
    return (
      dataCache.lastFetched &&
      Date.now() - dataCache.lastFetched < CACHE_DURATION &&
      dataCache.viewMode === viewMode &&
      dataCache.page === currentPage &&
      dataCache.assets &&
      (viewMode === "clients" || dataCache.assetAssignments) &&
      (viewMode === "clients" || viewMode === "batches" || dataCache.profiles)
    );
  };

  // Fetch only the data needed for the current view mode
  const fetchDataForViewMode = async () => {
    try {
      setLoadingStates((prev) => ({ ...prev, fetchingData: true }));

      const queries = [];
      // const queries = [];

      // Always need basic asset data for all views - with pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      queries.push(
        supabase
          .from("onboarding_assets")
          .select(
            `
            id,
            client,
            batch,
            status,
            created_at,
            delivery_date,
            revision_count
          `
          )
          .range(from, to)
          .order("created_at", { ascending: false })
      );

      // Only fetch assignments if needed for current view
      if (
        viewMode === "batches" ||
        viewMode === "modelers" ||
        viewMode === "qa"
      ) {
        queries.push(
          supabase.from("asset_assignments").select(`
            user_id,
            role,
            asset_id,
            start_time,
            end_time,
            onboarding_assets!inner(client, batch, status, revision_count)
          `)
        );
      }

      // Only fetch profiles if needed for current view
      if (viewMode === "modelers" || viewMode === "qa") {
        queries.push(
          supabase.from("profiles").select("id, email, title, role")
        );
      }

      const results = await Promise.all(queries);
      const [assetResult, assignmentResult, profileResult] = results;

      if (assetResult.error) throw assetResult.error;
      if (assignmentResult?.error) throw assignmentResult.error;
      if (profileResult?.error) throw profileResult.error;

      const data = {
        assetData: assetResult.data || [],
        assetAssignments: assignmentResult?.data || [],
        profiles: profileResult?.data || [],
      };

      // Update cache
      setDataCache({
        assets: data.assetData,
        assetAssignments: data.assetAssignments,
        profiles: data.profiles,
        lastFetched: Date.now(),
        viewMode: viewMode,
        page: currentPage,
      });

      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    } finally {
      setLoadingStates((prev) => ({ ...prev, fetchingData: false }));
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        let data;

        // Check if we have cached data for this view mode
        const hasCachedData =
          dataCache.assets &&
          (viewMode === "clients" || dataCache.assetAssignments) &&
          (viewMode === "clients" ||
            viewMode === "batches" ||
            dataCache.profiles);

        if (hasCachedData && isCacheValid()) {
          // Use cached data
          data = {
            assetData: dataCache.assets!,
            assetAssignments: dataCache.assetAssignments || [],
            profiles: dataCache.profiles || [],
          };
        } else {
          // Fetch fresh data for current view mode
          data = await fetchDataForViewMode();
        }

        // Process data based on current view mode
        await processDataForViewMode(data);
      } catch (error) {
        console.error("Error initializing data:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [viewMode, currentPage]);

  // Process cached data for different view modes - only load what's needed
  const processDataForViewMode = async (data: {
    assetData: any[];
    assetAssignments: any[];
    profiles: any[];
  }) => {
    if (viewMode === "clients") {
      await processClientData(data);
    } else if (viewMode === "batches") {
      await processBatchData(data);
    } else if (viewMode === "modelers") {
      await processModelerData(data);
    } else if (viewMode === "qa") {
      await processQAData(data);
    }
  };

  // Optimized client data processing using cached data
  const processClientData = async (data: {
    assetData: any[];
    assetAssignments: any[];
    profiles: any[];
  }) => {
    try {
      setLoadingStates((prev) => ({ ...prev, clients: true }));
      const { assetData, assetAssignments } = data;

      // Group assets by client
      const clientMap = new Map<string, ClientSummary>();

      // First pass: count models and collect unique batches
      const clientBatches = new Map<string, Set<number>>();

      assetData.forEach((asset) => {
        const clientName = asset.client;
        const batchNumber = asset.batch || 1;

        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, {
            name: clientName,
            totalBatches: 0,
            totalModels: 0,
            completedModels: 0,
            completionPercentage: 0,
            unassignedAssets: 0,
            statusCounts: {
              in_production: 0,
              revisions: 0,
              approved: 0,
              approved_by_client: 0,
            },
            assignedUsers: {
              modelers: 0,
              qa: 0,
            },
            averageProgress: 0,
            batches: [],
          });

          // Initialize batch tracking for this client
          clientBatches.set(clientName, new Set());
        }

        const client = clientMap.get(clientName)!;
        client.totalModels++;

        // Track unique batches for this client
        const clientBatchSet = clientBatches.get(clientName)!;
        clientBatchSet.add(batchNumber);

        // Count status
        const status = asset.status || "in_production";
        if (status in client.statusCounts) {
          client.statusCounts[status as keyof typeof client.statusCounts]++;
        }

        if (status === "approved" || status === "approved_by_client") {
          client.completedModels++;
        }
      });

      // Second pass: update totalBatches and populate batches array
      clientMap.forEach((client, clientName) => {
        const batchSet = clientBatches.get(clientName)!;
        client.totalBatches = batchSet.size;

        // Populate batches array with batch information
        client.batches = Array.from(batchSet).map((batchNum) => {
          const batchAssets = assetData.filter(
            (asset) =>
              asset.client === clientName && (asset.batch || 1) === batchNum
          );
          const completedCount = batchAssets.filter(
            (asset) =>
              asset.status === "approved" ||
              asset.status === "approved_by_client"
          ).length;

          return {
            batch: batchNum,
            totalModels: batchAssets.length,
            completionPercentage:
              batchAssets.length > 0
                ? Math.round((completedCount / batchAssets.length) * 100)
                : 0,
            startDate: batchAssets[0]?.created_at || new Date().toISOString(),
          };
        });
      });

      // Calculate unassigned assets for each client
      const modelerAssignments = assetAssignments.filter(
        (a) => a.role === "modeler"
      );
      const assignedAssetIds = new Set(
        modelerAssignments.map((assignment) => assignment.asset_id) || []
      );

      // Calculate completion percentages and other stats
      const clientsArray = Array.from(clientMap.values()).map((client) => {
        // Count unassigned assets for this client
        const clientAssets = assetData.filter(
          (asset) => asset.client === client.name
        );

        const unassignedCount = clientAssets.filter(
          (asset) => !assignedAssetIds.has(asset.id)
        ).length;

        // Count assigned users for this client
        const clientModelerAssignments = modelerAssignments.filter(
          (assignment) => {
            const asset = assignment.onboarding_assets as any;
            return asset && asset.client === client.name;
          }
        );

        const clientQAAssignments = assetAssignments.filter((assignment) => {
          const asset = assignment.onboarding_assets as any;
          return (
            asset && asset.client === client.name && assignment.role === "qa"
          );
        });

        const uniqueModelers = new Set(
          clientModelerAssignments.map((a) => a.user_id)
        ).size;
        const uniqueQAUsers = new Set(clientQAAssignments.map((a) => a.user_id))
          .size;

        return {
          ...client,
          completionPercentage:
            client.totalModels > 0
              ? Math.round((client.completedModels / client.totalModels) * 100)
              : 0,
          unassignedAssets: unassignedCount,
          assignedUsers: {
            modelers: uniqueModelers,
            qa: uniqueQAUsers,
          },
        };
      });

      setClients(clientsArray);
      setFilteredClients(clientsArray);

      // Also process modeler and QA data in parallel
      await Promise.all([processModelerData(data), processQAData(data)]);
    } catch (error) {
      console.error("Error processing client data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, clients: false }));
    }
  };

  // Optimized batch data processing using cached data
  const processBatchData = async (data: {
    assetData: any[];
    assetAssignments: any[];
    profiles: any[];
  }) => {
    try {
      setLoadingStates((prev) => ({ ...prev, batches: true }));
      const { assetData, assetAssignments } = data;

      // Group by client and batch
      const batchMap = new Map<string, BatchProgress>();

      assetData.forEach((asset) => {
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

        // Count completed models
        if (
          asset.status === "approved" ||
          asset.status === "approved_by_client"
        ) {
          batchProgress.completedModels++;
        }
      });

      // Calculate unassigned assets for each batch
      const modelerAssignments = assetAssignments.filter(
        (a) => a.role === "modeler"
      );
      const assignedAssetIds = new Set(
        modelerAssignments.map((assignment) => assignment.asset_id) || []
      );

      // Calculate completion percentages and format dates
      const batchesArray = Array.from(batchMap.values()).map((batch) => {
        // Count unassigned assets for this batch
        const batchAssets = assetData.filter(
          (asset) =>
            asset.client === batch.client && asset.batch === batch.batch
        );

        const unassignedCount = batchAssets.filter(
          (asset) => !assignedAssetIds.has(asset.id)
        ).length;

        return {
          ...batch,
          completionPercentage:
            batch.totalModels > 0
              ? Math.round((batch.completedModels / batch.totalModels) * 100)
              : 0,
          startDate: new Date(batch.startDate).toLocaleDateString(),
          deadline: new Date(batch.deadline).toLocaleDateString(),
          unassignedAssets: unassignedCount,
        };
      });

      setBatches(batchesArray);
      setFilteredBatches(batchesArray);

      // Also process modeler and QA data in parallel
      await Promise.all([processModelerData(data), processQAData(data)]);
    } catch (error) {
      console.error("Error processing batch data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, batches: false }));
    }
  };

  // Optimized modeler data processing using cached data
  const processModelerData = async (data: {
    assetData: any[];
    assetAssignments: any[];
    profiles: any[];
  }) => {
    try {
      setLoadingStates((prev) => ({ ...prev, modelers: true }));
      const { assetAssignments, profiles } = data;

      // Get modelers from profiles
      const modelerDetails = profiles.filter((p) => p.role === "modeler");

      // Filter modeler assignments
      const modelerAssignments = assetAssignments.filter(
        (a) => a.role === "modeler"
      );

      // Create modeler progress map
      const modelerMap = new Map<string, ModelerProgress>();

      // Initialize all modelers
      modelerDetails.forEach((modeler) => {
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

      // Process assignments
      modelerAssignments.forEach((assignment) => {
        const modeler = modelerMap.get(assignment.user_id);
        if (!modeler) return;

        const asset = assignment.onboarding_assets as any;
        if (!asset) return;

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
        } else if (!asset.status || asset.status === "not_started") {
          modeler.pendingModels++;
        }

        // Calculate completion percentage
        modeler.completionPercentage =
          modeler.totalAssigned > 0
            ? Math.round(
                (modeler.completedModels / modeler.totalAssigned) * 100
              )
            : 0;
      });

      const modelersArray = Array.from(modelerMap.values());
      setModelers(modelersArray);
      setFilteredModelers(modelersArray);
    } catch (error) {
      console.error("Error processing modeler data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, modelers: false }));
    }
  };

  // Optimized QA data processing using cached data
  const processQAData = async (data: {
    assetData: any[];
    assetAssignments: any[];
    profiles: any[];
  }) => {
    try {
      setLoadingStates((prev) => ({ ...prev, qa: true }));
      const { assetAssignments, profiles } = data;

      // Get QA users from profiles
      const qaDetails = profiles.filter((p) => p.role === "qa");

      // Filter QA assignments
      const qaAssignments = assetAssignments.filter((a) => a.role === "qa");

      // Create QA progress map
      const qaMap = new Map<string, QAProgress>();

      // Initialize all QA users
      qaDetails.forEach((qa) => {
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
          },
          reviewStats: {
            averageReviewTime: 0,
            totalReviews: 0,
            fastestReview: 0,
            slowestReview: 0,
            revisionRate: 0,
            totalRevisions: 0,
          },
          connectedModelers: [],
          totalModelers: 0,
          totalModelerAssets: 0,
          totalModelerCompleted: 0,
          modelerCompletionRate: 0,
          chartData: [],
          chartDateRange: {
            from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            to: new Date(),
          },
        });
      });

      // Process assignments
      qaAssignments.forEach((assignment) => {
        const qaUser = qaMap.get(assignment.user_id);
        if (!qaUser) return;

        const asset = assignment.onboarding_assets as any;
        if (!asset) return;

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
        } else if (asset.status === "in_production") {
          qaUser.inProgressReviews++;
        } else if (asset.status === "revisions") {
          qaUser.revisionReviews++;
        } else if (!asset.status || asset.status === "not_started") {
          qaUser.pendingReviews++;
        }

        // Calculate completion percentage
        qaUser.completionPercentage =
          qaUser.totalAssigned > 0
            ? Math.round((qaUser.completedReviews / qaUser.totalAssigned) * 100)
            : 0;
      });

      const qaArray = Array.from(qaMap.values());
      setQAUsers(qaArray);
      setFilteredQAUsers(qaArray);
    } catch (error) {
      console.error("Error processing QA data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, qa: false }));
    }
  };

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

        // Count completed models (approved + approved_by_client)
        if (
          asset.status === "approved" ||
          asset.status === "approved_by_client"
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
    } catch {
      console.error("Error fetching client progress");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchModelerProgress = async (assetData: any[]) => {
    try {
      // Get modelers from profiles table - limit for performance
      const { data: modelerDetails, error: userError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "modeler")
        .limit(50); // Limit to first 50 modelers for performance

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

  // Fetch QA progress data - optimized for performance
  //eslint-disable-next-line
  const fetchQAProgress = async () => {
    try {
      // Get only basic QA user info first
      const { data: qaDetails, error: userError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "qa")
        .limit(20); // Limit to first 20 QA users for performance

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

    // Apply client filter (either from old filter or selected client)
    const activeClientFilter = selectedClient || clientFilter;
    if (activeClientFilter && activeClientFilter !== "all") {
      filtered = filtered.filter(
        (batch) => batch.client === activeClientFilter
      );
    }

    // Apply sorting only if a sort option is selected
    if (sortBy) {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "completion":
            return b.completionPercentage - a.completionPercentage;
          case "unassigned":
            return b.unassignedAssets - a.unassignedAssets;
          default:
            return 0;
        }
      });
    }

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

    // Apply sorting only if a sort option is selected
    if (sortBy) {
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
    }

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

    // Apply sorting only if a sort option is selected
    if (sortBy) {
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
    }

    setFilteredQAUsers(filtered);
  }, [qaUsers, searchTerm, sortBy]);

  // Filter and sort clients based on search term and sort criteria
  useEffect(() => {
    let filtered = [...clients];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort the filtered clients only if a sort option is selected
    if (sortBy) {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "completion":
            return b.completionPercentage - a.completionPercentage;
          case "total-models":
            return b.totalModels - a.totalModels;
          case "batches":
            return b.totalBatches - a.totalBatches;
          case "name":
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
    } else {
      // Default sort by name when no option is selected
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setFilteredClients(filtered);
  }, [clients, searchTerm, sortBy]);

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

  // Function to refetch chart data for a specific QA user

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
        {/* Header Skeleton */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            {/* View Toggle Skeleton */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <div className="h-8 w-16 bg-muted-foreground/20 animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted-foreground/20 animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted-foreground/20 animate-pulse rounded" />
              <div className="h-8 w-16 bg-muted-foreground/20 animate-pulse rounded" />
            </div>

            {/* Back Button Skeleton (conditional) */}
            {viewMode === "batches" && selectedClient && (
              <div className="h-8 w-32 bg-muted animate-pulse rounded ml-4" />
            )}
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
          </div>
        </div>

        {/* Search and Filter Controls Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-2">
            {viewMode === "batches" && (
              <>
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                <div className="h-10 w-48 bg-muted animate-pulse rounded" />
              </>
            )}
            <div className="h-10 w-48 bg-muted animate-pulse rounded" />
          </div>
        </div>

        {/* Results Count Skeleton */}
        <div className="mb-4">
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border rounded-lg p-0 bg-background shadow-sm"
            >
              {/* Card Header Skeleton */}
              <div className="p-6 pb-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Title */}
                    <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-1">
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-18 bg-muted animate-pulse rounded" />
                      </div>
                    </div>

                    {/* Progress Bar Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-10 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
                      <div className="flex justify-between">
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="mx-6 h-px bg-muted" />

              {/* Card Content Skeleton */}
              <div className="p-6 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Chart */}
                  <div className="flex items-center justify-center">
                    <div className="w-32 h-32 bg-muted animate-pulse rounded-full" />
                  </div>

                  {/* Right Column - Status/Batches */}
                  <div className="space-y-3">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div
                          key={j}
                          className="h-8 w-full bg-muted animate-pulse rounded"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Button Skeleton */}
                <div className="mt-6 pt-4 border-t">
                  <div className="h-8 w-full bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* View Toggle */}
          <div className="flex items-center font-bold text-lg sm:text-2xl gap-1 sm:gap-2 bg-muted rounded-lg p-1 overflow-x-auto">
            <Button
              variant={viewMode === "clients" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("clients")}
              className="text-xs whitespace-nowrap"
            >
              <Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Clients</span>
              <span className="sm:hidden">Client</span>
            </Button>
            <Button
              variant={viewMode === "batches" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("batches")}
              className="text-xs whitespace-nowrap"
            >
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Projects</span>
              <span className="sm:hidden">Proj</span>
            </Button>
            <Button
              variant={viewMode === "modelers" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("modelers")}
              className="text-xs whitespace-nowrap"
            >
              <Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Modelers</span>
              <span className="sm:hidden">Model</span>
            </Button>
            <Button
              variant={viewMode === "qa" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("qa")}
              className="text-xs whitespace-nowrap"
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              QA
            </Button>
          </div>

          {/* Back to Clients Button */}
          {viewMode === "batches" && selectedClient && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToClients}
              className="text-xs w-full sm:w-auto"
            >
              ← Back to Clients
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === "qa" && (
            <Button
              onClick={() => router.push("/production/qa-allocation")}
              variant="default"
              className="w-full sm:w-auto"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">QA Allocation</span>
              <span className="sm:hidden">QA Alloc</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              viewMode === "clients"
                ? "Search clients..."
                : viewMode === "batches"
                  ? "Search clients..."
                  : viewMode === "modelers"
                    ? "Search modelers..."
                    : viewMode === "qa"
                      ? "Search QA users..."
                      : "Search assets..."
            }
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 text-sm sm:text-base"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-48 text-sm">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {viewMode === "clients" ? (
                <>
                  <SelectItem value="name">Client Name (A-Z)</SelectItem>
                  <SelectItem value="completion">
                    Completion % (Highest)
                  </SelectItem>
                  <SelectItem value="total-models">
                    Total Models (Most)
                  </SelectItem>
                  <SelectItem value="batches">Batches (Most)</SelectItem>
                </>
              ) : viewMode === "batches" ? (
                <>
                  <SelectItem value="completion">
                    Completion % (Highest)
                  </SelectItem>
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

      {/* Results Count and Pagination Info */}
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          {viewMode === "clients" && (
            <>
              Showing {filteredClients.length} of {clients.length} clients
            </>
          )}
          {viewMode === "batches" && (
            <>
              Showing {filteredBatches.length} of {batches.length} batches
              {selectedClient && ` for ${selectedClient}`}
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
        </p>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center sm:justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="text-xs px-3 py-1.5"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </Button>
          <span className="text-xs sm:text-sm text-muted-foreground px-2">
            Page {currentPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={
              (filteredClients.length < itemsPerPage &&
                viewMode === "clients") ||
              (filteredBatches.length < itemsPerPage &&
                viewMode === "batches") ||
              (filteredModelers.length < itemsPerPage &&
                viewMode === "modelers") ||
              (filteredQAUsers.length < itemsPerPage && viewMode === "qa")
            }
            className="text-xs px-3 py-1.5"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading
          ? // Loading skeleton for current view
            Array.from({ length: itemsPerPage }).map((_, i) => (
              <div
                key={i}
                className="border rounded-lg p-6 bg-background shadow-sm animate-pulse"
              >
                <div className="space-y-4">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-2 bg-muted rounded w-full"></div>
                  <div className="h-32 bg-muted rounded"></div>
                </div>
              </div>
            ))
          : viewMode === "clients"
            ? // Client Cards
              filteredClients.map((client) => {
                // Prepare chart data
                const chartData = Object.entries(client.statusCounts)
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  .filter(([_, count]) => count > 0)
                  .map(([status, count]) => ({
                    name: getStatusLabel(status),
                    value: count,
                    color: getStatusColor(status),
                  }));

                return (
                  <Card
                    key={client.name}
                    className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                    onClick={() => handleClientSelect(client.name)}
                  >
                    <CardHeader className="pb-3 space-y-3 p-4 sm:p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                            {client.name}
                          </CardTitle>

                          {/* Key Metrics Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>{client.totalModels} models</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>{client.totalBatches} batches</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>
                                {client.assignedUsers.modelers +
                                  client.assignedUsers.qa}{" "}
                                team
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="font-medium text-muted-foreground">
                                Overall Progress
                              </span>
                              <span className="font-bold text-base sm:text-lg">
                                {client.completionPercentage}%
                              </span>
                            </div>
                            <Progress
                              value={client.completionPercentage}
                              className="h-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{client.completedModels} completed</span>
                              <span>
                                {client.totalModels - client.completedModels}{" "}
                                remaining
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 p-4 sm:p-6">
                      {/* Main Content Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Left Column - Chart */}
                        <div className="flex items-center justify-center">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={25}
                                  outerRadius={40}
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
                              <div className="text-center">
                                <div className="text-sm sm:text-lg font-bold text-primary">
                                  {client.completedModels}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                  of {client.totalModels}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column - Batches Summary */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-xs sm:text-sm text-muted-foreground">
                            Recent Batches
                          </h4>
                          <div className="space-y-2 max-h-20 sm:max-h-24 overflow-y-auto">
                            {client.batches.slice(0, 3).map((batch) => (
                              <div
                                key={batch.batch}
                                className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs"
                              >
                                <span className="font-medium">
                                  Batch {batch.batch}
                                </span>
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="text-muted-foreground text-xs">
                                    {batch.totalModels} models
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {batch.completionPercentage}%
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {client.batches.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{client.batches.length - 3} more batches
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fixed Action Button */}
                      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border">
                        <Separator className="mb-3 sm:mb-4" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs sm:text-sm"
                          onClick={() => handleClientSelect(client.name)}
                        >
                          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          View Projects
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            : viewMode === "batches"
              ? // Batch Cards
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
                      className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                    >
                      <CardHeader className="pb-3 space-y-3 p-4 sm:p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                              {batch.client} - Batch {batch.batch}
                            </CardTitle>

                            {/* Key Metrics Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>{batch.totalModels} models</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">
                                  Started {batch.startDate}
                                </span>
                                <span className="sm:hidden">
                                  {batch.startDate}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {batch.unassignedAssets > 0 ? (
                                  <>
                                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
                                    <span className="text-orange-600 dark:text-orange-400 text-xs sm:text-sm">
                                      {batch.unassignedAssets} unassigned
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                                    <span className="text-green-600 dark:text-green-400 text-xs sm:text-sm">
                                      All assigned
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="font-medium text-muted-foreground">
                                  Progress
                                </span>
                                <span className="font-bold text-base sm:text-lg">
                                  {batch.completionPercentage}%
                                </span>
                              </div>
                              <Progress
                                value={batch.completionPercentage}
                                className="h-2"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  {batch.statusCounts.approved} completed
                                </span>
                                <span>
                                  {batch.totalModels -
                                    batch.statusCounts.approved}{" "}
                                  remaining
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 ml-2 sm:ml-4">
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
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={isDeleting}
                                  onClick={() =>
                                    setDeleteDialogOpen({
                                      client: batch.client,
                                      batch: batch.batch,
                                    })
                                  }
                                >
                                  {isDeleting ? (
                                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-destructive" />
                                  ) : (
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  )}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-background h-fit">
                                <DialogHeader>
                                  <DialogTitle>Delete Batch</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to delete all assets
                                    in{" "}
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
                                        All allocation lists containing these
                                        assets
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
                                      deleteBatchAssets(
                                        batch.client,
                                        batch.batch
                                      )
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isDeleting
                                      ? "Deleting..."
                                      : "Delete Batch"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 p-4 sm:p-6">
                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          {/* Left Column - Chart */}
                          <div className="flex items-center justify-center">
                            <div className="w-32 h-32 sm:w-40 sm:h-40 relative">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={50}
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
                                <div className="text-center">
                                  <div className="text-lg sm:text-2xl font-bold text-primary">
                                    {batch.statusCounts.approved}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-medium">
                                    of {batch.totalModels}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column - Compact Status & Team */}
                          <div className="space-y-3 sm:space-y-4">
                            {/* Compact Status Grid */}
                            <div>
                              <h4 className="font-medium text-xs sm:text-sm text-muted-foreground mb-2">
                                Status Overview
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                {Object.entries(batch.statusCounts)
                                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                  .filter(([_, count]) => count > 0)
                                  .map(([status, count]) => (
                                    <div
                                      key={status}
                                      className="flex items-center justify-between p-1.5 rounded bg-muted/20"
                                    >
                                      <span
                                        className={`text-xs font-medium ${
                                          status === "approved"
                                            ? "text-green-600 dark:text-green-400"
                                            : status === "in_production"
                                              ? "text-blue-600 dark:text-blue-400"
                                              : status === "revisions"
                                                ? "text-orange-600 dark:text-orange-400"
                                                : "text-muted-foreground"
                                        }`}
                                      >
                                        {getStatusLabel(status)}
                                      </span>
                                      <span className="font-bold text-xs sm:text-sm">
                                        {count}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            {/* Team Section */}
                            {(batch.assignedUsers.modelers.length > 0 ||
                              batch.assignedUsers.qa.length > 0) && (
                              <div className="bg-muted/30 rounded-lg p-2 sm:p-3">
                                <TeamInfoTooltip
                                  modelers={batch.assignedUsers.modelers}
                                  qa={batch.assignedUsers.qa}
                                  clientName={batch.client}
                                  batchNumber={batch.batch}
                                >
                                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="font-medium">
                                      Team (
                                      {batch.assignedUsers.modelers.length +
                                        batch.assignedUsers.qa.length}
                                      )
                                    </span>
                                  </div>
                                </TeamInfoTooltip>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {batch.assignedUsers.modelers.length} modelers
                                  • {batch.assignedUsers.qa.length} QA
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fixed Action Button */}
                        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs sm:text-sm"
                            onClick={() =>
                              handleAdminReview(batch.client, batch.batch)
                            }
                          >
                            <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Admin Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              : viewMode === "modelers"
                ? // Modeler Cards
                  filteredModelers.map((modeler) => {
                    // Prepare chart data for modeler

                    return (
                      <Card
                        key={modeler.id}
                        className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                      >
                        <CardHeader className="pb-3 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-xl font-semibold text-foreground mb-2">
                                {modeler.name || modeler.email.split("@")[0]}
                              </CardTitle>

                              {/* Key Metrics Row */}
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Package className="h-4 w-4" />
                                  <span>{modeler.totalAssigned} assigned</span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-muted-foreground">
                                    Progress
                                  </span>
                                  <span className="font-bold text-lg">
                                    {modeler.completionPercentage}%
                                  </span>
                                </div>
                                <Progress
                                  value={modeler.completionPercentage}
                                  className="h-2"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>
                                    {modeler.statusCounts.approved || 0}{" "}
                                    completed
                                  </span>
                                  <span>
                                    {modeler.totalAssigned -
                                      (modeler.statusCounts.approved || 0)}{" "}
                                    remaining
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 ml-4">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Info className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    className="max-w-sm bg-background border border-border text-muted-foreground"
                                  >
                                    <div className="space-y-2">
                                      <div className="font-semibold">
                                        Completion Statistics
                                      </div>
                                      {modeler.completionStats.totalCompleted >
                                      0 ? (
                                        <>
                                          <div className="text-sm">
                                            <span className="font-medium text-muted-foreground">
                                              Average Time:
                                            </span>{" "}
                                            {
                                              modeler.completionStats
                                                .averageMinutes
                                            }
                                            m
                                          </div>
                                          <div className="text-sm">
                                            <span className="font-medium text-muted-foreground">
                                              Fastest:
                                            </span>{" "}
                                            {
                                              modeler.completionStats
                                                .fastestCompletionMinutes
                                            }
                                            m
                                          </div>
                                          <div className="text-sm">
                                            <span className="font-medium text-muted-foreground">
                                              Revision Rate:
                                            </span>{" "}
                                            {
                                              modeler.completionStats
                                                .revisionRate
                                            }
                                            %
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
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                          {/* Status Distribution */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-muted-foreground">
                                Asset Status Distribution
                              </h4>
                            </div>

                            {/* Status bars similar to batch view */}
                            <div className="space-y-2">
                              {Object.entries(modeler.statusCounts)
                                .filter(([, count]) => count > 0)
                                .map(([status, count]) => (
                                  <div
                                    key={status}
                                    className="flex items-center justify-between p-2 rounded bg-muted/20"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                          backgroundColor:
                                            getStatusColor(status),
                                        }}
                                      ></span>
                                      <span className="text-sm font-medium">
                                        {getStatusLabel(status)}
                                      </span>
                                    </div>
                                    <span className="font-bold text-sm">
                                      {count}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Assigned Batches - More Prominent */}

                          {/* Action Button */}
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                handleModelerAdminReview(
                                  modeler.id,
                                  modeler.email
                                )
                              }
                            >
                              <ShieldCheck className="h-4 w-4 mr-2" />
                              Admin Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                : viewMode === "qa"
                  ? // QA Cards
                    filteredQAUsers.map((qaUser) => {
                      // Calculate combined chart data from connected modelers
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const chartData = (() => {
                        const combinedStatusCounts = {
                          in_production: 0,
                          revisions: 0,
                          approved: 0,
                          approved_by_client: 0,
                        };

                        qaUser.connectedModelers.forEach((modeler) => {
                          combinedStatusCounts.in_production +=
                            modeler.inProgressAssets || 0;
                          combinedStatusCounts.revisions +=
                            modeler.revisionAssets || 0;
                          combinedStatusCounts.approved +=
                            modeler.completedAssets || 0;
                          combinedStatusCounts.approved_by_client += 0; // This would need to be tracked separately if needed
                        });

                        return Object.entries(combinedStatusCounts)
                          .filter(([, count]) => count > 0)
                          .map(([status, count]) => ({
                            name: getStatusLabel(status),
                            value: count,
                            color: getStatusColor(status),
                          }));
                      })();

                      return (
                        <Card
                          key={qaUser.id}
                          className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                        >
                          <CardHeader className="pb-3 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-xl font-semibold text-foreground mb-2">
                                  {qaUser.name || qaUser.email.split("@")[0]}
                                </CardTitle>

                                {/* Key Metrics Row */}
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Package className="h-4 w-4" />
                                    <span>
                                      {qaUser.totalModelerAssets} total assets
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span>
                                      {qaUser.connectedModelers?.length || 0}{" "}
                                      modelers
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>
                                      {qaUser.modelerCompletionRate}% completion
                                    </span>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-muted-foreground">
                                      Modeler Progress
                                    </span>
                                    <span className="font-bold text-lg">
                                      {qaUser.modelerCompletionRate}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={qaUser.modelerCompletionRate}
                                    className="h-2"
                                  />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>
                                      {qaUser.totalModelerCompleted} completed
                                    </span>
                                    <span>
                                      {qaUser.totalModelerAssets -
                                        qaUser.totalModelerCompleted}{" "}
                                      remaining
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {/* Modeler Asset Status Distribution */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-muted-foreground">
                                  Modeler Asset Status Distribution
                                </h4>
                              </div>

                              {/* Calculate combined status counts from connected modelers */}
                              <div className="space-y-2">
                                {(() => {
                                  const combinedStatusCounts = {
                                    in_production: 0,
                                    revisions: 0,
                                    approved: 0,
                                    approved_by_client: 0,
                                  };

                                  qaUser.connectedModelers.forEach(
                                    (modeler) => {
                                      combinedStatusCounts.in_production +=
                                        modeler.inProgressAssets || 0;
                                      combinedStatusCounts.revisions +=
                                        modeler.revisionAssets || 0;
                                      combinedStatusCounts.approved +=
                                        modeler.completedAssets || 0;
                                      combinedStatusCounts.approved_by_client += 0; // This would need to be tracked separately if needed
                                    }
                                  );

                                  return Object.entries(combinedStatusCounts)
                                    .filter(([, count]) => count > 0)
                                    .map(([status, count]) => (
                                      <div
                                        key={status}
                                        className="flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                              backgroundColor:
                                                getStatusColor(status),
                                            }}
                                          ></span>
                                          <span className="text-sm font-medium">
                                            {getStatusLabel(status)}
                                          </span>
                                        </div>
                                        <span className="font-bold text-sm">
                                          {count}
                                        </span>
                                      </div>
                                    ));
                                })()}
                              </div>
                            </div>

                            {/* Connected Modelers */}
                            {qaUser.connectedModelers.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground">
                                  Connected Modelers
                                </h4>
                                <div className="space-y-2 max-h-24 overflow-y-auto">
                                  {qaUser.connectedModelers
                                    .slice(0, 3)
                                    .map((modeler) => (
                                      <div
                                        key={modeler.id}
                                        className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() =>
                                          handleModelerAdminReview(
                                            modeler.id,
                                            modeler.email
                                          )
                                        }
                                      >
                                        <span className="font-medium">
                                          {modeler.name ||
                                            modeler.email.split("@")[0]}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {modeler.completionPercentage}%
                                        </span>
                                      </div>
                                    ))}
                                  {qaUser.connectedModelers.length > 3 && (
                                    <div className="text-xs text-muted-foreground text-center">
                                      +{qaUser.connectedModelers.length - 3}{" "}
                                      more modelers
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Button */}
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  handleModelerAdminReview(
                                    qaUser.id,
                                    qaUser.email
                                  )
                                }
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Admin Review
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  : null}
      </div>

      {/* Empty State - Clients */}
      {viewMode === "clients" && clients.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Clients Found</h3>
          <p className="text-muted-foreground mb-4">
            No client data found. Start by uploading client assets.
          </p>
          <Button className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            Upload Client Data
          </Button>
        </div>
      )}

      {/* Empty State - Batches */}
      {viewMode === "batches" && batches.length === 0 && !loading && (
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

      {/* No Search Results - Clients */}
      {viewMode === "clients" &&
        clients.length > 0 &&
        filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Clients Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria.
            </p>
          </div>
        )}

      {/* No Search Results - Batches */}
      {viewMode === "batches" &&
        batches.length > 0 &&
        filteredBatches.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
            <p className="text-muted-foreground mb-4">
              No clients match your search criteria. Try adjusting your search
              or filters.
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
