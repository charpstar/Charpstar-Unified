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
import { Button } from "@/components/ui/display";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Eye,
  Package,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  ArrowLeft,
  Trash2,
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
      return "table-row-status-not-started";
    default:
      return "table-row-status-unknown";
  }
};

const STATUS_LABELS = {
  in_production: {
    label: "In Production",
    color: "bg-warning-muted text-warning border-warning/20",
  },
  revisions: {
    label: "Sent for Revision",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  approved: {
    label: "Approved",
    color: "bg-success-muted text-success border-success/20",
  },
  approved_by_client: {
    label: "Approved by Client",
    color: "bg-emerald-muted text-emerald border-emerald/20",
  },
  delivered_by_artist: {
    label: "Waiting for Approval",
    color: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  },
  not_started: {
    label: "Not Started",
    color: "bg-error-muted text-error border-error/20",
  },
};

const PAGE_SIZE = 18;

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "delivered_by_artist":
      return <Clock className="h-4 w-4 text-accent-purple" />;
    case "in_production":
      return <Clock className="h-4 w-4 text-warning" />;
    case "not_started":
      return <AlertCircle className="h-4 w-4 text-error" />;
    case "revisions":
      return <RotateCcw className="h-4 w-4 text-info" />;
    default:
      return <Eye className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved":
      return "bg-success-muted text-success border-success/20";
    case "delivered_by_artist":
      return "bg-accent-purple/10 text-accent-purple border-accent-purple/20";
    case "in_production":
      return "bg-warning-muted text-warning border-warning/20";
    case "not_started":
      return "bg-error-muted text-error border-error/20";
    case "revisions":
      return "bg-blue-50 text-blue-600 border-blue-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const calculateListStats = (list: any) => {
  const totalAssets = list.asset_assignments.length;
  const approvedAssets = list.asset_assignments.filter(
    (assignment: any) => assignment.onboarding_assets.status === "approved"
  ).length;
  const totalPrice = list.asset_assignments.reduce(
    (sum: number, assignment: any) => sum + (assignment.price || 0),
    0
  );

  // Calculate bonus only if work was completed before deadline
  let bonusAmount = 0;
  let totalEarnings = totalPrice;

  if (list.approved_at && list.deadline) {
    const approvedDate = new Date(list.approved_at);
    const deadlineDate = new Date(list.deadline);

    // Only apply bonus if work was completed before or on the deadline
    if (approvedDate <= deadlineDate) {
      bonusAmount = totalPrice * (list.bonus / 100);
      totalEarnings = totalPrice + bonusAmount;
    }
  }

  const completionPercentage =
    totalAssets > 0 ? Math.round((approvedAssets / totalAssets) * 100) : 0;

  return {
    totalAssets,
    approvedAssets,
    totalPrice,
    bonusAmount,
    totalEarnings,
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
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [modelerFilter, setModelerFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState<
    Record<string, number>
  >({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<string[]>([]);
  const [assignedAssets, setAssignedAssets] = useState<
    Map<string, { email: string; name?: string }>
  >(new Map());
  const [pendingAssets, setPendingAssets] = useState<
    Map<string, { email: string; name?: string }>
  >(new Map());

  // Allocation lists state for modeler view
  const [allocationLists, setAllocationLists] = useState<any[]>([]);
  const [filteredLists, setFilteredLists] = useState<any[]>([]);
  const [showAllocationLists, setShowAllocationLists] = useState(false);
  const [modelerEmail, setModelerEmail] = useState<string>("");
  const [refreshTrigger] = useState(0);
  const [updatingPriorities, setUpdatingPriorities] = useState<Set<string>>(
    new Set()
  );
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

  // Allocation list cleanup state
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  // Calculate status totals based on filtered data
  const statusTotals = useMemo(() => {
    if (showAllocationLists) {
      // Aggregate asset statuses from all assets within filtered allocation lists
      const totals = {
        total: 0, // Total assets across all lists
        in_production: 0,
        revisions: 0,
        approved: 0,
        delivered_by_artist: 0,
        not_started: 0,
      };

      filteredLists.forEach((list) => {
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
    } else {
      const totals = {
        total: filtered.length,
        in_production: 0,
        revisions: 0,
        approved: 0,
        delivered_by_artist: 0,
        not_started: 0, // Include not_started for consistency
      };

      filtered.forEach((asset) => {
        const displayStatus = asset.status;

        if (displayStatus && totals.hasOwnProperty(displayStatus)) {
          totals[displayStatus as keyof typeof totals]++;
        }
      });

      // Calculate percentages
      const percentages = {
        total: 100,
        in_production:
          filtered.length > 0
            ? Math.round((totals.in_production / filtered.length) * 100)
            : 0,
        revisions:
          filtered.length > 0
            ? Math.round((totals.revisions / filtered.length) * 100)
            : 0,
        approved:
          filtered.length > 0
            ? Math.round((totals.approved / filtered.length) * 100)
            : 0,
        delivered_by_artist:
          filtered.length > 0
            ? Math.round((totals.delivered_by_artist / filtered.length) * 100)
            : 0,
        not_started:
          filtered.length > 0
            ? Math.round((totals.not_started / filtered.length) * 100)
            : 0,
      };

      return { totals, percentages } as const;
    }
  }, [filtered, filteredLists, showAllocationLists]);

  // Handle URL parameters for client, batch, and modeler filter
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const batchParam = searchParams.get("batch");
    const modelerParam = searchParams.get("modeler");
    const emailParam = searchParams.get("email");

    if (clientParam) {
      setClientFilter(clientParam);
    }

    if (batchParam) {
      setBatchFilter(batchParam);
    }

    if (modelerParam) {
      setModelerFilter(modelerParam);
    }

    if (emailParam) {
      setModelerEmail(emailParam);
    }

    // Show allocation lists if both modeler and email are provided
    if (modelerParam && emailParam) {
      setShowAllocationLists(true);
    } else {
      setShowAllocationLists(false);
    }
  }, [searchParams]);

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
        !modelerFilter
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
                batch
              )
            )
          `
          )
          .eq("user_id", modelerFilter)
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
    modelerFilter,
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

      let query = supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, client"
        );

      // If modeler filter is applied, only fetch assets assigned to that modeler
      if (modelerFilter && modelerFilter !== "all") {
        // First get the asset IDs assigned to this modeler (only accepted assignments)
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("asset_assignments")
          .select("asset_id")
          .eq("user_id", modelerFilter)
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
    modelerFilter,
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

  // Set filtered lists directly since we're not filtering anymore
  useEffect(() => {
    if (!showAllocationLists) return;
    setFilteredLists([...allocationLists]);
  }, [allocationLists, showAllocationLists]);

  // Set filtered assets directly since we're not filtering anymore
  useEffect(() => {
    if (showAllocationLists) return;
    setFiltered([...assets]);
  }, [assets, showAllocationLists]);

  // Reset page when view changes
  useEffect(() => {
    setPage(1);
  }, [showAllocationLists]);

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return showAllocationLists
      ? filteredLists.slice(start, start + PAGE_SIZE)
      : filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, filteredLists, page, showAllocationLists]);

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
      if (modelerFilter && modelerFilter !== "all") {
        // For modeler filter, we need to check which assets are actually accepted
        const { data: acceptedAssignments, error: acceptedError } =
          await supabase
            .from("asset_assignments")
            .select("asset_id")
            .eq("user_id", modelerFilter)
            .eq("role", "modeler")
            .eq("status", "accepted")
            .in("asset_id", assetIds);

        if (acceptedError) {
          console.error("Error fetching accepted assignments:", acceptedError);
          return;
        }

        const assignedAssetsMap = new Map<
          string,
          { email: string; name?: string }
        >();

        // Get the modeler's profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, title")
          .eq("id", modelerFilter)
          .single();

        if (!profileError && profileData && acceptedAssignments) {
          // Only mark accepted assets as assigned to this modeler
          acceptedAssignments.forEach((assignment) => {
            assignedAssetsMap.set(assignment.asset_id, {
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
        { email: string; name?: string }
      >();
      data?.forEach((assignment) => {
        const profile = profilesMap.get(assignment.user_id);
        if (profile) {
          assignedAssetsMap.set(assignment.asset_id, {
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

            console.log(`Deleted empty allocation list ${listId}`);
          } else {
            console.log(
              `Allocation list ${listId} still has ${remainingAssets.length} assets, keeping it`
            );
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
      console.log(`Successfully deleted asset ${assetId}`);
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete asset");
    } finally {
      setDeletingAsset(null);
    }
  };

  // Clean up empty allocation lists
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
  const checkOrphanedAllocationLists = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch("/api/admin/cleanup-allocation-lists", {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check allocation lists");
      }

      const result = await response.json();
      setCleanupResult(result);
      setShowCleanupDialog(true);

      toast.success(result.message);
    } catch (error) {
      console.error("Error checking allocation lists:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to check allocation lists"
      );
    } finally {
      setCleanupLoading(false);
    }
  };

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="p-6 flex-1 flex flex-col border-0 shadow-none bg-background  ">
        {/* Page Title and Cleanup Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Cleanup Controls */}
        </div>

        {selected.size > 0 && (
          <div className="flex justify-end mb-4">
            <Button
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
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Assign ({selected.size})
            </Button>
          </div>
        )}

        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info-muted rounded-lg">
                  <Package className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Models
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {statusTotals.totals.total}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-muted rounded-lg">
                  <Package className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    In Production
                  </p>
                  <p className="text-2xl font-bold text-warning">
                    {statusTotals.totals.in_production +
                      statusTotals.totals.delivered_by_artist +
                      statusTotals.totals.not_started}
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
                    Approved
                  </p>
                  <p className="text-2xl font-medium text-success">
                    {statusTotals.totals.approved}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Sent for Revision
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {statusTotals.totals.revisions}
                  </p>
                </div>
              </div>
            </Card>
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
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(list.status)}
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusColor(list.status)}`}
                            >
                              {list.status === "in_progress"
                                ? "In Progress"
                                : list.status === "pending"
                                  ? "Pending"
                                  : list.status}
                            </Badge>
                          </div>
                          <h3 className="text-md font-medium text-foreground">
                            Allocation {list.number} -{" "}
                            {new Date(list.deadline).toLocaleDateString()} -{" "}
                            {stats.totalAssets} assets
                          </h3>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 transition-transform duration-200" />
                            ) : (
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span>{modelerEmail}</span>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            Assets
                          </p>
                          <p className="text-2xl font-medium">
                            {stats.approvedAssets}/{stats.totalAssets}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            Progress
                          </p>
                          <p className="text-2xl font-medium text-info">
                            {stats.completionPercentage}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            Base Price
                          </p>
                          <p className="text-2xl font-medium  text-success">
                            €{stats.totalPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground">
                            Total Earnings
                          </p>
                          <p className="text-2xl font-medium text-success">
                            €{stats.totalEarnings.toFixed(2)}
                          </p>
                          {list.bonus > 0 && (
                            <p className="text-xs text-muted-foreground">
                              +{list.bonus}% bonus
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Down arrow indicator for collapsed state */}
                    {!isExpanded && (
                      <div className="flex justify-center ">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <span>Click to expand</span>
                          <ChevronDown className="h-4 w-4" />
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
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product Name</TableHead>
                              <TableHead className="w-32">Article ID</TableHead>
                              <TableHead className="w-24">Priority</TableHead>
                              <TableHead className="w-24">Price</TableHead>
                              <TableHead className="w-32">Status</TableHead>
                              <TableHead className="w-12">Actions</TableHead>
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
                                <TableCell>
                                  <div className="font-medium">
                                    {assignment.onboarding_assets.product_name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm">
                                    {assignment.onboarding_assets.article_id}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-2">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                        assignment.onboarding_assets.priority ||
                                          2
                                      )}`}
                                    >
                                      {getPriorityLabel(
                                        assignment.onboarding_assets.priority ||
                                          2
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      (
                                      {assignment.onboarding_assets.priority ||
                                        2}
                                      )
                                    </span>
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
                                      <SelectTrigger className="w-6 h-6 p-1 border-0 bg-transparent hover:bg-muted/50 rounded transition-colors">
                                        {updatingPriorities.has(
                                          assignment.onboarding_assets.id
                                        ) ? (
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
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
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">
                                      €{assignment.price.toFixed(2)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getStatusColor(assignment.onboarding_assets.status)}`}
                                  >
                                    {assignment.onboarding_assets.status ===
                                    "delivered_by_artist"
                                      ? "Waiting for Approval"
                                      : assignment.onboarding_assets.status ===
                                          "not_started"
                                        ? "Not Started"
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
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Preserve current filter parameters when navigating to asset detail
                                        const params = new URLSearchParams();
                                        params.set("from", "admin-review");
                                        if (
                                          clientFilter &&
                                          clientFilter !== "all"
                                        ) {
                                          params.set("client", clientFilter);
                                        }
                                        if (
                                          batchFilter &&
                                          batchFilter !== "all"
                                        ) {
                                          params.set("batch", batchFilter);
                                        }
                                        if (
                                          modelerFilter &&
                                          modelerFilter !== "all"
                                        ) {
                                          params.set("modeler", modelerFilter);
                                        }
                                        if (modelerEmail) {
                                          params.set("email", modelerEmail);
                                        }
                                        router.push(
                                          `/client-review/${assignment.onboarding_assets.id}?${params.toString()}`
                                        );
                                      }}
                                    >
                                      <Eye className="h-5 w-5" />
                                    </Button>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="cursor-pointer text-error hover:text-error hover:bg-error/10"
                                          onClick={(e) => e.stopPropagation()}
                                          disabled={
                                            deletingAsset ===
                                            assignment.onboarding_assets.id
                                          }
                                        >
                                          {deletingAsset ===
                                          assignment.onboarding_assets.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-error" />
                                          ) : (
                                            <Trash2 className="h-5 w-5" />
                                          )}
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="h-fit overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>
                                            Delete Asset
                                          </DialogTitle>
                                          <DialogDescription>
                                            Are you sure you want to delete this
                                            asset? This action cannot be undone
                                            and will permanently delete:
                                            <ul className="list-disc list-inside mt-2 space-y-1">
                                              <li>The asset itself</li>
                                              <li>
                                                All assignments and comments
                                              </li>
                                              <li>All revision history</li>
                                              <li>All QA approvals</li>
                                              <li>
                                                Any empty allocation lists (only
                                                if this was the last asset in
                                                the list)
                                              </li>
                                            </ul>
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                          <Button
                                            variant="destructive"
                                            onClick={() =>
                                              deleteAsset(
                                                assignment.onboarding_assets.id
                                              )
                                            }
                                            disabled={
                                              deletingAsset ===
                                              assignment.onboarding_assets.id
                                            }
                                          >
                                            {deletingAsset ===
                                            assignment.onboarding_assets.id ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
                      </CardContent>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          // Assets View
          <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = isSomeSelected && !isAllSelected;
                          }
                        }}
                        onChange={handleSelectAll}
                        className="h-4 w-4"
                      />
                    </div>
                  </TableHead>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Article ID</TableHead>
                  <TableHead>Priority</TableHead>

                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className={getStatusRowClass(asset.status)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(asset.id)}
                            onChange={() => toggleSelect(asset.id)}
                          />
                          {assignedAssets.has(asset.id) && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-xs text-muted-foreground">
                                {assignedAssets.get(asset.id)?.name ||
                                  assignedAssets
                                    .get(asset.id)
                                    ?.email?.split("@")[0]}
                              </span>
                            </div>
                          )}
                          {pendingAssets.has(asset.id) && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                              <span className="text-xs text-muted-foreground">
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
                          <span className="font-medium">
                            {asset.product_name}
                          </span>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {annotationCounts[asset.id] || 0} annotation
                              {(annotationCounts[asset.id] || 0) !== 1
                                ? "s"
                                : ""}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <Badge variant="outline" className="text-xs">
                              Batch {asset.batch || 1}
                            </Badge>
                            {(asset.revision_count || 0) > 0 && (
                              <>
                                <span className="text-xs text-slate-500">
                                  •
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                                >
                                  R{asset.revision_count}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{asset.article_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                              asset.priority || 2
                            )}`}
                          >
                            {getPriorityLabel(asset.priority || 2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({asset.priority || 2})
                          </span>
                          <Select
                            value={(asset.priority || 2).toString()}
                            onValueChange={(value) =>
                              handlePriorityUpdate(asset.id, parseInt(value))
                            }
                            disabled={updatingPriorities.has(asset.id)}
                          >
                            <SelectTrigger className="w-6 h-6 p-1 border-0 bg-transparent hover:bg-muted/50 rounded transition-colors">
                              {updatingPriorities.has(asset.id) ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                              ) : null}
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
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              asset.status in STATUS_LABELS
                                ? STATUS_LABELS[
                                    asset.status as keyof typeof STATUS_LABELS
                                  ].color
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {asset.status in STATUS_LABELS
                              ? STATUS_LABELS[
                                  asset.status as keyof typeof STATUS_LABELS
                                ].label
                              : asset.status}
                          </span>
                          {(asset.revision_count || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                            >
                              R{asset.revision_count}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer"
                          onClick={() => {
                            // Preserve current filter parameters when navigating to asset detail
                            const params = new URLSearchParams();
                            params.set("from", "admin-review");
                            if (clientFilter && clientFilter !== "all") {
                              params.set("client", clientFilter);
                            }
                            if (batchFilter && batchFilter !== "all") {
                              params.set("batch", batchFilter);
                            }
                            if (modelerFilter && modelerFilter !== "all") {
                              params.set("modeler", modelerFilter);
                            }
                            if (modelerEmail) {
                              params.set("email", modelerEmail);
                            }
                            router.push(
                              `/client-review/${asset.id}?${params.toString()}`
                            );
                          }}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="cursor-pointer text-error hover:text-error hover:bg-error/10"
                              disabled={deletingAsset === asset.id}
                            >
                              {deletingAsset === asset.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-error" />
                              ) : (
                                <Trash2 className="h-5 w-5" />
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="h-fit ">
                            <DialogHeader>
                              <DialogTitle>Delete Asset</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete this asset? This
                                action cannot be undone and will permanently
                                delete:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>The asset itself</li>
                                  <li>All assignments and comments</li>
                                  <li>All revision history</li>
                                  <li>All QA approvals</li>
                                  <li>
                                    Any empty allocation lists (only if this was
                                    the last asset in the list)
                                  </li>
                                </ul>
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="destructive"
                                onClick={() => deleteAsset(asset.id)}
                                disabled={deletingAsset === asset.id}
                              >
                                {deletingAsset === asset.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                ) : null}
                                Delete Asset
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Pagination - Always at bottom */}
        <div className="flex items-center justify-center  gap-2  ">
          <div className="text-sm text-muted-foreground">
            {showAllocationLists
              ? filteredLists.length === 0
                ? "No items"
                : `
                    ${1 + (page - 1) * PAGE_SIZE}
                    -
                    ${Math.min(page * PAGE_SIZE, filteredLists.length)}
                    of
                    ${filteredLists.length}
                    Items
                  `
              : filtered.length === 0
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
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={
                page * PAGE_SIZE >=
                (showAllocationLists ? filteredLists.length : filtered.length)
              }
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Cleanup Results Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="max-w-4xl h-fit overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocation List Cleanup Results</DialogTitle>
            <DialogDescription>
              {cleanupResult?.message || "Cleanup operation completed"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {cleanupResult && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-info-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Processed
                    </p>
                    <p className="text-2xl font-bold text-info">
                      {cleanupResult.totalProcessed || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-success-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">
                      Deleted
                    </p>
                    <p className="text-2xl font-bold text-success">
                      {cleanupResult.deletedCount || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-warning-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">
                      Remaining
                    </p>
                    <p className="text-2xl font-bold text-warning">
                      {cleanupResult.remainingCount || 0}
                    </p>
                  </div>
                  {cleanupResult.orphanedCount !== undefined && (
                    <div className="p-4 bg-error-muted rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground">
                        Orphaned
                      </p>
                      <p className="text-2xl font-bold text-error">
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

          <DialogFooter>
            <Button onClick={() => setShowCleanupDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
