"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { AssetFilesManager } from "@/components/asset-library/AssetFilesManager";

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
  deadline: string;
  bonus: number;
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
          deadline,
          bonus,
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
            deadline: list.deadline,
            bonus: list.bonus,
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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "delivered_by_artist":
        return <Clock className="h-4 w-4 text-purple-600" />;
      case "in_production":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "not_started":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "revisions":
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "delivered_by_artist":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "in_production":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "not_started":
        return "bg-red-100 text-red-800 border-red-200";
      case "revisions":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1:
        return "bg-red-100 text-red-800 border-red-200";
      case 2:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 3:
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleViewAsset = (assetId: string) => {
    router.push(`/modeler-review/${assetId}`);
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
      if (!file.name.toLowerCase().endsWith(".glb")) {
        toast.error("Please select a GLB file");
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

      const result = await response.json();
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

      const result = await response.json();
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

  const handleFileInputChange = (
    assetId: string,
    type: "glb" | "asset",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear the input value to allow re-uploading the same file
    event.target.value = "";

    if (type === "glb") {
      handleUploadGLB(assetId, file);
    } else {
      handleUploadAsset(assetId, file);
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
      <div className="flex flex-1 flex-col p-4 sm:p-12">
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
    <div className="flex flex-1 flex-col p-4 sm:p-18">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/my-assignments")}
            className="flex items-center gap-2"
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
        <div className="flex items-center gap-4 text-muted-foreground">
          <p>Manage and review all assets in this batch</p>
          {allocationLists.length > 0 && allocationLists[0]?.deadline && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Deadline:{" "}
                {new Date(allocationLists[0].deadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Batch Earnings Statistics */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Euro className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Potential Earnings
                </p>
                <p className="text-2xl font-bold text-blue-600">
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
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed Earnings
                </p>
                <p className="text-2xl font-medium text-green-600">
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
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Earnings
                </p>
                <p className="text-2xl font-bold text-orange-600">
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bonus Earnings
                </p>
                <p className="text-2xl font-bold text-purple-600">
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
          <Card className="p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          </Card>
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
                        {allocationList.name}
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
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
                        <div className="flex items-center gap-1">
                          <span>{allocationList.assets.length} assets</span>
                        </div>
                      </div>
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
                              className={`text-xs ${getPriorityColor(asset.priority)}`}
                            >
                              {asset.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {asset.price ? (
                              <div className="flex items-center gap-1">
                                <Euro className="h-3 w-3 text-green-600" />
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
                Supports ZIP archives, 3D files (BLEND, OBJ, FBX), images, and
                other asset formats
              </p>

              <input
                type="file"
                multiple
                accept=".zip,.blend,.obj,.fbx,.dae,.max,.ma,.mb,.3ds,.stl,.ply,.wrl,.x3d,.usd,.abc,.c4d,.skp,.dwg,.dxf,.iges,.step,.stp,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tga,.hdr,.exr,.psd,.ai,.eps,.svg,.pdf"
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
    </div>
  );
}
