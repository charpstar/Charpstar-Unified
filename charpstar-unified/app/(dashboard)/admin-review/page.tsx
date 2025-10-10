"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowLeft,
  Trash2,
  X,
  FileText,
  GripVertical,
  Euro,
  StickyNote,
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
import { Input, Textarea } from "@/components/ui/inputs";
import { Calendar } from "@/components/ui/utilities";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";

// Pricing options for admin price management
interface PricingOption {
  id: string;
  label: string;
  price: number;
  description?: string;
}

const PRICING_OPTIONS: PricingOption[] = [
  // Premium Tier Options Only
  {
    id: "pbr_3d_model_after_second",
    label: "PBR 3D Model Creation (Premium Tier)",
    price: 30,
    description: "Premium PBR 3D model creation after second deadline",
  },
  {
    id: "additional_colors_after_second",
    label: "Additional Colors (Premium Tier)",
    price: 1.5,
    description: "Additional colors for already made 3D models",
  },
  {
    id: "additional_textures_after_second",
    label: "Additional Textures/Materials (Premium Tier)",
    price: 7,
    description: "Additional textures/materials for already made 3D models",
  },
  {
    id: "additional_sizes_after_second",
    label: "Additional Sizes (Premium Tier)",
    price: 5,
    description: "Additional sizes for already made 3D models",
  },

  // Custom pricing option
  {
    id: "custom_pricing",
    label: "Custom Pricing",
    price: 0, // Will be set by user
    description: "Set a custom price for this asset",
  },
];

// Derive human-readable task type from pricing option id

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import { getPriorityLabel } from "@/lib/constants";
import { format } from "date-fns";
import { Calendar as CalendarIcon, User, Package } from "lucide-react";

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
    case "client_revision":
      return "table-row-status-client-revision";
    case "approved":
      return "table-row-status-approved";
    case "approved_by_client":
      return "table-row-status-approved-by-client";
    case "delivered_by_artist":
      return "table-row-status-delivered-by-artist";
    case "not_started":
      return "table-row-status-not-started bg-gray-50 dark:bg-gray-900/30";
    case "in_progress":
      return "table-row-status-in-production"; // Same as in_production
    case "waiting_for_approval":
      return "table-row-status-delivered-by-artist"; // Same as delivered_by_artist
    case "pending":
      return "table-row-status-not-started"; // Same as not_started
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
    case "client_revision":
      return "status-client-revision";
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
    case "pending":
      return "status-not-started"; // Same as not_started
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
    case "client_revision":
      return "Client Revision";
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
    case "unallocated":
      return "Not Allocated";
    default:
      return status;
  }
};

