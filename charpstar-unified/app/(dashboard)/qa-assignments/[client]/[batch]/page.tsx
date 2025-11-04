"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { getPriorityLabel } from "@/lib/constants";
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
  Search,
  Package,
  Clock,
  CheckCircle,
  RotateCcw,
  Eye,
  Building,
  ArrowLeft,
  Download,
  Upload,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

interface QAAsset {
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
  created_at: string;
  revision_count: number;
  glb_link: string | null;
  product_link: string | null;
  reference: string[] | null;
  measurements?: any;
  qa_team_handles_model?: boolean;
  pricing_option_id?: string;
}

interface BatchStats {
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
  waitingForApprovalAssets: number;
  completionPercentage: number;
  urgentAssets: number;
}

export default function QABatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const client = decodeURIComponent(params.client as string);
  const batch = parseInt(params.batch as string);
  const filter = searchParams?.get("filter");

  const [assets, setAssets] = useState<QAAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<QAAsset[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    totalAssets: 0,
    completedAssets: 0,
    inProgressAssets: 0,
    pendingAssets: 0,
    revisionAssets: 0,
    waitingForApprovalAssets: 0,
    completionPercentage: 0,
    urgentAssets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadingGLB, setUploadingGLB] = useState<string | null>(null);
  const [showViewRefDialog, setShowViewRefDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] =
    useState<QAAsset | null>(null);
  const [glbUploadDialogOpen, setGlbUploadDialogOpen] = useState(false);
  const [currentUploadAsset, setCurrentUploadAsset] = useState<QAAsset | null>(
    null
  );
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    document.title = `CharpstAR Platform - QA Assignments - ${client} Batch ${batch}`;
  }, [client, batch]);

  useEffect(() => {
    if (user?.id) {
      fetchQAAssets();
    }
  }, [user?.id, client, batch]);

  useEffect(() => {
    filterAndSortAssets();
  }, [assets, searchTerm, statusFilter, filter]);

  const fetchQAAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // Get ALL assets for this specific client and batch (not just QA-handled)
      // QA needs to see all models in the batch to review previous modeler work
      const { data: qaAssets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select(
          `
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
          measurements,
          qa_team_handles_model,
          pricing_option_id
        `
        )
        .eq("client", client)
        .eq("batch", batch);

      if (assetsError) {
        console.error("Error fetching QA assets:", assetsError);
        toast.error("Failed to fetch QA assets");
        return;
      }

      if (!qaAssets || qaAssets.length === 0) {
        setAssets([]);
        toast.error("No assets found for this batch");
        return;
      }

      setAssets(qaAssets as QAAsset[]);

      // Calculate batch statistics
      const totalAssets = qaAssets.length;
      const completedAssets = qaAssets.filter(
        (asset) =>
          asset.status === "approved_by_client" || asset.status === "approved"
      ).length;
      const inProgressAssets = qaAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pendingAssets = qaAssets.filter(
        (asset) => asset.status === "not_started"
      ).length;
      const revisionAssets = qaAssets.filter(
        (asset) =>
          asset.status === "revisions" || asset.status === "client_revision"
      ).length;
      const waitingForApprovalAssets = qaAssets.filter(
        (asset) => asset.status === "delivered_by_artist"
      ).length;
      const urgentAssets = qaAssets.filter(
        (asset) => asset.priority === 1
      ).length;

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
        urgentAssets,
      });
    } catch (error) {
      console.error("Error fetching QA assets:", error);
      toast.error("Failed to fetch QA assets");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const filterAndSortAssets = () => {
    let filtered = [...assets];

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
          asset.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((asset) => asset.status === statusFilter);
    }

    setFilteredAssets(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
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
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

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
      default:
        return status;
    }
  };

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

  const handleUploadGLB = async (assetId: string, file: File) => {
    try {
      setUploadingGLB(assetId);

      const asset = assets.find((a) => a.id === assetId);
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

      // Update the asset with the new GLB link
      // QA uploads should instantly approve the asset
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: result.url,
          status: "approved",
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
          glb_url: result.url,
          file_name: file.name,
          file_size: file.size,
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        });

      if (newHistoryError) {
        console.error(
          "Error recording GLB upload to history:",
          newHistoryError
        );
      }

      toast.success("GLB file uploaded successfully");
      await fetchQAAssets(); // Refresh assets
    } catch (error: any) {
      console.error("Error uploading GLB:", error);
      toast.error(error.message || "Failed to upload GLB file");
    } finally {
      setUploadingGLB(null);
      setGlbUploadDialogOpen(false);
      setCurrentUploadAsset(null);
    }
  };

  const handleOpenUploadDialog = (asset: QAAsset) => {
    setCurrentUploadAsset(asset);
    setGlbUploadDialogOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentUploadAsset) {
      handleUploadGLB(currentUploadAsset.id, file);
    }
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

    const file = e.dataTransfer.files?.[0];
    if (file && currentUploadAsset) {
      handleUploadGLB(currentUploadAsset.id, file);
    }
  };

  const parseReferences = (
    referenceImages: string[] | string | null
  ): string[] => {
    if (!referenceImages) return [];
    if (Array.isArray(referenceImages)) return referenceImages;
    if (typeof referenceImages === "string") {
      if (referenceImages.includes("|||")) {
        return referenceImages
          .split("|||")
          .map((ref) => ref.trim())
          .filter(Boolean);
      }
      try {
        const parsed = JSON.parse(referenceImages);
        return Array.isArray(parsed) ? parsed : [referenceImages];
      } catch {
        return [referenceImages];
      }
    }
    return [];
  };

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

  if (!user) {
    return null;
  }

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

  if (user.metadata?.role !== "qa") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for QA team members.
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
            onClick={() => router.push("/qa-assignments")}
            className="gap-2 text-muted-foreground hover:text-foreground w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Assignments</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <Badge variant="outline" className="gap-1 w-fit">
            <Package className="h-3 w-3" />
            QA Assignments
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Building className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-semibold text-foreground truncate">
                {client} - Batch {batch}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                All Models (QA can review modeler work and handle QA models)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Total
            </div>
            <div className="text-lg sm:text-2xl font-bold">
              {batchStats.totalAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Completed
            </div>
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {batchStats.completedAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              In Progress
            </div>
            <div className="text-lg sm:text-2xl font-bold text-blue-600">
              {batchStats.inProgressAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Pending
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-600">
              {batchStats.pendingAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Revisions
            </div>
            <div className="text-lg sm:text-2xl font-bold text-orange-600">
              {batchStats.revisionAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Waiting
            </div>
            <div className="text-lg sm:text-2xl font-bold text-purple-600">
              {batchStats.waitingForApprovalAssets}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">
              Progress
            </div>
            <div className="text-lg sm:text-2xl font-bold">
              {batchStats.completionPercentage}%
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name, article ID, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="delivered_by_artist">Delivered</SelectItem>
            <SelectItem value="revisions">Revisions</SelectItem>
            <SelectItem value="approved_by_client">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Table */}
      {loading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assets...</p>
        </Card>
      ) : filteredAssets.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Assets Found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== "all" || filter === "urgent"
              ? "Try adjusting your filters"
              : "No assets found in this batch"}
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Assets ({filteredAssets.length})
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead className="w-32">Product Name</TableHead>
                    <TableHead className="w-32">Article ID</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-24">Category</TableHead>
                    <TableHead className="w-24">GLB</TableHead>
                    <TableHead className="w-24">References</TableHead>
                    <TableHead className="w-20">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {asset.qa_team_handles_model ||
                          asset.pricing_option_id ===
                            "qa_team_handles_model" ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                            >
                              QA
                            </Badge>
                          ) : null}
                          <span>{asset.product_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-mono">
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
                        {asset.qa_team_handles_model ||
                        asset.pricing_option_id === "qa_team_handles_model" ? (
                          <div className="flex flex-col gap-1">
                            {asset.glb_link ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const fileName =
                                    asset.glb_link?.split("/").pop() ||
                                    `${asset.article_id}.glb`;
                                  handleFileDownload(asset.glb_link!, fileName);
                                }}
                                className="text-xs h-6 px-2"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            ) : null}
                            <Button
                              variant={asset.glb_link ? "ghost" : "default"}
                              size="sm"
                              onClick={() => handleOpenUploadDialog(asset)}
                              disabled={uploadingGLB === asset.id}
                              className="text-xs h-6 px-2"
                            >
                              {uploadingGLB === asset.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
                              ) : (
                                <Upload className="h-3 w-3 mr-1" />
                              )}
                              {asset.glb_link ? "Update" : "Upload"}
                            </Button>
                          </div>
                        ) : asset.glb_link ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const fileName =
                                asset.glb_link?.split("/").pop() ||
                                `${asset.article_id}.glb`;
                              handleFileDownload(asset.glb_link!, fileName);
                            }}
                            className="text-xs h-6 px-2"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
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
                          {separateReferences(asset.reference || null)
                            .imageReferences.length +
                            separateReferences(asset.reference || null).glbFiles
                              .length +
                            (asset.glb_link ? 1 : 0)}
                          )
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-fit h-6 px-2"
                          onClick={() =>
                            window.open(
                              `/modeler-review/${asset.id}?from=qa-assignments&client=${encodeURIComponent(client)}&batch=${batch}`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GLB Upload Dialog */}
      <Dialog
        open={glbUploadDialogOpen}
        onOpenChange={setGlbUploadDialogOpen}
        modal={false}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentUploadAsset?.glb_link
                ? "Update GLB File"
                : "Upload GLB File"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Asset:</strong> {currentUploadAsset?.product_name}
              </p>
              <p>
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
              <p className="text-xs text-muted-foreground mb-2">
                Only .glb and .gltf files are supported
              </p>
              <p className="text-xs text-amber-600 font-medium mb-4">
                File name must match Article ID:{" "}
                <span className="font-mono bg-amber-100 px-1 py-0.5 rounded">
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
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
              >
                Choose File
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View References Dialog */}
      <ViewReferencesDialog
        open={showViewRefDialog}
        onOpenChange={setShowViewRefDialog}
        asset={selectedAssetForView}
      />
    </div>
  );
}
