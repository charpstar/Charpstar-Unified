"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { getPriorityLabel } from "@/lib/constants";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/interactive";
import {
  Search,
  Filter,
  Package,
  Clock,
  CheckCircle,
  RotateCcw,
  Eye,
  Calendar,
  Building,
  ArrowLeft,
  Download,
  Upload,
  Image,
  Euro,
  X,
  FileText,
  Link2,
  ChevronDown,
  Target,
  StickyNote,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { notificationService } from "@/lib/notificationService";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";

interface BatchAsset {
  id: string;
  product_name: string;
  article_id: string;
  status: string;
  priority: number;
  category: string;
  subcategory: string;
  client: string;
  batch: number;
  delivery_date: string | null;
  deadline: string | null;
  created_at: string;
  revision_count: number;
  glb_link: string | null;
  product_link: string | null;
  reference: string[] | null;
  price?: number;
  bonus?: number;
  allocation_list_id?: string;
  pricing_comment?: string;
  qa_team_handles_model?: boolean;
  pricing_option_id?: string;
}

interface AllocationList {
  id: string;
  name: string;
  number: number;
  deadline: string;
  bonus: number;
  status: string;
  created_at: string;
  correction_amount?: number;
  assets: BatchAsset[];
}

interface BatchStats {
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
  waitingForApprovalAssets: number;
  completionPercentage: number;
  totalBaseEarnings: number;
  totalBonusEarnings: number;
  totalPotentialEarnings: number;
  completedEarnings: number;
  pendingEarnings: number;
  averageAssetPrice: number;
}

interface AssetFileHistory {
  assetId: string;
  previousModelerId: string;
  previousModelerName: string;
  files: {
    glb_link?: string;
    reference?: string[];
    other_files?: string[];
  };
}

// Helper function to check if deadline is overdue
const isOverdue = (deadline: string) => {
  return new Date(deadline) < new Date();
};

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const client = decodeURIComponent(params.client as string);
  const batch = parseInt(params.batch as string);
  const filter = searchParams?.get("filter");

  const [allocationLists, setAllocationLists] = useState<AllocationList[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<BatchAsset[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    totalAssets: 0,
    completedAssets: 0,
    inProgressAssets: 0,
    pendingAssets: 0,
    revisionAssets: 0,
    waitingForApprovalAssets: 0,
    completionPercentage: 0,
    totalBaseEarnings: 0,
    totalBonusEarnings: 0,
    totalPotentialEarnings: 0,
    completedEarnings: 0,
    pendingEarnings: 0,
    averageAssetPrice: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortBy, setSortBy] = useState<
    "priority" | "name" | "status" | "article_id"
  >("priority");

  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadingGLB, setUploadingGLB] = useState<string | null>(null);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentReferences, setCurrentReferences] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentAssetName, setCurrentAssetName] = useState("");

  // Upload dialog states
  const [glbUploadDialogOpen, setGlbUploadDialogOpen] = useState(false);
  const [assetUploadDialogOpen, setAssetUploadDialogOpen] = useState(false);
  const [currentUploadAsset, setCurrentUploadAsset] =
    useState<BatchAsset | null>(null);
  const [uploadType, setUploadType] = useState<"glb" | "asset">("glb");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [assetFileHistory, setAssetFileHistory] = useState<AssetFileHistory[]>(
    []
  );
  const [clientGuideUrls, setClientGuideUrls] = useState<string[]>([]);
  // Persisted expanded allocations in accordion
  const [expandedAllocations, setExpandedAllocations] = useState<string[]>([]);

  // Add Ref dialog state
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );

  // View Ref dialog state
  const [showViewRefDialog, setShowViewRefDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  useEffect(() => {
    document.title = `CharpstAR Platform - ${client} All Batches`;
  }, [client, batch]);

  // Load persisted expanded accordion state
  useEffect(() => {
    try {
      const storageKey = `myAssignmentsAccordion:${client}:${batch}`;
      const saved =
        typeof window !== "undefined"
          ? window.localStorage.getItem(storageKey)
          : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setExpandedAllocations(parsed.filter((v) => typeof v === "string"));
        }
      }
    } catch {}
  }, [client, batch]);

  useEffect(() => {
    if (user?.id && client && batch) {
      fetchBatchAssets();
    }
  }, [user?.id, client, batch]);

  // Fetch client guidelines link for this client
  useEffect(() => {
    const fetchClientGuide = async () => {
      try {
        // Try by name first, fetch both single guide and array of links
        let { data, error } = await supabase
          .from("clients")
          .select("client_guide, client_guide_links")
          .eq("name", client)
          .maybeSingle();
        // If not found, try by id as fallback
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            client as string
          );
        if ((!data || error) && client && isUuid) {
          const byId = await supabase
            .from("clients")
            .select("client_guide, client_guide_links")
            .eq("id", client)
            .maybeSingle();
          data = byId.data as any;
          error = byId.error as any;
        }
        if (error) {
          console.error("Error fetching client guide:", error);
        }
        const urls: string[] = [];
        if ((data as any)?.client_guide) urls.push((data as any).client_guide);
        if (Array.isArray((data as any)?.client_guide_links)) {
          urls.push(
            ...((data as any).client_guide_links as any[]).filter(
              (x) => typeof x === "string" && x
            )
          );
        }
        setClientGuideUrls(urls);
      } catch (e) {
        console.error("Failed to fetch client guide:", e);
      }
    };
    if (client) {
      fetchClientGuide();
    }
  }, [client]);

  // Mark relevant notifications as read when visiting this page
  useEffect(() => {
    const markPageNotificationsRead = async () => {
      if (!user?.id) return;
      try {
        const unread = await notificationService.getUnreadNotifications(
          user.id
        );
        const toMark = unread.filter(
          (n) => n.type === "asset_completed" || n.type === "status_change"
        );
        if (toMark.length > 0) {
          await Promise.all(
            toMark
              .filter((n) => n.id)
              .map((n) => notificationService.markNotificationAsRead(n.id!))
          );
          // notify bell to refresh immediately
          window.dispatchEvent(new Event("notificationsUpdated"));
        }
      } catch (e) {
        console.error(
          "Failed marking notifications as read on my-assignments",
          e
        );
      }
    };
    markPageNotificationsRead();
  }, [user?.id]);

  useEffect(() => {
    filterAndSortAssets();
  }, [allocationLists, searchTerm, statusFilter, filter]);

  // Check for previous modeler files when component mounts
  useEffect(() => {
    if (allocationLists.length > 0) {
      checkForPreviousModelerFiles();
    }
  }, [allocationLists]);

  // Keep expanded state in sync with available allocation ids
  useEffect(() => {
    if (!allocationLists?.length) return;
    const ids = new Set(allocationLists.map((a) => a.id));
    const filtered = expandedAllocations.filter((id) => ids.has(id));
    if (filtered.length !== expandedAllocations.length) {
      setExpandedAllocations(filtered);
      try {
        const storageKey = `myAssignmentsAccordion:${client}:${batch}`;
        window.localStorage.setItem(storageKey, JSON.stringify(filtered));
      } catch {}
    }
  }, [allocationLists, expandedAllocations, client, batch]);

  // Check for previous modeler files for re-allocated assets
  const checkForPreviousModelerFiles = async () => {
    try {
      const assetIds = allocationLists.flatMap((list) =>
        list.assets.map((asset) => asset.id)
      );

      if (assetIds.length === 0) return;

      // Get previous modeler assignments for these assets
      const { data: previousAssignments } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id
        `
        )
        .in("asset_id", assetIds)
        .eq("role", "modeler")
        .neq("user_id", user?.id)
        .order("start_time", { ascending: false });

      if (!previousAssignments || previousAssignments.length === 0) {
        setAssetFileHistory([]);
        return;
      }

      // Get asset details including files
      const { data: assetDetails } = await supabase
        .from("onboarding_assets")
        .select("id, glb_link, reference, product_link")
        .in("id", assetIds);

      // Get GLB upload history for these assets
      const { data: glbHistory, error: glbError } = await supabase
        .from("glb_upload_history")
        .select("asset_id, glb_url, file_name, uploaded_at")
        .in("asset_id", assetIds)
        .order("uploaded_at", { ascending: false });

      if (glbError) {
        console.error("Error fetching GLB history:", glbError);
      }

      // Get additional asset files if the table exists
      let assetFiles: any[] = [];
      try {
        const { data: filesData } = await supabase
          .from("asset_files")
          .select("asset_id, file_url, file_name, file_type")
          .in("asset_id", assetIds)
          .order("uploaded_at", { ascending: false });

        if (filesData) {
          assetFiles = filesData;
        }
      } catch {}

      // Create file history for assets with previous modelers
      const history: AssetFileHistory[] = [];

      for (const assignment of previousAssignments) {
        const asset = assetDetails?.find((a) => a.id === assignment.asset_id);
        if (
          asset &&
          (asset.glb_link || asset.reference?.length > 0 || asset.product_link)
        ) {
          const existingHistory = history.find(
            (h) => h.assetId === assignment.asset_id
          );
          if (!existingHistory) {
            const assetGlbHistory =
              glbHistory?.filter((h) => h.asset_id === assignment.asset_id) ||
              [];

            const assetAdditionalFiles =
              assetFiles?.filter((f) => f.asset_id === assignment.asset_id) ||
              [];

            history.push({
              assetId: assignment.asset_id,
              previousModelerId: assignment.user_id,
              previousModelerName: `User ${assignment.user_id.slice(0, 8)}...`,
              files: {
                glb_link: asset.glb_link,
                reference: asset.reference,
                other_files: [
                  ...(asset.product_link ? [asset.product_link] : []),
                  ...assetGlbHistory.map((h) => h.glb_url),
                  ...assetAdditionalFiles.map((f) => f.file_url),
                ],
              },
            });
          }
        }
      }

      setAssetFileHistory(history);
    } catch (error) {
      console.error("Error checking for previous modeler files:", error);
    }
  };

  // Handle file download
  const handleFileDownload = (url: string, fileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      window.open(url, "_blank");
    }
  };

  const fetchBatchAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // Get user's allocation lists for this specific client across ALL batches (only accepted assignments)
      const { data: allocationListsData } = await supabase
        .from("allocation_lists")
        .select(
          `
          id,
          name,
          number,
          deadline,
          bonus,
          status,
          created_at,
          correction_amount,
          asset_assignments!inner(
            asset_id,
            status,
            price,
            onboarding_assets!inner(
              id,
              product_name,
              article_id,
              status,
              priority,
              category,
              subcategory,
              client,
              batch,
              delivery_date,
              created_at,
              revision_count,
              glb_link,
              product_link,
              reference,
              pricing_comment,
              measurements,
              qa_team_handles_model,
              pricing_option_id
            )
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("asset_assignments.status", "accepted")
        .eq("asset_assignments.onboarding_assets.client", client);

      if (!allocationListsData || allocationListsData.length === 0) {
        toast.error("You don't have any assigned assets for this client");
        router.push("/my-assignments");
        return;
      }

      // Process allocation lists and their assets
      const processedLists: AllocationList[] = allocationListsData.map(
        (list) => {
          const assets = list.asset_assignments
            .map((assignment: any) => ({
              ...assignment.onboarding_assets,
              price: assignment.price,
              bonus: list.bonus,
              deadline: list.deadline,
              allocation_list_id: list.id,
              qa_team_handles_model: assignment.onboarding_assets.qa_team_handles_model,
              pricing_option_id: assignment.onboarding_assets.pricing_option_id,
            }))
            .filter(Boolean) as BatchAsset[];

          return {
            id: list.id,
            name: list.name,
            number: list.number,
            deadline: list.deadline,
            bonus: list.bonus,
            status: list.status,
            created_at: list.created_at,
            correction_amount: list.correction_amount || 0,
            assets,
          };
        }
      );

      setAllocationLists(processedLists);

      // Calculate batch statistics from all assets across all lists
      const allAssets = processedLists.flatMap((list) => list.assets);
      const totalAssets = allAssets.length;
      // Count assets that are approved by client (immediate earnings)
      const completedAssets = allAssets.filter(
        (asset) => asset.status === "approved_by_client"
      ).length;
      const inProgressAssets = allAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pendingAssets = allAssets.filter(
        (asset) => asset.status === "not_started"
      ).length;
      const revisionAssets = allAssets.filter(
        (asset) =>
          asset.status === "revisions" || asset.status === "client_revision"
      ).length;
      const waitingForApprovalAssets = allAssets.filter(
        (asset) => asset.status === "delivered_by_artist"
      ).length;

      // Calculate earnings statistics (exclude QA-handled models)
      const totalBaseEarnings = allAssets
        .filter(
          (asset) =>
            !asset.qa_team_handles_model &&
            asset.pricing_option_id !== "qa_team_handles_model"
        )
        .reduce((sum, asset) => sum + (asset.price || 0), 0);

      // Add correction amounts from allocation lists
      const totalCorrections = processedLists.reduce(
        (sum, list) => sum + (list.correction_amount || 0),
        0
      );

      const totalBonusEarnings = allAssets
        .filter(
          (asset) =>
            !asset.qa_team_handles_model &&
            asset.pricing_option_id !== "qa_team_handles_model"
        )
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + ((asset.price || 0) * bonus) / 100;
        }, 0);

      const totalPotentialEarnings =
        totalBaseEarnings + totalBonusEarnings + totalCorrections;

      // Calculate earnings immediately for assets approved by client (exclude QA-handled)
      const completedEarnings =
        allAssets
          .filter(
            (asset) =>
              asset.status === "approved_by_client" &&
              !asset.qa_team_handles_model &&
              asset.pricing_option_id !== "qa_team_handles_model"
          )
          .reduce((sum, asset) => {
            const bonus = asset.bonus || 0;
            return sum + (asset.price || 0) * (1 + bonus / 100);
          }, 0) + totalCorrections;

      // Pending earnings include everything that hasn't been approved by client yet (exclude QA-handled)
      const pendingEarnings = allAssets
        .filter(
          (asset) =>
            asset.status !== "approved_by_client" &&
            !asset.qa_team_handles_model &&
            asset.pricing_option_id !== "qa_team_handles_model"
        )
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + (asset.price || 0) * (1 + bonus / 100);
        }, 0);

      // Calculate average price excluding QA-handled models
      const nonQAAssets = allAssets.filter(
        (asset) =>
          !asset.qa_team_handles_model &&
          asset.pricing_option_id !== "qa_team_handles_model"
      );
      const averageAssetPrice =
        nonQAAssets.length > 0 ? totalBaseEarnings / nonQAAssets.length : 0;

      setBatchStats({
        totalAssets,
        completedAssets,
        inProgressAssets,
        pendingAssets,
        revisionAssets,
        waitingForApprovalAssets,
        completionPercentage:
          totalAssets > 0
            ? Math.round((completedAssets / totalAssets) * 100)
            : 0,
        totalBaseEarnings,
        totalBonusEarnings,
        totalPotentialEarnings,
        completedEarnings,
        pendingEarnings,
        averageAssetPrice,
      });
    } catch (error) {
      console.error("Error fetching batch assets:", error);
      toast.error("Failed to fetch batch assets");
      // Don't let errors crash the app - set default values instead
      setAllocationLists([]);
      setBatchStats({
        totalAssets: 0,
        completedAssets: 0,
        inProgressAssets: 0,
        pendingAssets: 0,
        revisionAssets: 0,
        waitingForApprovalAssets: 0,
        completionPercentage: 0,
        totalBaseEarnings: 0,
        totalBonusEarnings: 0,
        totalPotentialEarnings: 0,
        completedEarnings: 0,
        pendingEarnings: 0,
        averageAssetPrice: 0,
      });
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  // Recalculate batch stats from current allocation lists without full refetch
  const recalculateBatchStatsFromLists = (lists: AllocationList[]) => {
    const allAssets = lists.flatMap((list) => list.assets);
    const totalAssets = allAssets.length;
    const completedAssets = allAssets.filter(
      (asset) => asset.status === "approved_by_client"
    ).length;
    const inProgressAssets = allAssets.filter(
      (asset) => asset.status === "in_production"
    ).length;
    const pendingAssets = allAssets.filter(
      (asset) => asset.status === "not_started"
    ).length;
    const revisionAssets = allAssets.filter(
      (asset) => asset.status === "revisions"
    ).length;
    const waitingForApprovalAssets = allAssets.filter(
      (asset) => asset.status === "delivered_by_artist"
    ).length;

    // Calculate earnings statistics (exclude QA-handled models)
    const totalBaseEarnings = allAssets
      .filter(
        (asset) =>
          !asset.qa_team_handles_model &&
          asset.pricing_option_id !== "qa_team_handles_model"
      )
      .reduce((sum, asset) => sum + (asset.price || 0), 0);

    // Add correction amounts from allocation lists
    const totalCorrections = lists.reduce(
      (sum, list) => sum + (list.correction_amount || 0),
      0
    );

    const totalBonusEarnings = allAssets
      .filter(
        (asset) =>
          !asset.qa_team_handles_model &&
          asset.pricing_option_id !== "qa_team_handles_model"
      )
      .reduce((sum, asset) => {
        const bonus = asset.bonus || 0;
        return sum + ((asset.price || 0) * bonus) / 100;
      }, 0);

    const totalPotentialEarnings =
      totalBaseEarnings + totalBonusEarnings + totalCorrections;

    const completedEarnings =
      allAssets
        .filter(
          (asset) =>
            asset.status === "approved_by_client" &&
            !asset.qa_team_handles_model &&
            asset.pricing_option_id !== "qa_team_handles_model"
        )
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + (asset.price || 0) * (1 + bonus / 100);
        }, 0) + totalCorrections;

    const pendingEarnings = allAssets
      .filter(
        (asset) =>
          asset.status !== "approved_by_client" &&
          !asset.qa_team_handles_model &&
          asset.pricing_option_id !== "qa_team_handles_model"
      )
      .reduce((sum, asset) => {
        const bonus = asset.bonus || 0;
        return sum + (asset.price || 0) * (1 + bonus / 100);
      }, 0);

    // Calculate average price excluding QA-handled models
    const nonQAAssets = allAssets.filter(
      (asset) =>
        !asset.qa_team_handles_model &&
        asset.pricing_option_id !== "qa_team_handles_model"
    );
    const averageAssetPrice =
      nonQAAssets.length > 0 ? totalBaseEarnings / nonQAAssets.length : 0;

    setBatchStats({
      totalAssets,
      completedAssets,
      inProgressAssets,
      pendingAssets,
      revisionAssets,
      waitingForApprovalAssets,
      completionPercentage:
        totalAssets > 0 ? Math.round((completedAssets / totalAssets) * 100) : 0,
      totalBaseEarnings,
      totalBonusEarnings,
      totalPotentialEarnings,
      completedEarnings,
      pendingEarnings,
      averageAssetPrice,
    });
  };

  const filterAndSortAssets = () => {
    // Get all assets from all allocation lists
    const allAssets = allocationLists.flatMap((list) => list.assets);
    let filtered = [...allAssets];

    // Apply urgent filter first (from URL parameter)
    if (filter === "urgent") {
      filtered = filtered.filter((asset) => asset.priority === 1);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (asset) =>
          asset.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.article_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((asset) => asset.status === statusFilter);
    }

    setFilteredAssets(filtered);
  };

  // Highlight helper for search matches
  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
    const parts = text.split(pattern);
    if (parts.length === 1) return text;
    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={idx} className="bg-yellow-200/70 rounded px-0.5">
              {part}
            </span>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "approved_by_client":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "delivered_by_artist":
        return <Clock className="h-4 w-4 text-green-600" />;
      case "in_production":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "not_started":
        return null;
      case "revisions":
        return <RotateCcw className="h-4 w-4 text-orange-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
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
        return "Waiting for Approval";
      default:
        return status;
    }
  };

  // Match admin-review row styling by status
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
        return "table-row-status-approved";
      case "delivered_by_artist":
        return "table-row-status-delivered-by-artist";
      case "not_started":
        return "table-row-status-not-started";
      default:
        return "table-row-status-unknown";
    }
  };

  const handleOpenProductLink = (productLink: string) => {
    if (productLink) {
      window.open(productLink, "_blank");
    }
  };

  const parseReferences = (
    referenceImages: string[] | string | null
  ): string[] => {
    if (!referenceImages) return [];

    let urls: string[] = [];

    // Handle different data formats
    if (Array.isArray(referenceImages)) {
      urls = referenceImages;
    } else if (typeof referenceImages === "string") {
      // Check if it's a string with ||| separator
      if (referenceImages.includes("|||")) {
        urls = referenceImages
          .split("|||")
          .map((ref) => ref.trim())
          .filter(Boolean);
      } else {
        // Try to parse as JSON if it's a string
        try {
          const parsed = JSON.parse(referenceImages);
          urls = Array.isArray(parsed) ? parsed : [referenceImages];
        } catch {
          // If not JSON, treat as single URL
          urls = [referenceImages];
        }
      }
    }

    return urls.filter((url) => url && typeof url === "string");
  };

  const handleDownloadReference = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || "reference-image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadGLB = async (assetId: string, file: File) => {
    try {
      setUploadingGLB(assetId);

      // Get the asset to validate file name against article ID
      const asset = allocationLists
        .flatMap((list) => list.assets)
        .find((a) => a.id === assetId);

      if (!asset) {
        toast.error("Asset not found");
        return;
      }

      // Validate file
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
        toast.error("Please select a GLB or GLTF file");
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        toast.error("File size must be less than 100MB");
        return;
      }

      // Validate file name matches article ID
      const fileBaseName = file.name
        .replace(/\.(glb|gltf)$/i, "")
        .toLowerCase();
      const articleId = asset.article_id.toLowerCase();

      if (fileBaseName !== articleId) {
        toast.error(
          `File name must match the Article ID. Expected: ${asset.article_id}, got: ${file.name.replace(/\.(glb|gltf)$/i, "")}`
        );
        return;
      }

      // Save current GLB to history if it exists
      if (asset.glb_link) {
        // Save current GLB to history
        const { error: historyError } = await supabase
          .from("glb_upload_history")
          .insert({
            asset_id: assetId,
            glb_url: asset.glb_link,
            file_name: `${asset.article_id}.glb`,
            file_size: 0,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error(
            "Error recording original GLB to history:",
            historyError
          );
        }
      }

      // Check if file is too large for regular upload
      const isLargeFile = file.size > 4.5 * 1024 * 1024; // 4.5MB
      let result: any;

      if (isLargeFile) {
        // Use direct upload (bypasses Vercel's 4.5MB limit)
        const { DirectFileUploader, formatFileSize } = await import(
          "@/lib/directUpload"
        );

        const uploader = new DirectFileUploader((progress) => {
          // Only log every 10% to reduce console spam
          if (
            progress.progress % 10 === 0 ||
            progress.status === "complete" ||
            progress.status === "error"
          ) {
          }
        });

        const uploadResult = await uploader.uploadFile(
          file,
          assetId,
          "glb",
          client
        );

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Direct GLB upload failed");
        }

        result = { url: uploadResult.cdnUrl };
        toast.success(
          `Large GLB file uploaded successfully! (${formatFileSize(file.size)})`
        );
      } else {
        // Use regular upload for smaller files
        const formData = new FormData();
        formData.append("file", file);
        formData.append("asset_id", assetId);
        formData.append("file_type", "glb");
        formData.append("client_name", client);

        const response = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to upload GLB file");
        }

        result = await response.json();
      }

      // Update the asset with the new GLB link but keep status as in_progress for QA
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: result.url, // Use result.url instead of result.file_url
          status: "delivered_by_artist",
          // Don't change status to delivered_by_artist - let QA handle that
        })
        .eq("id", assetId);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw updateError;
      }

      // Mark all existing annotations as "old" when uploading new GLB
      const { error: markOldError } = await supabase
        .from("asset_annotations")
        .update({ is_old_annotation: true })
        .eq("asset_id", assetId);

      if (markOldError) {
        console.error("Error marking old annotations:", markOldError);
      }

      // Record GLB upload history
      const { error: newHistoryError } = await supabase
        .from("glb_upload_history")
        .insert({
          asset_id: assetId,
          glb_url: result.url, // Use result.url instead of result.file_url
          file_name: file.name,
          file_size: file.size,
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        });

      if (newHistoryError) {
        console.error("Error recording GLB history:", newHistoryError);
      }

      // Update local state to avoid collapsing the accordion
      setAllocationLists((prev) => {
        const updatedLists = prev.map((list) => ({
          ...list,
          assets: list.assets.map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  glb_link: result.url, // Use result.url instead of result.file_url
                  status: "delivered_by_artist",
                }
              : a
          ),
        }));
        recalculateBatchStatsFromLists(updatedLists);
        return updatedLists;
      });

      toast.success("GLB file uploaded successfully! Redirecting to viewer...");

      // Redirect to modeler review page
      setTimeout(() => {
        router.push(`/modeler-review/${assetId}`);
      }, 1500);
    } catch (error) {
      console.error("Error uploading GLB:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload GLB file"
      );
    } finally {
      setUploadingGLB(null);
    }
  };

  const handleUploadAsset = async (assetId: string, file: File) => {
    try {
      setUploadingFile(assetId);

      // Check if file is too large for regular upload
      const isLargeFile = file.size > 4.5 * 1024 * 1024; // 4.5MB

      if (isLargeFile) {
        // Use direct upload (bypasses Vercel's 4.5MB limit)
        const { DirectFileUploader, formatFileSize } = await import(
          "@/lib/directUpload"
        );

        const uploader = new DirectFileUploader((progress) => {
          // Only log every 10% to reduce console spam
          if (
            progress.progress % 10 === 0 ||
            progress.status === "complete" ||
            progress.status === "error"
          ) {
          }
        });

        const result = await uploader.uploadFile(
          file,
          assetId,
          "reference",
          client
        );

        if (!result.success) {
          throw new Error(result.error || "Direct upload failed");
        }

        toast.success(
          `Large file uploaded successfully! (${formatFileSize(file.size)})`
        );
      } else {
        // Use regular upload for smaller files
        const formData = new FormData();
        formData.append("file", file);
        formData.append("asset_id", assetId);
        formData.append("file_type", "asset");
        formData.append("client_name", client);

        const response = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Failed to upload file";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            // If response is not JSON (e.g., HTML error page), use status text
            errorMessage =
              response.status === 413
                ? "File too large. Please compress the file or use a smaller file."
                : `Upload failed: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        toast.success("File uploaded successfully!");
      }

      // Refresh only the affected asset to keep UI state
      await refreshAssetReferenceData(assetId);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file"
      );
    } finally {
      setUploadingFile(null);
    }
  };

  const handleOpenUploadDialog = (asset: BatchAsset, type: "glb" | "asset") => {
    setCurrentUploadAsset(asset);
    setUploadType(type);
    if (type === "glb") {
      setGlbUploadDialogOpen(true);
    } else {
      setAssetUploadDialogOpen(true);
    }
  };

  const handleMultipleFileUpload = async () => {
    if (!currentUploadAsset || selectedFiles.length === 0) return;

    setUploadingMultiple(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const file of selectedFiles) {
        try {
          if (uploadType === "glb") {
            await handleUploadGLB(currentUploadAsset.id, file);
          } else {
            await handleUploadAsset(currentUploadAsset.id, file);
          }
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully uploaded ${successCount} files${errorCount > 0 ? ` (${errorCount} failed)` : ""}`
        );
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} files failed to upload`);
      }

      // Reset state
      setSelectedFiles([]);
      setAssetUploadDialogOpen(false);
      setGlbUploadDialogOpen(false);
      setCurrentUploadAsset(null);
    } finally {
      setUploadingMultiple(false);
    }
  };

  const handleFileSelectMultiple = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (uploadType === "asset") {
        setSelectedFiles((prev) => [...prev, ...files]);
      } else {
        // For GLB files, still use single file upload
        handleFileUpload(files[0]);
      }
    }
  };

  const handleFileUpload = (file: File) => {
    if (!currentUploadAsset) {
      console.error("No current upload asset");
      return;
    }

    if (uploadType === "glb") {
      handleUploadGLB(currentUploadAsset.id, file);
    } else {
      handleUploadAsset(currentUploadAsset.id, file);
    }

    // Close dialog after upload
    setTimeout(() => {
      setGlbUploadDialogOpen(false);
      setAssetUploadDialogOpen(false);
      setCurrentUploadAsset(null);
    }, 1000);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFileUpload(file);
    }
    // Clear the input
    event.target.value = "";
  };

  // Refresh a specific asset's reference/glb data
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link, measurements")
        .eq("id", assetId)
        .single();

      if (!error && data) {
        // Update the asset in allocation lists
        setAllocationLists((prev) =>
          prev.map((list) => ({
            ...list,
            assets: list.assets.map((asset) =>
              asset.id === assetId
                ? {
                    ...asset,
                    reference: data.reference,
                    glb_link: data.glb_link,
                    measurements: data.measurements,
                  }
                : asset
            ),
          }))
        );
      }
    } catch (error) {
      console.error("Error refreshing asset reference data:", error);
    }
  };

  useEffect(() => {
    const applyLocalAssetStatus = (data: any) => {
      const sameClient = String(data.client) === String(client);
      const sameBatch = Number(data.batch) === Number(batch);
      if (!sameClient || !sameBatch) return;
      const assetId: string | undefined = data.assetId;
      const status: string | undefined = data.status;
      if (!assetId || !status) return;
      setAllocationLists((prev) => {
        const updated = prev.map((list) => ({
          ...list,
          assets: list.assets.map((a) =>
            a.id === assetId ? { ...a, status } : a
          ),
        }));
        recalculateBatchStatsFromLists(updated);
        return updated;
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as any;
      if (data && data.type === "assetStatusChanged") {
        applyLocalAssetStatus(data);
      }
    };

    // BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("charpstar-asset-status");
      bc.onmessage = (ev) => {
        const data = ev.data as any;
        if (data && data.type === "assetStatusChanged") {
          applyLocalAssetStatus(data);
        }
      };
    } catch {}

    // storage event fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "charpstar-asset-status-event" || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (data && data.type === "assetStatusChanged") {
          applyLocalAssetStatus(data);
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      try {
        if (bc) bc.close();
      } catch {}
    };
  }, [client, batch]);

  if (!user) {
    return null;
  }

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
  if (user.metadata?.role !== "modeler") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for modelers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/my-assignments")}
            className="gap-2 text-muted-foreground hover:text-foreground w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Assignments</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <Badge variant="outline" className="gap-1 w-fit">
            <Building className="h-3 w-3" />
            <span className="hidden sm:inline">Modeler Dashboard</span>
            <span className="sm:hidden">Modeler</span>
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Building className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h1 className="text-lg sm:text-2xl font-semibold text-foreground truncate">
                  {client}
                </h1>
                {filter === "urgent" && (
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800 w-fit">
                    <Target className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Urgent Only</span>
                    <span className="sm:hidden">Urgent</span>
                  </Badge>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-muted-foreground mt-1">
                <span className="text-xs sm:text-sm">All Batches</span>
                <span className="hidden sm:inline">•</span>
                <span className="text-xs sm:text-sm">Active Assignment</span>
                {clientGuideUrls.length > 0 ? (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      {clientGuideUrls.map((url, idx) => (
                        <a
                          key={`guide-header-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs sm:text-sm text-primary hover:underline break-all"
                        >
                          {idx === 0
                            ? `Client Guidelines - ${client}`
                            : `Guide ${idx + 1} - ${client}`}
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-xs sm:text-sm italic">
                      No guidelines found – contact production team
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Earnings Statistics */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm animate-pulse"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-muted rounded-xl">
                  <div className="h-4 w-4 sm:h-5 sm:w-5 bg-muted-foreground/20 rounded" />
                </div>
                <div className="flex-1 space-y-2 sm:space-y-3">
                  <div className="h-3 w-20 sm:w-24 bg-muted rounded" />
                  <div className="h-5 w-16 sm:w-20 bg-muted rounded" />
                  <div className="h-2 w-12 sm:w-16 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-50 rounded-xl flex-shrink-0">
                <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                  Total Potential
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.totalPotentialEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets} assets • €
                  {batchStats.averageAssetPrice.toFixed(2)} avg
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-50 rounded-xl flex-shrink-0">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                  Completed Earnings
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.completedEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.completedAssets} assets completed
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-amber-50 rounded-xl flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                  Pending Earnings
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.pendingEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets - batchStats.completedAssets}{" "}
                  remaining
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-purple-50 rounded-xl flex-shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                  Bonus Earnings
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.totalBonusEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.completionPercentage}% completion
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      {loading ? (
        <div className="mb-6 sm:mb-8">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm animate-pulse">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 h-8 sm:h-10 bg-muted rounded-lg" />
              <div className="w-full sm:w-48 h-8 sm:h-10 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 sm:h-4 sm:w-4" />
              <Input
                placeholder="Search by name, article ID, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-10 h-8 sm:h-10 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 h-8 sm:h-10 text-sm">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {[
                  "in_production",
                  "revisions",
                  "delivered_by_artist",
                  "approved_by_client",
                  "approved",
                  "not_started",
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
            {filter === "urgent" && (
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/my-assignments/${encodeURIComponent(client)}/${batch}`
                  )
                }
                className="h-8 sm:h-10 px-3 sm:px-4 text-sm w-full sm:w-auto"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Clear Urgent Filter</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                Assets Overview
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your allocated work assignments
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs px-2 sm:px-3 py-1 w-fit">
            {filteredAssets.length} of{" "}
            {allocationLists.flatMap((list) => list.assets).length} assets
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Skeleton for allocation list cards */}
            {[...Array(2)].map((_, listIndex) => (
              <Card key={listIndex} className="animate-pulse">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4 w-4 sm:h-5 sm:w-5 bg-gray-200 rounded" />
                        <div className="h-5 w-24 sm:w-32 bg-gray-200 rounded" />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="h-3 w-3 sm:h-4 sm:w-4 bg-gray-200 rounded" />
                            <div className="h-3 w-16 sm:w-20 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    {/* Table header skeleton */}
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 sm:gap-4 pb-2">
                      {[...Array(7)].map((_, i) => (
                        <div
                          key={i}
                          className="h-3 sm:h-4 bg-gray-200 rounded"
                        />
                      ))}
                    </div>
                    {/* Table rows skeleton */}
                    {[...Array(3)].map((_, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid grid-cols-2 sm:grid-cols-7 gap-2 sm:gap-4 py-2 sm:py-3"
                      >
                        {[...Array(7)].map((_, colIndex) => (
                          <div
                            key={colIndex}
                            className="h-3 sm:h-4 bg-gray-200 rounded"
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allocationLists.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              No Assets for Client
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              This client doesn&apos;t have any assigned assets yet.
            </p>
            <Button
              onClick={() => router.push("/my-assignments")}
              className="text-sm"
            >
              Back to Assignments
            </Button>
          </Card>
        ) : filteredAssets.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <Search className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              No Assets Found
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              No assets match your current filters. Try adjusting your search or
              filters.
            </p>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Accordion
              type="multiple"
              value={expandedAllocations}
              onValueChange={(vals) => {
                const next = Array.isArray(vals) ? (vals as string[]) : [];
                setExpandedAllocations(next);
                try {
                  const storageKey = `myAssignmentsAccordion:${client}:${batch}`;
                  window.localStorage.setItem(storageKey, JSON.stringify(next));
                } catch {}
              }}
              className="space-y-3 sm:space-y-4"
            >
              {allocationLists.map((allocationList) => {
                const visibleAssets = allocationList.assets.filter((a) =>
                  filteredAssets.some((f) => f.id === a.id)
                );
                if (visibleAssets.length === 0) return null;
                return (
                  <AccordionItem
                    value={allocationList.id}
                    key={allocationList.id}
                  >
                    <div
                      className={`group relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-xl backdrop-blur supports-[backdrop-filter]:backdrop-blur-md ${
                        isOverdue(allocationList.deadline)
                          ? "border-red-200/60 bg-white/60 dark:bg-white/5"
                          : allocationList.status === "approved"
                            ? "border-emerald-200/60 bg-white/60 dark:bg-white/5"
                            : "border-border/60 bg-white/60 dark:bg-white/5 hover:border-primary/40"
                      }`}
                    >
                      {/* Accents */}
                      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                      <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-accent-purple/10 blur-2xl" />

                      <AccordionTrigger className="relative px-4 sm:px-6 py-4 sm:py-5 transition-all duration-200 hover:bg-black/3.5 dark:hover:bg-white/5">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                            <div
                              className={`p-2 sm:p-3 rounded-xl shadow-sm transition-all flex-shrink-0 ${
                                isOverdue(allocationList.deadline)
                                  ? "bg-red-100 text-red-600"
                                  : allocationList.status === "approved"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-primary/10 text-primary group-hover:bg-primary/15"
                              }`}
                            >
                              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div className="text-left space-y-1 sm:space-y-2 min-w-0 flex-1">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">
                                  Allocation #{allocationList.number}
                                </h3>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 lg:gap-6 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-muted rounded">
                                    <Building className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <span className="text-muted-foreground truncate">
                                    {client}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-1 rounded ${
                                      isOverdue(allocationList.deadline)
                                        ? "bg-red-100"
                                        : "bg-muted"
                                    }`}
                                  >
                                    <Calendar className="h-3 w-3" />
                                  </div>
                                  <span
                                    className={
                                      isOverdue(allocationList.deadline)
                                        ? "text-red-600 font-medium"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    Due:{" "}
                                    {new Date(
                                      allocationList.deadline
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-green-100 rounded">
                                    <Euro className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="font-medium text-green-700">
                                    +{allocationList.bonus}% bonus
                                  </span>
                                </div>
                                {allocationList.correction_amount &&
                                  allocationList.correction_amount > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="p-1 bg-orange-100 rounded">
                                        <Euro className="h-3 w-3 text-orange-600" />
                                      </div>
                                      <span className="font-medium text-orange-700">
                                        +€
                                        {allocationList.correction_amount.toFixed(
                                          2
                                        )}{" "}
                                        correction
                                      </span>
                                    </div>
                                  )}
                                {clientGuideUrls.length > 0 ? (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1 bg-primary/10 rounded">
                                        <Link2 className="h-3 w-3 text-primary" />
                                      </div>
                                      <span className="text-xs sm:text-sm">
                                        Guides:
                                      </span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                      {clientGuideUrls.map((url, idx) => (
                                        <a
                                          key={`guide-list-${idx}`}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs sm:text-sm text-primary hover:underline break-all"
                                        >
                                          {idx === 0
                                            ? `Client Guidelines - ${client}`
                                            : `Guide ${idx + 1} - ${client}`}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-muted rounded">
                                      <Link2 className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="italic text-muted-foreground text-xs sm:text-sm">
                                      No guidelines found for client – See
                                      general guidelines page
                                    </span>
                                  </div>
                                )}
                                {client === "Synsam" ? (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-primary/10 rounded">
                                      <Link2 className="h-3 w-3 text-primary" />
                                    </div>
                                    <a
                                      href="https://cdn2.charpstar.net/3DTester/TransparencyFix/"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-700 hover:underline text-xs sm:text-sm"
                                    >
                                      Synsam viewer
                                    </a>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 bg-primary/10 rounded">
                                      <Link2 className="h-3 w-3 text-primary" />
                                    </div>
                                    <a
                                      href="https://charpstar.se/3DTester-V5/"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-700 hover:underline text-xs sm:text-sm"
                                    >
                                      Model viewer
                                    </a>
                                  </div>
                                )}
                              </div>
                              {/* Progress */}
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                  <span>Progress</span>
                                  <span className="font-medium">
                                    {visibleAssets.length
                                      ? Math.round(
                                          (visibleAssets.filter(
                                            (a) =>
                                              a.status ===
                                                "approved_by_client" ||
                                              a.status === "approved"
                                          ).length /
                                            visibleAssets.length) *
                                            100
                                        )
                                      : 0}
                                    %
                                  </span>
                                </div>
                                <div className="h-1.5 sm:h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                                    style={{
                                      width: `${visibleAssets.length ? (visibleAssets.filter((a) => a.status === "approved_by_client" || a.status === "approved").length / visibleAssets.length) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-1 flex-shrink-0">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="p-1 bg-muted rounded">
                                <Package className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <span className="text-base sm:text-lg font-semibold text-foreground">
                                {visibleAssets.length}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {visibleAssets.length === 1 ? "asset" : "assets"}
                            </p>
                            {visibleAssets.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    "revisions",
                                    "not_started",
                                    "in_production",
                                    "delivered_by_artist",
                                    "approved_by_client",
                                    "approved",
                                  ].map((status) => {
                                    const count = visibleAssets.filter(
                                      (a) => a.status === status
                                    ).length;
                                    if (count === 0) return null;
                                    return (
                                      <div
                                        key={status}
                                        className={`px-1 sm:px-1.5 py-0.5 rounded text-xs font-medium ${getStatusLabelClass(status)}`}
                                      >
                                        {count}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <ChevronDown className="ml-auto h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                          <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                            {/* Desktop Table */}
                            <div className="hidden lg:block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12 py-2 text-xs text-left">
                                      Status
                                    </TableHead>
                                    <TableHead className="w-32 py-2 text-xs text-left">
                                      Product Name
                                    </TableHead>
                                    <TableHead className="w-32 py-2 text-xs text-left">
                                      Article ID
                                    </TableHead>
                                    <TableHead className="w-24 py-2 text-xs text-left">
                                      Priority
                                    </TableHead>
                                    <TableHead className="w-24 py-2 text-xs text-left">
                                      Price
                                    </TableHead>
                                    <TableHead className="w-32 py-2 text-xs text-left">
                                      Category
                                    </TableHead>
                                    <TableHead className="w-24 py-2 text-xs text-left">
                                      GLB
                                    </TableHead>
                                    <TableHead className="w-24 py-2 text-xs text-left">
                                      References
                                    </TableHead>
                                    <TableHead className="w-20 py-2 text-xs text-left">
                                      Feedback
                                    </TableHead>
                                    <TableHead className="w-24 py-2 text-xs text-left">
                                      Product Link
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {visibleAssets.map((asset) => (
                                    <TableRow
                                      key={asset.id}
                                      className={`${getStatusRowClass(asset.status)} hover:bg-muted/50`}
                                    >
                                      <TableCell className="py-2 text-left">
                                        <div className="flex items-center gap-2">
                                          {getStatusIcon(asset.status)}
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${getStatusLabelClass(asset.status)}`}
                                          >
                                            {getStatusLabelText(asset.status)}
                                          </Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        <div
                                          className="font-medium truncate max-w-[200px] cursor-help"
                                          title={asset.product_name}
                                        >
                                          {highlightMatch(
                                            asset.product_name.length > 35
                                              ? asset.product_name.substring(
                                                  0,
                                                  35
                                                ) + "..."
                                              : asset.product_name,
                                            searchTerm
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        <span className="text-xs text-muted-foreground font-mono">
                                          {
                                            highlightMatch(
                                              asset.article_id,
                                              searchTerm
                                            ) as any
                                          }
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${getPriorityClass(asset.priority)}`}
                                        >
                                          {getPriorityLabel(asset.priority)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                                          >
                                            QA
                                          </Badge>
                                        ) : asset.price ? (
                                          <div className="flex items-center gap-1 text-sm">
                                            <Euro className="h-3 w-3 text-success" />
                                            <span className="font-semibold">
                                              {asset.price.toFixed(2)}
                                            </span>
                                            {asset.pricing_comment && (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 hover:bg-muted"
                                                  >
                                                    <StickyNote className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-fit p-3">
                                                  <div className="space-y-2">
                                                    <h4 className="font-medium text-sm">
                                                      Pricing Note
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap min-w-[200px]">
                                                      {asset.pricing_comment}
                                                    </p>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">
                                            -
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        <div className="text-sm">
                                          {highlightMatch(
                                            asset.category,
                                            searchTerm
                                          )}
                                          {asset.subcategory && (
                                            <div className="text-xs text-muted-foreground">
                                              {highlightMatch(
                                                asset.subcategory,
                                                searchTerm
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <span className="text-xs text-muted-foreground">
                                            -
                                          </span>
                                        ) : (
                                          <div className="flex flex-col gap-1">
                                            {asset.glb_link ? (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const fileName =
                                                    asset.glb_link
                                                      ?.split("/")
                                                      .pop() ||
                                                    `${asset.article_id}.glb`;
                                                  handleFileDownload(
                                                    asset.glb_link!,
                                                    fileName
                                                  );
                                                }}
                                                className="text-xs h-6 px-2 w-full hover:text-blue-700 hover:underline"
                                              >
                                                <Download className="h-3 w-3 mr-1" />
                                                Download
                                              </Button>
                                            ) : null}
                                            <Button
                                              variant={
                                                asset.glb_link
                                                  ? "ghost"
                                                  : "default"
                                              }
                                              size="sm"
                                              onClick={() =>
                                                handleOpenUploadDialog(
                                                  asset,
                                                  "glb"
                                                )
                                              }
                                              disabled={uploadingGLB === asset.id}
                                              className={`text-xs h-6 px-2 w-full ${
                                                asset.glb_link
                                                  ? "hover:text-blue-700 hover:underline"
                                                  : " text-white"
                                              }`}
                                            >
                                              {uploadingGLB === asset.id ? (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1 dark:border-border dark:text-muted-foreground text-foreground" />
                                              ) : (
                                                <Upload className="h-3 w-3 mr-1" />
                                              )}
                                              {asset.glb_link
                                                ? "Update GLB"
                                                : "Upload GLB"}
                                            </Button>
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <span className="text-xs text-muted-foreground">
                                            -
                                          </span>
                                        ) : (
                                          <div className="flex flex-col gap-1">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedAssetForView(asset);
                                                setShowViewRefDialog(true);
                                              }}
                                              className="text-xs h-6 px-2 w-full border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/50 dark:text-muted-foreground"
                                            >
                                              <FileText className="h-3 w-3 mr-1" />
                                              Ref (
                                              {separateReferences(
                                                asset.reference || null
                                              ).imageReferences.length +
                                                separateReferences(
                                                  asset.reference || null
                                                ).glbFiles.length +
                                                (asset.glb_link ? 1 : 0)}
                                              )
                                            </Button>
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <span className="text-xs text-muted-foreground">
                                            -
                                          </span>
                                        ) : (
                                          <div className="flex flex-col gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="w-fit h-6 px-2 text-xs hover:text-purple-700 hover:underline"
                                              onClick={() =>
                                                window.open(
                                                  `/modeler-review/${asset.id}?from=my-assignments&client=${encodeURIComponent(client)}&batch=${batch}`,
                                                  "_blank",
                                                  "noopener,noreferrer"
                                                )
                                              }
                                            >
                                              <Eye className="h-4 w-4 mr-1" />
                                            </Button>
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-left">
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <span className="text-xs text-muted-foreground">
                                            -
                                          </span>
                                        ) : (
                                          <div>
                                            {asset.product_link ? (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                                onClick={() =>
                                                  handleOpenProductLink(
                                                    asset.product_link || ""
                                                  )
                                                }
                                              >
                                                Product Link
                                              </Button>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">
                                                -
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="lg:hidden space-y-3">
                              {visibleAssets.map((asset) => (
                                <Card
                                  key={asset.id}
                                  className={`${getStatusRowClass(asset.status)} p-3 sm:p-4`}
                                >
                                  <div className="space-y-3">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          {getStatusIcon(asset.status)}
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${getStatusLabelClass(asset.status)}`}
                                          >
                                            {getStatusLabelText(asset.status)}
                                          </Badge>
                                        </div>
                                        <h4
                                          className="font-medium text-sm truncate"
                                          title={asset.product_name}
                                        >
                                          {highlightMatch(
                                            asset.product_name.length > 35
                                              ? asset.product_name.substring(
                                                  0,
                                                  35
                                                ) + "..."
                                              : asset.product_name,
                                            searchTerm
                                          )}
                                        </h4>
                                        <p className="text-xs text-muted-foreground font-mono">
                                          {
                                            highlightMatch(
                                              asset.article_id,
                                              searchTerm
                                            ) as any
                                          }
                                        </p>
                                      </div>
                                      {!(asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model") && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 hover:text-purple-700"
                                          onClick={() =>
                                            window.open(
                                              `/modeler-review/${asset.id}?from=my-assignments&client=${encodeURIComponent(client)}&batch=${batch}`,
                                              "_blank",
                                              "noopener,noreferrer"
                                            )
                                          }
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>

                                    {/* Details */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">
                                          Priority:
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ml-1 ${getPriorityClass(asset.priority)}`}
                                        >
                                          {getPriorityLabel(asset.priority)}
                                        </Badge>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">
                                          Price:
                                        </span>
                                        {asset.qa_team_handles_model ||
                                        asset.pricing_option_id ===
                                          "qa_team_handles_model" ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs ml-1 bg-amber-50 text-amber-700 border-amber-200"
                                          >
                                            QA
                                          </Badge>
                                        ) : asset.price ? (
                                          <div className="flex items-center gap-1 ml-1">
                                            <span className="font-semibold">
                                              €{asset.price.toFixed(2)}
                                            </span>
                                            {asset.pricing_comment && (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 hover:bg-muted"
                                                  >
                                                    <StickyNote className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-fit ">
                                                  <div className="space-y-2">
                                                    <h4 className="font-medium text-sm">
                                                      Pricing Note
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground w-fit whitespace-pre-wrap min-w-[200px]">
                                                      {asset.pricing_comment}
                                                    </p>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="ml-1 text-muted-foreground">
                                            -
                                          </span>
                                        )}
                                      </div>
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">
                                          Category:
                                        </span>
                                        <span className="ml-1">
                                          {highlightMatch(
                                            asset.category,
                                            searchTerm
                                          )}
                                          {asset.subcategory && (
                                            <span className="text-muted-foreground">
                                              {" / "}
                                              {highlightMatch(
                                                asset.subcategory,
                                                searchTerm
                                              )}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    {!(asset.qa_team_handles_model ||
                                      asset.pricing_option_id ===
                                        "qa_team_handles_model") && (
                                      <div className="flex flex-wrap gap-2">
                                        {/* GLB Actions */}
                                        <div className="flex gap-1">
                                          {asset.glb_link ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const fileName =
                                                  asset.glb_link
                                                    ?.split("/")
                                                    .pop() ||
                                                  `${asset.article_id}.glb`;
                                                handleFileDownload(
                                                  asset.glb_link!,
                                                  fileName
                                                );
                                              }}
                                              className="text-xs h-6 px-2 hover:text-blue-700"
                                            >
                                              <Download className="h-3 w-3 mr-1" />
                                              GLB
                                            </Button>
                                          ) : null}
                                          <Button
                                            variant={
                                              asset.glb_link
                                                ? "ghost"
                                                : "default"
                                            }
                                            size="sm"
                                            onClick={() =>
                                              handleOpenUploadDialog(
                                                asset,
                                                "glb"
                                              )
                                            }
                                            disabled={uploadingGLB === asset.id}
                                            className={`text-xs h-6 px-2 ${
                                              asset.glb_link
                                                ? "hover:text-blue-700"
                                                : "text-white"
                                            }`}
                                          >
                                            {uploadingGLB === asset.id ? (
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
                                            ) : (
                                              <Upload className="h-3 w-3 mr-1" />
                                            )}
                                            {asset.glb_link
                                              ? "Update"
                                              : "Upload"}
                                          </Button>
                                        </div>

                                        {/* References */}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedAssetForView(asset);
                                            setShowViewRefDialog(true);
                                          }}
                                          className="text-xs h-6 px-2"
                                        >
                                          <FileText className="h-3 w-3 mr-1" />
                                          Ref (
                                          {separateReferences(
                                            asset.reference || null
                                          ).imageReferences.length +
                                            separateReferences(
                                              asset.reference || null
                                            ).glbFiles.length +
                                            (asset.glb_link ? 1 : 0)}
                                          )
                                        </Button>

                                        {/* Product Link */}
                                        {asset.product_link && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-6 px-2 text-blue-600 hover:text-blue-700"
                                            onClick={() =>
                                              handleOpenProductLink(
                                                asset.product_link || ""
                                              )
                                            }
                                          >
                                            <Link2 className="h-3 w-3 mr-1" />
                                            Link
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>

      {/* Previous Modeler Files Section */}
      {assetFileHistory.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            <h3 className="text-base sm:text-lg font-medium">
              Previous Modeler Files Available
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            These assets have files from previous modelers that you can
            download:
          </p>

          <div className="space-y-3 sm:space-y-4">
            {assetFileHistory.map((history) => {
              const asset = allocationLists
                .flatMap((list) => list.assets)
                .find((asset) => asset.id === history.assetId);

              if (!asset) return null;

              return (
                <Card
                  key={history.assetId}
                  className="p-3 sm:p-4 border-amber-200 bg-amber-50/50"
                >
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs sm:text-sm truncate">
                          {asset.product_name} ({asset.article_id})
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Previously worked on by: {history.previousModelerName}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {history.files.glb_link && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Badge variant="outline" className="text-xs w-fit">
                            Current GLB File
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleFileDownload(
                                history.files.glb_link!,
                                `${asset.product_name}-${asset.article_id}.glb`
                              )
                            }
                            className="text-xs h-6 px-2 w-full sm:w-auto"
                          >
                            Download
                          </Button>
                        </div>
                      )}

                      {history.files.reference &&
                        history.files.reference.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Reference Images ({history.files.reference.length}
                              )
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {history.files.reference.map((ref, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleFileDownload(
                                      ref,
                                      `ref-${index + 1}.png`
                                    )
                                  }
                                  className="text-xs h-6 px-2"
                                >
                                  Ref {index + 1}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                      {history.files.other_files &&
                        history.files.other_files.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Additional Files (
                              {history.files.other_files.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {history.files.other_files.map((file, index) => {
                                const fileName =
                                  file.split("/").pop() || `file-${index + 1}`;
                                const fileExtension =
                                  fileName.split(".").pop() || "file";
                                return (
                                  <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleFileDownload(file, fileName)
                                    }
                                    className="text-xs h-6 px-2"
                                  >
                                    {fileExtension.toUpperCase()} {index + 1}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Reference Images Dialog */}
      <Dialog open={referenceDialogOpen} onOpenChange={setReferenceDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              Reference Images - {currentAssetName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {currentReferences.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Download className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  No reference images available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {currentReferences.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src =
                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04MCAxMDBDODAgODkuNTQ0NyA4OC41NDQ3IDgxIDEwMCA4MUMxMTAuNDU1IDgxIDExOSA4OS41NDQ3IDExOSAxMDBDMTE5IDExMC40NTUgMTEwLjQ1NSAxMTkgMTAwIDExOUM4OC41NDQ3IDExOSA4MCAxMTAuNDU1IDgwIDEwMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTEwMCAxMzVDMTEwLjQ1NSAxMzUgMTE5IDEyNi40NTUgMTE5IDExNkMxMTkgMTA1LjU0NSAxMTAuNDU1IDk3IDEwMCA5N0M4OS41NDQ3IDk3IDgxIDEwNS41NDUgODEgMTE2QzgxIDEyNi40NTUgODkuNTQ0NyAxMzUgMTAwIDEzNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+";
                        }}
                      />
                    </div>

                    {/* Download overlay */}
                    <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                      <Button
                        onClick={() => handleDownloadReference(url)}
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-gray-900 hover:bg-gray-100 text-xs sm:text-sm"
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Download
                      </Button>
                    </div>

                    {/* Image number badge */}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black bg-opacity-75 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GLB Upload Dialog */}
      <Dialog
        open={glbUploadDialogOpen}
        onOpenChange={setGlbUploadDialogOpen}
        modal={false}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-md h-fit overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 dark:text-muted-foreground dark:text-foreground text-foreground text-base sm:text-lg">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
              {currentUploadAsset?.glb_link
                ? "Update GLB File"
                : "Upload GLB File"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              <p className="mb-1 sm:mb-2">
                <strong>Asset:</strong> {currentUploadAsset?.product_name}
              </p>
              <p className="mb-1 sm:mb-2">
                <strong>Article ID:</strong>{" "}
                <span
                  className="inline-flex items-center gap-1 font-mono cursor-pointer hover:text-foreground hover:bg-muted rounded px-1 py-0.5 transition-colors"
                  onClick={() => {
                    if (currentUploadAsset?.article_id) {
                      navigator.clipboard.writeText(
                        currentUploadAsset.article_id
                      );
                      toast.success("Article ID copied to clipboard");
                    }
                  }}
                  title="Click to copy Article ID"
                >
                  {currentUploadAsset?.article_id}
                  <Copy className="h-3 w-3 " />
                </span>
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                Drop your GLB file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Only .glb and .gltf files are supported
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3 sm:mb-4">
                File name must match Article ID:{" "}
                <span className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">
                  {currentUploadAsset?.article_id}.glb
                </span>
              </p>

              <input
                type="file"
                accept=".glb,.gltf"
                onChange={handleFileSelect}
                className="hidden"
                id="glb-file-input"
              />
              <label
                htmlFor="glb-file-input"
                className="inline-flex items-center justify-center rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 sm:h-9 px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer"
              >
                Choose File
              </label>
            </div>

            {uploadingGLB === currentUploadAsset?.id && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600" />
                Uploading GLB file...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Asset Upload Dialog */}
      <Dialog
        open={assetUploadDialogOpen}
        onOpenChange={setAssetUploadDialogOpen}
        modal={false}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-md h-fit overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Image className="h-4 w-4 sm:h-5 sm:w-5" />
              Upload Asset Files
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              <p className="mb-1 sm:mb-2">
                <strong>Asset:</strong> {currentUploadAsset?.product_name}
              </p>
              <p className="mb-1 sm:mb-2">
                <strong>Article ID:</strong> {currentUploadAsset?.article_id}
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Image className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                Drop your asset files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-3 sm:mb-4">
                Supports ZIP archives, 3D files (BLEND, OBJ, FBX, GLB, GLTF,
                Substance), images, and other asset formats
              </p>

              <input
                type="file"
                multiple
                accept=".zip,.blend,.obj,.fbx,.dae,.max,.ma,.mb,.3ds,.stl,.ply,.wrl,.x3d,.usd,.abc,.c4d,.skp,.dwg,.dxf,.iges,.step,.stp,.sbs,.sbsar,.spp,.spt,.sbsa,.sbsb,.sbsm,.sbsn,.sbsr,.sbst,.sbsu,.sbsv,.sbsx,.sbsy,.sbsz,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tga,.hdr,.exr,.psd,.ai,.eps,.svg,.pdf,.glb,.gltf,.3dm,.3ds,.ac,.ac3d,.ase,.ask,.b3d,.bvh,.cob,.csm,.dae,.dxf,.enff,.fbx,.gltf,.glb,.ifc,.irr,.lwo,.lws,.lxo,.md2,.md3,.md5anim,.mdl,.m3d,.m3ds,.mesh,.mot,.ms3d,.ndo,.nff,.obj,.off,.ogex,.ply,.pmx,.prj,.q3o,.q3s,.raw,.scn,.sib,.smd,.stl,.ter,.uc,.vta,.x,.x3d,.xgl,.xml,.zae,.zgl"
                onChange={handleFileSelectMultiple}
                className="hidden"
                id="asset-file-input"
              />
              <label
                htmlFor="asset-file-input"
                className="inline-flex items-center justify-center rounded-md text-xs sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 sm:h-9 px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer"
              >
                Choose Files
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-medium">
                  Selected Files ({selectedFiles.length}):
                </p>
                <div className="max-h-24 sm:max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-xs sm:text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSelectedFile(index)}
                        className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            {selectedFiles.length > 0 && (
              <Button
                onClick={handleMultipleFileUpload}
                disabled={uploadingMultiple}
                className="w-full text-xs sm:text-sm"
              >
                {uploadingMultiple ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2" />
                    Uploading {selectedFiles.length} files...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Upload {selectedFiles.length} Files
                  </>
                )}
              </Button>
            )}

            {uploadingFile === currentUploadAsset?.id && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-green-600" />
                Uploading asset file...
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Recommended formats:</strong> ZIP, BLEND, OBJ, FBX
              </p>
            </div>
          </div>
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
