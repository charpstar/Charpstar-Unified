"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from "@/components/ui/inputs";

import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  X,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { getPriorityLabel } from "@/lib/constants";
import dayjs from "@/utils/dayjs";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import { SubcategoryEditor } from "@/components/qa/SubcategoryEditor";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Helper function to check if an asset is new (created within last 7 days)
const isNewAsset = (createdAt: string): boolean => {
  const createdDate = dayjs(createdAt);
  const sevenDaysAgo = dayjs().subtract(7, "days");
  return createdDate.isAfter(sevenDaysAgo);
};

// Helper function to get status label CSS class
const getStatusLabelClass = (status: string): string => {
  switch (status) {
    case "in_production":
      return "status-in-production";
    case "revisions":
      return "status-revisions";
    case "approved":
      return "status-approved";
    case "approved_by_client":
      return "status-approved-by-client";
    case "delivered_by_artist":
      return "status-delivered-by-artist";
    case "not_started":
      return "status-not-started";
    case "in_progress":
      return "status-in-progress";
    case "waiting_for_approval":
      return "status-waiting-for-approval";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

// Helper function to get status label text
const getStatusLabelText = (status: string): string => {
  switch (status) {
    case "in_production":
      return "In Production";
    case "revisions":
      return "Sent for Revision";
    case "approved":
      return "Approved";
    case "approved_by_client":
      return "Approved by Client";
    case "delivered_by_artist":
      return "Delivered by Artist";
    case "not_started":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "waiting_for_approval":
      return "Delivered by Artist";
    default:
      return status;
  }
};

// Helper function to get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "approved_by_client":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "delivered_by_artist":
      return <Clock className="h-4 w-4 text-green-600" />;
    case "waiting_for_approval":
      return <Clock className="h-4 w-4 text-green-600" />;
    case "in_production":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "not_started":
      return null;
    case "revisions":
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    default:
      return <Eye className="h-4 w-4 text-gray-600" />;
  }
};

const PAGE_SIZE = 100;

interface AssignedAsset {
  id: string;
  product_name: string;
  article_id: string;
  client: string;
  batch: number;
  priority: number;
  delivery_date: string;
  status: string;
  glb_link?: string;
  product_link?: string;
  category: string;
  subcategory: string;
  subcategory_missing?: boolean;
  created_at: string;
  reference?: string[] | null;
  price: number;
  modeler?: {
    id: string;
    email: string;
    title?: string;
  };
}

