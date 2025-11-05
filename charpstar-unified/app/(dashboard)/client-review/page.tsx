"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
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
import { Button } from "@/components/ui/display";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";
import { ActivityLogsDialog } from "@/components/ui/containers/ActivityLogsDialog";
import { ShareForReviewDialog } from "@/components/ui/containers/ShareForReviewDialog";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  CheckCircle,
  ExternalLink,
  FileText,
  Download,
  X,
  Activity,
  Plus,
  Trash2,
  Layers,
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  Share,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import { getPriorityLabel } from "@/lib/constants";

// Helper function to get status label CSS class
const getStatusLabelClass = (status: string): string => {
  switch (status) {
    case "in_production":
      return "status-in-production";
    case "revisions":
      return "status-revisions";
    case "client_revision":
      return "status-client-revision";
    case "approved":
      return "status-approved";
    case "approved_by_client":
      return "status-approved-by-client";
    case "delivered_by_artist":
      return "status-in-progress"; // Use in-progress styling for client view
    case "not_started":
      return "status-in-production"; // Use same styling as in_production
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
      return "In Progress";
    case "revisions":
      return "Sent for Revision";
    case "client_revision":
      return "Client Revision";
    case "approved":
      return "New Upload";
    case "approved_by_client":
      return "Approved by Client";
    case "delivered_by_artist":
      return "In Progress"; // Client-facing label
    case "not_started":
      return "In Progress"; // Client-facing label
    case "in_progress":
      return "In Progress";
    case "waiting_for_approval":
      return "In Progress"; // Client-facing label
    default:
      return status;
  }
};

