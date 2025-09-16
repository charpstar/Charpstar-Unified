"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/containers";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Checkbox } from "@/components/ui/inputs";
import { Button } from "@/components/ui/display";

import {
  Users,
  Eye,
  Package,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowLeft,
  Trash2,
  X,
  FileText,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import { getPriorityLabel } from "@/lib/constants";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

// Helper function to get status-based row color class
const getStatusRowClass = (status: string): string => {
  switch (status) {
    case "in_production":
      return "table-row-status-in-production";
    case "revisions":
      return "table-row-status-revisions";
    case "approved":
      return "table-row-status-approved";
    case "approved_by_client":
      return "table-row-status-approved-by-client";
    case "delivered_by_artist":
      return "table-row-status-delivered-by-artist";
    case "not_started":
      return "table-row-status-not-started bg-gray-50 dark:bg-gray-900/30";
    default:
      return "table-row-status-unknown";
  }
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

const PAGE_SIZE = 100;

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
      return <RotateCcw className="h-4 w-4 text-orange-600" />;
    default:
      return <Eye className="h-4 w-4 text-gray-600" />;
  }
};

// Helper function to check if status filters match specific combinations

const calculateListStats = (list: any) => {
  const totalAssets = list.asset_assignments.length;
  const approvedAssets = list.asset_assignments.filter(
    (assignment: any) =>
      assignment.onboarding_assets.status === "approved" ||
      assignment.onboarding_assets.status === "approved_by_client"
  ).length;

  // Calculate total price for all assets
  const totalPrice = list.asset_assignments.reduce(
    (sum: number, assignment: any) => sum + (assignment.price || 0),
    0
  );

  // Calculate price for only completed assets (for bonus calculation)
  const completedPrice = list.asset_assignments
    .filter(
      (assignment: any) =>
        assignment.onboarding_assets.status === "approved" ||
        assignment.onboarding_assets.status === "approved_by_client"
    )
    .reduce((sum: number, assignment: any) => sum + (assignment.price || 0), 0);

  // Calculate potential bonus (what could be earned if everything is completed on time)
  let bonusAmount = 0;
  let totalEarnings = totalPrice;
  let potentialEarnings = totalPrice;

  // Calculate actual earnings (for completed work only)
  if (list.approved_at && list.deadline && completedPrice > 0) {
    const approvedDate = new Date(list.approved_at);
    const deadlineDate = new Date(list.deadline);

    // Only apply bonus if work was completed before or on the deadline
    if (approvedDate <= deadlineDate) {
      bonusAmount = completedPrice * (list.bonus / 100);
      totalEarnings = totalPrice + bonusAmount;
    }
  }

  // Calculate potential earnings (full bonus on all assets if completed on time)
  if (list.bonus > 0) {
    const potentialBonus = totalPrice * (list.bonus / 100);
    potentialEarnings = totalPrice + potentialBonus;
  }

  const completionPercentage =
    totalAssets > 0 ? Math.round((approvedAssets / totalAssets) * 100) : 0;

  return {
    totalAssets,
    approvedAssets,
    totalPrice,
    bonusAmount,
    totalEarnings,
    potentialEarnings,
    completionPercentage,
  };
};

const isOverdue = (deadline: string) => {
  return new Date(deadline) < new Date();
};