export default function QAReviewPage() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoadingState();
  const [assets, setAssets] = useState<AssignedAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssignedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const [modelerFilter, setModelerFilter] = useState("all");
  const [sort, setSort] = useState("status-progress");
  const [availableModelers, setAvailableModelers] = useState<
    Array<{ id: string; email: string; title?: string }>
  >([]);
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [updatingStatusAssetId, setUpdatingStatusAssetId] = useState<
    string | null
  >(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );

  // Add new filter states for multi-select capability
  const [clientFilters, setClientFilters] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<number[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([
    "delivered_by_artist",
  ]);
  const [clients, setClients] = useState<string[]>([]);

  // Add Ref dialog state
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );

  // View Ref dialog state
  const [showViewRefDialog, setShowViewRefDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  useEffect(() => {
    document.title = "CharpstAR Platform - QA Review";
  }, []);

  // Handle URL parameters for modeler filter
  useEffect(() => {
    const modelerParam = searchParams.get("modeler");
    if (modelerParam) {
      setModelerFilter(modelerParam);
    }
  }, [searchParams]);

  // Handle URL parameters for new filters
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const batchParam = searchParams.get("batch");
    const statusParam = searchParams.get("status");

    if (clientParam) {
      setClientFilters(clientParam.split(","));
    }
    if (batchParam) {
      setBatchFilters(batchParam.split(",").map(Number));
    }
    if (statusParam) {
      setStatusFilters(statusParam.split(","));
    }
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (clientFilters.length > 0) {
      params.set("client", clientFilters.join(","));
    }
    if (batchFilters.length > 0) {
      params.set("batch", batchFilters.join(","));
    }
    if (statusFilters.length > 0) {
      params.set("status", statusFilters.join(","));
    }

    // Update URL without triggering a page reload
    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [clientFilters, batchFilters, statusFilters]);

  useEffect(() => {
    if (user?.id) {
      fetchAssignedAssets();
    }
  }, [user?.id]);

  useEffect(() => {
    filterAndSortAssets();
  }, [
    assets,
    search,
    modelerFilter,
    sort,
    clientFilters,
    batchFilters,
    statusFilters,
  ]);

  const handlePriorityChange = async (assetId: string, newPriority: number) => {
    try {
      setUpdatingAssetId(assetId);
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ priority: newPriority })
        .eq("id", assetId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, priority: newPriority } : a
        )
      );

      toast.success("Priority updated successfully");
    } catch (err) {
      console.error("Error updating priority:", err);
      toast.error("Failed to update priority");
    } finally {
      setUpdatingAssetId(null);
    }
  };

  // Refresh a specific asset's reference/glb data
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link")
        .eq("id", assetId)
        .single();

      if (!error && data) {
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? { ...asset, reference: data.reference, glb_link: data.glb_link }
              : asset
          )
        );
      }
    } catch (error) {
      console.error("Error refreshing asset reference data:", error);
    }
  };

  const fetchAssignedAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // First, get the modelers allocated to this QA user
      const { data: qaAllocations, error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", user?.id);

      if (allocationError) {
        console.error("Error fetching QA allocations:", allocationError);
        toast.error("Failed to fetch your modeler allocations");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        setAssets([]);
        return;
      }

      const allocatedModelerIds = qaAllocations.map((a) => a.modeler_id);

      // Get assets assigned to the allocated modelers
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          price,
          onboarding_assets!inner(
            id,
            product_name,
            article_id,
            client,
            batch,
            priority,
            delivery_date,
            status,
            glb_link,
            product_link,
            category,
            subcategory,
            subcategory_missing,
            created_at,
            reference,
            upload_order
          )
        `
        )
        .in("user_id", allocatedModelerIds)
        .eq("role", "modeler")
        .order("upload_order", {
          ascending: true,
          referencedTable: "onboarding_assets",
        });

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        toast.error("Failed to fetch your assigned assets");
        return;
      }

      // Get modeler details for the allocated modelers
      const { data: modelerDetails, error: modelerError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", allocatedModelerIds);

      if (modelerError) {
        console.error("Error fetching modeler details:", modelerError);
      }

      // Create a map of modeler info by ID
      const modelerMap = new Map();
      modelerDetails?.forEach((modeler) => {
        modelerMap.set(modeler.id, {
          id: modeler.id,
          email: modeler.email,
          title: modeler.title,
        });
      });

      // Set available modelers for filter dropdown
      setAvailableModelers(modelerDetails || []);

      // Transform the data
      const transformedAssets: AssignedAsset[] =
        assetAssignments?.map((assignment) => {
          const asset = assignment.onboarding_assets as any;
          return {
            id: assignment.asset_id,
            product_name: asset.product_name,
            article_id: asset.article_id,
            client: asset.client,
            batch: asset.batch,
            priority: asset.priority,
            delivery_date: asset.delivery_date,
            status: asset.status,
            glb_link: asset.glb_link,
            product_link: asset.product_link,
            category: asset.category,
            subcategory: asset.subcategory,
            created_at: asset.created_at,
            reference: asset.reference,
            price: assignment.price || 0,
            modeler: modelerMap.get(assignment.user_id),
          };
        }) || [];

      setAssets(transformedAssets);

      // Populate clients array for filter dropdown
      const uniqueClients = Array.from(
        new Set(transformedAssets.map((asset) => asset.client).filter(Boolean))
      ).sort();
      setClients(uniqueClients);
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
      toast.error("Failed to fetch assigned assets");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const filterAndSortAssets = () => {
    let filtered = [...assets];

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (asset) =>
          asset.product_name.toLowerCase().includes(search.toLowerCase()) ||
          asset.article_id.toLowerCase().includes(search.toLowerCase()) ||
          asset.client.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply multi client filter
    if (clientFilters.length > 0) {
      filtered = filtered.filter((asset) =>
        clientFilters.includes(asset.client)
      );
    }

    // Apply multi batch filter
    if (batchFilters.length > 0) {
      filtered = filtered.filter((asset) =>
        batchFilters.includes(Number(asset.batch))
      );
    }

    // Apply multi status filter
    if (statusFilters.length > 0) {
      filtered = filtered.filter((asset) => {
        // Handle special "new" filter
        if (statusFilters.includes("new")) {
          return isNewAsset(asset.created_at);
        }
        // Handle regular status filters
        return statusFilters.includes(asset.status);
      });
    }

    // Apply modeler filter
    if (modelerFilter !== "all") {
      filtered = filtered.filter(
        (asset) => asset.modeler?.id === modelerFilter
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case "status-progress": {
          const statusPriority: Record<string, number> = {
            in_production: 1,
            delivered_by_artist: 2,
            revisions: 3,
            approved: 4,
            approved_by_client: 5,
          };
          return (
            (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
          );
        }
        case "priority":
          // 1 is highest priority; show lowest numeric value first
          return a.priority - b.priority;
        case "priority-lowest":
          // Lowest priority first means highest numeric value first
          return b.priority - a.priority;
        case "batch":
          return a.batch - b.batch;
        case "az":
          return a.product_name.localeCompare(b.product_name);
        case "za":
          return b.product_name.localeCompare(a.product_name);
        case "date":
          // Newest first using asset delivery_date
          return (
            dayjs(b.delivery_date).valueOf() - dayjs(a.delivery_date).valueOf()
          );
        case "date-oldest":
          // Oldest first using asset delivery_date
          return (
            dayjs(a.delivery_date).valueOf() - dayjs(b.delivery_date).valueOf()
          );
        default:
          return 0;
      }
    });

    setFilteredAssets(filtered);
  };

  const handleViewAsset = (assetId: string) => {
    router.push(`/client-review/${assetId}?from=qa-review`);
  };

  // References column removed

  const handleDownloadGLB = (asset: AssignedAsset) => {
    if (asset.glb_link) {
      const link = document.createElement("a");
      link.href = asset.glb_link;
      link.download = `${asset.product_name}_${asset.article_id}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("GLB file download started");
    } else {
      toast.error("No GLB file available for this asset");
    }
  };

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUpdateStatus = async (assetId: string, newStatus: string) => {
    try {
      setUpdatingStatusAssetId(assetId);
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ status: newStatus })
        .eq("id", assetId);
      if (error) {
        throw new Error(error.message);
      }
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: newStatus } : a))
      );
      toast.success("Status updated to In Progress");
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatusAssetId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setModelerFilter("all");
    setSort("status-progress");
    setCurrentPage(1);
    setClientFilters([]);
    setBatchFilters([]);
    setStatusFilters([]);
  };

  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  const isAssetSelected = (id: string) => selectedAssetIds.has(id);
  const areAllCurrentSelected =
    currentAssets.length > 0 &&
    currentAssets.every((a) => selectedAssetIds.has(a.id));
  const someCurrentSelected =
    currentAssets.some((a) => selectedAssetIds.has(a.id)) &&
    !areAllCurrentSelected;

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCurrent = () => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (areAllCurrentSelected) {
        // Unselect only current page assets
        currentAssets.forEach((a) => next.delete(a.id));
      } else {
        // Select all current page assets
        currentAssets.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  const handleDownloadSelectedGLBs = async () => {
    const selected = filteredAssets.filter((a) => selectedAssetIds.has(a.id));
    const withGlb = selected.filter((a) => a.glb_link);
    if (withGlb.length === 0) {
      toast.info("No GLB files found for selected items");
      return;
    }
    for (const asset of withGlb) {
      try {
        const a = document.createElement("a");
        a.href = asset.glb_link as string;
        a.download = `${asset.article_id}.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((res) => setTimeout(res, 120));
      } catch (e) {
        console.error("Failed to start GLB download for", asset.id, e);
      }
    }
    toast.success(`Started downloading ${withGlb.length} GLB file(s)`);
  };

  // Helper function to parse references
  const parseReferences = (
    referenceImages: string[] | string | null
  ): string[] => {
    if (!referenceImages) return [];
    if (Array.isArray(referenceImages)) return referenceImages;
    try {
      return JSON.parse(referenceImages);
    } catch {
      return [referenceImages];
    }
  };

  // Helper function to separate GLB files from reference images
  const separateReferences = (referenceImages: string[] | string | null) => {
    const allReferences = parseReferences(referenceImages);
    const glbFiles = allReferences.filter((ref) =>
      ref.toLowerCase().endsWith(".glb")
    );
    const imageReferences = allReferences.filter(
      (ref) => !ref.toLowerCase().endsWith(".glb")
    );
    return { glbFiles, imageReferences };
  };

  const statusTotals = {
    total: assets.length,
    in_production: assets.filter((a) => a.status === "in_production").length,
    delivered_by_artist: assets.filter(
      (a) => a.status === "delivered_by_artist"
    ).length,
    revisions: assets.filter((a) => a.status === "revisions").length,
    approved: assets.filter((a) => a.status === "approved").length,
    approved_by_client: assets.filter((a) => a.status === "approved_by_client")
      .length,
  };

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
            This page is only available for QA reviewers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2 h-8 sm:h-9 text-sm"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs sm:text-sm">
            <ShieldCheck className="h-3 w-3" />
            <span className="hidden sm:inline">QA Review</span>
            <span className="sm:hidden">QA</span>
          </Badge>
        </div>
      </div>

      <Card className="p-3 sm:p-6 flex-1 flex flex-col border-0 shadow-none">
        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
            {/* Total Assigned (no filtering on this card itself) */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters([]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-info-muted rounded-lg">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    <span className="hidden sm:inline">Total Assigned</span>
                    <span className="sm:hidden">Total</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-info">
                    {statusTotals.total}
                  </p>
                </div>
              </div>
            </Card>

            {/* In Production */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["in_production"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-warning-muted rounded-lg">
                  {getStatusIcon("in_production")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    <span className="hidden sm:inline">In Production</span>
                    <span className="sm:hidden">Production</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-warning">
                    {statusTotals.in_production}
                  </p>
                </div>
              </div>
            </Card>

            {/* Waiting for Review */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["delivered_by_artist"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-accent-purple/10 rounded-lg">
                  {getStatusIcon("delivered_by_artist")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    <span className="hidden sm:inline">
                      Delivered by Artist
                    </span>
                    <span className="sm:hidden">Delivered</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-accent-purple">
                    {statusTotals.delivered_by_artist}
                  </p>
                </div>
              </div>
            </Card>

            {/* Revision */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["revisions"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-info-muted rounded-lg">
                  {getStatusIcon("revisions")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Revision
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-info">
                    {statusTotals.revisions}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["approved"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-success-muted rounded-lg">
                  {getStatusIcon("approved")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Approved
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-success">
                    {statusTotals.approved}
                  </p>
                </div>
              </div>
            </Card>

            {/* Delivered by Client */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["approved_by_client"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-success-muted rounded-lg">
                  {getStatusIcon("approved_by_client")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    <span className="hidden sm:inline">Approved by Client</span>
                    <span className="sm:hidden">Client OK</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-success">
                    {statusTotals.approved_by_client || 0}
                  </p>
                </div>
              </div>
            </Card>

            {/* New Assets */}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:gap-2 mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            {/* Client Filter */}
            <Select
              value={clientFilters.length === 1 ? clientFilters[0] : undefined}
              onValueChange={(value) => {
                if (value === "all") {
                  setClientFilters([]);
                } else if (value) {
                  setClientFilters([value]);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40 h-8 sm:h-9 text-sm">
                <SelectValue
                  placeholder={
                    clientFilters.length === 0
                      ? "All clients"
                      : clientFilters.length === 1
                        ? clientFilters[0]
                        : `${clientFilters.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Batch Filter */}
            <Select
              value={
                batchFilters.length === 1
                  ? batchFilters[0].toString()
                  : undefined
              }
              onValueChange={(value) => {
                if (value === "all") {
                  setBatchFilters([]);
                } else if (value) {
                  setBatchFilters([parseInt(value)]);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-32 h-8 sm:h-9 text-sm">
                <SelectValue
                  placeholder={
                    batchFilters.length === 0
                      ? "All batches"
                      : batchFilters.length === 1
                        ? `Batch ${batchFilters[0]}`
                        : `${batchFilters.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {Array.from(
                  new Set(assets.map((asset) => asset.batch).filter(Boolean))
                )
                  .sort((a, b) => a - b)
                  .map((batch) => (
                    <SelectItem key={batch} value={batch.toString()}>
                      Batch {batch}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={modelerFilter}
              onValueChange={(value) => setModelerFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-auto h-8 sm:h-9 text-sm">
                <SelectValue placeholder="Modeler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modelers</SelectItem>
                {availableModelers.map((modeler) => (
                  <SelectItem key={modeler.id} value={modeler.id}>
                    {modeler.title || modeler.email.split("@")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-full sm:w-48 md:w-64 text-sm"
              placeholder="Search by name, article ID, or client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-stretch sm:items-center">
            <Select value={sort} onValueChange={(value) => setSort(value)}>
              <SelectTrigger className="w-full sm:w-auto h-8 sm:h-9 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status-progress">
                  <span className="hidden sm:inline">Status Progression</span>
                  <span className="sm:hidden">Status</span>
                </SelectItem>
                <SelectItem value="priority">
                  <span className="hidden sm:inline">
                    Priority (Highest First)
                  </span>
                  <span className="sm:hidden">Priority (High)</span>
                </SelectItem>
                <SelectItem value="priority-lowest">
                  <span className="hidden sm:inline">
                    Priority (Lowest First)
                  </span>
                  <span className="sm:hidden">Priority (Low)</span>
                </SelectItem>
                <SelectItem value="batch">
                  <span className="hidden sm:inline">Batch (1, 2, 3...)</span>
                  <span className="sm:hidden">Batch</span>
                </SelectItem>
                <SelectItem value="az">
                  <span className="hidden sm:inline">Name (A-Z)</span>
                  <span className="sm:hidden">A-Z</span>
                </SelectItem>
                <SelectItem value="za">
                  <span className="hidden sm:inline">Name (Z-A)</span>
                  <span className="sm:hidden">Z-A</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2 h-8 sm:h-9 text-sm w-full sm:w-auto"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Clear Filters</span>
              <span className="sm:hidden">Clear</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedAssetIds.size === 0}
              onClick={handleDownloadSelectedGLBs}
              className="h-8 sm:h-9 text-sm w-full sm:w-auto"
            >
              <span className="hidden sm:inline">
                Download GLBs (Selected {selectedAssetIds.size})
              </span>
              <span className="sm:hidden">
                Download ({selectedAssetIds.size})
              </span>
            </Button>
          </div>
        </div>

        {/* Assets Table */}
        <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[64vh]">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        areAllCurrentSelected
                          ? true
                          : someCurrentSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleSelectAllCurrent}
                    />
                  </TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Article ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modeler</TableHead>
                  <TableHead className="w-20">Created</TableHead>
                  <TableHead className="">Product Link</TableHead>
                  <TableHead className="">GLB</TableHead>
                  <TableHead className="">Files</TableHead>
                  <TableHead className="">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // Loading skeleton
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {/* Checkbox */}
                      <TableCell>
                        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Product Name */}
                      <TableCell>
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Article ID */}
                      <TableCell>
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Client */}
                      <TableCell>
                        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Price */}
                      <TableCell>
                        <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Priority */}
                      <TableCell>
                        <div className="flex justify-center">
                          <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                        </div>
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                      </TableCell>
                      {/* Modeler */}
                      <TableCell>
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Created */}
                      <TableCell>
                        <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Product */}
                      <TableCell>
                        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* GLB */}
                      <TableCell>
                        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* Files */}
                      <TableCell>
                        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                      </TableCell>
                      {/* View */}
                      <TableCell>
                        <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : currentAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        {assets.length === 0 ? (
                          <>
                            <p className="text-muted-foreground">
                              No assets assigned
                            </p>
                            <p className="text-sm text-muted-foreground">
                              You will see assets here once you are allocated to
                              modelers by production management.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-muted-foreground">
                              No assets match the current filters
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try adjusting your search or filter criteria to
                              see more results.
                            </p>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentAssets.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className={`${
                        asset.status === "in_production"
                          ? "table-row-status-in-production"
                          : asset.status === "revisions"
                            ? "table-row-status-revisions"
                            : asset.status === "approved"
                              ? "table-row-status-approved"
                              : asset.status === "approved_by_client"
                                ? "table-row-status-approved-by-client"
                                : asset.status === "delivered_by_artist"
                                  ? "table-row-status-delivered-by-artist"
                                  : asset.status === "not_started"
                                    ? "table-row-status-not-started"
                                    : "table-row-status-unknown"
                      } ${
                        isNewAsset(asset.created_at)
                          ? "bg-green-50/30 dark:bg-green-900/5 border-l-2 border-l-green-400"
                          : ""
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isAssetSelected(asset.id)}
                          onCheckedChange={() => toggleSelectAsset(asset.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div
                          className="font-medium truncate max-w-[200px] cursor-help"
                          title={asset.product_name}
                        >
                          {asset.product_name.length > 35
                            ? asset.product_name.substring(0, 35) + "..."
                            : asset.product_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 group">
                          <span>{asset.category}</span>
                          <span>•</span>
                          <SubcategoryEditor
                            assetId={asset.id}
                            currentSubcategory={asset.subcategory}
                            category={asset.category}
                            isMissing={asset.subcategory_missing || false}
                            onUpdate={(newSubcategory) => {
                              // Update the local state to reflect the change
                              setAssets((prevAssets) =>
                                prevAssets.map((a) =>
                                  a.id === asset.id
                                    ? {
                                        ...a,
                                        subcategory: newSubcategory,
                                        subcategory_missing: false,
                                      }
                                    : a
                                )
                              );
                            }}
                            variant="inline"
                            className="inline-flex"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {asset.article_id}
                        </span>
                      </TableCell>
                      <TableCell>{asset.client}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          €{(asset.price || 0).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center items-center">
                          <Select
                            value={asset.priority.toString()}
                            onValueChange={(value) => {
                              const newPriority = parseInt(value);
                              handlePriorityChange(asset.id, newPriority);
                            }}
                            disabled={updatingAssetId === asset.id}
                          >
                            <SelectTrigger
                              className={`border-0 shadow-none p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                            >
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                  asset.priority
                                )}`}
                              >
                                {getPriorityLabel(asset.priority)}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">High</SelectItem>
                              <SelectItem value="2">Medium</SelectItem>
                              <SelectItem value="3">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStatusLabelClass(asset.status)}`}
                          >
                            {getStatusLabelText(asset.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.modeler ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {asset.modeler.title ||
                                asset.modeler.email.split("@")[0]}
                            </div>
                            {asset.modeler.title && (
                              <div className="text-xs text-muted-foreground">
                                {asset.modeler.title}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            -
                          </span>
                        )}
                      </TableCell>
                      {/* Created Date */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-muted-foreground">
                            {dayjs(asset.created_at).format("MMM DD")}•
                            {dayjs(asset.created_at).format("YYYY")}
                          </div>
                        </div>
                      </TableCell>
                      {/* Product */}
                      <TableCell>
                        {asset.product_link ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Open Product Link"
                            onClick={() =>
                              window.open(
                                asset.product_link as string,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      {/* GLB */}
                      <TableCell>
                        {asset.glb_link ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadGLB(asset)}
                            title="Download GLB"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      {/* Files */}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-3 py-1 h-7"
                            onClick={() => {
                              setSelectedAssetForView(asset);
                              setShowViewRefDialog(true);
                            }}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Ref (
                            {separateReferences(asset.reference || null)
                              .imageReferences.length +
                              separateReferences(asset.reference || null)
                                .glbFiles.length}
                            )
                          </Button>
                        </div>
                      </TableCell>
                      {/* View */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAsset(asset.id)}
                          title="View Asset"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-3">
            {loading ? (
              // Loading skeleton for mobile
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                      <div className="h-6 w-6 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))
            ) : currentAssets.length === 0 ? (
              <div className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  {assets.length === 0 ? (
                    <>
                      <p className="text-muted-foreground">
                        No assets assigned
                      </p>
                      <p className="text-sm text-muted-foreground">
                        You will see assets here once you are allocated to
                        modelers by production management.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        No assets match the current filters
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Try adjusting your search or filter criteria to see more
                        results.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              currentAssets.map((asset) => (
                <Card
                  key={asset.id}
                  className={`p-4 transition-all duration-200 ${
                    asset.status === "in_production"
                      ? "table-row-status-in-production"
                      : asset.status === "revisions"
                        ? "table-row-status-revisions"
                        : asset.status === "approved"
                          ? "table-row-status-approved"
                          : asset.status === "approved_by_client"
                            ? "table-row-status-approved-by-client"
                            : asset.status === "delivered_by_artist"
                              ? "table-row-status-delivered-by-artist"
                              : asset.status === "not_started"
                                ? "table-row-status-not-started"
                                : "table-row-status-unknown"
                  } ${
                    isNewAsset(asset.created_at)
                      ? "bg-green-50/30 dark:bg-green-900/5 border-l-2 border-l-green-400"
                      : ""
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header with checkbox and product name */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isAssetSelected(asset.id)}
                          onCheckedChange={() => toggleSelectAsset(asset.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-medium text-sm truncate"
                            title={asset.product_name}
                          >
                            {asset.product_name.length > 30
                              ? asset.product_name.substring(0, 30) + "..."
                              : asset.product_name}
                          </h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 group">
                            <span>{asset.category}</span>
                            <span>•</span>
                            <SubcategoryEditor
                              assetId={asset.id}
                              currentSubcategory={asset.subcategory}
                              category={asset.category}
                              isMissing={asset.subcategory_missing || false}
                              onUpdate={(newSubcategory) => {
                                // Update the local state to reflect the change
                                setAssets((prevAssets) =>
                                  prevAssets.map((a) =>
                                    a.id === asset.id
                                      ? {
                                          ...a,
                                          subcategory: newSubcategory,
                                          subcategory_missing: false,
                                        }
                                      : a
                                  )
                                );
                              }}
                              variant="inline"
                              className="inline-flex"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewAsset(asset.id)}
                        className="h-8 w-8 flex-shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Article ID and Client */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground font-mono">
                        {asset.article_id}
                      </div>
                      <div className="text-sm font-medium">{asset.client}</div>
                    </div>

                    {/* Price and Priority */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        €{(asset.price || 0).toFixed(2)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={asset.priority.toString()}
                          onValueChange={(value) => {
                            const newPriority = parseInt(value);
                            handlePriorityChange(asset.id, newPriority);
                          }}
                          disabled={updatingAssetId === asset.id}
                        >
                          <SelectTrigger
                            className={`border-0 shadow-none p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                          >
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                asset.priority
                              )}`}
                            >
                              {getPriorityLabel(asset.priority)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">High</SelectItem>
                            <SelectItem value="2">Medium</SelectItem>
                            <SelectItem value="3">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusLabelClass(asset.status)}`}
                      >
                        {getStatusLabelText(asset.status)}
                      </Badge>
                    </div>

                    {/* Modeler and Created Date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        {asset.modeler ? (
                          <div>
                            {asset.modeler.title ||
                              asset.modeler.email.split("@")[0]}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                      <div>
                        {dayjs(asset.created_at).format("MMM DD")} •{" "}
                        {dayjs(asset.created_at).format("YYYY")}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {asset.product_link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline"
                          onClick={() =>
                            window.open(asset.product_link as string, "_blank")
                          }
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Product
                        </Button>
                      )}
                      {asset.glb_link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline"
                          onClick={() => handleDownloadGLB(asset)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          GLB
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs px-3 py-1 h-7"
                        onClick={() => {
                          setSelectedAssetForView(asset);
                          setShowViewRefDialog(true);
                        }}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Files (
                        {separateReferences(asset.reference || null)
                          .imageReferences.length +
                          separateReferences(asset.reference || null).glbFiles
                            .length}
                        )
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 pt-3 sm:pt-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground order-1 sm:order-1">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredAssets.length)} of{" "}
              {filteredAssets.length} assets
            </div>
            <div className="flex items-center justify-center gap-2 order-2 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="text-xs sm:text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Reference Dialog (Reusable) */}
      <AddReferenceDialog
        open={showAddRefDialog}
        onOpenChange={(open) => {
          setShowAddRefDialog(open);
          if (!open && selectedAssetForRef) {
            refreshAssetReferenceData(selectedAssetForRef);
          }
        }}
        assetId={selectedAssetForRef}
        onUploadComplete={() => {
          if (selectedAssetForRef) {
            refreshAssetReferenceData(selectedAssetForRef);
          }
        }}
      />

      {/* View References Dialog (Reusable) */}
      <ViewReferencesDialog
        open={showViewRefDialog}
        onOpenChange={(open) => {
          setShowViewRefDialog(open);
          if (!open && selectedAssetForView?.id) {
            refreshAssetReferenceData(selectedAssetForView.id);
          }
        }}
        asset={selectedAssetForView}
        onAddReference={() => {
          setSelectedAssetForRef(selectedAssetForView?.id);
          setShowViewRefDialog(false);
          setShowAddRefDialog(true);
        }}
      />
    </div>
  );
}
