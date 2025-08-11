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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  ExternalLink,
  Download,
  Upload,
  File,
  Image,
  Euro,
  MoreHorizontal,
  FolderOpen,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { AssetFilesManager } from "@/components/asset-library/AssetFilesManager";
import { InvoiceGenerator } from "@/components/invoice";

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
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedAllocationListId, setSelectedAllocationListId] =
    useState<string>("");
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
          user_id,
          profiles!inner(title, email)
        `
        )
        .in("asset_id", assetIds)
        .eq("role", "modeler")
        .neq("user_id", user?.id)
        .order("created_at", { ascending: false });

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
            const profile = Array.isArray(assignment.profiles)
              ? assignment.profiles[0]
              : assignment.profiles;

            const assetGlbHistory =
              glbHistory?.filter((h) => h.asset_id === assignment.asset_id) ||
              [];

            const assetAdditionalFiles =
              assetFiles?.filter((f) => f.asset_id === assignment.asset_id) ||
              [];

            history.push({
              assetId: assignment.asset_id,
              previousModelerId: assignment.user_id,
              previousModelerName:
                profile?.title || profile?.email || "Unknown",
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
      const completedAssets = allAssets.filter(
        (asset) => asset.status === "approved"
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

      const completedEarnings = allAssets
        .filter((asset) => asset.status === "approved")
        .reduce((sum, asset) => {
          const bonus = asset.bonus || 0;
          return sum + (asset.price || 0) * (1 + bonus / 100);
        }, 0);

      const pendingEarnings = allAssets
        .filter((asset) => asset.status !== "approved")
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
    } finally {
      setLoading(false);
      stopLoading();
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
        return "bg-info-muted text-info border-info/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleViewAsset = (assetId: string) => {
    router.push(
      `/modeler-review/${assetId}?from=my-assignments&client=${encodeURIComponent(params.client as string)}&batch=${params.batch}`
    );
  };

  const handleGenerateInvoice = (allocationListId: string) => {
    setSelectedAllocationListId(allocationListId);
    setShowInvoice(true);
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

      // Validate file
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
        toast.error("Please select a GLB or GLTF file");
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_id", assetId);
      formData.append("file_type", "glb");

      const response = await fetch("/api/assets/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload GLB file");
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
    setCurrentUploadAsset(asset);
    setUploadType(type);
    if (type === "glb") {
      setGlbUploadDialogOpen(true);
    } else {
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
    if (!currentUploadAsset) return;

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

  if (!user) {
    return null;
  }

  if (user.metadata?.role !== "modeler") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
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
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/my-assignments")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assignments
          </Button>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">{client}</h1>
          <Badge variant="outline" className="text-lg px-3 py-1">
            Batch {batch}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground"></div>
      </div>

      {/* Batch Earnings Statistics */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <div className="h-5 w-5 bg-gray-300 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-6 w-20 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-muted rounded-lg">
                <Euro className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Potential Earnings
                </p>
                <p className="text-2xl font-bold text-info">
                  €{batchStats.totalPotentialEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets} assets • €
                  {batchStats.averageAssetPrice.toFixed(2)} avg
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
                  Completed Earnings
                </p>
                <p className="text-2xl font-medium text-success">
                  €{batchStats.completedEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.completedAssets} assets completed
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-muted rounded-lg">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Earnings
                </p>
                <p className="text-2xl font-bold text-warning">
                  €{batchStats.pendingEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.totalAssets - batchStats.completedAssets} assets
                  remaining
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-purple/10 rounded-lg">
                <Package className="h-5 w-5 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bonus Earnings
                </p>
                <p className="text-2xl font-bold text-accent-purple">
                  €{batchStats.totalBonusEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batchStats.completionPercentage}% completion
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      {loading ? (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="w-full sm:w-48 h-10 bg-gray-200 rounded animate-pulse" />
            <div className="w-full sm:w-48 h-10 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_production">In Progress</SelectItem>
                <SelectItem value="revisions">Sent for Revisions</SelectItem>
                <SelectItem value="delivered_by_artist">
                  Waiting for Approval
                </SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="article_id">Article ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Batch Assets</h2>
          <Badge variant="outline">
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
                    <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="h-4 bg-gray-200 rounded" />
                      ))}
                    </div>
                    {/* Table rows skeleton */}
                    {[...Array(3)].map((_, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid grid-cols-7 gap-4 py-3 border-b"
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
            {allocationLists.map((allocationList) => (
              <Card key={allocationList.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Allocation {allocationList.number} -{" "}
                        {new Date(allocationList.deadline).toLocaleDateString()}{" "}
                        - {allocationList.assets.length} assets
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span
                            className={
                              isOverdue(allocationList.deadline)
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            Deadline:{" "}
                            {new Date(
                              allocationList.deadline
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Euro className="h-4 w-4" />
                          <span>Bonus: +{allocationList.bonus}%</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            allocationList.status === "approved"
                              ? "bg-success-muted text-success border-success/20"
                              : "bg-warning-muted text-warning border-warning/20"
                          }`}
                        >
                          {allocationList.status === "approved"
                            ? "Approved"
                            : allocationList.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Invoice Button - Only show if allocation list is approved */}
                      {allocationList.status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleGenerateInvoice(allocationList.id)
                          }
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Generate Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="w-32">Article ID</TableHead>
                        <TableHead className="w-24">Priority</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                        <TableHead className="w-32">Category</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocationList.assets.map((asset) => (
                        <TableRow key={asset.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(asset.status)}
                              <Badge
                                variant="outline"
                                className={`text-xs ${getStatusColor(asset.status)}`}
                              >
                                {asset.status === "delivered_by_artist"
                                  ? "Waiting for Approval"
                                  : asset.status === "not_started"
                                    ? "Not Started"
                                    : asset.status === "in_production"
                                      ? "In Progress"
                                      : asset.status === "revisions"
                                        ? "Sent for Revision"
                                        : asset.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {asset.product_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {asset.article_id}
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
                              {asset.category}
                              {asset.subcategory && (
                                <div className="text-xs text-muted-foreground">
                                  {asset.subcategory}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleViewAsset(asset.id)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Asset
                                </DropdownMenuItem>

                                {asset.product_link && (
                                  <DropdownMenuItem asChild>
                                    <a
                                      href={asset.product_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Product Link
                                    </a>
                                  </DropdownMenuItem>
                                )}

                                {asset.reference && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenReferences(asset)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    View References (
                                    {parseReferences(asset.reference).length})
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() =>
                                    handleOpenUploadDialog(asset, "glb")
                                  }
                                >
                                  {uploadingGLB === asset.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                                  ) : (
                                    <Upload className="h-4 w-4 mr-2" />
                                  )}
                                  {asset.glb_link ? "Update GLB" : "Upload GLB"}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() =>
                                    handleOpenUploadDialog(asset, "asset")
                                  }
                                >
                                  {uploadingFile === asset.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2" />
                                  ) : (
                                    <Image className="h-4 w-4 mr-2" />
                                  )}
                                  Upload Asset
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleOpenFilesManager(asset)}
                                >
                                  <FolderOpen className="h-4 w-4 mr-2" />
                                  View Files
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
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
      <Dialog open={glbUploadDialogOpen} onOpenChange={setGlbUploadDialogOpen}>
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
        <AssetFilesManager
          assetId={selectedAssetForFiles.id}
          isOpen={filesManagerOpen}
          onClose={() => {
            setFilesManagerOpen(false);
            setSelectedAssetForFiles(null);
          }}
          onFilesChange={fetchBatchAssets}
        />
      )}

      {/* Invoice Generator Modal */}
      {showInvoice && selectedAllocationListId && (
        <InvoiceGenerator
          allocationListId={selectedAllocationListId}
          onClose={() => {
            setShowInvoice(false);
            setSelectedAllocationListId("");
          }}
        />
      )}
    </div>
  );
}