const AdminReviewTableSkeleton = () => (
  <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[79vh]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-8 bg-muted rounded animate-pulse" />
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminReviewPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [clientFilters, setClientFilters] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<number[]>([]);
  const [modelerFilters, setModelerFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState<
    Record<string, number>
  >({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<string[]>([]);
  const [modelers, setModelers] = useState<
    Array<{ id: string; email: string; title?: string }>
  >([]);
  const [assignedAssets, setAssignedAssets] = useState<
    Map<string, { id: string; email: string; name?: string }>
  >(new Map());
  const [pendingAssets, setPendingAssets] = useState<
    Map<string, { email: string; name?: string }>
  >(new Map());

  // Allocation lists state for modeler view
  const [allocationLists, setAllocationLists] = useState<any[]>([]);
  const [filteredLists, setFilteredLists] = useState<any[]>([]);
  const [showAllocationLists, setShowAllocationLists] = useState(false);
  const [showQAAssets, setShowQAAssets] = useState(false);
  const [modelerEmail, setModelerEmail] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewedUserRole, setViewedUserRole] = useState<string>("");
  const [refreshTrigger] = useState(0);
  const [updatingPriorities, setUpdatingPriorities] = useState<Set<string>>(
    new Set()
  );
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

  // Allocation list cleanup state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  // Reference management state
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  // Refresh a specific asset's reference/glb data across all relevant views
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link, status")
        .eq("id", assetId)
        .single();

      if (!error && data) {
        // Update assets table view
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  reference: data.reference,
                  glb_link: data.glb_link,
                  status: data.status || asset.status,
                }
              : asset
          )
        );

        // Update allocation lists view
        setAllocationLists((prevLists) =>
          prevLists.map((list) => ({
            ...list,
            asset_assignments: list.asset_assignments.map((assignment: any) =>
              assignment.onboarding_assets.id === assetId
                ? {
                    ...assignment,
                    onboarding_assets: {
                      ...assignment.onboarding_assets,
                      reference: data.reference,
                      glb_link: data.glb_link,
                      status:
                        data.status || assignment.onboarding_assets.status,
                    },
                  }
                : assignment
            ),
          }))
        );

        // Update QA/filtered view if present
        setFiltered((prev) =>
          prev.map((asset: any) =>
            asset.id === assetId
              ? {
                  ...asset,
                  reference: data.reference,
                  glb_link: data.glb_link,
                  status: data.status || asset.status,
                }
              : asset
          )
        );
      }
    } catch (e) {
      console.error("Error refreshing asset reference data:", e);
    }
  };

  // Calculate status totals based on unfiltered data (always show overall totals)
  const statusTotals = useMemo(() => {
    if (showAllocationLists) {
      // Aggregate asset statuses from all assets across all allocation lists (unfiltered)
      const totals = {
        total: 0, // Total assets across all lists
        in_production: 0,
        revisions: 0,
        approved: 0,
        delivered_by_artist: 0,
        not_started: 0,
      };

      allocationLists.forEach((list) => {
        list.asset_assignments.forEach((assignment: any) => {
          const assetStatus = assignment.onboarding_assets.status;
          totals.total++;
          if (totals.hasOwnProperty(assetStatus)) {
            totals[assetStatus as keyof typeof totals]++;
          }
        });
      });

      // Calculate percentages
      const percentages = {
        total: 100,
        in_production:
          totals.total > 0
            ? Math.round((totals.in_production / totals.total) * 100)
            : 0,
        revisions:
          totals.total > 0
            ? Math.round((totals.revisions / totals.total) * 100)
            : 0,
        approved:
          totals.total > 0
            ? Math.round((totals.approved / totals.total) * 100)
            : 0,
        delivered_by_artist:
          totals.total > 0
            ? Math.round((totals.delivered_by_artist / totals.total) * 100)
            : 0,
        not_started:
          totals.total > 0
            ? Math.round((totals.not_started / totals.total) * 100)
            : 0,
      };

      return { totals, percentages } as const;
    } else if (showQAAssets) {
      // For QA assets view, calculate totals from filtered QA assets
      const totals = {
        total: filtered.length,
        in_production: 0,
        revisions: 0,
        approved: 0,
        delivered_by_artist: 0,
        not_started: 0,
      };

      filtered.forEach((asset) => {
        const status = asset.status;
        if (totals.hasOwnProperty(status)) {
          totals[status as keyof typeof totals]++;
        }
      });

      // Calculate percentages
      const percentages = {
        total: 100,
        in_production:
          totals.total > 0
            ? Math.round((totals.in_production / totals.total) * 100)
            : 0,
        revisions:
          totals.total > 0
            ? Math.round((totals.revisions / totals.total) * 100)
            : 0,
        approved:
          totals.total > 0
            ? Math.round((totals.approved / totals.total) * 100)
            : 0,
        delivered_by_artist:
          totals.total > 0
            ? Math.round((totals.delivered_by_artist / totals.total) * 100)
            : 0,
        not_started:
          totals.total > 0
            ? Math.round((totals.not_started / totals.total) * 100)
            : 0,
      };

      return { totals, percentages } as const;
    } else {
      const totals = {
        total: assets.length,
        in_production: 0,
        revisions: 0,
        approved: 0,
        delivered_by_artist: 0,
        not_started: 0, // Include not_started for consistency
      };

      assets.forEach((asset) => {
        const displayStatus = asset.status;

        if (displayStatus && totals.hasOwnProperty(displayStatus)) {
          totals[displayStatus as keyof typeof totals]++;
        }
      });

      // Calculate percentages
      const percentages = {
        total: 100,
        in_production:
          assets.length > 0
            ? Math.round((totals.in_production / assets.length) * 100)
            : 0,
        revisions:
          assets.length > 0
            ? Math.round((totals.revisions / assets.length) * 100)
            : 0,
        approved:
          assets.length > 0
            ? Math.round((totals.approved / assets.length) * 100)
            : 0,
        delivered_by_artist:
          assets.length > 0
            ? Math.round((totals.delivered_by_artist / assets.length) * 100)
            : 0,
        not_started:
          assets.length > 0
            ? Math.round((totals.not_started / assets.length) * 100)
            : 0,
      };

      return { totals, percentages } as const;
    }
  }, [assets, allocationLists, showAllocationLists, showQAAssets, filtered]);

  // Handle URL parameters for client, batch, modeler, and status filters
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const batchParam = searchParams.get("batch");
    const modelerParam = searchParams.get("modeler");
    const statusParam = searchParams.get("status");
    const emailParam = searchParams.get("email");

    if (clientParam) {
      setClientFilters(
        clientParam
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      );
    }

    if (batchParam) {
      setBatchFilters(
        batchParam
          .split(",")
          .map((b) => parseInt(b.trim()))
          .filter((n) => !Number.isNaN(n))
      );
    }

    if (modelerParam) {
      setModelerFilters(
        modelerParam
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
      );
    }

    if (statusParam) {
      setStatusFilters(
        statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      );
    }

    if (emailParam) {
      setModelerEmail(emailParam);
    }

    // Fetch user role and decide what to show when both modeler and email are provided
    if (modelerParam && emailParam) {
      // Fetch the viewed user's role to determine what to show
      supabase
        .from("profiles")
        .select("role")
        .eq("id", modelerParam)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setViewedUserRole(data.role);
            if (data.role === "qa") {
              setShowQAAssets(true);
              setShowAllocationLists(false);
            } else {
              setShowAllocationLists(true);
              setShowQAAssets(false);
            }
          } else {
            // Default to modeler view if role fetch fails
            setShowAllocationLists(true);
            setShowQAAssets(false);
            setViewedUserRole("modeler");
          }
        });
    } else {
      setShowAllocationLists(false);
      setShowQAAssets(false);
      setViewedUserRole("");
    }
  }, [searchParams]);

  // Update URL when filters change (temporarily disabled to prevent page reloads)
  // TODO: Implement proper URL state management without causing page reloads
  // useEffect(() => {
  //   const params = new URLSearchParams();
  //   if (clientFilters.length > 0) params.set("client", clientFilters.join(","));
  //   if (batchFilters.length > 0) params.set("batch", batchFilters.join(","));
  //   if (modelerFilters.length > 0) params.set("modeler", modelerFilters.join(","));
  //   if (statusFilters.length > 0) params.set("status", statusFilters.join(","));
  //   const queryString = params.toString();
  //   const currentPath = window.location.pathname;
  //   const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
  //   if (window.location.href !== new URL(newUrl, window.location.origin).href) {
  //     router.replace(newUrl, { scroll: false });
  //   }
  // }, [clientFilters, batchFilters, modelerFilters, statusFilters, router]);

  // Check if user is admin
  useEffect(() => {
    if (user && user.metadata?.role !== "admin") {
      router.push("/dashboard");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [user, router]);

  // Fetch allocation lists for specific modeler
  useEffect(() => {
    async function fetchAllocationLists() {
      if (
        !user ||
        (user.metadata?.role !== "admin" &&
          user.metadata?.role !== "production") ||
        !showAllocationLists ||
        modelerFilters.length === 0
      )
        return;

      startLoading();
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("allocation_lists")
          .select(
            `
            id,
            name,
            number,
            deadline,
            bonus,
            created_at,
            status,
            asset_assignments(
              asset_id,
              price,
              status,
              onboarding_assets(
                id,
                product_name,
                article_id,
                status,
                priority,
                category,
                client,
                batch,
                reference,
                glb_link,
                product_link
              )
            )
          `
          )
          .in("user_id", modelerFilters)
          .eq("role", "modeler")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching allocation lists:", error);
          toast.error("Failed to fetch allocation lists");
          return;
        }

        setAllocationLists(data || []);
      } catch (error) {
        console.error("Error fetching allocation lists:", error);
        toast.error("Failed to fetch allocation lists");
      } finally {
        setLoading(false);
        stopLoading();
      }
    }

    if (showAllocationLists) {
      fetchAllocationLists();
    }
  }, [
    user?.metadata?.role,
    showAllocationLists,
    modelerFilters,
    refreshTrigger,
  ]);

  // Fetch all assets for admin review
  useEffect(() => {
    async function fetchAssets() {
      if (
        !user ||
        (user.metadata?.role !== "admin" &&
          user.metadata?.role !== "production") ||
        showAllocationLists
      )
        return;
      startLoading();
      setLoading(true);

      // Fetch modelers for the filter
      try {
        const { data: modelersData, error: modelersError } = await supabase
          .from("profiles")
          .select("id, email, title")
          .eq("role", "modeler")
          .order("email");

        if (!modelersError && modelersData) {
          setModelers(modelersData);
        }
      } catch (error) {
        console.error("Error fetching modelers:", error);
      }

      let query = supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, client, reference, glb_link, product_link"
        );

      // If modeler filters are applied, only fetch assets assigned to those modelers
      if (modelerFilters && modelerFilters.length > 0) {
        // First get the asset IDs assigned to this modeler (only accepted assignments)
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("asset_assignments")
          .select("asset_id")
          .in("user_id", modelerFilters)
          .eq("role", "modeler")
          .eq("status", "accepted");

        if (assignmentError) {
          console.error("Error fetching modeler assignments:", assignmentError);
          setLoading(false);
          stopLoading();
          return;
        }

        if (assignmentData && assignmentData.length > 0) {
          const assetIds = assignmentData.map(
            (assignment) => assignment.asset_id
          );
          query = query.in("id", assetIds);
        } else {
          // No assets assigned to this modeler
          setAssets([]);
          setClients([]);
          setAssignedAssets(new Map());
          setLoading(false);
          stopLoading();
          return;
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        setAssets(data);
        // Extract unique clients
        const uniqueClients = [
          ...new Set(data.map((asset) => asset.client).filter(Boolean)),
        ];
        setClients(uniqueClients);

        // Fetch assigned assets
        await fetchAssignedAssets(data.map((asset) => asset.id));
        // Fetch pending assets
        await fetchPendingAssets(data.map((asset) => asset.id));
      }
      setLoading(false);
      stopLoading();
    }
    fetchAssets();
  }, [
    user?.metadata?.role,
    modelerFilters,
    clientFilters,
    batchFilters,
    showAllocationLists,
    refreshTrigger,
  ]);

  // Fetch annotation counts for assets
  useEffect(() => {
    async function fetchAnnotationCounts() {
      if (assets.length === 0) return;

      try {
        const assetIds = assets.map((asset) => asset.id);
        const { data, error } = await supabase
          .from("asset_annotations")
          .select("asset_id")
          .in("asset_id", assetIds);

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
  }, [assets]);

  // Apply filters to allocation lists
  useEffect(() => {
    if (!showAllocationLists) return;

    let filteredListsData = [...allocationLists];

    // Apply client filter to allocation lists
    if (clientFilters.length > 0) {
      filteredListsData = filteredListsData.filter((list) => {
        // Check if any asset in the list matches the client filter
        return list.asset_assignments.some((assignment: any) =>
          clientFilters.includes(assignment.onboarding_assets?.client)
        );
      });
    }

    // Apply batch filter to allocation lists
    if (batchFilters.length > 0) {
      filteredListsData = filteredListsData.filter((list) => {
        // Check if any asset in the list matches the batch filter
        return list.asset_assignments.some((assignment: any) =>
          batchFilters.includes(assignment.onboarding_assets?.batch)
        );
      });
    }

    setFilteredLists(filteredListsData);
  }, [allocationLists, clientFilters, batchFilters, showAllocationLists]);

  // Apply filters to assets
  useEffect(() => {
    if (showAllocationLists || showQAAssets) return;

    let filteredAssets = [...assets];

    // Apply multi client filter
    if (clientFilters.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        clientFilters.includes(asset.client)
      );
    }

    // Apply multi batch filter
    if (batchFilters.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        batchFilters.includes(Number(asset.batch))
      );
    }

    // Apply multi modeler filter using assignedAssets map (by modeler id)
    if (modelerFilters.length > 0) {
      filteredAssets = filteredAssets.filter((asset) => {
        const assigned = assignedAssets.get(asset.id);
        if (!assigned) return false;
        return modelerFilters.includes(assigned.id);
      });
    }

    // Apply status filter
    if (statusFilters.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        statusFilters.includes(asset.status)
      );
    }

    // Default sort: status progression like QA Review
    const statusPriority: Record<string, number> = {
      in_production: 1,
      delivered_by_artist: 2,
      revisions: 3,
      approved: 4,
      approved_by_client: 5,
    };
    filteredAssets.sort(
      (a, b) =>
        (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
    );

    setFiltered(filteredAssets);
  }, [
    assets,
    clientFilters,
    batchFilters,
    modelerFilters,
    statusFilters,
    showAllocationLists,
    assignedAssets,
  ]);

  // Fetch and filter QA assets (when viewing a QA user)
  useEffect(() => {
    if (!showQAAssets || !modelerFilters.length) return;

    const fetchQAAssets = async () => {
      try {
        setLoading(true);
        const qaUserId = modelerFilters[0]; // The QA user ID from URL params

        // Get modelers connected to this QA user via qa_allocations
        const { data: qaAllocations, error: allocationError } = await supabase
          .from("qa_allocations")
          .select("modeler_id")
          .eq("qa_id", qaUserId);

        if (allocationError) {
          console.error("Error fetching QA allocations:", allocationError);
          setLoading(false);
          return;
        }

        if (!qaAllocations || qaAllocations.length === 0) {
          setFiltered([]);
          setLoading(false);
          return;
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
          setLoading(false);
          return;
        }

        // Create a map of modeler IDs to modeler details
        const modelerMap = new Map();
        modelerDetails?.forEach((modeler) => {
          modelerMap.set(modeler.id, modeler);
        });

        // Get assets assigned to these connected modelers
        const { data: qaAssets, error: assetsError } = await supabase
          .from("asset_assignments")
          .select(
            `
            asset_id,
            user_id,
            onboarding_assets!inner(
              id,
              product_name,
              article_id,
              client,
              batch,
              status,
              priority,
              reference,
              glb_link,
              product_link,
              created_at
            )
          `
          )
          .in("user_id", modelerIds)
          .eq("role", "modeler");

        if (assetsError) {
          console.error("Error fetching QA connected assets:", assetsError);
          setLoading(false);
          return;
        }

        // Transform the data to match the expected asset format
        const transformedAssets =
          qaAssets?.map((assignment: any) => {
            const modeler = modelerMap.get(assignment.user_id);
            const asset = assignment.onboarding_assets;
            return {
              id: asset.id,
              product_name: asset.product_name,
              article_id: asset.article_id,
              client: asset.client,
              batch: asset.batch,
              status: asset.status,
              priority: asset.priority,
              reference: asset.reference,
              created_at: asset.created_at,
              modeler_id: assignment.user_id, // Track which modeler this asset belongs to
              modeler_email: modeler?.email || "Unknown",
              modeler_title: modeler?.title || "Unknown",
            };
          }) || [];

        let filteredAssets = [...transformedAssets];

        // Apply multi client filter
        if (clientFilters.length > 0) {
          filteredAssets = filteredAssets.filter((asset) =>
            clientFilters.includes(asset.client)
          );
        }

        // Apply multi batch filter
        if (batchFilters.length > 0) {
          filteredAssets = filteredAssets.filter((asset) =>
            batchFilters.includes(Number(asset.batch))
          );
        }

        // Apply multi status filter
        if (statusFilters.length > 0) {
          filteredAssets = filteredAssets.filter((asset) =>
            statusFilters.includes(asset.status)
          );
        }

        // Sort by status priority (most critical first)
        const statusPriority: Record<string, number> = {
          delivered_by_artist: 1, // Waiting for QA review
          revisions: 2, // Sent back for revisions
          in_production: 3, // In progress
          approved: 4, // Approved by QA
          approved_by_client: 5, // Final approval
          not_started: 6, // Not started yet
        };

        filteredAssets.sort(
          (a, b) =>
            (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
        );

        setFiltered(filteredAssets);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching QA assets:", error);
        setLoading(false);
      }
    };

    fetchQAAssets();
  }, [
    showQAAssets,
    modelerFilters,
    clientFilters,
    batchFilters,
    statusFilters,
  ]);

  // Reset page when view changes
  useEffect(() => {
    setPage(1);
  }, [showAllocationLists, showQAAssets]);

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return showAllocationLists
      ? filteredLists.slice(start, start + PAGE_SIZE)
      : filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, filteredLists, page, showAllocationLists, showQAAssets]);

  // Fetch pending assets
  const fetchPendingAssets = async (assetIds: string[]) => {
    try {
      const query = supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          status
        `
        )
        .in("asset_id", assetIds)
        .eq("role", "modeler")
        .eq("status", "pending"); // Only show pending assignments

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending assets:", error);
        return;
      }

      // Get unique user IDs
      const userIds = [
        ...new Set(data?.map((assignment) => assignment.user_id) || []),
      ];

      // Fetch user profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
      }

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach((profile) => {
        profilesMap.set(profile.id, profile);
      });

      const pendingAssetsMap = new Map<
        string,
        { email: string; name?: string }
      >();
      data?.forEach((assignment) => {
        const profile = profilesMap.get(assignment.user_id);
        if (profile) {
          pendingAssetsMap.set(assignment.asset_id, {
            email: profile.email,
            name: profile.title,
          });
        }
      });

      setPendingAssets(pendingAssetsMap);
    } catch (error) {
      console.error("Error fetching pending assets:", error);
    }
  };

  // Selection
  const fetchAssignedAssets = async (assetIds: string[]) => {
    try {
      const query = supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          status
        `
        )
        .in("asset_id", assetIds)
        .eq("role", "modeler")
        .eq("status", "accepted"); // Only show accepted assignments as assigned

      // If modeler filter is applied, we already filtered at the asset level
      // so we don't need to filter again here
      if (modelerFilters.length > 0) {
        // For modeler filter, we need to check which assets are actually accepted
        const { data: acceptedAssignments, error: acceptedError } =
          await supabase
            .from("asset_assignments")
            .select("asset_id")
            .in("user_id", modelerFilters)
            .eq("role", "modeler")
            .eq("status", "accepted")
            .in("asset_id", assetIds);

        if (acceptedError) {
          console.error("Error fetching accepted assignments:", acceptedError);
          return;
        }

        const assignedAssetsMap = new Map<
          string,
          { id: string; email: string; name?: string }
        >();

        // Get the modeler's profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, title")
          .in("id", modelerFilters)
          .single();

        if (!profileError && profileData && acceptedAssignments) {
          // Only mark accepted assets as assigned to this modeler
          acceptedAssignments.forEach((assignment) => {
            assignedAssetsMap.set(assignment.asset_id, {
              id: modelerFilters[0] || "",
              email: profileData.email,
              name: profileData.title,
            });
          });
        }

        setAssignedAssets(assignedAssetsMap);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching assigned assets:", error);
        return;
      }

      // Get unique user IDs
      const userIds = [
        ...new Set(data?.map((assignment) => assignment.user_id) || []),
      ];

      // Fetch user profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
      }

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach((profile) => {
        profilesMap.set(profile.id, profile);
      });

      const assignedAssetsMap = new Map<
        string,
        { id: string; email: string; name?: string }
      >();
      data?.forEach((assignment) => {
        const profile = profilesMap.get(assignment.user_id);
        if (profile) {
          assignedAssetsMap.set(assignment.asset_id, {
            id: assignment.user_id,
            email: profile.email,
            name: profile.title,
          });
        }
      });

      setAssignedAssets(assignedAssetsMap);
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all products
  const selectAll = () => {
    const allAssetIds = paged.map((asset) => asset.id);
    setSelected(new Set(allAssetIds));
  };

  // Deselect all products
  const deselectAll = () => {
    setSelected(new Set());
  };

  // Check if all products are selected
  const isAllSelected =
    paged.length > 0 && paged.every((asset) => selected.has(asset.id));

  // Check if some products are selected
  const isSomeSelected = paged.some((asset) => selected.has(asset.id));

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const toggleListExpansion = (listId: string) => {
    setExpandedLists((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const handlePriorityUpdate = async (assetId: string, newPriority: number) => {
    // Update the priority locally immediately for instant feedback
    if (showAllocationLists) {
      setAllocationLists((prevLists) =>
        prevLists.map((list) => ({
          ...list,
          asset_assignments: list.asset_assignments.map((assignment: any) =>
            assignment.onboarding_assets.id === assetId
              ? {
                  ...assignment,
                  onboarding_assets: {
                    ...assignment.onboarding_assets,
                    priority: newPriority,
                  },
                }
              : assignment
          ),
        }))
      );
    } else {
      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === assetId ? { ...asset, priority: newPriority } : asset
        )
      );
    }

    // Add to loading state
    setUpdatingPriorities((prev) => new Set(prev).add(assetId));

    try {
      const response = await fetch("/api/assets/update-priority", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          priority: newPriority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update priority");
      }

      toast.success("Priority updated successfully");
    } catch (error) {
      console.error("Error updating priority:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update priority"
      );

      // Revert the local change on error
      if (showAllocationLists) {
        setAllocationLists((prevLists) =>
          prevLists.map((list) => ({
            ...list,
            asset_assignments: list.asset_assignments.map((assignment: any) =>
              assignment.onboarding_assets.id === assetId
                ? {
                    ...assignment,
                    onboarding_assets: {
                      ...assignment.onboarding_assets,
                      priority: assignment.onboarding_assets.priority || 2,
                    },
                  }
                : assignment
            ),
          }))
        );
      } else {
        setAssets((prevAssets) =>
          prevAssets.map((asset) =>
            asset.id === assetId
              ? { ...asset, priority: asset.priority || 2 }
              : asset
          )
        );
      }
    } finally {
      // Remove from loading state
      setUpdatingPriorities((prev) => {
        const newSet = new Set(prev);
        newSet.delete(assetId);
        return newSet;
      });
    }
  };

  const deleteAsset = async (assetId: string) => {
    setDeletingAsset(assetId);

    try {
      // Get allocation list IDs that are linked to this asset
      const { data: assignments, error: assignmentsQueryError } = await supabase
        .from("asset_assignments")
        .select("allocation_list_id")
        .eq("asset_id", assetId)
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
        .eq("asset_id", assetId);

      if (assignmentsError) {
        console.error("Error deleting asset assignments:", assignmentsError);
        throw assignmentsError;
      }

      // 2. Delete asset comments
      const { error: commentsError } = await supabase
        .from("asset_comments")
        .delete()
        .eq("asset_id", assetId);

      if (commentsError) {
        console.error("Error deleting asset comments:", commentsError);
        throw commentsError;
      }

      // 3. Delete revision history
      const { error: revisionError } = await supabase
        .from("revision_history")
        .delete()
        .eq("asset_id", assetId);

      if (revisionError) {
        console.error("Error deleting revision history:", revisionError);
        throw revisionError;
      }

      // 4. Delete QA approvals
      const { error: approvalsError } = await supabase
        .from("qa_approvals")
        .delete()
        .eq("asset_id", assetId);

      if (approvalsError) {
        console.error("Error deleting QA approvals:", approvalsError);
        throw approvalsError;
      }

      // 5. Check each allocation list and delete only if it becomes empty
      if (allocationListIds.length > 0) {
        for (const listId of allocationListIds) {
          // Check how many assets are left in this allocation list
          const { data: remainingAssets, error: countError } = await supabase
            .from("asset_assignments")
            .select("asset_id")
            .eq("allocation_list_id", listId);

          if (countError) {
            console.error(
              "Error checking remaining assets in list:",
              countError
            );
            throw countError;
          }

          // If no assets remain in this list, delete the allocation list
          if (!remainingAssets || remainingAssets.length === 0) {
            const { error: allocationListError } = await supabase
              .from("allocation_lists")
              .delete()
              .eq("id", listId);

            if (allocationListError) {
              console.error(
                "Error deleting empty allocation list:",
                allocationListError
              );
              throw allocationListError;
            }
          } else {
          }
        }
      }

      // 6. Finally, delete the asset itself
      const { error: assetDeleteError } = await supabase
        .from("onboarding_assets")
        .delete()
        .eq("id", assetId);

      if (assetDeleteError) {
        console.error("Error deleting asset:", assetDeleteError);
        throw assetDeleteError;
      }

      // Remove from local state
      setAssets((prevAssets) =>
        prevAssets.filter((asset) => asset.id !== assetId)
      );
      setSelected((prev) => {
        const newSet = new Set(prev);
        newSet.delete(assetId);
        return newSet;
      });

      // Also update allocation lists state to remove the deleted asset
      setAllocationLists((prevLists) =>
        prevLists.map((list) => ({
          ...list,
          asset_assignments: list.asset_assignments.filter(
            (assignment: any) => assignment.onboarding_assets.id !== assetId
          ),
        }))
      );

      // Update filtered lists as well
      setFilteredLists((prevLists) =>
        prevLists.map((list) => ({
          ...list,
          asset_assignments: list.asset_assignments.filter(
            (assignment: any) => assignment.onboarding_assets.id !== assetId
          ),
        }))
      );

      // Remove allocation lists that become empty after asset deletion
      setAllocationLists((prevLists) =>
        prevLists.filter((list) => {
          const updatedAssignments = list.asset_assignments.filter(
            (assignment: any) => assignment.onboarding_assets.id !== assetId
          );
          return updatedAssignments.length > 0;
        })
      );

      setFilteredLists((prevLists) =>
        prevLists.filter((list) => {
          const updatedAssignments = list.asset_assignments.filter(
            (assignment: any) => assignment.onboarding_assets.id !== assetId
          );
          return updatedAssignments.length > 0;
        })
      );

      toast.success("Asset deleted successfully");
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete asset");
    } finally {
      setDeletingAsset(null);
    }
  };

  // Clean up empty allocation lists
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cleanupEmptyAllocationLists = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch("/api/admin/cleanup-allocation-lists", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to cleanup allocation lists"
        );
      }

      const result = await response.json();
      setCleanupResult(result);
      setShowCleanupDialog(true);

      // Refresh the data
      if (showAllocationLists) {
        // Trigger a refresh by updating the refresh trigger
        window.location.reload();
      }

      toast.success(result.message);
    } catch (error) {
      console.error("Error cleaning up allocation lists:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cleanup allocation lists"
      );
    } finally {
      setCleanupLoading(false);
    }
  };

  // Check for orphaned allocation lists

  if (
    user &&
    user.metadata?.role !== "admin" &&
    user.metadata?.role !== "production"
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Access denied. Admin or Production privileges required.
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
        </div>
      </div>
    );
  }

  // Reference management functions are handled by reusable dialogs below

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  return (
    <div className="container mx-auto p-2 sm:p-6 space-y-2 sm:space-y-6">
      <Card className="p-2 sm:p-6 flex-1 flex flex-col border-0 shadow-none bg-background">
        {/* Page Title and Cleanup Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-6">
          {/* Cleanup Controls */}
        </div>

        {/* Status Summary Cards */}
        {!loading && !showAllocationLists && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-2 sm:mb-6">
            {/* Total Models (no filtering on this card itself) */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters([]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="p-1 sm:p-2 bg-info-muted rounded-lg">
                  <Package className="h-3 w-3 sm:h-5 sm:w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Models
                  </p>
                  <p className="text-sm sm:text-2xl font-bold text-info">
                    {statusTotals.totals.total}
                  </p>
                </div>
              </div>
            </Card>

            {/* In Production */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters([
                  "in_production",
                  "delivered_by_artist",
                  "not_started",
                ]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "rgb(219 234 254)" }}
                >
                  <Package
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "rgb(30 64 175)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    In Production
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "rgb(30 64 175)" }}
                  >
                    {statusTotals.totals.in_production +
                      statusTotals.totals.delivered_by_artist +
                      statusTotals.totals.not_started}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["approved"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "var(--success-muted)" }}
                >
                  <CheckCircle
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "var(--success)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Approved
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "var(--success)" }}
                  >
                    {statusTotals.totals.approved}
                  </p>
                </div>
              </div>
            </Card>

            {/* Sent for Revision */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["revisions"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "rgb(254 215 170)" }}
                >
                  <Eye
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "rgb(194 65 12)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Sent for Revision
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "rgb(194 65 12)" }}
                  >
                    {statusTotals.totals.revisions}
                  </p>
                </div>
              </div>
            </Card>

            {/* Delivered by Artist */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["delivered_by_artist"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "rgb(220 252 231)" }}
                >
                  <Eye
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "rgb(22 101 52)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Delivered by Artist
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "rgb(22 101 52)" }}
                  >
                    {statusTotals.totals.delivered_by_artist}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Inline Filter Controls */}
        {!loading && !showAllocationLists && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            {/* Status Filter */}
            <Select
              value={
                statusFilters.length === 1
                  ? statusFilters[0] === "delivered_by_artist"
                    ? "waiting_for_approval"
                    : statusFilters[0]
                  : undefined
              }
              onValueChange={(value) => {
                if (value === "all") {
                  setStatusFilters([]);
                } else if (value === "waiting_for_approval") {
                  // Map virtual status to actual asset status
                  setStatusFilters(["delivered_by_artist"]);
                } else if (value) {
                  setStatusFilters([value]);
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40 h-8 sm:h-9 text-sm">
                <SelectValue
                  placeholder={
                    statusFilters.length === 0
                      ? "All statuses"
                      : statusFilters.length === 1
                        ? statusFilters[0] === "delivered_by_artist"
                          ? "Delivered by Artist"
                          : getStatusLabelText(statusFilters[0])
                        : `${statusFilters.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "in_production",
                  "revisions",
                  "approved",
                  "approved_by_client",
                  "delivered_by_artist",
                  "not_started",
                  "in_progress",
                  "waiting_for_approval",
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {getStatusLabelText(status)}
                    </div>
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

            {/* Modeler Filter */}
            <Select
              value={
                modelerFilters.length === 1 ? modelerFilters[0] : undefined
              }
              onValueChange={(value) => {
                if (value === "all") {
                  setModelerFilters([]);
                } else if (value) {
                  setModelerFilters([value]);
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                <SelectValue
                  placeholder={
                    modelerFilters.length === 0
                      ? "All modelers"
                      : modelerFilters.length === 1
                        ? modelers.find((m) => m.id === modelerFilters[0])
                            ?.title ||
                          modelers.find((m) => m.id === modelerFilters[0])
                            ?.email
                        : `${modelerFilters.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modelers</SelectItem>
                {modelers.map((modeler) => (
                  <SelectItem key={modeler.id} value={modeler.id}>
                    {modeler.title || modeler.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {(clientFilters.length > 0 ||
              batchFilters.length > 0 ||
              modelerFilters.length > 0 ||
              statusFilters.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setClientFilters([]);
                  setBatchFilters([]);
                  setModelerFilters([]);
                  setStatusFilters([]);
                  setPage(1);
                }}
                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm w-full sm:w-auto"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}

            {selected.size > 0 && (
              <div className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Navigate to the allocate page with selected assets
                    const selectedAssetIds = Array.from(selected);

                    // Create URL with selected asset IDs as query parameters
                    const params = new URLSearchParams();
                    selectedAssetIds.forEach((id) =>
                      params.append("selectedAssets", id)
                    );

                    // Navigate to allocate page with selected assets
                    router.push(`/production/allocate?${params.toString()}`);
                  }}
                  className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">
                    Assign ({selected.size})
                  </span>
                  <span className="sm:hidden">Assign {selected.size}</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <AdminReviewTableSkeleton />
        ) : showAllocationLists ? (
          // Allocation Lists View
          <div className="space-y-4">
            {paged.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Allocation Lists
                </h3>
                <p className="text-muted-foreground">
                  No allocation lists found for this modeler.
                </p>
              </Card>
            ) : (
              paged.map((list) => {
                const stats = calculateListStats(list);
                const isExpanded = expandedLists.has(list.id);
                return (
                  <Card
                    key={list.id}
                    className="cursor-pointer transition-all duration-300 ease-in-out hover:shadow-md"
                    onClick={() => toggleListExpansion(list.id)}
                  >
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(list.status)}
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusLabelClass(list.status)}`}
                            >
                              {list.status === "in_progress"
                                ? "In Progress"
                                : list.status === "pending"
                                  ? "Pending"
                                  : list.status}
                            </Badge>
                          </div>
                          <h3 className="text-sm sm:text-md font-medium text-foreground">
                            <span className="hidden sm:inline">
                              Allocation {list.number} -{" "}
                            </span>
                            <span className="sm:hidden">#{list.number} - </span>
                            {new Date(
                              list.deadline
                            ).toLocaleDateString()} - {stats.totalAssets} assets
                          </h3>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200" />
                            ) : (
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200" />
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{modelerEmail}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={
                                isOverdue(list.deadline)
                                  ? "text-error font-medium"
                                  : ""
                              }
                            >
                              {new Date(list.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Summary stats always visible */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4">
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                            Assets
                          </p>
                          <p className="text-lg sm:text-2xl font-medium">
                            {stats.approvedAssets}/{stats.totalAssets}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                            Progress
                          </p>
                          <p className="text-lg sm:text-2xl font-medium text-info">
                            {stats.completionPercentage}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                            Base Price
                          </p>
                          <p className="text-lg sm:text-2xl font-medium  text-success">
                            €{stats.totalPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Down arrow indicator for collapsed state */}
                    {!isExpanded && (
                      <div className="flex justify-center">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                          <span>Click to expand</span>
                          <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                        </div>
                      </div>
                    )}

                    {/* Collapsible content with smooth transition */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? "max-h-[2000px] opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <CardContent className="p-4 sm:p-6">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs sm:text-sm">
                                  Product Name
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm">
                                  Article ID
                                </TableHead>
                                <TableHead className="w-24 text-center text-xs sm:text-sm">
                                  Priority
                                </TableHead>
                                <TableHead className="w-24 text-xs sm:text-sm">
                                  Price
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm">
                                  Status
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm">
                                  References
                                </TableHead>
                                <TableHead className="w-40 text-xs sm:text-sm">
                                  Product Link
                                </TableHead>
                                <TableHead className="w-12 text-xs sm:text-sm">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.asset_assignments.map((assignment: any) => (
                                <TableRow
                                  key={assignment.asset_id}
                                  className={getStatusRowClass(
                                    assignment.onboarding_assets.status
                                  )}
                                >
                                  <TableCell className="text-center">
                                    <div
                                      className="font-medium truncate cursor-help text-sm sm:text-base"
                                      title={
                                        assignment.onboarding_assets
                                          .product_name
                                      }
                                    >
                                      {assignment.onboarding_assets.product_name
                                        .length > 20
                                        ? assignment.onboarding_assets.product_name.substring(
                                            0,
                                            20
                                          ) + "..."
                                        : assignment.onboarding_assets
                                            .product_name}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-mono text-xs sm:text-sm">
                                      {assignment.onboarding_assets.article_id}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={(
                                        assignment.onboarding_assets.priority ||
                                        2
                                      ).toString()}
                                      onValueChange={(value) =>
                                        handlePriorityUpdate(
                                          assignment.onboarding_assets.id,
                                          parseInt(value)
                                        )
                                      }
                                      disabled={updatingPriorities.has(
                                        assignment.onboarding_assets.id
                                      )}
                                    >
                                      <SelectTrigger className="border-0 bg-transparent shadow-none p-0 hover:bg-transparent [&>svg]:hidden justify-center w-full h-fit">
                                        <span
                                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${getPriorityClass(
                                            assignment.onboarding_assets
                                              .priority || 2
                                          )}`}
                                        >
                                          {getPriorityLabel(
                                            assignment.onboarding_assets
                                              .priority || 2
                                          )}
                                        </span>
                                        {updatingPriorities.has(
                                          assignment.onboarding_assets.id
                                        ) ? (
                                          <div className="ml-1 sm:ml-2 animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-blue-600" />
                                        ) : null}
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">High</SelectItem>
                                        <SelectItem value="2">
                                          Medium
                                        </SelectItem>
                                        <SelectItem value="3">Low</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-sm sm:text-base">
                                        €{assignment.price.toFixed(2)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getStatusLabelClass(assignment.onboarding_assets.status)}`}
                                    >
                                      {assignment.onboarding_assets.status ===
                                      "delivered_by_artist"
                                        ? "Delivered by Artist"
                                        : assignment.onboarding_assets
                                              .status === "in_production"
                                          ? "In Progress"
                                          : assignment.onboarding_assets
                                                .status === "revisions"
                                            ? "Sent for Revision"
                                            : assignment.onboarding_assets
                                                .status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs px-2 sm:px-3 py-1 h-6 sm:h-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssetForView(
                                            assignment.onboarding_assets
                                          );
                                          setShowViewDialog(true);
                                        }}
                                      >
                                        <FileText className="mr-1 h-3 w-3" />
                                        <span className="hidden sm:inline">
                                          Ref (
                                        </span>
                                        <span className="sm:hidden">(</span>
                                        {(() => {
                                          const allRefs = parseReferences(
                                            assignment.onboarding_assets
                                              .reference
                                          );
                                          return (
                                            allRefs.length +
                                            (assignment.onboarding_assets
                                              .glb_link
                                              ? 1
                                              : 0)
                                          );
                                        })()}
                                        )
                                      </Button>
                                    </div>
                                  </TableCell>

                                  <TableCell>
                                    {assignment.onboarding_assets
                                      .product_link ? (
                                      <a
                                        href={
                                          assignment.onboarding_assets
                                            .product_link
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline break-all text-xs sm:text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="hidden sm:inline">
                                          Product Link
                                        </span>
                                        <span className="sm:hidden">Link</span>
                                      </a>
                                    ) : (
                                      <span className="text-xs sm:text-sm text-muted-foreground">
                                        —
                                      </span>
                                    )}
                                  </TableCell>

                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Preserve current filter parameters when navigating to asset detail
                                          const params = new URLSearchParams();
                                          params.set("from", "admin-review");
                                          if (clientFilters.length > 0) {
                                            params.set(
                                              "client",
                                              clientFilters.join(",")
                                            );
                                          }
                                          if (batchFilters.length > 0) {
                                            params.set(
                                              "batch",
                                              batchFilters.join(",")
                                            );
                                          }
                                          if (modelerFilters.length > 0) {
                                            params.set(
                                              "modeler",
                                              modelerFilters.join(",")
                                            );
                                          }
                                          if (modelerEmail) {
                                            params.set("email", modelerEmail);
                                          }
                                          router.push(
                                            `/client-review/${assignment.onboarding_assets.id}?${params.toString()}`
                                          );
                                        }}
                                      >
                                        <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                                      </Button>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="cursor-pointer text-error hover:text-error hover:bg-error/10 h-8 w-8 sm:h-10 sm:w-10"
                                            onClick={(e) => e.stopPropagation()}
                                            disabled={
                                              deletingAsset ===
                                              assignment.onboarding_assets.id
                                            }
                                          >
                                            {deletingAsset ===
                                            assignment.onboarding_assets.id ? (
                                              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-error" />
                                            ) : (
                                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            )}
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="w-[95vw] sm:w-full max-w-md h-fit overflow-y-auto">
                                          <DialogHeader className="pb-3 sm:pb-4">
                                            <DialogTitle className="text-base sm:text-lg">
                                              Delete Asset
                                            </DialogTitle>
                                            <DialogDescription className="text-xs sm:text-sm">
                                              Are you sure you want to delete
                                              this asset? This action cannot be
                                              undone and will permanently
                                              delete:
                                              <ul className="list-disc list-inside mt-2 space-y-1">
                                                <li>The asset itself</li>
                                                <li>
                                                  All assignments and comments
                                                </li>
                                                <li>All revision history</li>
                                                <li>All QA approvals</li>
                                                <li>
                                                  Any empty allocation lists
                                                  (only if this was the last
                                                  asset in the list)
                                                </li>
                                              </ul>
                                            </DialogDescription>
                                          </DialogHeader>
                                          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            <Button
                                              variant="destructive"
                                              className="w-full sm:w-auto text-sm sm:text-base"
                                              onClick={() =>
                                                deleteAsset(
                                                  assignment.onboarding_assets
                                                    .id
                                                )
                                              }
                                              disabled={
                                                deletingAsset ===
                                                assignment.onboarding_assets.id
                                              }
                                            >
                                              {deletingAsset ===
                                              assignment.onboarding_assets
                                                .id ? (
                                                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2" />
                                              ) : null}
                                              Delete Asset
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        ) : showQAAssets ? (
          // QA Assets View (showing assets reviewed by this QA user)
          <div className="overflow-x-auto rounded-lg border bg-background flex-1 max-h-[67vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">
                    Model Name
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Article ID
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Modeler</TableHead>
                  <TableHead className="text-xs sm:text-sm">Client</TableHead>
                  <TableHead className="text-xs sm:text-sm">Batch</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    References
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Product Link
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No assets found for this QA reviewer.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className={getStatusRowClass(asset.status)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-medium truncate cursor-help text-sm sm:text-base"
                            title={asset.product_name}
                          >
                            {asset.product_name.length > 20
                              ? asset.product_name.substring(0, 20) + "..."
                              : asset.product_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-mono">
                        {asset.article_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            {asset.modeler_email?.split("@")[0] || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {asset.client}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          B{asset.batch}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={(asset.priority || 2).toString()}
                          onValueChange={(value) =>
                            handlePriorityUpdate(asset.id, parseInt(value))
                          }
                          disabled={updatingPriorities.has(asset.id)}
                        >
                          <SelectTrigger className="border-none shadow-none p-0 hover:bg-transparent [&>svg]:hidden justify-center w-full h-fit cursor-pointer">
                            <span
                              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${getPriorityClass(
                                asset.priority || 2
                              )}`}
                            >
                              {getPriorityLabel(asset.priority || 2)}
                            </span>
                            {updatingPriorities.has(asset.id) ? (
                              <div className="ml-1 sm:ml-2 animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-blue-600 cursor-pointer" />
                            ) : null}
                          </SelectTrigger>
                          <SelectContent className="cursor-pointer">
                            <SelectItem className="cursor-pointer" value="1">
                              High
                            </SelectItem>
                            <SelectItem className="cursor-pointer" value="2">
                              Medium
                            </SelectItem>
                            <SelectItem className="cursor-pointer" value="3">
                              Low
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2 justify-center">
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${getStatusLabelClass(asset.status)}`}
                          >
                            {getStatusLabelText(asset.status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-2 sm:px-3 py-1 h-6 sm:h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssetForView(asset);
                              setShowViewDialog(true);
                            }}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            <span className="hidden sm:inline">Ref (</span>
                            <span className="sm:hidden">(</span>
                            {(() => {
                              const allRefs = parseReferences(asset.reference);
                              return allRefs.length + (asset.glb_link ? 1 : 0);
                            })()}
                            <span className="hidden sm:inline">)</span>
                            <span className="sm:hidden">)</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.product_link ? (
                          <a
                            href={asset.product_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline break-all text-xs"
                          >
                            <span className="hidden sm:inline">
                              Product Link
                            </span>
                            <span className="sm:hidden">Link</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10"
                          onClick={() => {
                            // Navigate to asset detail for QA assets
                            const params = new URLSearchParams();
                            params.set("from", "admin-review");
                            if (clientFilters.length > 0) {
                              params.set("client", clientFilters.join(","));
                            }
                            if (batchFilters.length > 0) {
                              params.set("batch", batchFilters.join(","));
                            }
                            if (modelerFilters.length > 0) {
                              params.set("modeler", modelerFilters.join(","));
                            }
                            if (modelerEmail) {
                              params.set("email", modelerEmail);
                            }
                            router.push(
                              `/client-review/${asset.id}?${params.toString()}`
                            );
                          }}
                        >
                          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Regular Assets View
          <div className="overflow-x-auto rounded-lg border bg-background flex-1 max-h-[67vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 sm:w-12">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          isAllSelected
                            ? true
                            : isSomeSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={handleSelectAll}
                        className="h-4 w-4"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Model Name
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Article ID
                  </TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    References
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Product Link
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {statusFilters.length > 0 ||
                      clientFilters.length > 0 ||
                      batchFilters.length > 0 ||
                      modelerFilters.length > 0 ||
                      search ? (
                        <div className="space-y-2">
                          <div className="text-lg font-medium">
                            No matching assets found
                          </div>
                          <div className="text-sm">
                            {statusFilters.length > 0 && (
                              <div>
                                No assets with status:{" "}
                                {statusFilters.join(", ")}
                              </div>
                            )}
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
                            {modelerFilters.length > 0 && (
                              <div>
                                No assets assigned to modeler:{" "}
                                {modelerFilters.join(", ")}
                              </div>
                            )}
                            {search && (
                              <div>
                                No assets matching: &quot;{search}&quot;
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-3">
                            Try adjusting your filters or check back later for
                            new assets.
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
                  paged.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className={getStatusRowClass(asset.status)}
                    >
                      <TableCell className="text-center">
                        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                          <Checkbox
                            checked={selected.has(asset.id)}
                            onCheckedChange={() => toggleSelect(asset.id)}
                            className="h-4 w-4"
                          />
                          {assignedAssets.has(asset.id) && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {assignedAssets.get(asset.id)?.name ||
                                  assignedAssets
                                    .get(asset.id)
                                    ?.email?.split("@")[0]}
                              </span>
                            </div>
                          )}
                          {pendingAssets.has(asset.id) && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-500 rounded-full" />
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {pendingAssets.get(asset.id)?.name ||
                                  pendingAssets
                                    .get(asset.id)
                                    ?.email?.split("@")[0]}
                                {" (pending)"}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-medium truncate cursor-help text-sm sm:text-base"
                            title={asset.product_name}
                          >
                            {asset.product_name.length > 20
                              ? asset.product_name.substring(0, 20) + "..."
                              : asset.product_name}
                          </span>
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                            <span className="text-xs text-muted-foreground">
                              {annotationCounts[asset.id] || 0} ann.
                            </span>
                            <span className="text-xs text-slate-500 hidden sm:inline">
                              •
                            </span>
                            <Badge variant="outline" className="text-xs">
                              B{asset.batch || 1}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-mono">
                        {asset.article_id}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={(asset.priority || 2).toString()}
                          onValueChange={(value) =>
                            handlePriorityUpdate(asset.id, parseInt(value))
                          }
                          disabled={updatingPriorities.has(asset.id)}
                        >
                          <SelectTrigger className="border-none shadow-none p-0 hover:bg-transparent [&>svg]:hidden justify-center w-full h-fit cursor-pointer">
                            <span
                              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${getPriorityClass(
                                asset.priority || 2
                              )}`}
                            >
                              {getPriorityLabel(asset.priority || 2)}
                            </span>
                            {updatingPriorities.has(asset.id) ? (
                              <div className="ml-1 sm:ml-2 animate-spin rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 border-b-2 border-blue-600 cursor-pointer" />
                            ) : null}
                          </SelectTrigger>
                          <SelectContent className="cursor-pointer">
                            <SelectItem className="cursor-pointer" value="1">
                              High
                            </SelectItem>
                            <SelectItem className="cursor-pointer" value="2">
                              Medium
                            </SelectItem>
                            <SelectItem className="cursor-pointer" value="3">
                              Low
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 sm:gap-2 justify-center">
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${getStatusLabelClass(asset.status)}`}
                          >
                            {getStatusLabelText(asset.status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-2 sm:px-3 py-1 h-6 sm:h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssetForView(asset);
                              setShowViewDialog(true);
                            }}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            <span className="hidden sm:inline">Ref (</span>
                            <span className="sm:hidden">(</span>
                            {(() => {
                              const allRefs = parseReferences(asset.reference);
                              return allRefs.length + (asset.glb_link ? 1 : 0);
                            })()}
                            <span className="hidden sm:inline">)</span>
                            <span className="sm:hidden">)</span>
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell>
                        {asset.product_link ? (
                          <a
                            href={asset.product_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline break-all text-xs sm:text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="hidden sm:inline">
                              Product Link
                            </span>
                            <span className="sm:hidden">Link</span>
                          </a>
                        ) : (
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10"
                            onClick={() => {
                              // Preserve current filter parameters when navigating to asset detail
                              const params = new URLSearchParams();
                              params.set("from", "admin-review");
                              if (clientFilters.length > 0) {
                                params.set("client", clientFilters.join(","));
                              }
                              if (batchFilters.length > 0) {
                                params.set("batch", batchFilters.join(","));
                              }
                              if (modelerFilters.length > 0) {
                                params.set("modeler", modelerFilters.join(","));
                              }
                              if (modelerEmail) {
                                params.set("email", modelerEmail);
                              }
                              router.push(
                                `/client-review/${asset.id}?${params.toString()}`
                              );
                            }}
                          >
                            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="cursor-pointer text-error hover:text-error hover:bg-error/10 h-8 w-8 sm:h-10 sm:w-10"
                                disabled={deletingAsset === asset.id}
                              >
                                {deletingAsset === asset.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-error" />
                                ) : (
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                )}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] sm:w-full max-w-md h-fit overflow-y-auto">
                              <DialogHeader className="pb-3 sm:pb-4">
                                <DialogTitle className="text-base sm:text-lg">
                                  Delete Asset
                                </DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm">
                                  Are you sure you want to delete this asset?
                                  This action cannot be undone and will
                                  permanently delete:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>The asset itself</li>
                                    <li>All assignments and comments</li>
                                    <li>All revision history</li>
                                    <li>All QA approvals</li>
                                    <li>
                                      Any empty allocation lists (only if this
                                      was the last asset in the list)
                                    </li>
                                  </ul>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <Button
                                  variant="destructive"
                                  onClick={() => deleteAsset(asset.id)}
                                  disabled={deletingAsset === asset.id}
                                  className="w-full sm:w-auto text-sm"
                                >
                                  {deletingAsset === asset.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2" />
                                  ) : null}
                                  Delete Asset
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Pagination - Always at bottom */}
      </Card>

      {/* Cleanup Results Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl h-fit overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg">
              Allocation List Cleanup Results
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {cleanupResult?.message || "Cleanup operation completed"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {cleanupResult && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-info-muted rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Total Processed
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-info">
                      {cleanupResult.totalProcessed || 0}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-success-muted rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Deleted
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-success">
                      {cleanupResult.deletedCount || 0}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-warning-muted rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Remaining
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-warning">
                      {cleanupResult.remainingCount || 0}
                    </p>
                  </div>
                  {cleanupResult.orphanedCount !== undefined && (
                    <div className="p-3 sm:p-4 bg-error-muted rounded-lg">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                        Orphaned
                      </p>
                      <p className="text-lg sm:text-2xl font-bold text-error">
                        {cleanupResult.orphanedCount}
                      </p>
                    </div>
                  )}
                </div>

                {cleanupResult.deletedLists &&
                  cleanupResult.deletedLists.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Deleted Lists
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {cleanupResult.deletedLists.map((list: any) => (
                          <div
                            key={list.id}
                            className="p-3 bg-muted rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{list.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {list.reason}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {list.id}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {cleanupResult.orphanedLists &&
                  cleanupResult.orphanedLists.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Orphaned Lists
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {cleanupResult.orphanedLists.map((list: any) => (
                          <div
                            key={list.id}
                            className="p-3 bg-muted rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{list.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Created:{" "}
                                  {new Date(
                                    list.created_at
                                  ).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  User: {list.user_id} | Role: {list.role}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {list.assetCount} assets
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {cleanupResult.errors && cleanupResult.errors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-error">
                      Errors
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {cleanupResult.errors.map((error: any) => (
                        <div
                          key={error.id}
                          className="p-3 bg-error-muted rounded-lg"
                        >
                          <p className="font-medium text-error">{error.id}</p>
                          <p className="text-sm text-error">{error.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              className="w-full sm:w-auto text-sm sm:text-base"
              onClick={() => setShowCleanupDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        open={showViewDialog}
        onOpenChange={(open) => {
          setShowViewDialog(open);
          if (!open && selectedAssetForView?.id) {
            refreshAssetReferenceData(selectedAssetForView.id);
          }
        }}
        asset={selectedAssetForView}
        onAddReference={() => {
          setSelectedAssetForRef(selectedAssetForView?.id);
          setShowViewDialog(false);
          setShowAddRefDialog(true);
        }}
      />
    </div>
  );
}