const PAGE_SIZE = 200;

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
    case "client_revision":
      return <RotateCcw className="h-4 w-4 text-red-600" />;
    case "unallocated":
      return <Users className="h-4 w-4 text-red-600" />;
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
    (sum: number, assignment: any) =>
      sum + (assignment.onboarding_assets.price || 0),
    0
  );

  // Calculate price for only completed assets (for bonus calculation)
  const completedPrice = list.asset_assignments
    .filter(
      (assignment: any) =>
        assignment.onboarding_assets.status === "approved" ||
        assignment.onboarding_assets.status === "approved_by_client"
    )
    .reduce(
      (sum: number, assignment: any) =>
        sum + (assignment.onboarding_assets.price || 0),
      0
    );

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
  <>
    {/* Summary Stats Skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-2 sm:mb-6">
      {Array.from({ length: 7 }).map((_, i) => (
        <Card key={i} className="p-2 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1 sm:p-2 bg-muted rounded-lg">
              <div className="h-3 w-3 sm:h-5 sm:w-5 bg-muted-foreground/20 rounded animate-pulse" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-16 sm:w-20 bg-muted rounded animate-pulse" />
              <div className="h-5 sm:h-7 w-10 sm:w-14 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>

    {/* Filters Skeleton */}
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
      <div className="h-8 sm:h-9 w-full sm:w-40 bg-muted rounded animate-pulse" />
      <div className="h-8 sm:h-9 w-full sm:w-32 bg-muted rounded animate-pulse" />
      <div className="h-8 sm:h-9 w-full sm:w-40 bg-muted rounded animate-pulse" />
    </div>

    {/* Table Skeleton */}
    <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[67vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-left">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </TableHead>
            <TableHead className="text-left">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </TableHead>
            <TableHead className="text-left">
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-16 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-16 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-20 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-16 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
            <TableHead className="text-center">
              <div className="h-4 w-16 bg-muted rounded animate-pulse mx-auto" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 12 }).map((_, i) => (
            <TableRow key={i}>
              {/* Checkbox + Drag Handle */}
              <TableCell className="text-left">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                </div>
              </TableCell>

              {/* Model Name */}
              <TableCell className="text-left">
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-muted/60 rounded animate-pulse" />
                    <div className="h-5 w-10 bg-muted/60 rounded-full animate-pulse" />
                  </div>
                </div>
              </TableCell>

              {/* Article ID */}
              <TableCell className="text-left">
                <div className="h-4 w-24 bg-muted rounded animate-pulse font-mono" />
              </TableCell>

              {/* Priority */}
              <TableCell className="text-center">
                <div className="h-6 w-16 bg-muted rounded-full animate-pulse mx-auto" />
              </TableCell>

              {/* Status */}
              <TableCell className="text-center">
                <div className="h-6 w-24 bg-muted rounded-full animate-pulse mx-auto" />
              </TableCell>

              {/* References */}
              <TableCell className="text-center">
                <div className="h-7 w-16 bg-muted rounded animate-pulse mx-auto" />
              </TableCell>

              {/* Product Link */}
              <TableCell className="text-center">
                <div className="h-4 w-20 bg-muted rounded animate-pulse mx-auto" />
              </TableCell>

              {/* Price */}
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                </div>
              </TableCell>

              {/* Review Actions */}
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </>
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

  // Get URL parameters for client and batch filtering
  const urlClient = searchParams.get("client");
  const urlBatch = searchParams.get("batch");

  // Debug URL parameters
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<string[]>([]);
  const [modelers, setModelers] = useState<
    Array<{ id: string; email: string; title?: string }>
  >([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>(
    {}
  );
  // Price management state
  const [assetPrices, setAssetPrices] = useState<
    Record<string, { pricingOptionId: string; price: number }>
  >({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [pricingComments, setPricingComments] = useState<
    Record<string, string>
  >({});
  const [settingPrices, setSettingPrices] = useState<Set<string>>(new Set());
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [draggedAssets, setDraggedAssets] = useState<Set<string>>(new Set());
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [dragPreview, setDragPreview] = useState<any[]>([]);
  const [dragInsertPosition, setDragInsertPosition] = useState<number>(-1);
  const [isManuallyReordering, setIsManuallyReordering] = useState(false);
  const lastManualOrderRef = useRef<string[]>([]);
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

  // Allocation dialog state
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);
  const [selectedModeler, setSelectedModeler] = useState<string>("");
  const [allocationDeadline, setAllocationDeadline] = useState<string>(
    format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [allocationBonus, setAllocationBonus] = useState<number>(15);
  const [allocating, setAllocating] = useState(false);

  // Reallocation dialog state
  const [showReallocationDialog, setShowReallocationDialog] = useState(false);
  const [selectedAssetForReallocation, setSelectedAssetForReallocation] =
    useState<any>(null);
  const [reallocationModeler, setReallocationModeler] = useState<string>("");
  const [reallocationDeadline, setReallocationDeadline] = useState<string>(
    format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );
  const [reallocationBonus, setReallocationBonus] = useState<number>(15);
  const [reallocating, setReallocating] = useState(false);

  // Bulk reallocation state
  const [selectedAssetsForReallocation, setSelectedAssetsForReallocation] =
    useState<Set<string>>(new Set());
  const [showBulkReallocationDialog, setShowBulkReallocationDialog] =
    useState(false);
  const [bulkReallocationModeler, setBulkReallocationModeler] =
    useState<string>("");
  const [bulkReallocationDeadline, setBulkReallocationDeadline] =
    useState<string>(
      format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
    );
  const [bulkReallocationBonus, setBulkReallocationBonus] =
    useState<number>(15);
  const [bulkReallocating, setBulkReallocating] = useState(false);

  // Bulk status update state
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);

  // Fix stuck assets state
  const [showFixStuckDialog, setShowFixStuckDialog] = useState(false);
  const [fixingStuckAssets, setFixingStuckAssets] = useState(false);
  const [stuckAssetsCount, setStuckAssetsCount] = useState(0);

  // Count stuck assets when dialog opens or selection changes
  useEffect(() => {
    if (showFixStuckDialog) {
      countStuckAssets().then(setStuckAssetsCount);
    }
  }, [showFixStuckDialog, selected]);

  // Fetch assets function
  const fetchAssets = async () => {
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

      if (modelersError) {
        console.error("Error fetching modelers:", modelersError);
      } else {
        setModelers(modelersData || []);
      }

      // Build the query
      let query = supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, product_link, glb_link, reference, client, upload_order, pricing_option_id, price, pricing_comment, transferred"
        )
        .eq("transferred", false) // Exclude transferred assets
        .order("upload_order", { ascending: true });

      // Apply URL parameter filters
      if (urlClient) {
        query = query.eq("client", urlClient);
      }
      if (urlBatch) {
        query = query.eq("batch", parseInt(urlBatch));
      }

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
          console.error("Error fetching assignments:", assignmentError);
          setLoading(false);
          stopLoading();
          return;
        }

        const assignedAssetIds = assignmentData?.map((a) => a.asset_id) || [];
        if (assignedAssetIds.length === 0) {
          setAssets([]);
          setFiltered([]);
          setLoading(false);
          stopLoading();
          return;
        }

        query = query.in("id", assignedAssetIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching assets:", error);
        setLoading(false);
        stopLoading();
        return;
      }

      setAssets(data || []);
      setFiltered(data || []);
    } catch (error) {
      console.error("Error in fetchAssets:", error);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  // Handle bulk reallocation
  const handleBulkReallocateAssets = async () => {
    if (!bulkReallocationModeler || selectedAssetsForReallocation.size === 0) {
      toast.error("Please select a modeler and assets for reallocation");
      return;
    }

    try {
      setBulkReallocating(true);

      // Check if the selected modeler has a QA assigned
      const { data: qaAllocations, error: qaError } = await supabase
        .from("qa_allocations")
        .select("qa_id")
        .eq("modeler_id", bulkReallocationModeler);

      if (qaError) {
        console.error("Error checking QA allocation:", qaError);
        toast.error("Failed to verify QA assignment");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        toast.error(
          "Cannot reallocate assets: The selected modeler does not have a QA assigned. Please assign a QA to this modeler first.",
          { duration: 8000 }
        );
        return;
      }

      // Get all assets from all allocation lists
      const allAssets: any[] = [];
      allocationLists.forEach((list) => {
        list.asset_assignments.forEach((assignment: any) => {
          allAssets.push(assignment.onboarding_assets);
        });
      });

      // Filter selected assets with pricing
      const selectedAssets = Array.from(selectedAssetsForReallocation);
      const assetsWithPricing = allAssets.filter(
        (asset) =>
          selectedAssets.includes(asset.id) &&
          ((asset.pricing_option_id && asset.price && asset.price > 0) ||
            (assetPrices[asset.id] && assetPrices[asset.id].price > 0))
      );

      if (assetsWithPricing.length === 0) {
        toast.error(
          "No selected assets have pricing set. Please set pricing for the assets first."
        );
        return;
      }

      if (assetsWithPricing.length < selectedAssets.length) {
        toast.warning(
          `${selectedAssets.length - assetsWithPricing.length} asset(s) excluded - no pricing set. Only assets with pricing will be reallocated.`,
          { duration: 6000 }
        );
      }

      // Create allocation list using the API
      const response = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: assetsWithPricing.map((asset) => asset.id),
          userIds: [bulkReallocationModeler],
          role: "modeler",
          deadline: new Date(
            bulkReallocationDeadline + "T00:00:00.000Z"
          ).toISOString(),
          bonus: bulkReallocationBonus,
          allocationName: `Bulk Reallocation ${new Date().toISOString().split("T")[0]} - ${assetsWithPricing.length} assets`,
          prices: assetsWithPricing.reduce(
            (acc, asset) => {
              acc[asset.id] = asset.price;
              return acc;
            },
            {} as Record<string, number>
          ),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to create bulk reallocation"
        );
      }

      // Close dialog and clear state
      setShowBulkReallocationDialog(false);
      setSelectedAssetsForReallocation(new Set());
      setBulkReallocationModeler("");

      toast.success(
        `Successfully reallocated ${assetsWithPricing.length} asset(s) to new modeler`
      );

      // Update local state to remove reallocated assets from current view
      const reallocatedAssetIds = assetsWithPricing.map((asset) => asset.id);
      setAllocationLists(
        (prevLists) =>
          prevLists
            .map((list) => ({
              ...list,
              asset_assignments: list.asset_assignments.filter(
                (assignment: any) =>
                  !reallocatedAssetIds.includes(assignment.onboarding_assets.id)
              ),
            }))
            .filter((list) => list.asset_assignments.length > 0) // Remove empty lists
      );

      // Refresh the page data
      await fetchAssets();
    } catch (error) {
      console.error("Error bulk reallocating assets:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to bulk reallocate assets"
      );
    } finally {
      setBulkReallocating(false);
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async () => {
    if (selected.size === 0) {
      toast.error("Please select assets to update");
      return;
    }

    try {
      setBulkStatusUpdating(true);

      const selectedArray = Array.from(selected);

      // Use the bulk-complete API endpoint to handle status update and transfer
      const response = await fetch("/api/assets/bulk-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: selectedArray,
          status: "approved_by_client",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update assets");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await response.json();

      // Update local state
      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          selected.has(asset.id)
            ? { ...asset, status: "approved_by_client" }
            : asset
        )
      );

      // Clear selection and close dialog
      setSelected(new Set());
      setShowBulkStatusDialog(false);

      toast.success(
        `Successfully updated ${selected.size} asset(s) to approved by client status and transferred to assets table`
      );

      // Refresh the page data
      await fetchAssets();
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update asset status"
      );
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  // Count stuck assets in selection (approved_by_client but not transferred)
  const countStuckAssets = async () => {
    if (selected.size === 0) {
      return 0;
    }

    try {
      const selectedArray = Array.from(selected);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id")
        .in("id", selectedArray)
        .eq("status", "approved_by_client")
        .eq("transferred", false);

      if (error) {
        console.error("Error counting stuck assets:", error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error("Error counting stuck assets:", error);
      return 0;
    }
  };

  // Fix stuck assets function - only for selected assets
  const handleFixStuckAssets = async () => {
    if (selected.size === 0) {
      toast.error("Please select assets to fix");
      return;
    }

    try {
      setFixingStuckAssets(true);

      // Get selected assets that are stuck (approved_by_client but not transferred)
      const selectedArray = Array.from(selected);
      const { data: stuckAssets, error: fetchError } = await supabase
        .from("onboarding_assets")
        .select("id, product_name, article_id, status, transferred")
        .in("id", selectedArray)
        .eq("status", "approved_by_client")
        .eq("transferred", false);

      if (fetchError) {
        console.error("Error fetching stuck assets:", fetchError);
        throw new Error("Failed to fetch stuck assets");
      }

      if (!stuckAssets || stuckAssets.length === 0) {
        toast.success("No stuck assets found in your selection!");
        setShowFixStuckDialog(false);
        return;
      }

      // Update each asset using the complete API to trigger auto-transfer
      let successCount = 0;
      let errorCount = 0;

      for (const asset of stuckAssets) {
        try {
          const response = await fetch("/api/assets/complete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset.id,
              status: "approved_by_client",
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            const errorData = await response.json();
            console.error(
              `❌ Failed to fix ${asset.article_id}:`,
              errorData.error
            );
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Error fixing ${asset.article_id}:`, error);
          errorCount++;
        }
      }

      // Clear selection and close dialog
      setSelected(new Set());
      setShowFixStuckDialog(false);

      // Show results
      if (successCount > 0) {
        toast.success(
          `Successfully fixed ${successCount} stuck asset(s) and transferred them to assets table`
        );
      }

      if (errorCount > 0) {
        toast.error(`Failed to fix ${errorCount} asset(s)`);
      }

      // Refresh the page data
      await fetchAssets();
    } catch (error) {
      console.error("Error fixing stuck assets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fix stuck assets"
      );
    } finally {
      setFixingStuckAssets(false);
    }
  };

  // Toggle asset selection for reallocation
  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetsForReallocation((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  // Select all assets in current view
  const selectAllAssetsForReallocation = () => {
    const allAssetIds: string[] = [];
    allocationLists.forEach((list) => {
      list.asset_assignments.forEach((assignment: any) => {
        allAssetIds.push(assignment.onboarding_assets.id);
      });
    });
    setSelectedAssetsForReallocation(new Set(allAssetIds));
  };

  // Clear all asset selections
  const clearAssetSelections = () => {
    setSelectedAssetsForReallocation(new Set());
  };

  // Handle asset reallocation
  const handleReallocateAsset = async () => {
    if (!reallocationModeler || !selectedAssetForReallocation) {
      toast.error("Please select a modeler for reallocation");
      return;
    }

    try {
      setReallocating(true);

      // Check if the selected modeler has a QA assigned
      const { data: qaAllocations, error: qaError } = await supabase
        .from("qa_allocations")
        .select("qa_id")
        .eq("modeler_id", reallocationModeler);

      if (qaError) {
        console.error("Error checking QA allocation:", qaError);
        toast.error("Failed to verify QA assignment");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        toast.error(
          "Cannot reallocate asset: The selected modeler does not have a QA assigned. Please assign a QA to this modeler first.",
          { duration: 8000 }
        );
        return;
      }

      // Check if asset has pricing
      if (
        !selectedAssetForReallocation.pricing_option_id ||
        !selectedAssetForReallocation.price ||
        selectedAssetForReallocation.price <= 0
      ) {
        toast.error(
          "Cannot reallocate asset: No pricing set. Please set pricing for this asset first."
        );
        return;
      }

      // Create allocation list using the API
      const response = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: [selectedAssetForReallocation.id],
          userIds: [reallocationModeler],
          role: "modeler",
          deadline: new Date(
            reallocationDeadline + "T00:00:00.000Z"
          ).toISOString(),
          bonus: reallocationBonus,
          allocationName: `Reallocation ${new Date().toISOString().split("T")[0]} - ${selectedAssetForReallocation.product_name}`,
          prices: {
            [selectedAssetForReallocation.id]:
              selectedAssetForReallocation.price,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create reallocation");
      }

      // Close dialog and clear state
      setShowReallocationDialog(false);
      setSelectedAssetForReallocation(null);
      setReallocationModeler("");

      toast.success(`Successfully reallocated asset to new modeler`);

      // Update local state to remove reallocated asset from current view
      setAllocationLists(
        (prevLists) =>
          prevLists
            .map((list) => ({
              ...list,
              asset_assignments: list.asset_assignments.filter(
                (assignment: any) =>
                  assignment.onboarding_assets.id !==
                  selectedAssetForReallocation.id
              ),
            }))
            .filter((list) => list.asset_assignments.length > 0) // Remove empty lists
      );

      // Refresh the page data
      await fetchAssets();
    } catch (error) {
      console.error("Error reallocating asset:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reallocate asset"
      );
    } finally {
      setReallocating(false);
    }
  };

  // Handle asset allocation
  const handleAllocateAssets = async () => {
    if (!selectedModeler || selected.size === 0) {
      toast.error("Please select a modeler and assets to allocate");
      return;
    }

    try {
      setAllocating(true);

      // Check if the selected modeler has a QA assigned
      const { data: qaAllocations, error: qaError } = await supabase
        .from("qa_allocations")
        .select("qa_id")
        .eq("modeler_id", selectedModeler);

      if (qaError) {
        console.error("Error checking QA allocation:", qaError);
        toast.error("Failed to verify QA assignment");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        toast.error(
          "Cannot allocate assets: The selected modeler does not have a QA assigned. Please assign a QA to this modeler first.",
          { duration: 8000 }
        );
        return;
      }

      // Get selected assets with pricing
      const selectedAssets = Array.from(selected);
      const assetsWithPricing = filtered.filter(
        (asset) =>
          selectedAssets.includes(asset.id) &&
          ((asset.pricing_option_id && asset.price && asset.price > 0) ||
            (assetPrices[asset.id] && assetPrices[asset.id].price > 0))
      );

      if (assetsWithPricing.length === 0) {
        toast.error(
          "No selected assets have pricing set. Please set pricing for the assets first."
        );
        return;
      }

      if (assetsWithPricing.length < selectedAssets.length) {
        toast.warning(
          `${selectedAssets.length - assetsWithPricing.length} asset(s) excluded - no pricing set. Only assets with pricing will be allocated.`,
          { duration: 6000 }
        );
      }

      // Create allocation list using the API
      const response = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: assetsWithPricing.map((asset) => asset.id),
          userIds: [selectedModeler],
          role: "modeler",
          deadline: new Date(
            allocationDeadline + "T00:00:00.000Z"
          ).toISOString(),
          bonus: allocationBonus,
          allocationName: `Allocation ${new Date().toISOString().split("T")[0]} - ${assetsWithPricing.length} assets`,
          prices: assetsWithPricing.reduce(
            (acc, asset) => {
              acc[asset.id] = asset.price;
              return acc;
            },
            {} as Record<string, number>
          ),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create allocation");
      }

      // Clear selection and close dialog
      setSelected(new Set());
      setShowAllocationDialog(false);
      setSelectedModeler("");

      toast.success(
        `Successfully allocated ${assetsWithPricing.length} asset(s) to modeler`
      );

      // Refresh the page data
      await fetchAssets();
    } catch (error) {
      console.error("Error allocating assets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to allocate assets"
      );
    } finally {
      setAllocating(false);
    }
  };

  // Refresh a specific asset's reference/glb data across all relevant views
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link, status, transferred")
        .eq("id", assetId)
        .eq("transferred", false)
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

  // Calculate status totals - use filtered data when URL parameters are present
  const statusTotals = useMemo(() => {
    if (showAllocationLists) {
      // Aggregate asset statuses from all assets across all allocation lists (unfiltered)
      const totals = {
        total: 0, // Total assets across all lists
        in_production: 0,
        revisions: 0,
        client_revision: 0,
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
        client_revision:
          totals.total > 0
            ? Math.round((totals.client_revision / totals.total) * 100)
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
        client_revision: 0,
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
      // Use the assets array which is already filtered by URL parameters in fetchAssets
      const dataLength = assets.length;

      const totals = {
        total: dataLength,
        in_production: 0,
        in_progress: 0, // Add in_progress status
        revisions: 0,
        client_revision: 0,
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
          dataLength > 0
            ? Math.round((totals.in_production / dataLength) * 100)
            : 0,
        in_progress:
          dataLength > 0
            ? Math.round((totals.in_progress / dataLength) * 100)
            : 0,
        revisions:
          dataLength > 0
            ? Math.round((totals.revisions / dataLength) * 100)
            : 0,
        approved:
          dataLength > 0 ? Math.round((totals.approved / dataLength) * 100) : 0,
        client_revision:
          dataLength > 0
            ? Math.round((totals.client_revision / dataLength) * 100)
            : 0,
        delivered_by_artist:
          dataLength > 0
            ? Math.round((totals.delivered_by_artist / dataLength) * 100)
            : 0,
        not_started:
          dataLength > 0
            ? Math.round((totals.not_started / dataLength) * 100)
            : 0,
      };

      return { totals, percentages } as const;
    }
  }, [
    assets,
    allocationLists,
    showAllocationLists,
    showQAAssets,
    filtered,
    urlClient,
    urlBatch,
  ]);

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
                product_link,
                pricing_option_id,
                price
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

      // Wait for searchParams to be available
      if (!searchParams) {
        return;
      }
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
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, client, reference, glb_link, product_link, upload_order, pricing_option_id, price, pricing_comment, transferred"
        )
        .eq("transferred", false) // Exclude transferred assets
        .order("upload_order", { ascending: true });

      // Apply URL parameter filters
      if (urlClient) {
        query = query.eq("client", urlClient);
      }
      if (urlBatch) {
        query = query.eq("batch", parseInt(urlBatch));
      }

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

        // Initialize asset prices from loaded data
        const initialPrices: Record<
          string,
          { pricingOptionId: string; price: number }
        > = {};
        const initialCustomPrices: Record<string, number> = {};
        const initialPricingComments: Record<string, string> = {};
        data.forEach((asset) => {
          if (asset.pricing_option_id && asset.price !== undefined) {
            initialPrices[asset.id] = {
              pricingOptionId: asset.pricing_option_id,
              price: asset.price,
            };

            // If it's custom pricing, also set the custom price
            if (asset.pricing_option_id === "custom_pricing") {
              initialCustomPrices[asset.id] = asset.price;
            }
          }

          // Initialize pricing comments
          if ((asset as any).pricing_comment) {
            initialPricingComments[asset.id] = (asset as any).pricing_comment;
          }
        });
        setAssetPrices(initialPrices);
        setCustomPrices(initialCustomPrices);
        setPricingComments(initialPricingComments);

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
    urlClient,
    urlBatch,
    searchParams,
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

  // Fetch comment counts for assets
  useEffect(() => {
    async function fetchCommentCounts() {
      if (assets.length === 0) return;
      try {
        const assetIds = assets.map((asset) => asset.id);
        const { data, error } = await supabase
          .from("asset_comments")
          .select("asset_id")
          .in("asset_id", assetIds);
        if (!error && data) {
          const counts: Record<string, number> = {};
          data.forEach((comment) => {
            counts[comment.asset_id] = (counts[comment.asset_id] || 0) + 1;
          });
          setCommentCounts(counts);
        }
      } catch (error) {
        console.error("Error fetching comment counts:", error);
      }
    }
    fetchCommentCounts();
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
    if (showAllocationLists || showQAAssets || isManuallyReordering) return;

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
      filteredAssets = filteredAssets.filter((asset) => {
        // Handle special "unallocated" filter
        if (statusFilters.includes("unallocated")) {
          // Check if asset is unallocated (not in assignedAssets map)
          const isUnallocated = !assignedAssets.has(asset.id);
          // Include unallocated assets OR assets matching other status filters
          return (
            isUnallocated ||
            statusFilters
              .filter((s) => s !== "unallocated")
              .includes(asset.status)
          );
        }
        return statusFilters.includes(asset.status);
      });
    }

    // Default sort: status progression like QA Review
    const statusPriority: Record<string, number> = {
      in_production: 1,
      delivered_by_artist: 2,
      revisions: 3,
      approved: 4,
      approved_by_client: 5,
    };
    // If we have a recent manual order, try to preserve it
    if (lastManualOrderRef.current.length > 0 && !isManuallyReordering) {
      const manualOrderIds = lastManualOrderRef.current;
      const manualOrderMap = new Map(
        manualOrderIds.map((id, index) => [id, index])
      );

      // Check if all manually ordered items are still present in filtered results
      const hasAllManualItems = manualOrderIds.every((id) =>
        filteredAssets.some((asset) => asset.id === id)
      );

      if (
        hasAllManualItems &&
        filteredAssets.length === manualOrderIds.length
      ) {
        // Preserve manual order if possible
        filteredAssets.sort((a, b) => {
          const aOrder = manualOrderMap.get(a.id) ?? 999;
          const bOrder = manualOrderMap.get(b.id) ?? 999;
          return aOrder - bOrder;
        });
      } else {
        // Clear manual order if assets have changed significantly
        lastManualOrderRef.current = [];
        filteredAssets.sort(
          (a, b) =>
            (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
        );
      }
    } else {
      // Default sorting by status priority
      filteredAssets.sort(
        (a, b) =>
          (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
      );
    }

    setFiltered(filteredAssets);
  }, [
    assets,
    clientFilters,
    batchFilters,
    modelerFilters,
    statusFilters,
    showAllocationLists,
    assignedAssets,
    isManuallyReordering,
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

  const toggleSelect = (id: string, event?: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev);

      // Handle Ctrl+Click for individual toggle
      if (event?.ctrlKey || event?.metaKey) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }

      // Handle Shift+Click for range selection
      if (event?.shiftKey && prev.size > 0) {
        const currentAssets = paged; // Use paged instead of filtered for visible assets
        const currentIndex = currentAssets.findIndex(
          (asset) => asset.id === id
        );
        const lastSelectedIndex = Math.max(
          ...Array.from(prev)
            .map((selectedId) =>
              currentAssets.findIndex((asset) => asset.id === selectedId)
            )
            .filter((index) => index !== -1)
        );

        if (currentIndex !== -1 && lastSelectedIndex !== -1) {
          const start = Math.min(currentIndex, lastSelectedIndex);
          const end = Math.max(currentIndex, lastSelectedIndex);

          // Select all assets in the range
          for (let i = start; i <= end; i++) {
            next.add(currentAssets[i].id);
          }
          return next;
        }
      }

      // Default behavior - single selection
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

  // Price management functions
  const handlePriceUpdate = async (
    assetId: string,
    pricingOptionId: string,
    price: number
  ) => {
    try {
      const response = await fetch("/api/assets/update-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          pricingOptionId,
          price,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update price");
      }

      // Update local state
      setAssetPrices((prev) => ({
        ...prev,
        [assetId]: { pricingOptionId, price },
      }));

      // If it's custom pricing, also update the custom price
      if (pricingOptionId === "custom_pricing") {
        setCustomPrices((prev) => ({
          ...prev,
          [assetId]: price,
        }));
      }

      toast.success("Price updated successfully");
    } catch (error) {
      console.error("Error updating price:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update price"
      );
    }
  };

  const handleCustomPriceChange = (assetId: string, price: number) => {
    setCustomPrices((prev) => ({
      ...prev,
      [assetId]: price,
    }));
  };

  const handleCustomPriceSubmit = async (assetId: string) => {
    const customPrice = customPrices[assetId];
    if (customPrice !== undefined && customPrice > 0) {
      // Add to loading state
      setSettingPrices((prev) => new Set(prev).add(assetId));

      try {
        await handlePriceUpdate(assetId, "custom_pricing", customPrice);
        toast.success("Custom price set successfully");
      } catch (error) {
        console.error("Error setting custom price:", error);
        toast.error("Failed to set custom price");
      } finally {
        // Remove from loading state
        setSettingPrices((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
      }
    }
  };

  const handlePricingCommentUpdate = async (
    assetId: string,
    comment: string
  ) => {
    try {
      const response = await fetch("/api/assets/update-pricing-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          comment: comment.trim() || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update pricing comment");
      }

      // Update local state
      setPricingComments((prev) => ({
        ...prev,
        [assetId]: comment.trim() || "",
      }));

      toast.success("Pricing comment updated successfully");
    } catch (error) {
      console.error("Error updating pricing comment:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update pricing comment"
      );
    }
  };

  const getPricingOptionById = (id: string) => {
    return PRICING_OPTIONS.find((option) => option.id === id);
  };

  // Enhanced drag and drop reordering functions
  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    // If the asset being dragged is selected, drag all selected assets
    if (selected.has(assetId) && selected.size > 1) {
      setDraggedAssets(new Set(selected));
      setIsDraggingGroup(true);
      setDraggedAssetId(assetId); // Primary asset being dragged
    } else {
      // Single asset drag
      setDraggedAssetId(assetId);
      setDraggedAssets(new Set([assetId]));
      setIsDraggingGroup(false);
    }

    e.dataTransfer.effectAllowed = "move";

    // Initialize drag preview with current order
    setDragPreview([...filtered]);

    // Add visual feedback to dragged assets
    if (selected.has(assetId) && selected.size > 1) {
      // Multi-asset drag - highlight all selected rows
      const allRows = document.querySelectorAll("tr");
      allRows.forEach((row) => {
        const checkbox = row.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement;
        if (checkbox?.checked) {
          (row as HTMLElement).style.transform = "rotate(1deg) scale(0.98)";
          (row as HTMLElement).style.boxShadow =
            "0 8px 16px rgba(59, 130, 246, 0.3)";
          (row as HTMLElement).style.backgroundColor =
            "rgba(59, 130, 246, 0.1)";
        }
      });
    } else {
      // Single asset drag
      const target = e.target as HTMLElement;
      const row = target.closest("tr");
      if (row) {
        row.style.transform = "rotate(2deg)";
        row.style.boxShadow = "0 8px 16px rgba(0,0,0,0.2)";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Add visual feedback for drop target and generate preview
    const target = e.target as HTMLElement;
    const row = target.closest("tr");
    if (row && (draggedAssetId || draggedAssets.size > 0)) {
      // Don't highlight if it's one of the dragged assets
      const assetIdElement = row.querySelector(
        "[data-asset-id]"
      ) as HTMLElement;
      const assetId = assetIdElement?.dataset.assetId;

      if (assetId && !draggedAssets.has(assetId)) {
        // Find the target index for preview
        const currentAssets = [...filtered];
        const targetIndex = currentAssets.findIndex(
          (asset) => asset.id === assetId
        );

        if (targetIndex !== -1) {
          // Generate preview of the reordered list
          let previewAssets: any[];

          if (isDraggingGroup && draggedAssets.size > 1) {
            // Group movement preview
            const draggedAssetObjects = currentAssets.filter((asset) =>
              draggedAssets.has(asset.id)
            );
            const nonDraggedAssets = currentAssets.filter(
              (asset) => !draggedAssets.has(asset.id)
            );

            previewAssets = [
              ...nonDraggedAssets.slice(0, targetIndex),
              ...draggedAssetObjects,
              ...nonDraggedAssets.slice(targetIndex),
            ];
          } else {
            // Single asset movement preview
            const draggedIndex = currentAssets.findIndex(
              (asset) => asset.id === draggedAssetId
            );

            if (draggedIndex !== -1) {
              previewAssets = [...currentAssets];
              const [draggedAsset] = previewAssets.splice(draggedIndex, 1);
              previewAssets.splice(targetIndex, 0, draggedAsset);
            } else {
              previewAssets = currentAssets;
            }
          }

          setDragPreview(previewAssets);
          setDragInsertPosition(targetIndex);
        }

        row.style.backgroundColor = isDraggingGroup
          ? "rgba(34, 197, 94, 0.1)"
          : "rgba(59, 130, 246, 0.1)";
        row.style.borderTop = isDraggingGroup
          ? "3px solid #22c55e"
          : "2px solid #3b82f6";
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Remove visual feedback
    const target = e.target as HTMLElement;
    const row = target.closest("tr");
    if (row) {
      row.style.backgroundColor = "";
      row.style.borderTop = "";
    }

    // Clear preview if leaving the table area entirely
    const table = target.closest("table");
    if (!table && dragPreview.length > 0) {
      setDragPreview([]);
      setDragInsertPosition(-1);
    }
  };

  const handleDragEnd = () => {
    // Clean up all visual feedback for all rows
    const allRows = document.querySelectorAll("tr");
    allRows.forEach((row) => {
      (row as HTMLElement).style.transform = "";
      (row as HTMLElement).style.boxShadow = "";
      (row as HTMLElement).style.backgroundColor = "";
      (row as HTMLElement).style.borderTop = "";
    });

    setDraggedAssetId(null);
    setDraggedAssets(new Set());
    setIsDraggingGroup(false);
    setDragPreview([]);
    setDragInsertPosition(-1);
  };

  const handleDrop = async (e: React.DragEvent, targetAssetId: string) => {
    // Don't allow dropping on a dragged asset
    if (draggedAssets.has(targetAssetId)) return;

    // For single asset drops, check if we have a dragged asset
    if (!isDraggingGroup && !draggedAssetId) return;

    e.preventDefault();

    // Set flag to prevent filter effects from interfering
    setIsManuallyReordering(true);

    // Clean up visual feedback
    const allRows = document.querySelectorAll("tr");
    allRows.forEach((row) => {
      (row as HTMLElement).style.backgroundColor = "";
      (row as HTMLElement).style.borderTop = "";
    });

    try {
      const currentAssets = [...filtered];
      const targetIndex = currentAssets.findIndex(
        (asset) => asset.id === targetAssetId
      );

      if (targetIndex === -1) return;

      let reorderedAssets: any[];

      if (isDraggingGroup && draggedAssets.size > 1) {
        // Group movement - calculate proper insertion point
        const draggedAssetObjects = currentAssets.filter((asset) =>
          draggedAssets.has(asset.id)
        );
        const nonDraggedAssets = currentAssets.filter(
          (asset) => !draggedAssets.has(asset.id)
        );

        // Calculate the correct target index in the non-dragged array
        let adjustedTargetIndex = 0;
        for (let i = 0; i < targetIndex; i++) {
          if (!draggedAssets.has(currentAssets[i].id)) {
            adjustedTargetIndex++;
          }
        }

        // Insert the group at the adjusted target position
        reorderedAssets = [
          ...nonDraggedAssets.slice(0, adjustedTargetIndex),
          ...draggedAssetObjects,
          ...nonDraggedAssets.slice(adjustedTargetIndex),
        ];

        toast.success(
          `Successfully moved ${draggedAssets.size} assets as a group`
        );
      } else {
        // Single asset movement
        const draggedIndex = currentAssets.findIndex(
          (asset) => asset.id === draggedAssetId
        );

        if (draggedIndex === -1) return;

        reorderedAssets = [...currentAssets];
        const [draggedAsset] = reorderedAssets.splice(draggedIndex, 1);
        reorderedAssets.splice(targetIndex, 0, draggedAsset);

        toast.success("Asset reordered successfully");
      }

      // Update filtered state immediately for instant visual feedback
      const reorderedWithOrder = reorderedAssets.map((asset, index) => ({
        ...asset,
        upload_order: index + 1,
      }));

      // Store the manual order for reference
      lastManualOrderRef.current = reorderedWithOrder.map((asset) => asset.id);

      // Update both states synchronously to prevent race conditions
      setFiltered([...reorderedWithOrder]);

      // Update assets state with the same reordered data
      setAssets((prevAssets) => {
        // Create a completely new assets array with the reordered items
        const reorderedAssetIds = new Set(reorderedAssets.map((a) => a.id));
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const nonReorderedAssets = prevAssets.filter(
          (asset) => !reorderedAssetIds.has(asset.id)
        );

        // Replace reordered assets with their new positions
        const updatedAssets = [...prevAssets];
        reorderedAssets.forEach((reorderedAsset, index) => {
          const assetIndex = updatedAssets.findIndex(
            (a) => a.id === reorderedAsset.id
          );
          if (assetIndex !== -1) {
            updatedAssets[assetIndex] = {
              ...reorderedAsset,
              upload_order: index + 1,
            };
          }
        });

        return [...updatedAssets];
      });

      // Update upload_order for all affected assets in database (async, no need to wait)
      const updates = reorderedAssets.map((asset, index) => ({
        id: asset.id,
        upload_order: index + 1,
      }));

      // Fire and forget - don't wait for response
      fetch("/api/assets/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      }).catch((error) => {
        console.error("Error updating database:", error);
        // Silently fail - user already sees the change
      });
    } catch (error) {
      console.error("Error reordering assets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder assets"
      );
    } finally {
      setDraggedAssetId(null);
      setDraggedAssets(new Set());
      setIsDraggingGroup(false);
      setDragPreview([]);
      setDragInsertPosition(-1);

      // Reset the manual reordering flag after state updates complete
      setTimeout(() => setIsManuallyReordering(false), 50);
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4 mb-2 sm:mb-6">
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
                setStatusFilters(["in_progress"]);
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
                    {statusTotals.totals.in_production}
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

            {/* Client Revision */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["client_revision"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "rgb(254 226 226)" }}
                >
                  <RotateCcw
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "rgb(220 38 38)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Client Revision
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "rgb(220 38 38)" }}
                  >
                    {statusTotals.totals.client_revision}
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

            {/* Not Started */}
            <Card
              className="p-2 sm:p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["not_started"]);
                setPage(1);
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div
                  className="p-1 sm:p-2 rounded-lg"
                  style={{ backgroundColor: "rgb(243 244 246)" }}
                >
                  <Clock
                    className="h-3 w-3 sm:h-5 sm:w-5"
                    style={{ color: "rgb(107 114 128)" }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Not Started
                  </p>
                  <p
                    className="text-sm sm:text-2xl font-bold"
                    style={{ color: "rgb(107 114 128)" }}
                  >
                    {statusTotals.totals.not_started}
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
                  "unallocated",
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
              <div className="w-full sm:w-auto flex gap-2">
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
                  className="flex items-center gap-1 sm:gap-2 bg-primary/90  text-primary-foreground w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                >
                  <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Allocate</span>
                  <span className="sm:hidden">Advanced</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="flex items-center gap-1 sm:gap-2 bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                >
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Mark as Approved</span>
                  <span className="sm:hidden">Approved</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFixStuckDialog(true)}
                  className="flex items-center gap-1 sm:gap-2 bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                >
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Fix Stuck Assets</span>
                  <span className="sm:hidden">Fix</span>
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
            {/* Bulk Reallocation Controls */}
            {paged.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Selected: {selectedAssetsForReallocation.size} assets
                    </span>
                    {selectedAssetsForReallocation.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAssetSelections}
                        className="h-8 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  {selectedAssetsForReallocation.size > 0 && (
                    <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-lg">
                      <Euro className="h-4 w-4" />
                      <span>
                        Total: €
                        {(() => {
                          let total = 0;
                          allocationLists.forEach((list) => {
                            list.asset_assignments.forEach(
                              (assignment: any) => {
                                if (
                                  selectedAssetsForReallocation.has(
                                    assignment.onboarding_assets.id
                                  )
                                ) {
                                  total +=
                                    assignment.onboarding_assets.price || 0;
                                }
                              }
                            );
                          });
                          return total.toFixed(2);
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllAssetsForReallocation}
                    className="h-8 px-2 text-xs"
                  >
                    Select All
                  </Button>
                  {selectedAssetsForReallocation.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkReallocationDialog(true)}
                      className="h-8 px-2 text-xs"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Reallocate ({selectedAssetsForReallocation.size})
                    </Button>
                  )}
                </div>
              </div>
            )}
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4">
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
                          <p className="text-lg sm:text-2xl font-medium text-success">
                            €{stats.totalPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                            Total w/ Bonus
                          </p>
                          <p className="text-lg sm:text-2xl font-medium text-primary">
                            €{stats.potentialEarnings.toFixed(2)}
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
                      <CardContent
                        className="p-4 sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8 text-xs sm:text-sm text-left">
                                  <Checkbox
                                    checked={
                                      selectedAssetsForReallocation.size > 0 &&
                                      list.asset_assignments.every(
                                        (assignment: any) =>
                                          selectedAssetsForReallocation.has(
                                            assignment.onboarding_assets.id
                                          )
                                      )
                                    }
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        // Select all assets in this list
                                        const assetIds =
                                          list.asset_assignments.map(
                                            (assignment: any) =>
                                              assignment.onboarding_assets.id
                                          );
                                        setSelectedAssetsForReallocation(
                                          (prev) => {
                                            const next = new Set(prev);
                                            assetIds.forEach((id: string) =>
                                              next.add(id)
                                            );
                                            return next;
                                          }
                                        );
                                      } else {
                                        // Deselect all assets in this list
                                        const assetIds =
                                          list.asset_assignments.map(
                                            (assignment: any) =>
                                              assignment.onboarding_assets.id
                                          );
                                        setSelectedAssetsForReallocation(
                                          (prev) => {
                                            const next = new Set(prev);
                                            assetIds.forEach((id: string) =>
                                              next.delete(id)
                                            );
                                            return next;
                                          }
                                        );
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableHead>
                                <TableHead className="text-xs sm:text-sm text-left">
                                  Product Name
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm text-left">
                                  Article ID
                                </TableHead>
                                <TableHead className="w-24 text-xs sm:text-sm text-left">
                                  Priority
                                </TableHead>
                                <TableHead className="w-24 text-xs sm:text-sm text-left">
                                  Price
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm text-left">
                                  Status
                                </TableHead>
                                <TableHead className="w-32 text-xs sm:text-sm text-left">
                                  References
                                </TableHead>
                                <TableHead className="w-40 text-xs sm:text-sm text-left">
                                  Product Link
                                </TableHead>
                                <TableHead className="w-12 text-xs sm:text-sm text-left">
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
                                  <TableCell className="text-left">
                                    <Checkbox
                                      checked={selectedAssetsForReallocation.has(
                                        assignment.onboarding_assets.id
                                      )}
                                      onCheckedChange={() =>
                                        toggleAssetSelection(
                                          assignment.onboarding_assets.id
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </TableCell>
                                  <TableCell className="text-left">
                                    <div
                                      className="font-medium cursor-help text-sm sm:text-base"
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
                                  <TableCell className="text-left">
                                    <span className="font-mono text-xs sm:text-sm">
                                      {assignment.onboarding_assets.article_id}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-left">
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
                                  <TableCell className="text-left">
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-sm sm:text-base">
                                        €
                                        {assignment.onboarding_assets.price?.toFixed(
                                          2
                                        ) || "0.00"}
                                      </span>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 hover:bg-muted"
                                          >
                                            <StickyNote
                                              className={`h-3 w-3 ${
                                                pricingComments[
                                                  assignment.onboarding_assets
                                                    .id
                                                ]
                                                  ? "text-blue-600 hover:text-blue-700"
                                                  : "text-muted-foreground hover:text-foreground"
                                              }`}
                                            />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-3">
                                          <div className="space-y-3">
                                            <h4 className="font-medium text-sm">
                                              Pricing Note
                                            </h4>
                                            <Textarea
                                              placeholder="Add pricing note..."
                                              value={
                                                pricingComments[
                                                  assignment.onboarding_assets
                                                    .id
                                                ] || ""
                                              }
                                              onChange={(e) => {
                                                setPricingComments((prev) => ({
                                                  ...prev,
                                                  [assignment.onboarding_assets
                                                    .id]: e.target.value,
                                                }));
                                              }}
                                              onBlur={() => {
                                                if (
                                                  pricingComments[
                                                    assignment.onboarding_assets
                                                      .id
                                                  ] !== undefined
                                                ) {
                                                  handlePricingCommentUpdate(
                                                    assignment.onboarding_assets
                                                      .id,
                                                    pricingComments[
                                                      assignment
                                                        .onboarding_assets.id
                                                    ]
                                                  );
                                                }
                                              }}
                                              className="min-h-[60px] max-h-[120px] resize-none text-xs"
                                              rows={3}
                                            />
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-left">
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
                                                .status === "revisions" ||
                                              assignment.onboarding_assets
                                                .status === "client_revision"
                                            ? "Sent for Revision"
                                            : assignment.onboarding_assets
                                                .status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-left">
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
                                          Ref
                                        </span>
                                        <span className="sm:hidden"> </span>
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
                                      </Button>
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-left">
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

                                  <TableCell className="text-left">
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
                  <TableHead className="text-xs sm:text-sm text-left">
                    Model Name
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-left">
                    Article ID
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Modeler
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Client
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Batch
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    References
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Product Link
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Price
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm text-center">
                    Review
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center">
                      No assets found for this QA reviewer.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className={`${getStatusRowClass(asset.status)} transition-all duration-200 ease-in-out ${draggedAssetId === asset.id ? "opacity-50 scale-105" : ""}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, asset.id)}
                      style={{
                        transition: "all 0.2s ease-in-out",
                        transform:
                          draggedAssetId === asset.id
                            ? "rotate(2deg) scale(1.02)"
                            : undefined,
                        boxShadow:
                          draggedAssetId === asset.id
                            ? "0 8px 16px rgba(0,0,0,0.2)"
                            : undefined,
                      }}
                    >
                      <TableCell className="text-left">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex flex-col gap-0.5 cursor-move group"
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, asset.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <span
                              className="font-medium  cursor-help text-sm sm:text-base"
                              title={asset.product_name}
                            >
                              {asset.product_name.length > 35
                                ? asset.product_name.substring(0, 35) + "..."
                                : asset.product_name}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left text-xs sm:text-sm font-mono">
                        {asset.article_id}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {asset.modeler_email?.split("@")[0] || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-muted-foreground">
                          {asset.client}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-muted-foreground">
                          B{asset.batch}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
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
                      <TableCell className="text-center">
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Select
                            value={assetPrices[asset.id]?.pricingOptionId || ""}
                            onValueChange={(value) => {
                              if (value === "custom_pricing") {
                                // Don't auto-update for custom pricing, let user set the price
                                setAssetPrices((prev) => ({
                                  ...prev,
                                  [asset.id]: {
                                    pricingOptionId: value,
                                    price: 0,
                                  },
                                }));
                              } else {
                                const option = getPricingOptionById(value);
                                if (option) {
                                  handlePriceUpdate(
                                    asset.id,
                                    value,
                                    option.price
                                  );
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs ">
                              <SelectValue placeholder="Set price" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRICING_OPTIONS.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  <div className="flex items-center gap-2 text-left">
                                    <Euro className="h-3 w-3" />
                                    {option.label} - €{option.price}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {assetPrices[asset.id]?.pricingOptionId ===
                            "custom_pricing" &&
                          !assetPrices[asset.id]?.price ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={customPrices[asset.id] || ""}
                                onChange={(e) =>
                                  handleCustomPriceChange(
                                    asset.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    !settingPrices.has(asset.id)
                                  ) {
                                    handleCustomPriceSubmit(asset.id);
                                  }
                                }}
                                disabled={settingPrices.has(asset.id)}
                                className="w-16 h-8 text-xs px-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="€0"
                                min="0"
                                step="0.01"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs"
                                onClick={() =>
                                  handleCustomPriceSubmit(asset.id)
                                }
                                disabled={settingPrices.has(asset.id)}
                              >
                                {settingPrices.has(asset.id) ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                ) : (
                                  "Set"
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {assetPrices[asset.id] && (
                                <span className="text-xs font-medium">
                                  €{assetPrices[asset.id].price}
                                </span>
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                  >
                                    <StickyNote
                                      className={`h-3 w-3 ${
                                        pricingComments[asset.id]
                                          ? "text-blue-600 hover:text-blue-700"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3">
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm">
                                      Pricing Note
                                    </h4>
                                    <Textarea
                                      placeholder="Add pricing note..."
                                      value={pricingComments[asset.id] || ""}
                                      onChange={(e) => {
                                        setPricingComments((prev) => ({
                                          ...prev,
                                          [asset.id]: e.target.value,
                                        }));
                                      }}
                                      onBlur={() => {
                                        if (
                                          pricingComments[asset.id] !==
                                          undefined
                                        ) {
                                          handlePricingCommentUpdate(
                                            asset.id,
                                            pricingComments[asset.id]
                                          );
                                        }
                                      }}
                                      className="min-h-[60px] max-h-[120px] resize-none text-xs"
                                      rows={3}
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Regular Assets View
          <div className="space-y-4">
            {/* Multi-selection helper */}

            {/* Drag preview indicator */}
            {dragPreview.length > 0 && draggedAssets.size > 0 && (
              <div className="fixed top-20 right-4 z-50 pointer-events-none">
                <div
                  className={`p-3 rounded-lg shadow-lg border-2 ${
                    isDraggingGroup
                      ? "bg-green-100 border-green-500 text-green-800"
                      : "bg-blue-100 border-blue-500 text-blue-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4" />
                    <span className="font-medium">
                      {isDraggingGroup
                        ? `Moving ${draggedAssets.size} assets as group`
                        : "Moving 1 asset"}
                    </span>
                  </div>
                  {dragInsertPosition !== -1 && (
                    <div className="text-xs mt-1 opacity-75">
                      Drop position: {dragInsertPosition + 1}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-background flex-1 max-h-[67vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 sm:w-12 text-left">
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
                    <TableHead className="text-xs sm:text-sm text-left">
                      Model Name
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Article ID
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      Priority
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      References
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      Product Link
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      Price
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-center">
                      Review
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
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
                                  No assets for client:{" "}
                                  {clientFilters.join(", ")}
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
                    (dragPreview.length > 0 ? dragPreview : paged).map(
                      (asset, index) => (
                        <TableRow
                          key={asset.id}
                          data-asset-id={asset.id}
                          className={`${getStatusRowClass(asset.status)} transition-all duration-200 ease-in-out ${
                            draggedAssets.has(asset.id)
                              ? "opacity-50 scale-98"
                              : ""
                          } ${
                            selected.has(asset.id) && selected.size > 1
                              ? "ring-2 ring-blue-200 bg-blue-50/50 dark:bg-blue-900/10"
                              : ""
                          } ${
                            dragPreview.length > 0 &&
                            index === dragInsertPosition
                              ? isDraggingGroup
                                ? "border-t-4 border-green-500 bg-green-50/30"
                                : "border-t-4 border-blue-500 bg-blue-50/30"
                              : ""
                          } ${
                            dragPreview.length > 0 &&
                            draggedAssets.has(asset.id)
                              ? isDraggingGroup
                                ? "bg-green-100/50 border-green-300"
                                : "bg-blue-100/50 border-blue-300"
                              : ""
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, asset.id)}
                          style={{
                            transition: "all 0.2s ease-in-out",
                            transform: draggedAssets.has(asset.id)
                              ? "rotate(1deg) scale(0.98)"
                              : undefined,
                            boxShadow: draggedAssets.has(asset.id)
                              ? "0 8px 16px rgba(59, 130, 246, 0.3)"
                              : undefined,
                          }}
                        >
                          <TableCell className="text-left">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex flex-col gap-0.5 cursor-move group"
                                draggable={true}
                                onDragStart={(e) =>
                                  handleDragStart(e, asset.id)
                                }
                                onDragEnd={handleDragEnd}
                              >
                                <GripVertical className="h-3 w-3 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                              </div>
                              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 flex-1">
                                <div
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleSelect(asset.id, event);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Checkbox
                                    checked={selected.has(asset.id)}
                                    onCheckedChange={() => {}}
                                    className="h-4 w-4 pointer-events-none"
                                  />
                                </div>
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
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex flex-col gap-1">
                              <span
                                className="font-medium truncate cursor-help text-sm sm:text-base"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 35
                                  ? asset.product_name.substring(0, 35) + "..."
                                  : asset.product_name}
                              </span>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {annotationCounts[asset.id] || 0} annotations
                                </span>
                                <span className="text-xs text-slate-500 hidden sm:inline">
                                  •
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {commentCounts[asset.id] || 0} comments
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
                          <TableCell className="text-left text-xs sm:text-sm font-mono">
                            {asset.article_id}
                          </TableCell>
                          <TableCell className="text-center">
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
                                <SelectItem
                                  className="cursor-pointer"
                                  value="1"
                                >
                                  High
                                </SelectItem>
                                <SelectItem
                                  className="cursor-pointer"
                                  value="2"
                                >
                                  Medium
                                </SelectItem>
                                <SelectItem
                                  className="cursor-pointer"
                                  value="3"
                                >
                                  Low
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 sm:gap-2">
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
                                  const allRefs = parseReferences(
                                    asset.reference
                                  );
                                  return (
                                    allRefs.length + (asset.glb_link ? 1 : 0)
                                  );
                                })()}
                                <span className="hidden sm:inline">)</span>
                                <span className="sm:hidden">)</span>
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
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

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Select
                                value={
                                  assetPrices[asset.id]?.pricingOptionId || ""
                                }
                                onValueChange={(value) => {
                                  if (value === "custom_pricing") {
                                    // Don't auto-update for custom pricing, let user set the price
                                    setAssetPrices((prev) => ({
                                      ...prev,
                                      [asset.id]: {
                                        pricingOptionId: value,
                                        price: 0,
                                      },
                                    }));
                                  } else {
                                    const option = getPricingOptionById(value);
                                    if (option) {
                                      handlePriceUpdate(
                                        asset.id,
                                        value,
                                        option.price
                                      );
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="w-32 h-8 text-xs border-none shadow-none hover:bg-muted cursor-pointer">
                                  <SelectValue placeholder="Set price" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRICING_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.id}
                                      value={option.id}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Euro className="h-3 w-3" />
                                        {option.label} - €{option.price}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {assetPrices[asset.id]?.pricingOptionId ===
                                "custom_pricing" &&
                              !assetPrices[asset.id]?.price ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={customPrices[asset.id] || ""}
                                    onChange={(e) =>
                                      handleCustomPriceChange(
                                        asset.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Enter" &&
                                        !settingPrices.has(asset.id)
                                      ) {
                                        handleCustomPriceSubmit(asset.id);
                                      }
                                    }}
                                    disabled={settingPrices.has(asset.id)}
                                    className="w-16 h-8 text-xs px-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="€0"
                                    min="0"
                                    step="0.01"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 text-xs"
                                    onClick={() =>
                                      handleCustomPriceSubmit(asset.id)
                                    }
                                    disabled={settingPrices.has(asset.id)}
                                  >
                                    {settingPrices.has(asset.id) ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                    ) : (
                                      "Set"
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {assetPrices[asset.id] && (
                                    <span className="text-xs font-medium">
                                      €{assetPrices[asset.id].price}
                                    </span>
                                  )}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 hover:bg-muted"
                                      >
                                        <StickyNote
                                          className={`h-3 w-3 ${
                                            pricingComments[asset.id]
                                              ? "text-blue-600 hover:text-blue-700"
                                              : "text-muted-foreground hover:text-foreground"
                                          }`}
                                        />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-3">
                                      <div className="space-y-3">
                                        <h4 className="font-medium text-sm">
                                          Pricing Note
                                        </h4>
                                        <Textarea
                                          placeholder="Add pricing note..."
                                          value={
                                            pricingComments[asset.id] || ""
                                          }
                                          onChange={(e) => {
                                            setPricingComments((prev) => ({
                                              ...prev,
                                              [asset.id]: e.target.value,
                                            }));
                                          }}
                                          onBlur={() => {
                                            if (
                                              pricingComments[asset.id] !==
                                              undefined
                                            ) {
                                              handlePricingCommentUpdate(
                                                asset.id,
                                                pricingComments[asset.id]
                                              );
                                            }
                                          }}
                                          className="min-h-[60px] max-h-[120px] resize-none text-xs"
                                          rows={3}
                                        />
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10"
                                onClick={() => {
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
                                    params.set("batch", batchFilters.join(","));
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
                                      Are you sure you want to delete this
                                      asset? This action cannot be undone and
                                      will permanently delete:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>The asset itself</li>
                                        <li>All assignments and comments</li>
                                        <li>All revision history</li>
                                        <li>All QA approvals</li>
                                        <li>
                                          Any empty allocation lists (only if
                                          this was the last asset in the list)
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
                      )
                    )
                  )}
                </TableBody>
              </Table>
            </div>
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

      {/* Allocation Dialog */}
      <Dialog
        open={showAllocationDialog}
        onOpenChange={setShowAllocationDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Allocate Assets
            </DialogTitle>
            <DialogDescription>
              Allocate {selected.size} selected asset(s) to a modeler
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Modeler Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Modeler
              </label>
              <Select
                value={selectedModeler}
                onValueChange={setSelectedModeler}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose modeler" />
                </SelectTrigger>
                <SelectContent>
                  {modelers.map((modeler) => (
                    <SelectItem key={modeler.id} value={modeler.id}>
                      {modeler.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Deadline
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(allocationDeadline), "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(allocationDeadline)}
                    onSelect={(date) => {
                      setAllocationDeadline(
                        format(date || new Date(), "yyyy-MM-dd")
                      );
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Bonus */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Bonus (%)
              </label>
              <Input
                type="number"
                placeholder="15"
                value={allocationBonus === 0 ? "" : allocationBonus}
                onChange={(e) => {
                  const value = e.target.value;
                  setAllocationBonus(value === "" ? 0 : parseInt(value) || 0);
                }}
              />
            </div>

            {/* Selected Assets Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Selected Assets
              </label>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm space-y-1">
                  <p>Total Selected: {selected.size}</p>
                  <p>
                    Assets with Pricing:{" "}
                    {
                      filtered.filter(
                        (asset) =>
                          selected.has(asset.id) &&
                          asset.pricing_option_id &&
                          asset.price &&
                          asset.price > 0
                      ).length
                    }
                  </p>
                  {filtered.filter(
                    (asset) =>
                      selected.has(asset.id) &&
                      (!asset.pricing_option_id ||
                        !asset.price ||
                        asset.price <= 0)
                  ).length > 0 && (
                    <p className="text-amber-600 text-xs">
                      ⚠️ Some assets don&apos;t have pricing and will be
                      excluded
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAllocationDialog(false)}
              disabled={allocating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAllocateAssets}
              disabled={!selectedModeler || selected.size === 0 || allocating}
              className="flex items-center gap-2"
            >
              {allocating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Allocating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Allocate Assets
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reallocation Dialog */}
      <Dialog
        open={showReallocationDialog}
        onOpenChange={setShowReallocationDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reallocate Asset
            </DialogTitle>
            <DialogDescription>
              Reallocate &apos;{selectedAssetForReallocation?.product_name}
              &apos; to a different modeler
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Asset Info */}
            {selectedAssetForReallocation && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Product:</strong>{" "}
                    {selectedAssetForReallocation.product_name}
                  </p>
                  <p>
                    <strong>Article ID:</strong>{" "}
                    {selectedAssetForReallocation.article_id}
                  </p>
                  <p>
                    <strong>Current Price:</strong> €
                    {selectedAssetForReallocation.price?.toFixed(2) ||
                      "Not set"}
                  </p>
                  {(!selectedAssetForReallocation.pricing_option_id ||
                    !selectedAssetForReallocation.price ||
                    selectedAssetForReallocation.price <= 0) && (
                    <p className="text-amber-600 text-xs">
                      ⚠️ No pricing set - cannot reallocate
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Modeler Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                New Modeler
              </label>
              <Select
                value={reallocationModeler}
                onValueChange={setReallocationModeler}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose new modeler" />
                </SelectTrigger>
                <SelectContent>
                  {modelers.map((modeler) => (
                    <SelectItem key={modeler.id} value={modeler.id}>
                      {modeler.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                New Deadline
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(reallocationDeadline), "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(reallocationDeadline)}
                    onSelect={(date) => {
                      setReallocationDeadline(
                        format(date || new Date(), "yyyy-MM-dd")
                      );
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Bonus */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Bonus (%)
              </label>
              <Input
                type="number"
                placeholder="15"
                value={reallocationBonus === 0 ? "" : reallocationBonus}
                onChange={(e) => {
                  const value = e.target.value;
                  setReallocationBonus(value === "" ? 0 : parseInt(value) || 0);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReallocationDialog(false)}
              disabled={reallocating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReallocateAsset}
              disabled={
                !reallocationModeler ||
                !selectedAssetForReallocation ||
                !selectedAssetForReallocation.pricing_option_id ||
                !selectedAssetForReallocation.price ||
                selectedAssetForReallocation.price <= 0 ||
                reallocating
              }
              className="flex items-center gap-2"
            >
              {reallocating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Reallocating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Reallocate Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reallocation Dialog */}
      <Dialog
        open={showBulkReallocationDialog}
        onOpenChange={setShowBulkReallocationDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reallocate Assets
            </DialogTitle>
            <DialogDescription>
              Reallocate {selectedAssetsForReallocation.size} selected asset(s)
              to a different modeler
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected Assets Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <p>
                  <strong>Selected Assets:</strong>{" "}
                  {selectedAssetsForReallocation.size}
                </p>
                <p>
                  <strong>Assets with Pricing:</strong>{" "}
                  {(() => {
                    const allAssets: any[] = [];
                    allocationLists.forEach((list) => {
                      list.asset_assignments.forEach((assignment: any) => {
                        allAssets.push(assignment.onboarding_assets);
                      });
                    });
                    return allAssets.filter(
                      (asset) =>
                        selectedAssetsForReallocation.has(asset.id) &&
                        asset.pricing_option_id &&
                        asset.price &&
                        asset.price > 0
                    ).length;
                  })()}
                </p>
                {(() => {
                  const allAssets: any[] = [];
                  allocationLists.forEach((list) => {
                    list.asset_assignments.forEach((assignment: any) => {
                      allAssets.push(assignment.onboarding_assets);
                    });
                  });
                  const assetsWithoutPricing = allAssets.filter(
                    (asset) =>
                      selectedAssetsForReallocation.has(asset.id) &&
                      (!asset.pricing_option_id ||
                        !asset.price ||
                        asset.price <= 0)
                  );
                  return (
                    assetsWithoutPricing.length > 0 && (
                      <p className="text-amber-600 text-xs">
                        ⚠️ {assetsWithoutPricing.length} asset(s) don&apos;t
                        have pricing and will be excluded
                      </p>
                    )
                  );
                })()}
              </div>
            </div>

            {/* Modeler Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                New Modeler
              </label>
              <Select
                value={bulkReallocationModeler}
                onValueChange={setBulkReallocationModeler}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose new modeler" />
                </SelectTrigger>
                <SelectContent>
                  {modelers.map((modeler) => (
                    <SelectItem key={modeler.id} value={modeler.id}>
                      {modeler.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                New Deadline
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(bulkReallocationDeadline), "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(bulkReallocationDeadline)}
                    onSelect={(date) => {
                      setBulkReallocationDeadline(
                        format(date || new Date(), "yyyy-MM-dd")
                      );
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Bonus */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Bonus (%)
              </label>
              <Input
                type="number"
                placeholder="15"
                value={bulkReallocationBonus === 0 ? "" : bulkReallocationBonus}
                onChange={(e) => {
                  const value = e.target.value;
                  setBulkReallocationBonus(
                    value === "" ? 0 : parseInt(value) || 0
                  );
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkReallocationDialog(false)}
              disabled={bulkReallocating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkReallocateAssets}
              disabled={
                !bulkReallocationModeler ||
                selectedAssetsForReallocation.size === 0 ||
                bulkReallocating
              }
              className="flex items-center gap-2"
            >
              {bulkReallocating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Reallocating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Reallocate {selectedAssetsForReallocation.size} Assets
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog
        open={showBulkStatusDialog}
        onOpenChange={setShowBulkStatusDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Mark Assets as Approved by Client
            </DialogTitle>
            <DialogDescription>
              Update {selected.size} selected asset(s) to
              &quot;approved_by_client&quot; status
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-800 dark:text-green-200">
                    Confirm Status Update
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    This will mark all selected assets as approved by the
                    client. This action will trigger the automatic transfer to
                    the assets table.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Selected Assets ({selected.size})</h4>
              <div className="max-h-32 overflow-y-auto border rounded-lg p-3 bg-muted/50">
                <div className="space-y-1">
                  {Array.from(selected)
                    .slice(0, 5)
                    .map((assetId) => {
                      const asset = assets.find((a) => a.id === assetId);
                      return asset ? (
                        <div
                          key={assetId}
                          className="text-sm font-mono text-slate-700 dark:text-slate-300"
                        >
                          {asset.article_id} - {asset.product_name}
                        </div>
                      ) : null;
                    })}
                  {selected.size > 5 && (
                    <div className="text-sm text-slate-500">
                      ... and {selected.size - 5} more assets
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkStatusDialog(false)}
              disabled={bulkStatusUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusUpdate}
              disabled={selected.size === 0 || bulkStatusUpdating}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {bulkStatusUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Mark as Approved ({selected.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Stuck Assets Dialog */}
      <Dialog open={showFixStuckDialog} onOpenChange={setShowFixStuckDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Fix Stuck Assets
            </DialogTitle>
            <DialogDescription>
              Fix selected assets that are stuck in
              &quot;approved_by_client&quot; status and transfer them to the
              assets table
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-3">
                <RotateCcw className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                    Fix Stuck Assets
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    This will find and fix selected assets that are stuck in
                    &quot;approved_by_client&quot; status but haven&apos;t been
                    transferred to the assets table. They will be processed
                    through the complete API to trigger the auto-transfer.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">
                Selected Assets: {selected.size} | Stuck Assets:{" "}
                {stuckAssetsCount}
              </h4>
              <div className="text-sm text-muted-foreground">
                {selected.size === 0 ? (
                  <span className="text-red-600">
                    ❌ Please select assets first
                  </span>
                ) : stuckAssetsCount === 0 ? (
                  <span className="text-green-600">
                    ✅ No stuck assets found in selection!
                  </span>
                ) : (
                  <span className="text-orange-600">
                    ⚠️ Found {stuckAssetsCount} stuck assets in your selection
                    that need to be fixed
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFixStuckDialog(false)}
              disabled={fixingStuckAssets}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFixStuckAssets}
              disabled={
                selected.size === 0 ||
                stuckAssetsCount === 0 ||
                fixingStuckAssets
              }
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {fixingStuckAssets ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Fixing...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Fix {stuckAssetsCount} Stuck Assets
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
