"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
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
  AlertCircle,
  RotateCcw,
  Eye,
  Calendar,
  Building,
  ArrowLeft,
  Download,
  Upload,
  Image,
  Euro,
  FolderOpen,
  X,
  FileText,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { AssetFilesManager } from "@/components/asset-library/AssetFilesManager";
import ErrorBoundary from "@/components/dashboard/error-boundary";
import { notificationService } from "@/lib/notificationService";

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
}

interface AllocationList {
  id: string;
  name: string;
  number: number;
  deadline: string;
  bonus: number;
  status: string;
  created_at: string;
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

// Helper function to get status priority for sorting
const getStatusPriority = (status: string): number => {
  switch (status) {
    case "revisions":
      return 1; // Highest priority - needs immediate attention
    case "not_started":
      return 2; // Second priority - needs to be started
    case "in_production":
      return 3; // Third priority - currently working
    case "delivered_by_artist":
      return 4; // Fourth priority - waiting for approval
    case "approved_by_client":
      return 5; // Fifth priority - approved by client
    case "approved":
      return 6; // Lowest priority - completed
    default:
      return 7; // Unknown status goes last
  }
};

// Helper function to sort assets by status priority
const sortAssetsByStatus = (assets: BatchAsset[]): BatchAsset[] => {
  return [...assets].sort((a, b) => {
    const priorityA = getStatusPriority(a.status);
    const priorityB = getStatusPriority(b.status);
    return priorityA - priorityB;
  });
};

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const client = decodeURIComponent(params.client as string);
  const batch = parseInt(params.batch as string);

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
  const [sortBy, setSortBy] = useState("priority");
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadingGLB, setUploadingGLB] = useState<string | null>(null);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [currentReferences, setCurrentReferences] = useState<string[]>([]);
  const [currentAssetName, setCurrentAssetName] = useState("");

  // Upload dialog states
  const [glbUploadDialogOpen, setGlbUploadDialogOpen] = useState(false);
  const [assetUploadDialogOpen, setAssetUploadDialogOpen] = useState(false);
  const [currentUploadAsset, setCurrentUploadAsset] =
    useState<BatchAsset | null>(null);
  const [uploadType, setUploadType] = useState<"glb" | "asset">("glb");
  const [dragActive, setDragActive] = useState(false);
  const [filesManagerOpen, setFilesManagerOpen] = useState(false);
  const [selectedAssetForFiles, setSelectedAssetForFiles] =
    useState<BatchAsset | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [assetFileHistory, setAssetFileHistory] = useState<AssetFileHistory[]>(
    []
  );

  useEffect(() => {
    document.title = `CharpstAR Platform - ${client} Batch ${batch}`;
  }, [client, batch]);

  useEffect(() => {
    if (user?.id && client && batch) {
      fetchBatchAssets();
    }
  }, [user?.id, client, batch]);

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
  }, [allocationLists, searchTerm, statusFilter, sortBy]);

  // Check for previous modeler files when component mounts
  useEffect(() => {
    if (allocationLists.length > 0) {
      checkForPreviousModelerFiles();
    }
  }, [allocationLists]);

  // Check for previous modeler files for re-allocated assets
  const checkForPreviousModelerFiles = async () => {
    try {
      const assetIds = allocationLists.flatMap((list) =>
        list.assets.map((asset) => asset.id)
      );

      if (assetIds.length === 0) return;

      // Get previous modeler assignments for these assets
      const { data: previousAssignments, error } = await supabase
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

      if (error) {
        console.error("Error fetching previous assignments:", error);
        return;
      }

      if (!previousAssignments || previousAssignments.length === 0) {
        setAssetFileHistory([]);
        return;
      }

      // Get asset details including files
      const { data: assetDetails, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("id, glb_link, reference, product_link")
        .in("id", assetIds);

      if (assetError) {
        console.error("Error fetching asset details:", assetError);
        return;
      }

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
        const { data: filesData, error: filesError } = await supabase
          .from("asset_files")
          .select("asset_id, file_url, file_name, file_type")
          .in("asset_id", assetIds)
          .order("uploaded_at", { ascending: false });

        if (!filesError && filesData) {
          assetFiles = filesData;
        }
      } catch (error) {
        console.log("asset_files table not available");
      }

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

      // Get user's allocation lists for this specific client and batch (only accepted assignments)
      const { data: allocationListsData, error: listsError } = await supabase
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
              reference
            )
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("asset_assignments.status", "accepted")
        .eq("asset_assignments.onboarding_assets.client", client)
        .eq("asset_assignments.onboarding_assets.batch", batch);

      if (listsError) {
        console.error("Error fetching allocation lists:", listsError);
        toast.error("Failed to fetch batch assets");
        return;
      }

      if (!allocationListsData || allocationListsData.length === 0) {
        toast.error("You don't have any assigned assets in this batch");
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
        (asset) => asset.status === "revisions"
      ).length;
      const waitingForApprovalAssets = allAssets.filter(
        (asset) => asset.status === "delivered_by_artist"
      ).length;

      // Calculate earnings statistics
      const totalBaseEarnings = allAssets.reduce(
        (sum, asset) => sum + (asset.price || 0),
        0
      );
      const totalBonusEarnings = allAssets.reduce((sum, asset) => {
        const bonus = asset.bonus || 0;
        return sum + ((asset.price || 0) * bonus) / 100;
      }, 0);
      const totalPotentialEarnings = totalBaseEarnings + totalBonusEarnings;

      // Calculate earnings immediately for assets approved by client
      const completedEarnings = allAssets
        .filter((asset) => asset.status === "approved_by_client")
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + (asset.price || 0) * (1 + bonus / 100);
        }, 0);

      // Pending earnings include everything that hasn't been approved by client yet
      const pendingEarnings = allAssets
        .filter((asset) => asset.status !== "approved_by_client")
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + (asset.price || 0) * (1 + bonus / 100);
        }, 0);

      const averageAssetPrice =
        totalAssets > 0 ? totalBaseEarnings / totalAssets : 0;

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

  // Safe wrapper for fetchBatchAssets to prevent app crashes
  const safeFetchBatchAssets = async () => {
    try {
      await fetchBatchAssets();
    } catch (error) {
      console.error("Error in safeFetchBatchAssets:", error);
      toast.error("Failed to refresh asset list");
    }
  };

  const filterAndSortAssets = () => {
    // Get all assets from all allocation lists
    const allAssets = allocationLists.flatMap((list) => list.assets);
    let filtered = [...allAssets];

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

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return a.priority - b.priority;
        case "name":
          return a.product_name.localeCompare(b.product_name);
        case "status":
          return a.status.localeCompare(b.status);
        case "article_id":
          return a.article_id.localeCompare(b.article_id);
        default:
          return 0;
      }
    });

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
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "delivered_by_artist":
        return <Clock className="h-4 w-4 text-accent-purple" />;
      case "in_production":
        return <Clock className="h-4 w-4 text-warning" />;
      case "not_started":
        return <AlertCircle className="h-4 w-4 text-error" />;
      case "revisions":
        return <RotateCcw className="h-4 w-4 text-error" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success-muted text-success border-success/20";
      case "approved_by_client":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "delivered_by_artist":
        return "bg-accent-purple/10 text-accent-purple border-accent-purple/20";
      case "in_production":
        return "bg-warning-muted text-warning border-warning/20";
      case "not_started":
        return "bg-error-muted text-error border-error/20";
      case "revisions":
        return "bg-error-muted text-error border-error/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Match admin-review row styling by status
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

  const handleViewAsset = (assetId: string) => {
    router.push(
      `/modeler-review/${assetId}?from=my-assignments&client=${encodeURIComponent(params.client as string)}&batch=${params.batch}`
    );
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
      // Try to parse as JSON if it's a string
      try {
        const parsed = JSON.parse(referenceImages);
        urls = Array.isArray(parsed) ? parsed : [referenceImages];
      } catch {
        // If not JSON, treat as single URL
        urls = [referenceImages];
      }
    }

    return urls.filter((url) => url && typeof url === "string");
  };

  const handleOpenReferences = (asset: BatchAsset) => {
    const references = parseReferences(asset.reference);
    setCurrentReferences(references);
    setCurrentAssetName(asset.product_name);
    setReferenceDialogOpen(true);
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
      console.log(
        "Starting GLB upload for asset:",
        assetId,
        "File:",
        file.name
      );

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

      // Get the asset to save current GLB to history if it exists
      const asset = allocationLists
        .flatMap((list) => list.assets)
        .find((a) => a.id === assetId);

      console.log("Found asset:", asset);

      if (asset?.glb_link) {
        console.log("Saving current GLB to history:", asset.glb_link);
        // Save current GLB to history
        const { error: historyError } = await supabase
          .from("glb_upload_history")
          .insert({
            asset_id: assetId,
            glb_url: asset.glb_link,
            file_name: `Current_${asset.article_id}_${Date.now()}.glb`,
            file_size: 0,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error(
            "Error recording original GLB to history:",
            historyError
          );
        } else {
          console.log("Successfully saved current GLB to history");
        }
      }

      // Upload to Supabase Storage
      const fileNameForUpload = `${asset?.article_id || assetId}_${Date.now()}.glb`;
      const filePath = `models/${fileNameForUpload}`;
      console.log("Uploading to path:", filePath);

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      console.log("File uploaded successfully to storage");

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(filePath);

      console.log("Got public URL:", urlData.publicUrl);

      // Update the asset with the new GLB link
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: urlData.publicUrl,
          status: "in_production",
        })
        .eq("id", assetId);

      if (updateError) {
        console.error("Database update error:", updateError);
        throw updateError;
      }

      console.log("Asset updated successfully in database");

      // Record GLB upload history
      const { error: newHistoryError } = await supabase
        .from("glb_upload_history")
        .insert({
          asset_id: assetId,
          glb_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        });

      if (newHistoryError) {
        console.error("Error recording GLB history:", newHistoryError);
      } else {
        console.log("GLB history recorded successfully");
      }

      toast.success("GLB file uploaded successfully!");

      // Refresh the assets list
      fetchBatchAssets();
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

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_id", assetId);
      formData.append("file_type", "asset");

      const response = await fetch("/api/assets/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      toast.success("File uploaded successfully!");

      // Refresh the assets list
      fetchBatchAssets();
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
    console.log("Opening upload dialog for asset:", asset.id, "type:", type);
    setCurrentUploadAsset(asset);
    setUploadType(type);
    if (type === "glb") {
      console.log("Setting GLB upload dialog open");
      setGlbUploadDialogOpen(true);
    } else {
      console.log("Setting asset upload dialog open");
      setAssetUploadDialogOpen(true);
    }
  };

  const handleOpenFilesManager = (asset: BatchAsset) => {
    setSelectedAssetForFiles(asset);
    setFilesManagerOpen(true);
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
    console.log("handleFileUpload called with:", {
      file: file.name,
      uploadType,
      currentUploadAsset,
    });
    if (!currentUploadAsset) {
      console.error("No current upload asset");
      return;
    }

    if (uploadType === "glb") {
      console.log("Calling handleUploadGLB for asset:", currentUploadAsset.id);
      handleUploadGLB(currentUploadAsset.id, file);
    } else {
      console.log(
        "Calling handleUploadAsset for asset:",
        currentUploadAsset.id
      );
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
    console.log("File selected:", file);
    if (file) {
      console.log(
        "Calling handleFileUpload with file:",
        file.name,
        "uploadType:",
        uploadType
      );
      handleFileUpload(file);
    }
    // Clear the input
    event.target.value = "";
  };

  if (!user) {
    return null;
  }

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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/my-assignments")}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assignments
          </Button>
          <Badge variant="outline" className="gap-1">
            <Building className="h-3 w-3" />
            Modeler Dashboard
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {client}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">Batch {batch}</span>
                <span>•</span>
                <span className="text-sm">Active Assignment</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Earnings Statistics */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-6 shadow-sm animate-pulse"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <div className="h-5 w-5 bg-muted-foreground/20 rounded" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-7 w-20 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Euro className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Total Potential
                </p>
                <p className="text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.totalPotentialEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets} assets • €
                  {batchStats.averageAssetPrice.toFixed(2)} avg
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Completed Earnings
                </p>
                <p className="text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.completedEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.completedAssets} assets completed
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Pending Earnings
                </p>
                <p className="text-2xl font-semibold text-foreground mb-1">
                  €{batchStats.pendingEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets - batchStats.completedAssets}{" "}
                  remaining
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-50 rounded-xl">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Bonus Earnings
                </p>
                <p className="text-2xl font-semibold text-foreground mb-1">
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
        <div className="mb-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-pulse">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 h-10 bg-muted rounded-lg" />
              <div className="w-full lg:w-48 h-10 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, article ID, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48 h-10">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in_production">In Progress</SelectItem>
                  <SelectItem value="revisions">Sent for Revisions</SelectItem>
                  <SelectItem value="delivered_by_artist">
                    Waiting for Approval
                  </SelectItem>
                  <SelectItem value="approved_by_client">
                    Approved by Client
                  </SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Assets Overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your allocated work assignments
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1">
            {filteredAssets.length} of{" "}
            {allocationLists.flatMap((list) => list.assets).length} assets
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-6">
            {/* Skeleton for allocation list cards */}
            {[...Array(2)].map((_, listIndex) => (
              <Card key={listIndex} className="animate-pulse">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-5 w-5 bg-gray-200 rounded" />
                        <div className="h-6 w-32 bg-gray-200 rounded" />
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="h-4 w-4 bg-gray-200 rounded" />
                            <div className="h-4 w-20 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Table header skeleton */}
                    <div className="grid grid-cols-7 gap-4 pb-2 ">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="h-4 bg-gray-200 rounded" />
                      ))}
                    </div>
                    {/* Table rows skeleton */}
                    {[...Array(3)].map((_, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid grid-cols-7 gap-4 py-3 "
                      >
                        {[...Array(7)].map((_, colIndex) => (
                          <div
                            key={colIndex}
                            className="h-4 bg-gray-200 rounded"
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
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Assets in Batch</h3>
            <p className="text-muted-foreground mb-4">
              This batch doesn&apos;t contain any assets yet.
            </p>
            <Button onClick={() => router.push("/my-assignments")}>
              Back to Assignments
            </Button>
          </Card>
        ) : filteredAssets.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Assets Found</h3>
            <p className="text-muted-foreground">
              No assets match your current filters. Try adjusting your search or
              filters.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" className="space-y-4">
              {allocationLists.map((allocationList) => {
                const visibleAssets = sortAssetsByStatus(
                  allocationList.assets.filter((a) =>
                    filteredAssets.some((f) => f.id === a.id)
                  )
                );
                if (visibleAssets.length === 0) return null;
                return (
                  <AccordionItem
                    value={allocationList.id}
                    key={allocationList.id}
                  >
                    <div
                      className={`bg-card border-2 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                        isOverdue(allocationList.deadline)
                          ? "border-red-200 bg-red-50/30"
                          : allocationList.status === "approved"
                            ? "border-green-200 bg-green-50/30"
                            : "border-border hover:border-primary/30"
                      }`}
                    >
                      <AccordionTrigger className="px-6 py-5 hover:bg-muted/30 transition-all duration-200">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-start gap-4">
                            <div
                              className={`p-3 rounded-xl shadow-sm ${
                                isOverdue(allocationList.deadline)
                                  ? "bg-red-100 text-red-600"
                                  : allocationList.status === "approved"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-primary/10 text-primary"
                              }`}
                            >
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="text-left space-y-2">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-foreground">
                                  Allocation #{allocationList.number}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${
                                    allocationList.status === "approved"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {allocationList.status === "approved"
                                    ? "✓ Approved"
                                    : allocationList.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="p-1 bg-muted rounded">
                                <Package className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <span className="text-lg font-semibold text-foreground">
                                {visibleAssets.length}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {visibleAssets.length === 1 ? "asset" : "assets"}
                            </p>
                            {visibleAssets.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <div className="flex gap-1">
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
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          status === "revisions"
                                            ? "bg-red-100 text-red-700"
                                            : status === "not_started"
                                              ? "bg-gray-100 text-gray-700"
                                              : status === "in_production"
                                                ? "bg-amber-100 text-amber-700"
                                                : status ===
                                                    "delivered_by_artist"
                                                  ? "bg-purple-100 text-purple-700"
                                                  : status ===
                                                      "approved_by_client"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-green-100 text-green-700"
                                        }`}
                                      >
                                        {count}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-6 pb-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">Status</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead className="w-32">
                                  Article ID
                                </TableHead>
                                <TableHead className="w-24">Priority</TableHead>
                                <TableHead className="w-24">Price</TableHead>
                                <TableHead className="w-32">Category</TableHead>
                                <TableHead className="w-24">GLB</TableHead>
                                <TableHead className="w-24">Asset</TableHead>
                                <TableHead className="w-20">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleAssets.map((asset) => (
                                <TableRow
                                  key={asset.id}
                                  className={`${getStatusRowClass(asset.status)} hover:bg-muted/50`}
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(asset.status)}
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${getStatusColor(asset.status)}`}
                                      >
                                        {asset.status === "delivered_by_artist"
                                          ? "Waiting for Approval"
                                          : asset.status === "in_production"
                                            ? "In Progress"
                                            : asset.status === "revisions"
                                              ? "Sent for Revision"
                                              : asset.status ===
                                                  "approved_by_client"
                                                ? "Approved by Client"
                                                : asset.status === "approved"
                                                  ? "Approved"
                                                  : asset.status}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">
                                      {highlightMatch(
                                        asset.product_name,
                                        searchTerm
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {
                                        highlightMatch(
                                          asset.article_id,
                                          searchTerm
                                        ) as any
                                      }
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getPriorityClass(asset.priority)}`}
                                    >
                                      {getPriorityLabel(asset.priority)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {asset.price ? (
                                      <div className="flex items-center gap-1">
                                        <Euro className="h-3 w-3 text-success" />
                                        <span className="font-semibold">
                                          €{asset.price.toFixed(2)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
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
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {asset.glb_link ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleFileDownload(
                                              asset.glb_link!,
                                              `${asset.product_name}-${asset.article_id}.glb`
                                            )
                                          }
                                          className="text-xs h-8 px-3 w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                                        >
                                          <Download className="h-3 w-3 mr-1" />
                                          Download
                                        </Button>
                                      ) : null}
                                      <Button
                                        variant={
                                          asset.glb_link ? "outline" : "default"
                                        }
                                        size="sm"
                                        onClick={() =>
                                          handleOpenUploadDialog(asset, "glb")
                                        }
                                        disabled={uploadingGLB === asset.id}
                                        className={`text-xs h-8 px-3 w-full ${
                                          asset.glb_link
                                            ? "border-blue-200 text-blue-700 hover:bg-blue-50"
                                            : "bg-blue-600 hover:bg-blue-700"
                                        }`}
                                      >
                                        {uploadingGLB === asset.id ? (
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
                                        ) : (
                                          <Upload className="h-3 w-3 mr-1" />
                                        )}
                                        {asset.glb_link ? "Update" : "Upload"}
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleOpenUploadDialog(asset, "asset")
                                        }
                                        disabled={uploadingFile === asset.id}
                                        className="text-xs h-8 px-3 w-full border-green-200 text-green-700 hover:bg-green-50"
                                      >
                                        {uploadingFile === asset.id ? (
                                          <div className="animate-spin rounded-full h-3 w-3  border-current mr-1" />
                                        ) : (
                                          <Image className="h-3 w-3 mr-1" />
                                        )}
                                        Upload
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleOpenFilesManager(asset)
                                        }
                                        className="text-xs h-8 px-3 w-full border-gray-200 text-gray-700 hover:bg-gray-50"
                                      >
                                        <FolderOpen className="h-3 w-3 mr-1" />
                                        Files
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 px-3 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                                        onClick={() =>
                                          handleViewAsset(asset.id)
                                        }
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View
                                      </Button>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 px-3 text-xs border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() =>
                                          handleOpenProductLink(
                                            asset.product_link || ""
                                          )
                                        }
                                        disabled={!asset.product_link}
                                      >
                                        <Link2 className="h-3 w-3 mr-1" />
                                        Product
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
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
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-medium">
              Previous Modeler Files Available
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            These assets have files from previous modelers that you can
            download:
          </p>

          <div className="space-y-4">
            {assetFileHistory.map((history) => {
              const asset = allocationLists
                .flatMap((list) => list.assets)
                .find((asset) => asset.id === history.assetId);

              if (!asset) return null;

              return (
                <Card
                  key={history.assetId}
                  className="p-4 border-amber-200 bg-amber-50/50"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">
                          {asset.product_name} ({asset.article_id})
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Previously worked on by: {history.previousModelerName}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {history.files.glb_link && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
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
                            className="text-xs h-6 px-2"
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Reference Images - {currentAssetName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {currentReferences.length === 0 ? (
              <div className="text-center py-8">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No reference images available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div className="absolute inset-0  bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                      <Button
                        onClick={() => handleDownloadReference(url)}
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-gray-900 hover:bg-gray-100"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>

                    {/* Image number badge */}
                    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
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
        <DialogContent className="max-w-md h-fit">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {currentUploadAsset?.glb_link
                ? "Update GLB File"
                : "Upload GLB File"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Asset:</strong> {currentUploadAsset?.product_name}
              </p>
              <p className="mb-2">
                <strong>Article ID:</strong> {currentUploadAsset?.article_id}
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drop your GLB file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Only .glb and .gltf files are supported
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
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
              >
                Choose File
              </label>
            </div>

            {uploadingGLB === currentUploadAsset?.id && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
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
        <DialogContent className="max-w-md h-fit">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Upload Asset Files
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Asset:</strong> {currentUploadAsset?.product_name}
              </p>
              <p className="mb-2">
                <strong>Article ID:</strong> {currentUploadAsset?.article_id}
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Image className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drop your asset files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
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
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
              >
                Choose Files
              </label>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Selected Files ({selectedFiles.length}):
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSelectedFile(index)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
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
                className="w-full"
              >
                {uploadingMultiple ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Uploading {selectedFiles.length} files...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {selectedFiles.length} Files
                  </>
                )}
              </Button>
            )}

            {uploadingFile === currentUploadAsset?.id && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
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

      {/* Asset Files Manager */}
      {selectedAssetForFiles && (
        <ErrorBoundary>
          <AssetFilesManager
            assetId={selectedAssetForFiles.id}
            isOpen={filesManagerOpen}
            onClose={() => {
              setFilesManagerOpen(false);
              setSelectedAssetForFiles(null);
            }}
            onFilesChange={safeFetchBatchAssets}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