// Helper function to get priority CSS class - uses ASSET's client (not user's client)
const getPriorityClass = (priority: number, client?: string | null): string => {
  const clientUpper = (client || "").toUpperCase();
  const isAJ = clientUpper === "AJ";

  // AJ client uses inverted mapping: 1=Low, 2=Medium, 3=High
  if (isAJ) {
    if (priority === 3) return "priority-high";
    if (priority === 2) return "priority-medium";
    if (priority === 1) return "priority-low";
    // For AJ-specific priorities 4 and 5
    if (priority === 4 || priority === 5) return "priority-medium"; // Flex/Express use medium styling
    return "priority-medium";
  }
  // Standard mapping for non-AJ clients: 1=High, 2=Medium, 3=Low
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Client-specific priority labels: AJ supports 1..5 (Low, Medium, High, Flex, Express)
const getPriorityLabelForClient = (
  priority: number,
  client?: string | null
): string => {
  if ((client || "").toUpperCase() === "AJ") {
    switch (priority) {
      case 1:
        return "Low";
      case 2:
        return "Medium";
      case 3:
        return "High";
      case 4:
        return "Flex";
      case 5:
        return "Express";
      default:
        return "Medium";
    }
  }
  return getPriorityLabel(priority as 1 | 2 | 3);
};

// Helper function to get row styling based on status
const getRowStyling = (status: string): { base: string; hover: string } => {
  switch (status) {
    case "in_production":
      return { base: "table-row-status-in-production", hover: "" };
    case "revisions":
      return { base: "table-row-status-revisions", hover: "" };
    case "client_revision":
      return { base: "table-row-status-client-revision", hover: "" };
    case "approved":
      return { base: "table-row-status-approved", hover: "" };
    case "approved_by_client":
      return { base: "table-row-status-approved-by-client", hover: "" };
    case "delivered_by_artist":
      return { base: "table-row-status-in-production", hover: "" }; // Use in-production styling for client view
    case "not_started":
      return { base: "table-row-status-in-production", hover: "" }; // Use same styling as in_production
    case "in_progress":
      return { base: "table-row-status-in-progress", hover: "" };
    case "waiting_for_approval":
      return { base: "table-row-status-waiting-for-approval", hover: "" };
    default:
      return { base: "table-row-status-unknown", hover: "" };
  }
};

const PAGE_SIZE = 100;

const ReviewTableSkeleton = () => (
  <div className="overflow-y-auto rounded-lg border dark:border-border bg-background dark:bg-background flex-1 max-h-[78vh]">
    <Table>
      <TableHeader>
        <TableRow className="dark:border-border">
          <TableHead className="w-12 text-left">
            <div className="h-4 w-4 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead className="text-left">
            <div className="h-4 w-24 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead className="text-left">
            <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead className="text-left">
            <div className="h-4 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead className="text-left">
            <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead className="text-left">
            <div className="h-4 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i} className="dark:border-border">
            <TableCell className="text-left">
              <div className="h-4 w-4 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell className="text-left">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            </TableCell>
            <TableCell className="text-left">
              <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell className="text-left">
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                <div className="h-3 w-8 bg-muted dark:bg-muted/50 rounded animate-pulse" />
              </div>
            </TableCell>
            <TableCell className="text-left">
              <div className="h-4 w-24 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell className="text-left">
              <div className="h-6 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function ReviewDashboardPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);

  const [sort, setSort] = useState<string>("status-progress");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState<
    Record<string, number>
  >({});
  const [bulkPriority, setBulkPriority] = useState<number>(2);
  const [allocatedAssets, setAllocatedAssets] = useState<Set<string>>(
    new Set()
  );

  // Add new filter states for multi-select capability
  const [clientFilters, setClientFilters] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<number[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<string[]>([]);

  // Add Ref dialog state
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );

  // View Ref dialog state
  const [showViewRefDialog, setShowViewRefDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  // Activity logs dialog state
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  // Share for review dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded parent groups state for collapsible parent/variation groups
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    new Set()
  );

  // Function to toggle parent group expansion
  const toggleParentGroup = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  // Group assets by parent/child relationships and create flat list for rendering
  const flatAssetsWithGroups = useMemo(() => {
    const result: Array<{
      asset: any;
      isParent: boolean;
      isVariation: boolean;
      parentId?: string;
      variationIndex?: number;
      variationCount?: number;
    }> = [];
    const parentMap = new Map<string, any[]>();
    const standaloneAssets: any[] = [];
    const processedIds = new Set<string>();

    // First, find all parents and group their variations
    filtered.forEach((asset) => {
      if (processedIds.has(asset.id)) return;

      const isVariation = asset.is_variation === true;
      const isParent = filtered.some((a) => a.parent_asset_id === asset.id);

      if (isParent && !isVariation) {
        // This is a parent - find all its variations and sort by variation_index
        const variations = filtered
          .filter((a) => a.parent_asset_id === asset.id)
          .sort((a, b) => {
            const indexA = a.variation_index || 0;
            const indexB = b.variation_index || 0;
            return indexA - indexB;
          });
        parentMap.set(asset.id, [asset, ...variations]);
        processedIds.add(asset.id);
        variations.forEach((v) => processedIds.add(v.id));
      } else if (!isVariation && !isParent) {
        // Standalone asset
        standaloneAssets.push(asset);
        processedIds.add(asset.id);
      }
    });

    // Add any remaining variations (orphaned) as standalone
    filtered.forEach((asset) => {
      if (!processedIds.has(asset.id)) {
        standaloneAssets.push(asset);
      }
    });

    // Build flat list: parents with their variations grouped
    parentMap.forEach((group, parentId) => {
      const parent = group[0];
      const variations = group.slice(1);
      result.push({
        asset: parent,
        isParent: true,
        isVariation: false,
        variationCount: variations.length,
      });
      // Add variations if parent is expanded
      if (expandedParents.has(parentId)) {
        variations.forEach((variation) => {
          result.push({
            asset: variation,
            isParent: false,
            isVariation: true,
            parentId,
            variationIndex: variation.variation_index,
          });
        });
      }
    });

    // Add standalone assets
    standaloneAssets.forEach((asset) => {
      const isVariation = asset.is_variation === true;
      result.push({
        asset,
        isParent: false,
        isVariation,
        parentId: asset.parent_asset_id,
        variationIndex: asset.variation_index,
      });
    });

    // Apply sorting
    if (sort === "az") {
      result.sort((a, b) =>
        a.asset.product_name.localeCompare(b.asset.product_name)
      );
    } else if (sort === "za") {
      result.sort((a, b) =>
        b.asset.product_name.localeCompare(a.asset.product_name)
      );
    }

    return result;
  }, [filtered, expandedParents, sort]);

  // Pagination for grouped assets
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return flatAssetsWithGroups.slice(start, end);
  }, [flatAssetsWithGroups, page]);

  // Function to refresh a specific asset's reference data
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link, measurements")
        .eq("id", assetId)
        .single();

      if (!error && data) {
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  reference: data.reference,
                  glb_link: data.glb_link,
                  measurements: data.measurements,
                }
              : asset
          )
        );
      }
    } catch (error) {
      console.error("Error refreshing asset reference data:", error);
    }
  };

  // Function to fetch allocation data
  const fetchAllocationData = async () => {
    try {
      const { data: assignments, error } = await supabase
        .from("asset_assignments")
        .select("asset_id, user_id")
        .eq("status", "accepted");

      if (error) {
        console.error("Error fetching allocation data:", error);
        return;
      }

      if (assignments) {
        const allocatedAssetIds = new Set(
          assignments.map((assignment) => assignment.asset_id)
        );
        setAllocatedAssets(allocatedAssetIds);
      }
    } catch (error) {
      console.error("Error in fetchAllocationData:", error);
    }
  };

  // Calculate status totals
  const statusTotals = useMemo(() => {
    const totals = {
      total: assets.length,
      in_production: 0,
      revisions: 0,
      client_revision: 0,
      approved: 0,
      approved_by_client: 0,
      delivered_by_artist: 0,
      review: 0,
    };

    assets.forEach((asset) => {
      const displayStatus = asset.status;

      if (displayStatus && totals.hasOwnProperty(displayStatus)) {
        totals[displayStatus as keyof typeof totals]++;
      }
    });

    return totals;
  }, [assets]);

  // Fetch assets for this client
  const fetchAssets = async () => {
    if (
      !user?.metadata?.client ||
      !Array.isArray(user.metadata.client) ||
      user.metadata.client.length === 0
    ) {
      return;
    }

    startLoading();
    setLoading(true);

    try {
      // Build query to fetch assets from all user's companies
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, product_link, glb_link, reference, client, upload_order, transferred, measurements, is_variation, parent_asset_id, variation_index"
        )
        .in("client", user.metadata.client)
        .eq("transferred", false) // Hide transferred assets
        .order("upload_order", { ascending: true });

      if (error) {
        console.error("Error fetching assets:", error);
        toast.error("Failed to fetch assets");
        return;
      }

      if (data) {
        setAssets(data);

        // Populate clients array for filter dropdown
        const uniqueClients = Array.from(
          new Set(data.map((asset) => asset.client).filter(Boolean))
        ).sort();
        setClients(uniqueClients);
      } else {
        setAssets([]);
      }
    } catch (err) {
      console.error("Exception in fetchAssets:", err);
      toast.error("Failed to fetch assets");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchAllocationData();
  }, [user?.metadata?.client]);

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

  // Listen for asset status updates from individual review pages
  useEffect(() => {
    const handleAssetStatusUpdate = () => {
      fetchAssets();
    };

    window.addEventListener(
      "assetStatusUpdated",
      handleAssetStatusUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "assetStatusUpdated",
        handleAssetStatusUpdate as EventListener
      );
    };
  }, []);

  // Fetch annotation counts for assets
  useEffect(() => {
    async function fetchAnnotationCounts() {
      if (assets.length === 0 || !user) return;

      try {
        const assetIds = assets.map((asset) => asset.id);
        let query = supabase
          .from("asset_annotations")
          .select("asset_id")
          .in("asset_id", assetIds);

        // Apply role-based filtering for annotation counts
        if (user.metadata?.role === "client") {
          // Clients can only see counts for their own annotations
          query = query.eq("created_by", user.id);
        }
        // QA, modelers, admin, and production can see all annotation counts (no additional filter needed)

        const { data, error } = await query;

        if (!error && data) {
          const counts: Record<string, number> = {};
          data.forEach((annotation) => {
            counts[annotation.asset_id] =
              (counts[annotation.asset_id] || 0) + 1;
          });
          setAnnotationCounts(counts);
        }
      } catch (error) {
        console.error("Error fetching annotation counts:", error);
      }
    }

    fetchAnnotationCounts();
  }, [assets, user]);

  // Filtering, sorting, searching
  useEffect(() => {
    let data = [...assets];

    // Apply multi client filter
    if (clientFilters.length > 0) {
      data = data.filter((asset) => clientFilters.includes(asset.client));
    }

    // Apply multi batch filter
    if (batchFilters.length > 0) {
      data = data.filter((asset) => batchFilters.includes(Number(asset.batch)));
    }

    // Apply multi status filter
    if (statusFilters.length > 0) {
      data = data.filter((asset) => statusFilters.includes(asset.status));
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (a) =>
          a.product_name?.toLowerCase().includes(s) ||
          a.article_id?.toLowerCase().includes(s)
      );
    }
    if (sort === "az")
      data.sort((a, b) => a.product_name.localeCompare(b.product_name));
    if (sort === "za")
      data.sort((a, b) => b.product_name.localeCompare(a.product_name));
    if (sort === "date")
      data.sort((a, b) =>
        (b.delivery_date || "").localeCompare(a.delivery_date || "")
      );
    if (sort === "date-oldest")
      data.sort((a, b) =>
        (a.delivery_date || "").localeCompare(b.delivery_date || "")
      );
    if (sort === "batch") data.sort((a, b) => (a.batch || 1) - (b.batch || 1));
    if (sort === "priority")
      data.sort((a, b) => (a.priority || 2) - (b.priority || 2));
    if (sort === "priority-lowest")
      data.sort((a, b) => (b.priority || 2) - (a.priority || 2));
    if (sort === "status-progress") {
      const statusPriority: Record<string, number> = {
        in_production: 1,
        delivered_by_artist: 2,
        revisions: 3,
        approved: 4,
        approved_by_client: 5,
      };
      data.sort(
        (a, b) =>
          (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
      );
    }
    setFiltered(data);
  }, [assets, sort, search, clientFilters, batchFilters, statusFilters]);

  // Reset page when filters change (but not when assets are updated)
  useEffect(() => {
    setPage(1);
  }, [sort, search, clientFilters, batchFilters, statusFilters]);

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((item) => item.asset.id)));
    }
  };

  const isAllSelected = selected.size === paged.length && paged.length > 0;
  const isIndeterminate = selected.size > 0 && selected.size < paged.length;

  const handleBulkPriorityChange = async () => {
    if (selected.size === 0) return;

    startLoading();
    try {
      const selectedIds = Array.from(selected);

      // Update local state immediately
      setAssets((prev) =>
        prev.map((a) =>
          selectedIds.includes(a.id) ? { ...a, priority: bulkPriority } : a
        )
      );

      // Update database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ priority: bulkPriority })
        .in("id", selectedIds);

      if (error) {
        console.error("Error updating bulk priority:", error);
        toast.error("Failed to update priorities");
        // Revert on error
        setAssets((prev) =>
          prev.map((a) =>
            selectedIds.includes(a.id) ? { ...a, priority: a.priority || 2 } : a
          )
        );
      } else {
        toast.success(`Updated priority for ${selectedIds.length} product(s)`);
        setSelected(new Set()); // Clear selection
      }
    } catch (error) {
      console.error("Error in bulk priority update:", error);
      toast.error("Failed to update priorities");
    } finally {
      stopLoading();
    }
  };

  // Helper function to parse references
  const parseReferences = (
    referenceImages: string[] | string | null
  ): string[] => {
    if (!referenceImages) return [];
    if (Array.isArray(referenceImages)) return referenceImages;

    // Check if it's a string with ||| separator
    if (
      typeof referenceImages === "string" &&
      referenceImages.includes("|||")
    ) {
      return referenceImages
        .split("|||")
        .map((ref) => ref.trim())
        .filter(Boolean);
    }

    try {
      return JSON.parse(referenceImages);
    } catch {
      return [referenceImages];
    }
  };

  // Handle delete asset
  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;

    // Check if asset is allocated
    if (allocatedAssets.has(assetToDelete.id)) {
      toast.error("Cannot delete product - it has been allocated to a modeler");
      setShowDeleteDialog(false);
      setAssetToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("onboarding_assets")
        .delete()
        .eq("id", assetToDelete.id);

      if (error) {
        console.error("Error deleting asset:", error);
        toast.error("Failed to delete product");
        return;
      }

      // Remove from local state
      setAssets((prev) =>
        prev.filter((asset) => asset.id !== assetToDelete.id)
      );

      // Clear selection if the deleted asset was selected
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(assetToDelete.id);
        return next;
      });

      toast.success("Product deleted successfully");
      setShowDeleteDialog(false);
      setAssetToDelete(null);
    } catch (error) {
      console.error("Error in delete asset:", error);
      toast.error("Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <Card className="p-3 sm:p-6 flex-1 flex flex-col border-0 shadow-none">
        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            {/* Total Models (no filtering on this card itself) */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters([]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-info-muted dark:bg-info-muted/20 rounded-lg">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">Total Models</span>
                    <span className="sm:hidden">Total</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-info">
                    {statusTotals.total}
                  </p>
                </div>
              </div>
            </Card>

            {/* New Upload (Approved) */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["approved"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">New Upload</span>
                    <span className="sm:hidden">New</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-medium text-green-600">
                    {statusTotals.approved}
                  </p>
                </div>
              </div>
            </Card>

            {/* Client Revision */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["client_revision"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">Client Revision</span>
                    <span className="sm:hidden">Client Rev</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-red-600">
                    {statusTotals.client_revision || 0}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved by Client */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["approved_by_client"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">Approved by Client</span>
                    <span className="sm:hidden">Approved</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600">
                    {statusTotals.approved_by_client}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
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
                  setPage(1);
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

              <Input
                className="w-full sm:w-48 md:w-64 text-sm"
                placeholder="Search by name or article ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              {/* Bulk Actions - Only show when items are selected */}
              {selected.size > 0 && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5  rounded-md">
                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                    <span className="text-xs font-medium text-primary">
                      {selected.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(new Set())}
                      className="h-5 px-2 text-xs hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={bulkPriority.toString()}
                      onValueChange={(value) =>
                        setBulkPriority(parseInt(value))
                      }
                    >
                      <SelectTrigger className="h-8 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">High</SelectItem>
                        <SelectItem value="2">Medium</SelectItem>
                        <SelectItem value="3">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleBulkPriorityChange}
                      className="h-8 px-3 text-xs"
                    >
                      Set Priority
                    </Button>
                  </div>
                  {/* Share for Review
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowShareDialog(true)}
                      className="h-8 px-3 text-xs"
                    >
                      <Share className="h-3 w-3 mr-1" />
                      Share for Review
                    </Button>
                  </div>
                  */}
                </>
              )}

              {/* Logs Dialog Trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogsDialog(true)}
                className="gap-2 h-8 sm:h-9 text-sm"
              >
                <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logs</span>
                <span className="sm:hidden">Logs</span>
              </Button>

              <Select value={sort} onValueChange={(value) => setSort(value)}>
                <SelectTrigger className="w-full sm:w-auto h-8 sm:h-9 text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status-progress">
                    <span className="hidden sm:inline">
                      Sort by: Status Progression
                    </span>
                    <span className="sm:hidden">Status Progression</span>
                  </SelectItem>
                  <SelectItem value="batch">
                    <span className="hidden sm:inline">
                      Sort by: Batch (1, 2, 3...)
                    </span>
                    <span className="sm:hidden">Batch</span>
                  </SelectItem>
                  <SelectItem value="priority">
                    <span className="hidden sm:inline">
                      Sort by: Priority (Highest First)
                    </span>
                    <span className="sm:hidden">Priority (High)</span>
                  </SelectItem>
                  <SelectItem value="priority-lowest">
                    <span className="hidden sm:inline">
                      Sort by: Priority (Lowest First)
                    </span>
                    <span className="sm:hidden">Priority (Low)</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSort("status-progress");
                  setPage(1);
                  setClientFilters([]);
                  setBatchFilters([]);
                  setStatusFilters([]);
                }}
                className="gap-2 h-8 sm:h-9 text-sm w-full sm:w-auto"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border dark:border-border bg-background dark:bg-background flex-1 max-h-[62vh] min-h-[62vh] relative">
          {loading ? (
            <ReviewTableSkeleton />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block min-w-[1000px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-20 border-b border-border dark:border-border shadow-sm">
                    <TableRow className="dark:border-border">
                      <TableHead className="w-12 dark:text-foreground text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Checkbox
                            checked={
                              isAllSelected
                                ? true
                                : isIndeterminate
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={selectAll}
                            className="dark:border-border"
                          />
                        </div>
                      </TableHead>
                      <TableHead className="dark:text-foreground text-left w-32 max-w-32">
                        Model Name
                      </TableHead>
                      <TableHead className="dark:text-foreground text-left w-20 max-w-20">
                        Article ID
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-24">
                        Priority
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-32">
                        Status
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-20">
                        Link
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-20">
                        Refs
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-16">
                        View
                      </TableHead>
                      <TableHead className="dark:text-foreground text-center w-16">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="pt-16">
                    {paged.length === 0 ? (
                      <TableRow className="dark:border-border">
                        <TableCell
                          colSpan={10}
                          className="text-center dark:text-muted-foreground py-8"
                        >
                          {statusFilters.length > 0 ||
                          clientFilters.length > 0 ||
                          batchFilters.length > 0 ||
                          search ? (
                            <div className="space-y-2">
                              <div className="text-lg font-medium">
                                No matching assets found
                              </div>
                              <div className="text-sm">
                                {clientFilters.length > 0 && (
                                  <div>
                                    No assets for client:{" "}
                                    {clientFilters.join(", ")}
                                  </div>
                                )}
                                {batchFilters.length > 0 && (
                                  <div>
                                    No assets in batch:{" "}
                                    {batchFilters.join(", ")}
                                  </div>
                                )}
                                {search && (
                                  <div>
                                    No assets matching: &quot;{search}&quot;
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-3">
                                Try adjusting your filters or check back later
                                for new assets.
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-lg font-medium">
                                No products found
                              </div>
                              <div className="text-sm">
                                No assets are available at the moment.
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paged.map((item) => {
                        const {
                          asset,
                          isParent,
                          isVariation,
                          variationCount,
                          variationIndex,
                        } = item;
                        const rowStyling = getRowStyling(asset.status);
                        const isExpanded =
                          isParent && expandedParents.has(asset.id);
                        return (
                          <TableRow
                            key={asset.id}
                            className={`${rowStyling.base} transition-all duration-200 dark:border-border dark:hover:bg-muted/20 ${
                              isVariation
                                ? "bg-slate-50/50 dark:bg-slate-900/20 border-l-2 border-l-slate-300 dark:border-l-slate-600"
                                : isParent
                                  ? "bg-amber-50/30 dark:bg-amber-950/10 border-l-2 border-l-amber-400 dark:border-l-amber-600"
                                  : ""
                            }`}
                          >
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selected.has(asset.id)}
                                onCheckedChange={() => toggleSelect(asset.id)}
                                className="bg-background dark:bg-background dark:border-border"
                              />
                            </TableCell>
                            <TableCell className="text-left w-32 max-w-32">
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isParent ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                        onClick={() =>
                                          toggleParentGroup(asset.id)
                                        }
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                                        )}
                                      </Button>
                                      <Layers className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                                      <span
                                        className="font-semibold dark:text-foreground truncate cursor-help text-amber-700 dark:text-amber-500"
                                        title={asset.product_name}
                                      >
                                        {asset.product_name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-amber-700 dark:text-amber-500 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 px-1.5 py-0 ml-1 font-medium"
                                      >
                                        {variationCount}{" "}
                                        {variationCount === 1
                                          ? "variation"
                                          : "variations"}
                                      </Badge>
                                    </>
                                  ) : isVariation ? (
                                    <>
                                      <div className="w-8 flex items-center justify-center flex-shrink-0">
                                        <div className="h-px w-4 bg-slate-300 dark:bg-slate-600" />
                                        <ChevronRight className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                                      </div>
                                      <span
                                        className="font-medium dark:text-foreground truncate cursor-help text-slate-600 dark:text-slate-400"
                                        title={asset.product_name}
                                      >
                                        {asset.product_name}
                                      </span>
                                      {variationIndex && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 px-1.5 py-0 ml-1"
                                        >
                                          V{variationIndex}
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <span
                                      className="font-medium dark:text-foreground truncate cursor-help"
                                      title={asset.product_name}
                                    >
                                      {asset.product_name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs"></div>
                              </div>
                            </TableCell>
                            <TableCell className="dark:text-foreground text-left w-20 max-w-20">
                              <div className="flex items-center gap-1.5">
                                {isVariation ? (
                                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                                    <div className="h-px w-4 bg-slate-300 dark:bg-slate-600" />
                                  </div>
                                ) : isParent ? (
                                  <div className="w-8 flex items-center justify-center flex-shrink-0" />
                                ) : null}
                                <span
                                  className={`text-xs font-mono truncate block ${
                                    isVariation
                                      ? "text-slate-600 dark:text-slate-400"
                                      : isParent
                                        ? "text-amber-700 dark:text-amber-500 font-semibold"
                                        : ""
                                  }`}
                                  title={asset.article_id}
                                >
                                  {asset.article_id}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-24">
                              <div className="flex items-center justify-center">
                                <Select
                                  value={(asset.priority || 2).toString()}
                                  onValueChange={(value) => {
                                    const newPriority = parseInt(value);
                                    setAssets((prev) =>
                                      prev.map((a) =>
                                        a.id === asset.id
                                          ? { ...a, priority: newPriority }
                                          : a
                                      )
                                    );
                                    // Auto-save to database
                                    supabase
                                      .from("onboarding_assets")
                                      .update({ priority: newPriority })
                                      .eq("id", asset.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          console.error(
                                            "Error updating priority:",
                                            error
                                          );
                                          toast.error(
                                            "Failed to update priority"
                                          );
                                          // Revert on error
                                          setAssets((prev) =>
                                            prev.map((a) =>
                                              a.id === asset.id
                                                ? {
                                                    ...a,
                                                    priority:
                                                      asset.priority || 2,
                                                  }
                                                : a
                                            )
                                          );
                                        } else {
                                          toast.success("Priority updated");
                                        }
                                      });
                                  }}
                                >
                                  <SelectTrigger
                                    className={`border-0 shadow-none dark:shadow-none dark:border-none dark:bg-transparent hover:bg-transparent dark:hover:bg-transparent p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                                  >
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                        asset.priority || 2,
                                        asset.client
                                      )}`}
                                    >
                                      {getPriorityLabelForClient(
                                        asset.priority || 2,
                                        asset.client
                                      )}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {asset.client?.toUpperCase() === "AJ" ? (
                                      <>
                                        <SelectItem
                                          value="1"
                                          className="dark:text-foreground"
                                        >
                                          Low
                                        </SelectItem>
                                        <SelectItem
                                          value="2"
                                          className="dark:text-foreground"
                                        >
                                          Medium
                                        </SelectItem>
                                        <SelectItem
                                          value="3"
                                          className="dark:text-foreground"
                                        >
                                          High
                                        </SelectItem>
                                        <SelectItem
                                          value="4"
                                          className="dark:text-foreground"
                                        >
                                          Flex
                                        </SelectItem>
                                        <SelectItem
                                          value="5"
                                          className="dark:text-foreground"
                                        >
                                          Express
                                        </SelectItem>
                                      </>
                                    ) : (
                                      <>
                                        <SelectItem
                                          value="1"
                                          className="dark:text-foreground"
                                        >
                                          High
                                        </SelectItem>
                                        <SelectItem
                                          value="2"
                                          className="dark:text-foreground"
                                        >
                                          Medium
                                        </SelectItem>
                                        <SelectItem
                                          value="3"
                                          className="dark:text-foreground"
                                        >
                                          Low
                                        </SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>

                            <TableCell className="text-center w-32">
                              <div className="flex items-center justify-center">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold shadow-none border-none bg-transparent ${getStatusLabelClass(asset.status)}`}
                                >
                                  {getStatusLabelText(asset.status)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-20">
                              {asset.product_link ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-center p-1 text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline dark:hover:bg-muted/50"
                                  onClick={() =>
                                    window.open(asset.product_link, "_blank")
                                  }
                                >
                                  Link
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center w-20">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-2 py-1 h-6 dark:border-border dark:hover:bg-muted/50"
                                  onClick={() => {
                                    setSelectedAssetForView(asset);
                                    setShowViewRefDialog(true);
                                  }}
                                  title={`View ${(() => {
                                    const allRefs = parseReferences(
                                      asset.reference
                                    );
                                    const total =
                                      allRefs.length + (asset.glb_link ? 1 : 0);
                                    return `${total} reference${total !== 1 ? "s" : ""}`;
                                  })()}`}
                                >
                                  <FileText className="mr-1 h-3 w-3" />
                                  {(() => {
                                    const allRefs = parseReferences(
                                      asset.reference
                                    );
                                    return (
                                      allRefs.length + (asset.glb_link ? 1 : 0)
                                    );
                                  })()}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 dark:border-border dark:hover:bg-muted/50 hover:bg-primary/10 hover:border-primary"
                                  onClick={() => {
                                    setSelectedAssetForRef(asset.id);
                                    setShowAddRefDialog(true);
                                  }}
                                  title="Add reference"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>

                            <TableCell className="text-center w-16">
                              {(asset.status === "approved" ||
                                asset.status === "approved_by_client") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const currentParams = new URLSearchParams(
                                      searchParams.toString()
                                    );
                                    currentParams.set("from", "client-review");
                                    router.push(
                                      `/client-review/${asset.id}?${currentParams.toString()}`
                                    );
                                  }}
                                  className="h-6 w-6 dark:hover:bg-muted/50"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-center w-16">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setAssetToDelete(asset);
                                  setShowDeleteDialog(true);
                                }}
                                disabled={allocatedAssets.has(asset.id)}
                                className={`h-6 w-6 ${
                                  allocatedAssets.has(asset.id)
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                }`}
                                title={
                                  allocatedAssets.has(asset.id)
                                    ? "Cannot delete - asset has been allocated to a modeler"
                                    : "Delete product"
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Tablet View */}
              <div className="hidden md:block lg:hidden">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Table view not available on this screen size.</p>
                  <p className="text-sm mt-2">
                    Please use a larger screen or switch to mobile view.
                  </p>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-3">
                {paged.length === 0 ? (
                  <div className="text-center py-8">
                    {statusFilters.length > 0 ||
                    clientFilters.length > 0 ||
                    batchFilters.length > 0 ||
                    search ? (
                      <div className="space-y-2">
                        <div className="text-base font-medium">
                          No matching assets found
                        </div>
                        <div className="text-sm">
                          {clientFilters.length > 0 && (
                            <div>
                              No assets for client: {clientFilters.join(", ")}
                            </div>
                          )}
                          {batchFilters.length > 0 && (
                            <div>
                              No assets in batch: {batchFilters.join(", ")}
                            </div>
                          )}
                          {search && (
                            <div>No assets matching: &quot;{search}&quot;</div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          Try adjusting your filters or check back later for new
                          assets.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-base font-medium">
                          No products found
                        </div>
                        <div className="text-sm">
                          No assets are available at the moment.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  paged.map((item) => {
                    const { asset, isParent, isVariation } = item;
                    const rowStyling = getRowStyling(asset.status);
                    return (
                      <Card
                        key={asset.id}
                        className={`p-4 transition-all duration-200 ${rowStyling.base} dark:border-border dark:hover:bg-muted/20 ${
                          isVariation
                            ? "bg-slate-50/50 dark:bg-slate-900/20 border-l-2 border-l-slate-300 dark:border-l-slate-600"
                            : isParent
                              ? "bg-amber-50/30 dark:bg-amber-950/10 border-l-2 border-l-amber-400 dark:border-l-amber-600"
                              : ""
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Header with checkbox and product name */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selected.has(asset.id)}
                                onCheckedChange={() => toggleSelect(asset.id)}
                                className="bg-background dark:bg-background dark:border-border"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isVariation && (
                                    <ChevronRight className="h-3 w-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                  )}
                                  {isParent && !isVariation && (
                                    <Package className="h-3 w-3 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                                  )}
                                  <h3
                                    className={`font-medium text-sm dark:text-foreground truncate ${
                                      isVariation
                                        ? "text-slate-600 dark:text-slate-400"
                                        : isParent
                                          ? "text-amber-700 dark:text-amber-500"
                                          : ""
                                    }`}
                                    title={asset.product_name}
                                  >
                                    {asset.product_name.length > 45
                                      ? asset.product_name.substring(0, 45) +
                                        "..."
                                      : asset.product_name}
                                  </h3>
                                  {isParent && !isVariation && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-amber-700 dark:text-amber-500 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 px-1.5 py-0"
                                    >
                                      Parent
                                    </Badge>
                                  )}
                                  {isVariation && asset.variation_index && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 px-1.5 py-0"
                                    >
                                      V{asset.variation_index}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                    {annotationCounts[asset.id] || 0} annotation
                                    {(annotationCounts[asset.id] || 0) !== 1
                                      ? "s"
                                      : ""}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    •
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs dark:border-border dark:bg-muted/20"
                                  >
                                    Batch {asset.batch || 1}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            {(asset.status === "approved" ||
                              asset.status === "approved_by_client") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const currentParams = new URLSearchParams(
                                    searchParams.toString()
                                  );
                                  currentParams.set("from", "client-review");
                                  router.push(
                                    `/client-review/${asset.id}?${currentParams.toString()}`
                                  );
                                }}
                                className="h-8 w-8 dark:hover:bg-muted/50 flex-shrink-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Article ID and Priority */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              {isVariation && (
                                <ChevronRight className="h-3 w-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                              )}
                              {isParent && !isVariation && (
                                <Package className="h-3 w-3 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                              )}
                              <span
                                className={
                                  isVariation
                                    ? "text-slate-600 dark:text-slate-400"
                                    : isParent
                                      ? "text-amber-700 dark:text-amber-500"
                                      : "text-muted-foreground dark:text-muted-foreground"
                                }
                              >
                                {asset.article_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={(asset.priority || 2).toString()}
                                onValueChange={(value) => {
                                  const newPriority = parseInt(value);
                                  setAssets((prev) =>
                                    prev.map((a) =>
                                      a.id === asset.id
                                        ? { ...a, priority: newPriority }
                                        : a
                                    )
                                  );
                                  // Auto-save to database
                                  supabase
                                    .from("onboarding_assets")
                                    .update({ priority: newPriority })
                                    .eq("id", asset.id)
                                    .then(({ error }) => {
                                      if (error) {
                                        console.error(
                                          "Error updating priority:",
                                          error
                                        );
                                        toast.error(
                                          "Failed to update priority"
                                        );
                                        // Revert on error
                                        setAssets((prev) =>
                                          prev.map((a) =>
                                            a.id === asset.id
                                              ? {
                                                  ...a,
                                                  priority: asset.priority || 2,
                                                }
                                              : a
                                          )
                                        );
                                      } else {
                                        toast.success("Priority updated");
                                      }
                                    });
                                }}
                              >
                                <SelectTrigger
                                  className={`border-0 shadow-none p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                                >
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                      asset.priority || 2,
                                      asset.client
                                    )}`}
                                  >
                                    {getPriorityLabelForClient(
                                      asset.priority || 2,
                                      asset.client
                                    )}
                                  </span>
                                </SelectTrigger>
                                <SelectContent className="dark:bg-background dark:border-border">
                                  {asset.client?.toUpperCase() === "AJ" ? (
                                    <>
                                      <SelectItem
                                        value="1"
                                        className="dark:text-foreground"
                                      >
                                        Low
                                      </SelectItem>
                                      <SelectItem
                                        value="2"
                                        className="dark:text-foreground"
                                      >
                                        Medium
                                      </SelectItem>
                                      <SelectItem
                                        value="3"
                                        className="dark:text-foreground"
                                      >
                                        High
                                      </SelectItem>
                                      <SelectItem
                                        value="4"
                                        className="dark:text-foreground"
                                      >
                                        Flex
                                      </SelectItem>
                                      <SelectItem
                                        value="5"
                                        className="dark:text-foreground"
                                      >
                                        Express
                                      </SelectItem>
                                    </>
                                  ) : (
                                    <>
                                      <SelectItem
                                        value="1"
                                        className="dark:text-foreground"
                                      >
                                        High
                                      </SelectItem>
                                      <SelectItem
                                        value="2"
                                        className="dark:text-foreground"
                                      >
                                        Medium
                                      </SelectItem>
                                      <SelectItem
                                        value="3"
                                        className="dark:text-foreground"
                                      >
                                        Low
                                      </SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex items-center justify-start">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${getStatusLabelClass(asset.status)}`}
                            >
                              {getStatusLabelText(asset.status)}
                            </span>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            {asset.product_link && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline dark:hover:bg-muted/50"
                                onClick={() =>
                                  window.open(asset.product_link, "_blank")
                                }
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Product Link
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs px-3 py-1 h-7 dark:border-border dark:hover:bg-muted/50"
                              onClick={() => {
                                setSelectedAssetForView(asset);
                                setShowViewRefDialog(true);
                              }}
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              View (
                              {(() => {
                                const allRefs = parseReferences(
                                  asset.reference
                                );
                                return (
                                  allRefs.length + (asset.glb_link ? 1 : 0)
                                );
                              })()}
                              )
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 dark:border-border dark:hover:bg-muted/50 hover:bg-primary/10 hover:border-primary flex-shrink-0"
                              onClick={() => {
                                setSelectedAssetForRef(asset.id);
                                setShowAddRefDialog(true);
                              }}
                              title="Add reference"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            {asset.glb_link && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline dark:hover:bg-muted/50"
                                onClick={() =>
                                  window.open(asset.glb_link, "_blank")
                                }
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Download GLB
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={allocatedAssets.has(asset.id)}
                              className={`flex-1 text-xs ${
                                allocatedAssets.has(asset.id)
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              }`}
                              onClick={() => {
                                setAssetToDelete(asset);
                                setShowDeleteDialog(true);
                              }}
                              title={
                                allocatedAssets.has(asset.id)
                                  ? "Cannot delete - asset has been allocated to a modeler"
                                  : "Delete product"
                              }
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
        {/* Pagination - Always at bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 mt-4">
          {selected.size > 0 && (
            <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground order-2 sm:order-1 sm:mr-4">
              {selected.size} of {paged.length} on this page selected
            </div>
          )}
          <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground order-1 sm:order-2">
            {filtered.length === 0
              ? "No items"
              : `
                ${1 + (page - 1) * PAGE_SIZE}
                -
                ${Math.min(page * PAGE_SIZE, filtered.length)}
                of
                ${filtered.length}
                Items
              `}
          </div>
          <div className="flex gap-2 order-3">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50 h-8 w-8 sm:h-9 sm:w-9"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50 h-8 w-8 sm:h-9 sm:w-9"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Reference Dialog */}
      <AddReferenceDialog
        open={showAddRefDialog}
        onOpenChange={(open) => {
          setShowAddRefDialog(open);
          // Refresh reference data when dialog closes
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

      {/* View References Dialog */}
      <ViewReferencesDialog
        open={showViewRefDialog}
        onOpenChange={(open) => {
          setShowViewRefDialog(open);
          // Refresh reference data when dialog closes
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

      {/* Activity Logs Dialog */}
      <ActivityLogsDialog
        open={showLogsDialog}
        onOpenChange={setShowLogsDialog}
        assetIds={assets.map((asset) => asset.id)}
      />

      {/* Share for Review Dialog */}
      <ShareForReviewDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        assetIds={Array.from(selected)}
        assetCount={selected.size}
        onSuccess={() => {
          setSelected(new Set()); // Clear selection after sharing
        }}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold dark:text-foreground">
                  Delete Product
                </h3>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="mb-6">
              {allocatedAssets.has(assetToDelete.id) ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <p className="font-medium text-sm text-red-800 dark:text-red-200">
                      Cannot Delete - Asset Allocated
                    </p>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    This product has been allocated to a modeler and cannot be
                    deleted.
                  </p>
                </div>
              ) : (
                <p className="text-sm dark:text-foreground mb-2">
                  Are you sure you want to delete this product?
                </p>
              )}
              <div className="bg-muted dark:bg-muted/20 rounded-lg p-3">
                <p className="font-medium text-sm dark:text-foreground">
                  {assetToDelete.product_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Article ID: {assetToDelete.article_id}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setAssetToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAsset}
                disabled={isDeleting || allocatedAssets.has(assetToDelete.id)}
                className={`${
                  allocatedAssets.has(assetToDelete.id)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : allocatedAssets.has(assetToDelete.id) ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cannot Delete
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Product
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
