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
  History,
  Trash2,
  Loader2,
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
  blend_link?: string | null;
  product_link: string | null;
  reference: string[] | string | null;
  internal_reference?: string[] | string | null;
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
  const normalizedRole = (
    (user?.metadata?.role ?? user?.role) as string | undefined
  )
    ?.toString()
    .toLowerCase();
  const isClient = normalizedRole === "client";
  const includeInternalRefs = !isClient;
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

  // New state for dual upload and history
  const [uploadingBlend, setUploadingBlend] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBlendFile, setSelectedBlendFile] = useState<File | null>(null);
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] =
    useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deletingAllVersions, setDeletingAllVersions] = useState(false);

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
          internal_reference,
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

  const fetchVersionHistory = async (assetId: string) => {
    if (!assetId) return;
    setLoadingVersions(true);
    try {
      // Fetch GLB history
      const { data: glbHistory, error: glbError } = await supabase
        .from("glb_upload_history")
        .select("*")
        .eq("asset_id", assetId)
        .order("uploaded_at", { ascending: false });

      if (glbError) {
        console.error("Error fetching version history:", glbError);
        return;
      }

      // Group by timestamp (within 5 seconds) to combine GLB and Blend uploads
      const groups: any[] = [];

      // Add current version
      const currentAsset = assets.find((a) => a.id === assetId);
      if (currentAsset?.glb_link || currentAsset?.blend_link) {
        groups.push({
          id: "current",
          isCurrent: true,
          lastModified: currentAsset.created_at, // Use created_at or updated_at if available
          glbFile: currentAsset.glb_link
            ? {
                fileName: `${currentAsset.article_id}.glb`,
                fileSize: 0, // We don't track current file size in asset table
                fileUrl: currentAsset.glb_link,
              }
            : null,
          blendFile: currentAsset.blend_link
            ? {
                fileName: `${currentAsset.article_id}.blend`,
                fileSize: 0,
                fileUrl: currentAsset.blend_link,
              }
            : null,
        });
      }

      // Process history items
      // Group items by timestamp (within 1 minute) to combine GLB and Blend uploads
      const groupedItems: { [key: string]: any } = {};

      glbHistory?.forEach((item) => {
        // Create a time key (rounded to minutes)
        const date = new Date(item.uploaded_at);
        const timeKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;

        if (!groupedItems[timeKey]) {
          groupedItems[timeKey] = {
            id: item.id, // Use the first ID as group ID
            isCurrent: false,
            isBackup: true,
            lastModified: item.uploaded_at,
            glbFile: null,
            blendFile: null,
          };
        }

        const isBlend = item.file_name.toLowerCase().endsWith(".blend");
        const isGlb =
          item.file_name.toLowerCase().endsWith(".glb") ||
          item.file_name.toLowerCase().endsWith(".gltf");

        if (isGlb) {
          groupedItems[timeKey].glbFile = {
            fileName: item.file_name,
            fileSize: item.file_size,
            fileUrl: item.glb_url,
          };
        } else if (isBlend) {
          groupedItems[timeKey].blendFile = {
            fileName: item.file_name,
            fileSize: item.file_size,
            fileUrl: item.glb_url, // Stored in glb_url column
          };
        }
      });

      // Add grouped items to groups array
      Object.values(groupedItems).forEach((group) => {
        groups.push(group);
      });

      // Sort by lastModified descending
      groups.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
      );

      setVersionHistory(groups);
    } catch (error) {
      console.error("Error fetching version history:", error);
    } finally {
      setLoadingVersions(false);
    }
  };

  const deleteAllVersions = async () => {
    if (!currentUploadAsset) return;
    setDeletingAllVersions(true);
    try {
      const { error } = await supabase
        .from("glb_upload_history")
        .delete()
        .eq("asset_id", currentUploadAsset.id);

      if (error) throw error;

      toast.success("All version history deleted");
      await fetchVersionHistory(currentUploadAsset.id);
    } catch (error) {
      console.error("Error deleting versions:", error);
      toast.error("Failed to delete version history");
    } finally {
      setDeletingAllVersions(false);
    }
  };

  const handleUploadBothFiles = async () => {
    if (!currentUploadAsset) return;
    if (!selectedFile && !selectedBlendFile) {
      toast.error("Please select at least one file to upload");
      return;
    }

    // Prevent multiple simultaneous uploads
    if (uploadingGLB || uploadingBlend) {
      return;
    }

    setUploadingGLB(currentUploadAsset.id);
    setUploadingBlend(true);

    let glbSuccess = false;
    let blendSuccess = false;

    try {
      // === BACKUP PHASE ===
      const sharedTimestamp = Date.now();

      if (selectedFile && currentUploadAsset.glb_link) {
        try {
          const cleanGlbUrl = currentUploadAsset.glb_link.split("?")[0];
          await fetch("/api/assets/backup-glb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: currentUploadAsset.id,
              glbUrl: cleanGlbUrl,
              timestamp: sharedTimestamp,
            }),
          });
        } catch (backupError) {
          console.error("Error creating GLB backup:", backupError);
        }
      }

      if (selectedBlendFile && currentUploadAsset.blend_link) {
        try {
          const cleanBlendUrl = currentUploadAsset.blend_link.split("?")[0];
          await fetch("/api/assets/backup-blend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: currentUploadAsset.id,
              blendUrl: cleanBlendUrl,
              timestamp: sharedTimestamp,
            }),
          });
        } catch (backupError) {
          console.error("Error creating Blender backup:", backupError);
        }
      }

      // === UPLOAD PHASE ===
      const uploadPromises = [];

      // GLB Upload
      if (selectedFile) {
        const glbUploadPromise = (async () => {
          try {
            const isLargeFile = selectedFile.size > 3.5 * 1024 * 1024;
            let uploadResult: any;

            if (isLargeFile) {
              const { DirectFileUploader } = await import("@/lib/directUpload");
              const uploader = new DirectFileUploader();
              const result = await uploader.uploadFile(
                selectedFile,
                currentUploadAsset.id,
                "glb",
                client
              );
              if (!result.success)
                throw new Error(result.error || "Direct GLB upload failed");
              uploadResult = { url: result.cdnUrl };
            } else {
              const formData = new FormData();
              formData.append("file", selectedFile);
              formData.append("asset_id", currentUploadAsset.id);
              formData.append("file_type", "glb");
              formData.append("client_name", client);

              const uploadResponse = await fetch("/api/assets/upload-file", {
                method: "POST",
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || "Upload failed");
              }
              uploadResult = await uploadResponse.json();
            }

            const cleanUrl = uploadResult.url.split("?")[0];

            // Update GLB link and status
            const { error: updateError } = await supabase
              .from("onboarding_assets")
              .update({
                glb_link: cleanUrl,
                status: "approved", // Auto-approve on QA upload
              })
              .eq("id", currentUploadAsset.id);

            if (updateError) throw updateError;

            // Record history
            await supabase.from("glb_upload_history").insert({
              asset_id: currentUploadAsset.id,
              glb_url: cleanUrl,
              file_name: selectedFile.name,
              file_size: selectedFile.size,
              uploaded_by: user?.id,
              uploaded_at: new Date().toISOString(),
            });

            glbSuccess = true;
            return { type: "glb", url: cleanUrl };
          } catch (error) {
            console.error("Error uploading GLB:", error);
            throw error;
          }
        })();
        uploadPromises.push(glbUploadPromise);
      }

      // Blender Upload
      if (selectedBlendFile) {
        const blendUploadPromise = (async () => {
          try {
            const isLargeFile = selectedBlendFile.size > 3.5 * 1024 * 1024;
            let uploadResult: any;

            if (isLargeFile) {
              const { DirectFileUploader } = await import("@/lib/directUpload");
              const uploader = new DirectFileUploader();
              const result = await uploader.uploadFile(
                selectedBlendFile,
                currentUploadAsset.id,
                "blend",
                client
              );
              if (!result.success)
                throw new Error(result.error || "Direct Blender upload failed");
              uploadResult = { url: result.cdnUrl };
            } else {
              const formData = new FormData();
              formData.append("file", selectedBlendFile);
              formData.append("asset_id", currentUploadAsset.id);
              formData.append("file_type", "blend");
              formData.append("client_name", client);

              const uploadResponse = await fetch("/api/assets/upload-file", {
                method: "POST",
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || "Upload failed");
              }
              uploadResult = await uploadResponse.json();
            }

            const cleanUrl = uploadResult.url.split("?")[0];

            const { error: updateError } = await supabase
              .from("onboarding_assets")
              .update({
                blend_link: cleanUrl,
              })
              .eq("id", currentUploadAsset.id);

            if (updateError) throw updateError;

            // Record history for Blend
            // We use glb_upload_history for both, storing Blend URL in glb_url
            await supabase.from("glb_upload_history").insert({
              asset_id: currentUploadAsset.id,
              glb_url: cleanUrl,
              file_name: selectedBlendFile.name,
              file_size: selectedBlendFile.size,
              uploaded_by: user?.id,
              uploaded_at: new Date().toISOString(),
            });

            blendSuccess = true;
            return { type: "blend", url: cleanUrl };
          } catch (error) {
            console.error("Error uploading Blender file:", error);
            throw error;
          }
        })();
        uploadPromises.push(blendUploadPromise);
      }

      await Promise.all(uploadPromises);

      // Mark old annotations
      if (glbSuccess) {
        await supabase
          .from("asset_annotations")
          .update({ is_old_annotation: true })
          .eq("asset_id", currentUploadAsset.id);
      }

      if (glbSuccess && blendSuccess) {
        toast.success("Both files uploaded successfully!");
      } else if (glbSuccess) {
        toast.success("GLB file uploaded successfully!");
      } else if (blendSuccess) {
        toast.success("Blender file uploaded successfully!");
      }

      setGlbUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedBlendFile(null);
      await fetchQAAssets();
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(error.message || "Failed to upload files");
    } finally {
      setUploadingGLB(null);
      setUploadingBlend(false);
    }
  };

  const handleOpenUploadDialog = (asset: QAAsset) => {
    setCurrentUploadAsset(asset);
    setGlbUploadDialogOpen(true);
    setSelectedFile(null);
    setSelectedBlendFile(null);
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
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".glb") || fileName.endsWith(".gltf")) {
        setSelectedFile(file);
      } else if (fileName.endsWith(".blend")) {
        setSelectedBlendFile(file);
      } else {
        toast.error("Unsupported file type");
      }
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

  const getVisibleReferences = (
    asset:
      | {
          reference?: string[] | string | null;
          internal_reference?: string[] | string | null;
        }
      | null
      | undefined
  ): string[] => {
    if (!asset) return [];
    const clientRefs = parseReferences(asset.reference ?? null);
    if (!includeInternalRefs) {
      return clientRefs;
    }
    const internalRefs = parseReferences(asset.internal_reference ?? null);
    return [...clientRefs, ...internalRefs];
  };

  const separateReferences = (
    asset:
      | {
          reference?: string[] | string | null;
          internal_reference?: string[] | string | null;
        }
      | null
      | undefined
  ) => {
    const allReferences = getVisibleReferences(asset);
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
                    <TableHead className="w-40">Files</TableHead>
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
                        <div className="flex flex-col gap-2">
                          {/* Download Buttons */}
                          <div className="flex gap-1 flex-wrap">
                            {asset.glb_link && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const fileName =
                                    asset.glb_link?.split("/").pop() ||
                                    `${asset.article_id}.glb`;
                                  handleFileDownload(asset.glb_link!, fileName);
                                }}
                                className="text-xs h-6 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                                title="Download GLB"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                GLB
                              </Button>
                            )}
                            {asset.blend_link && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const fileName =
                                    asset.blend_link?.split("/").pop() ||
                                    `${asset.article_id}.blend`;
                                  handleFileDownload(
                                    asset.blend_link!,
                                    fileName
                                  );
                                }}
                                className="text-xs h-6 px-2 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                                title="Download Blend"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Blend
                              </Button>
                            )}
                          </div>

                          {/* Upload/Update Button (QA Only) */}
                          {(asset.qa_team_handles_model ||
                            asset.pricing_option_id ===
                              "qa_team_handles_model") && (
                            <Button
                              variant={
                                asset.glb_link || asset.blend_link
                                  ? "outline"
                                  : "default"
                              }
                              size="sm"
                              onClick={() => handleOpenUploadDialog(asset)}
                              disabled={
                                uploadingGLB === asset.id || uploadingBlend
                              }
                              className="text-xs h-7 w-full justify-start"
                            >
                              {uploadingGLB === asset.id || uploadingBlend ? (
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3 mr-2" />
                              )}
                              {asset.glb_link || asset.blend_link
                                ? "Update Files"
                                : "Upload Files"}
                            </Button>
                          )}

                          {/* History Button */}
                        </div>
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
                          {(() => {
                            const separated = separateReferences(asset);
                            return (
                              separated.imageReferences.length +
                              separated.glbFiles.length +
                              (asset.glb_link ? 1 : 0)
                            );
                          })()}
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

      {/* Unified Upload Dialog */}
      <Dialog open={glbUploadDialogOpen} onOpenChange={setGlbUploadDialogOpen}>
        <DialogContent className="max-w-2xl w-full h-fit max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Model Files
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Asset Info */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Asset:</span>
                  <p className="font-medium">
                    {currentUploadAsset?.product_name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Article ID:</span>
                  <p className="font-mono font-medium">
                    {currentUploadAsset?.article_id}
                  </p>
                </div>
              </div>
            </div>

            {/* File Status Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`rounded-lg border-2 p-3 ${
                  selectedFile
                    ? "border-amber-300 bg-amber-50"
                    : currentUploadAsset?.glb_link
                      ? "border-blue-200 bg-blue-50"
                      : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">GLB File</span>
                  {selectedFile ? (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      WILL REPLACE
                    </span>
                  ) : currentUploadAsset?.glb_link ? (
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  ) : null}
                </div>
                {selectedFile ? (
                  <div>
                    <p
                      className="text-xs font-medium text-amber-900 mb-1"
                      title={selectedFile.name}
                    >
                      New:{" "}
                      {selectedFile.name.length > 25
                        ? `${selectedFile.name.substring(0, 25)}...`
                        : selectedFile.name}
                    </p>
                    {currentUploadAsset?.glb_link && (
                      <p className="text-xs text-muted-foreground">
                        Current file will be backed up
                      </p>
                    )}
                  </div>
                ) : currentUploadAsset?.glb_link ? (
                  <div>
                    <p className="text-xs text-blue-700 font-medium mb-1">
                      Current file exists
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Select new file to replace
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not uploaded yet
                  </p>
                )}
              </div>
              <div
                className={`rounded-lg border-2 p-3 ${
                  selectedBlendFile
                    ? "border-amber-300 bg-amber-50"
                    : currentUploadAsset?.blend_link
                      ? "border-purple-200 bg-purple-50"
                      : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Blender File</span>
                  {selectedBlendFile ? (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      WILL REPLACE
                    </span>
                  ) : currentUploadAsset?.blend_link ? (
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                  ) : null}
                </div>
                {selectedBlendFile ? (
                  <div>
                    <p
                      className="text-xs font-medium text-amber-900 mb-1"
                      title={selectedBlendFile.name}
                    >
                      New:{" "}
                      {selectedBlendFile.name.length > 25
                        ? `${selectedBlendFile.name.substring(0, 25)}...`
                        : selectedBlendFile.name}
                    </p>
                    {currentUploadAsset?.blend_link && (
                      <p className="text-xs text-muted-foreground">
                        Current file will be backed up
                      </p>
                    )}
                  </div>
                ) : currentUploadAsset?.blend_link ? (
                  <div>
                    <p className="text-xs text-purple-700 font-medium mb-1">
                      Current file exists
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Select new file to replace
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not uploaded yet
                  </p>
                )}
              </div>
            </div>

            {/* GLB File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                GLB File (.glb or .gltf)
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-50"
                    : "border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const fileName = file.name.toLowerCase();
                      if (
                        fileName.endsWith(".glb") ||
                        fileName.endsWith(".gltf")
                      ) {
                        setSelectedFile(file);
                      } else {
                        toast.error("Please select a GLB or GLTF file");
                      }
                    }
                  }}
                  className="hidden"
                  id="glb-file-input"
                />
                <label htmlFor="glb-file-input" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">
                    {selectedFile
                      ? selectedFile.name
                      : "Click to select GLB file"}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Must match:{" "}
                    <span className="font-mono bg-blue-100 px-1 py-0.5 rounded">
                      {currentUploadAsset?.article_id}.glb
                    </span>
                  </p>
                </label>
                {selectedFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedFile(null);
                    }}
                    className="mt-2 text-xs"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Blender File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                Blender File (.blend)
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? "border-purple-400 bg-purple-50"
                    : "border-purple-200 bg-purple-50/50 hover:bg-purple-50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".blend"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const fileName = file.name.toLowerCase();
                      if (fileName.endsWith(".blend")) {
                        setSelectedBlendFile(file);
                      } else {
                        toast.error("Please select a Blender (.blend) file");
                      }
                    }
                  }}
                  className="hidden"
                  id="blend-file-input"
                />
                <label htmlFor="blend-file-input" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-sm font-medium text-purple-900">
                    {selectedBlendFile
                      ? selectedBlendFile.name
                      : "Click to select Blender file"}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Must match:{" "}
                    <span className="font-mono bg-purple-100 px-1 py-0.5 rounded">
                      {currentUploadAsset?.article_id}.blend
                    </span>
                  </p>
                </label>
                {selectedBlendFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedBlendFile(null);
                    }}
                    className="mt-2 text-xs"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setGlbUploadDialogOpen(false)}
                disabled={!!uploadingGLB || uploadingBlend}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadBothFiles}
                disabled={
                  !!uploadingGLB ||
                  uploadingBlend ||
                  (!selectedFile && !selectedBlendFile)
                }
                className="flex-1"
              >
                {uploadingGLB || uploadingBlend ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {currentUploadAsset?.glb_link ||
                    currentUploadAsset?.blend_link
                      ? "Replace & Upload"
                      : "Upload Files"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog
        open={showVersionHistoryDialog}
        onOpenChange={setShowVersionHistoryDialog}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  File Version History
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  View and download previous versions of GLB and Blend files.
                </p>
              </div>
              {versionHistory.length > 0 &&
                versionHistory.some((v: any) => !v.isCurrent) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={deleteAllVersions}
                    disabled={deletingAllVersions}
                    className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingAllVersions ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete All
                      </>
                    )}
                  </Button>
                )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading version history...
                </span>
              </div>
            ) : versionHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No version history
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload GLB or Blend files to start version history
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-2">
                {versionHistory.map((group: any) => (
                  <Card
                    key={group.id}
                    className={`p-4 transition-all duration-200 ${
                      group.isCurrent
                        ? "ring-2 ring-primary/20 bg-primary/5"
                        : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {group.isCurrent === true && (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800 border-green-200"
                            >
                              Current
                            </Badge>
                          )}
                          {group.isBackup === true && (
                            <Badge variant="outline">Backup</Badge>
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {new Date(group.lastModified).toLocaleString()}
                          </span>
                        </div>

                        {/* File Download Links */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.glbFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleFileDownload(
                                  group.glbFile.fileUrl || group.glbFile.glbUrl,
                                  group.glbFile.fileName
                                )
                              }
                              className="text-xs h-7 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              GLB ({group.glbFile.fileName})
                            </Button>
                          )}
                          {group.blendFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleFileDownload(
                                  group.blendFile.fileUrl,
                                  group.blendFile.fileName
                                )
                              }
                              className="text-xs h-7 bg-purple-50 text-purple-700 hover:bg-purple-100"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Blend ({group.blendFile.fileName})
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
