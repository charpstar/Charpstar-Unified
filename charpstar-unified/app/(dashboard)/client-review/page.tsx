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

const STATUS_LABELS = {
  in_production: {
    label: "In Progress",
    color: "bg-warning-muted text-warning border-warning/20",
    rowColor: "table-row-status-in-production",
    hoverColor: "",
  },
  delivered_by_artist: {
    label: "In Progress", // Changed from "Waiting for Approval" to "In Progress" for clients
    color: "bg-warning-muted text-warning border-warning/20", // Same color as in_production
    rowColor: "table-row-status-in-production",
    hoverColor: "",
  },
  revisions: {
    label: "Sent for Revision",
    color: "bg-error-muted text-error border-error/20",
    rowColor: "table-row-status-revisions",
    hoverColor: "",
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-800 border-green-200",
    rowColor: "table-row-status-approved",
    hoverColor: "",
  },
  approved_by_client: {
    label: "Approved by Client",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    rowColor: "table-row-status-approved-by-client",
    hoverColor: "",
  },
};

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Helper function to get row styling based on status
const getRowStyling = (status: string): { base: string; hover: string } => {
  if (status in STATUS_LABELS) {
    const statusConfig = STATUS_LABELS[status as keyof typeof STATUS_LABELS];
    return {
      base: statusConfig.rowColor,
      hover: statusConfig.hoverColor,
    };
  }
  // Default styling for unknown statuses
  return {
    base: "table-row-status-unknown",
    hover: "",
  };
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
      console.log("No user or client metadata, skipping fetch");
      return;
    }

    console.log("Fetching assets for client:", user.metadata.client);
    startLoading();
    setLoading(true);

    try {
      // First, let's check what's in the database directly
      console.log("Checking database directly...");
      const { data: directCheck, error: directError } = await supabase
        .from("onboarding_assets")
        .select("id, client")
        .eq("client", user.metadata.client);

      if (directError) {
        console.error("Direct database check failed:", directError);
      } else {
        console.log(
          "Direct database check found:",
          directCheck?.length || 0,
          "assets for client"
        );
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
        console.log("Fetched assets:", data.length, "assets");
        console.log("Sample asset:", data[0]);
        setAssets(data);

        // Populate clients array for filter dropdown
        const uniqueClients = Array.from(
          new Set(data.map((asset) => asset.client).filter(Boolean))
        ).sort();
        setClients(uniqueClients);
      } else {
        console.log("No data returned from fetch");
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
    <div className="container mx-auto p-6 space-y-6">
      <Card className="p-6 flex-1 flex flex-col border-0 shadow-none ">
        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {/* Total Models (no filtering on this card itself) */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters([]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info-muted dark:bg-info-muted/20 rounded-lg">
                  <Package className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    Total Models
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {statusTotals.total}
                  </p>
                </div>
              </div>
            </Card>

            {/* In Production */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters([
                  "in_production",
                  "revisions",
                  "delivered_by_artist",
                ]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-muted dark:bg-warning-muted/20 rounded-lg">
                  <Send className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    In Production
                  </p>
                  <p className="text-2xl font-bold text-warning">
                    {statusTotals.in_production +
                      statusTotals.revisions +
                      statusTotals.delivered_by_artist}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["approved", "approved_by_client"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-muted dark:bg-success-muted/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    Approved
                  </p>
                  <p className="text-2xl font-medium text-success">
                    {statusTotals.approved + statusTotals.approved_by_client}
                  </p>
                </div>
              </div>
            </Card>

            {/* Ready for Revision */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["revisions"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-error-muted dark:bg-error-muted/20 rounded-lg">
                  <Eye className="h-5 w-5 text-error" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    Ready for Revision
                  </p>
                  <p className="text-2xl font-bold text-error">
                    {statusTotals.revisions}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved by Client */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all dark:bg-background dark:border-border"
              onClick={() => {
                setStatusFilters(["approved_by_client"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-muted dark:bg-emerald-muted/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                    Approved by Client
                  </p>
                  <p className="text-2xl font-bold text-emerald">
                    {statusTotals.approved_by_client}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
        <div className="flex flex-col gap-4 mb-4">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
            <div className="flex gap-2">
              {/* Client Filter */}

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
                <SelectTrigger className="w-32 h-9">
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
                className="w-full md:w-64"
                placeholder="Search by name or article ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={sort} onValueChange={(value) => setSort(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status-progress">
                    Sort by: Status Progression
                  </SelectItem>
                  <SelectItem value="batch">
                    Sort by: Batch (1, 2, 3...)
                  </SelectItem>

                  <SelectItem value="priority">
                    Sort by: Priority (Highest First)
                  </SelectItem>
                  <SelectItem value="priority-lowest">
                    Sort by: Priority (Lowest First)
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
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Bulk Actions Row - Fixed height to prevent layout shifts */}
          <div className="min-h-[60px]">
            {selected.size > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-muted/50 dark:bg-muted/20 rounded-lg border dark:border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
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

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground dark:text-muted-foreground">
                    Set priority:
                  </span>
                  <Select
                    value={bulkPriority.toString()}
                    onValueChange={(value) => setBulkPriority(parseInt(value))}
                  >
                    <SelectTrigger className="w-24 h-8 dark:bg-background dark:border-border">
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
                    className="h-8"
                  >
                    Apply to {selected.size} product(s)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto rounded-lg border dark:border-border bg-background dark:bg-background flex-1 max-h-[62vh] min-h-[62vh]">
          {loading ? (
            <ReviewTableSkeleton />
          ) : (
            <div className="min-w-[1200px]">
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
                        className="text-center dark:text-muted-foreground"
                      >
                        No products found.
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
                              <span className="font-medium dark:text-foreground">
                                {asset.product_name}
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
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-center">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  asset.status in STATUS_LABELS
                                    ? STATUS_LABELS[
                                        asset.status as keyof typeof STATUS_LABELS
                                      ].color
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {asset.status in STATUS_LABELS
                                  ? STATUS_LABELS[
                                      asset.status as keyof typeof STATUS_LABELS
                                    ].label
                                  : asset.status}
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
          )}
        </div>
        {/* Pagination - Always at bottom */}
        <div className="flex items-center justify-center gap-2">
          {selected.size > 0 && (
            <div className="text-sm text-muted-foreground dark:text-muted-foreground mr-4">
              {selected.size} of {paged.length} on this page selected
            </div>
          )}
          <div className="text-sm text-muted-foreground dark:text-muted-foreground">
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50"
            >
              <ChevronRight className="h-4 w-4" />
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
