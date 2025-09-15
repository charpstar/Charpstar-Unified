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
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Send,
  CheckCircle,
  ExternalLink,
  FileText,
  Download,
  X,
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
    case "approved":
      return "status-approved";
    case "approved_by_client":
      return "status-approved-by-client";
    case "delivered_by_artist":
      return "status-delivered-by-artist";
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

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Helper function to get row styling based on status
const getRowStyling = (status: string): { base: string; hover: string } => {
  switch (status) {
    case "in_production":
      return { base: "table-row-status-in-production", hover: "" };
    case "revisions":
      return { base: "table-row-status-revisions", hover: "" };
    case "approved":
      return { base: "table-row-status-approved", hover: "" };
    case "approved_by_client":
      return { base: "table-row-status-approved-by-client", hover: "" };
    case "delivered_by_artist":
      return { base: "table-row-status-delivered-by-artist", hover: "" };
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

const PAGE_SIZE = 18;

const ReviewTableSkeleton = () => (
  <div className="overflow-y-auto rounded-lg border dark:border-border bg-background dark:bg-background flex-1 max-h-[78vh]">
    <Table>
      <TableHeader>
        <TableRow className="dark:border-border">
          <TableHead className="w-12">
            <div className="h-4 w-4 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-24 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i} className="dark:border-border">
            <TableCell>
              <div className="h-4 w-4 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-20 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted dark:bg-muted/50 rounded animate-pulse" />
                <div className="h-3 w-8 bg-muted dark:bg-muted/50 rounded animate-pulse" />
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-muted dark:bg-muted/50 rounded animate-pulse" />
            </TableCell>
            <TableCell>
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

  // Function to refresh a specific asset's reference data
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

  // Calculate status totals
  const statusTotals = useMemo(() => {
    const totals = {
      total: assets.length,
      in_production: 0,
      revisions: 0,
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
    if (!user?.metadata?.client) {
      return;
    }

    startLoading();
    setLoading(true);

    try {
      // First, let's check what's in the database directly

      const { error: directError } = await supabase
        .from("onboarding_assets")
        .select("id, client")
        .eq("client", user.metadata.client);

      if (directError) {
        console.error("Direct database check failed:", directError);
      } else {
      }

      const { data, error } = await supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, product_link, glb_link, reference, client"
        )
        .eq("client", user.metadata.client);

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

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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
      setSelected(new Set(paged.map((asset) => asset.id)));
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
    try {
      return JSON.parse(referenceImages);
    } catch {
      return [referenceImages];
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <Card className="p-3 sm:p-6 flex-1 flex flex-col border-0 shadow-none">
        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
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

            {/* In Production */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters([
                  "in_production",
                  "revisions",
                  "delivered_by_artist",
                ]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Send className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">In Production</span>
                    <span className="sm:hidden">Production</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-600">
                    {statusTotals.in_production +
                      statusTotals.revisions +
                      statusTotals.delivered_by_artist}
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

            {/* Ready for Revision */}
            <Card
              className="p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["revisions"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    <span className="hidden sm:inline">Ready for Revision</span>
                    <span className="sm:hidden">Revision</span>
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-orange-600">
                    {statusTotals.revisions}
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

          {/* Bulk Actions Row - Fixed height to prevent layout shifts */}
          <div className="min-h-[60px]">
            {selected.size > 0 && (
              <div className="flex flex-col gap-3 sm:gap-4 p-3 bg-muted/50 dark:bg-muted/20 rounded-lg border dark:border-border">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    {selected.size} product(s) selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    className="h-6 px-2 text-xs dark:hover:bg-muted/50"
                  >
                    Clear
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                    Set priority:
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select
                      value={bulkPriority.toString()}
                      onValueChange={(value) =>
                        setBulkPriority(parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-20 sm:w-24 h-7 sm:h-8 dark:bg-background dark:border-border text-xs sm:text-sm">
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
                      className="h-7 sm:h-8 text-xs sm:text-sm flex-1 sm:flex-none"
                    >
                      <span className="hidden sm:inline">
                        Apply to {selected.size} product(s)
                      </span>
                      <span className="sm:hidden">Apply</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto rounded-lg border dark:border-border bg-background dark:bg-background flex-1 max-h-[62vh] min-h-[62vh]">
          {loading ? (
            <ReviewTableSkeleton />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block min-w-[1200px]">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-border">
                      <TableHead className="w-12 dark:text-foreground">
                        <div className="flex items-center gap-2">
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
                      <TableHead className="dark:text-foreground">
                        Model Name
                      </TableHead>
                      <TableHead className="dark:text-foreground">
                        Article ID
                      </TableHead>
                      <TableHead className="dark:text-foreground">
                        Priority
                      </TableHead>
                      <TableHead className="dark:text-foreground">
                        Status
                      </TableHead>
                      <TableHead className="dark:text-foreground">
                        Product Link
                      </TableHead>
                      <TableHead className="text-center dark:text-foreground">
                        References
                      </TableHead>
                      <TableHead className="dark:text-foreground">
                        GLB File
                      </TableHead>
                      <TableHead className="w-12 text-center dark:text-foreground">
                        View
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.length === 0 ? (
                      <TableRow className="dark:border-border">
                        <TableCell
                          colSpan={9}
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
                      paged.map((asset) => {
                        const rowStyling = getRowStyling(asset.status);
                        return (
                          <TableRow
                            key={asset.id}
                            className={`${rowStyling.base} transition-all duration-200 dark:border-border dark:hover:bg-muted/20`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selected.has(asset.id)}
                                onCheckedChange={() => toggleSelect(asset.id)}
                                className="bg-background dark:bg-background dark:border-border"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span
                                  className="font-medium dark:text-foreground truncate max-w-[200px] cursor-help"
                                  title={asset.product_name}
                                >
                                  {asset.product_name.length > 25
                                    ? asset.product_name.substring(0, 25) +
                                      "..."
                                    : asset.product_name}
                                </span>
                                <div className="flex items-center justify-center gap-2">
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
                            </TableCell>
                            <TableCell className="dark:text-foreground">
                              {asset.article_id}
                            </TableCell>
                            <TableCell>
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
                                    className={`border-0 shadow-none p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                                  >
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                        asset.priority || 2
                                      )}`}
                                    >
                                      {getPriorityLabel(asset.priority || 2)}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent className="dark:bg-background dark:border-border">
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
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center justify-center">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${getStatusLabelClass(asset.status)}`}
                                >
                                  {getStatusLabelText(asset.status)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-12">
                              {asset.product_link ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline dark:hover:bg-muted/50"
                                  onClick={() =>
                                    window.open(asset.product_link, "_blank")
                                  }
                                >
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  Open Link
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                  No link
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-3 py-1 h-7 dark:border-border dark:hover:bg-muted/50"
                                  onClick={() => {
                                    setSelectedAssetForView(asset);
                                    setShowViewRefDialog(true);
                                  }}
                                >
                                  <FileText className="mr-1 h-3 w-3" />
                                  Ref (
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
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-12">
                              {asset.glb_link ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-xs hover:text-blue-700 dark:hover:text-blue-400 hover:underline dark:hover:bg-muted/50"
                                  onClick={() =>
                                    window.open(asset.glb_link, "_blank")
                                  }
                                >
                                  <Download className="mr-2 h-3 w-3" />
                                  Download
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                  No GLB
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center w-12">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  router.push(`/client-review/${asset.id}`)
                                }
                                className="h-8 w-8 dark:hover:bg-muted/50"
                              >
                                <Eye className="h-5 w-5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
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
                  paged.map((asset) => {
                    const rowStyling = getRowStyling(asset.status);
                    return (
                      <Card
                        key={asset.id}
                        className={`p-4 transition-all duration-200 ${rowStyling.base} dark:border-border dark:hover:bg-muted/20`}
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
                                <h3
                                  className="font-medium text-sm dark:text-foreground truncate"
                                  title={asset.product_name}
                                >
                                  {asset.product_name.length > 30
                                    ? asset.product_name.substring(0, 30) +
                                      "..."
                                    : asset.product_name}
                                </h3>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                router.push(`/client-review/${asset.id}`)
                              }
                              className="h-8 w-8 dark:hover:bg-muted/50 flex-shrink-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Article ID and Priority */}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground dark:text-muted-foreground font-mono">
                              {asset.article_id}
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
                                      asset.priority || 2
                                    )}`}
                                  >
                                    {getPriorityLabel(asset.priority || 2)}
                                  </span>
                                </SelectTrigger>
                                <SelectContent className="dark:bg-background dark:border-border">
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
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex items-center justify-center">
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
                              Ref (
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2">
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
    </div>
  );
}
