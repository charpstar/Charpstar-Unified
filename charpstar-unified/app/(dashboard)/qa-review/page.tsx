"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  X,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { getPriorityLabel } from "@/lib/constants";
import dayjs from "@/utils/dayjs";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};

const STATUS_LABELS = {
  in_production: {
    label: "In Progress",
    color: "bg-warning-muted text-warning border-warning/20",
  },
  delivered_by_artist: {
    label: "Waiting for Approval",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  revisions: {
    label: "Sent for Revision",
    color: "bg-error-muted text-error border-error/20",
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  approved_by_client: {
    label: "Approved by Client",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

const PAGE_SIZE = 18;

interface AssignedAsset {
  id: string;
  product_name: string;
  article_id: string;
  client: string;
  batch: number;
  priority: number;
  delivery_date: string;
  status: string;
  glb_link?: string;
  product_link?: string;
  category: string;
  subcategory: string;
  created_at: string;
  reference?: string[] | null;
  modeler?: {
    id: string;
    email: string;
    title?: string;
  };
}

export default function QAReviewPage() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoadingState();
  const [assets, setAssets] = useState<AssignedAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssignedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const [modelerFilter, setModelerFilter] = useState("all");
  const [sort, setSort] = useState("status-progress");
  const [availableModelers, setAvailableModelers] = useState<
    Array<{ id: string; email: string; title?: string }>
  >([]);
  const [updatingAssetId, setUpdatingAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );

  // Add new filter states for multi-select capability
  const [clientFilters, setClientFilters] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<number[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);

  // Add Ref dialog state
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );
  const [referenceUrl, setReferenceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);

  // View Ref dialog state
  const [showViewRefDialog, setShowViewRefDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  useEffect(() => {
    document.title = "CharpstAR Platform - QA Review";
  }, []);

  // Handle URL parameters for modeler filter
  useEffect(() => {
    const modelerParam = searchParams.get("modeler");
    if (modelerParam) {
      setModelerFilter(modelerParam);
    }
  }, [searchParams]);

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

  useEffect(() => {
    if (user?.id) {
      fetchAssignedAssets();
    }
  }, [user?.id]);

  useEffect(() => {
    filterAndSortAssets();
  }, [
    assets,
    search,
    modelerFilter,
    sort,
    clientFilters,
    batchFilters,
    statusFilters,
  ]);

  const handlePriorityChange = async (assetId: string, newPriority: number) => {
    try {
      setUpdatingAssetId(assetId);
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ priority: newPriority })
        .eq("id", assetId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, priority: newPriority } : a
        )
      );

      toast.success("Priority updated successfully");
    } catch (err) {
      console.error("Error updating priority:", err);
      toast.error("Failed to update priority");
    } finally {
      setUpdatingAssetId(null);
    }
  };

  const fetchAssignedAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // First, get the modelers allocated to this QA user
      const { data: qaAllocations, error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", user?.id);

      if (allocationError) {
        console.error("Error fetching QA allocations:", allocationError);
        toast.error("Failed to fetch your modeler allocations");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        setAssets([]);
        return;
      }

      const allocatedModelerIds = qaAllocations.map((a) => a.modeler_id);

      // Get assets assigned to the allocated modelers
      const { data: assetAssignments, error: assignmentError } = await supabase
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
            priority,
            delivery_date,
            status,
            glb_link,
            product_link,
            category,
            subcategory,
            created_at,
            reference
          )
        `
        )
        .in("user_id", allocatedModelerIds)
        .eq("role", "modeler");

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        toast.error("Failed to fetch your assigned assets");
        return;
      }

      // Get modeler details for the allocated modelers
      const { data: modelerDetails, error: modelerError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", allocatedModelerIds);

      if (modelerError) {
        console.error("Error fetching modeler details:", modelerError);
      }

      // Create a map of modeler info by ID
      const modelerMap = new Map();
      modelerDetails?.forEach((modeler) => {
        modelerMap.set(modeler.id, {
          id: modeler.id,
          email: modeler.email,
          title: modeler.title,
        });
      });

      // Set available modelers for filter dropdown
      setAvailableModelers(modelerDetails || []);

      // Transform the data
      const transformedAssets: AssignedAsset[] =
        assetAssignments?.map((assignment) => {
          const asset = assignment.onboarding_assets as any;
          return {
            id: assignment.asset_id,
            product_name: asset.product_name,
            article_id: asset.article_id,
            client: asset.client,
            batch: asset.batch,
            priority: asset.priority,
            delivery_date: asset.delivery_date,
            status: asset.status,
            glb_link: asset.glb_link,
            product_link: asset.product_link,
            category: asset.category,
            subcategory: asset.subcategory,
            created_at: asset.created_at,
            reference: asset.reference,
            modeler: modelerMap.get(assignment.user_id),
          };
        }) || [];

      setAssets(transformedAssets);

      // Populate clients array for filter dropdown
      const uniqueClients = Array.from(
        new Set(transformedAssets.map((asset) => asset.client).filter(Boolean))
      ).sort();
      setClients(uniqueClients);
    } catch (error) {
      console.error("Error fetching assigned assets:", error);
      toast.error("Failed to fetch assigned assets");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const filterAndSortAssets = () => {
    let filtered = [...assets];

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (asset) =>
          asset.product_name.toLowerCase().includes(search.toLowerCase()) ||
          asset.article_id.toLowerCase().includes(search.toLowerCase()) ||
          asset.client.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply multi client filter
    if (clientFilters.length > 0) {
      filtered = filtered.filter((asset) =>
        clientFilters.includes(asset.client)
      );
    }

    // Apply multi batch filter
    if (batchFilters.length > 0) {
      filtered = filtered.filter((asset) =>
        batchFilters.includes(Number(asset.batch))
      );
    }

    // Apply multi status filter
    if (statusFilters.length > 0) {
      filtered = filtered.filter((asset) =>
        statusFilters.includes(asset.status)
      );
    }

    // Apply modeler filter
    if (modelerFilter !== "all") {
      filtered = filtered.filter(
        (asset) => asset.modeler?.id === modelerFilter
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case "status-progress": {
          const statusPriority: Record<string, number> = {
            in_production: 1,
            delivered_by_artist: 2,
            revisions: 3,
            approved: 4,
            approved_by_client: 5,
          };
          return (
            (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
          );
        }
        case "priority":
          // 1 is highest priority; show lowest numeric value first
          return a.priority - b.priority;
        case "priority-lowest":
          // Lowest priority first means highest numeric value first
          return b.priority - a.priority;
        case "batch":
          return a.batch - b.batch;
        case "az":
          return a.product_name.localeCompare(b.product_name);
        case "za":
          return b.product_name.localeCompare(a.product_name);
        case "date":
          // Newest first using asset delivery_date
          return (
            dayjs(b.delivery_date).valueOf() - dayjs(a.delivery_date).valueOf()
          );
        case "date-oldest":
          // Oldest first using asset delivery_date
          return (
            dayjs(a.delivery_date).valueOf() - dayjs(b.delivery_date).valueOf()
          );
        default:
          return 0;
      }
    });

    setFilteredAssets(filtered);
  };

  const handleViewAsset = (assetId: string) => {
    router.push(`/client-review/${assetId}?from=qa-review`);
  };

  // References column removed

  const handleDownloadGLB = (asset: AssignedAsset) => {
    if (asset.glb_link) {
      const link = document.createElement("a");
      link.href = asset.glb_link;
      link.download = `${asset.product_name}_${asset.article_id}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("GLB file download started");
    } else {
      toast.error("No GLB file available for this asset");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setModelerFilter("all");
    setSort("status-progress");
    setCurrentPage(1);
    setClientFilters([]);
    setBatchFilters([]);
    setStatusFilters([]);
  };

  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  const isAssetSelected = (id: string) => selectedAssetIds.has(id);
  const areAllCurrentSelected =
    currentAssets.length > 0 &&
    currentAssets.every((a) => selectedAssetIds.has(a.id));
  const someCurrentSelected =
    currentAssets.some((a) => selectedAssetIds.has(a.id)) &&
    !areAllCurrentSelected;

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCurrent = () => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (areAllCurrentSelected) {
        // Unselect only current page assets
        currentAssets.forEach((a) => next.delete(a.id));
      } else {
        // Select all current page assets
        currentAssets.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  const handleDownloadSelectedGLBs = async () => {
    const selected = filteredAssets.filter((a) => selectedAssetIds.has(a.id));
    const withGlb = selected.filter((a) => a.glb_link);
    if (withGlb.length === 0) {
      toast.info("No GLB files found for selected items");
      return;
    }
    for (const asset of withGlb) {
      try {
        const a = document.createElement("a");
        a.href = asset.glb_link as string;
        a.download = `${asset.product_name}_${asset.article_id}.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((res) => setTimeout(res, 120));
      } catch (e) {
        console.error("Failed to start GLB download for", asset.id, e);
      }
    }
    toast.success(`Started downloading ${withGlb.length} GLB file(s)`);
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

  // Handle adding reference URL
  const handleAddReferenceUrl = async () => {
    if (!referenceUrl.trim() || !selectedAssetForRef) return;

    try {
      // Validate URL format
      const url = new URL(referenceUrl.trim());
      if (!url.protocol.startsWith("http")) {
        toast.error("Please enter a valid HTTP/HTTPS URL");
        return;
      }

      // Find the current asset
      const currentAsset = assets.find(
        (asset) => asset.id === selectedAssetForRef
      );
      if (!currentAsset) {
        toast.error("Asset not found");
        return;
      }

      // Get existing references and add new one
      const existingReferences = parseReferences(
        currentAsset.reference || null
      );
      const newReferences = [...existingReferences, referenceUrl.trim()];

      // Update the asset in the database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: newReferences })
        .eq("id", selectedAssetForRef);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to save reference image URL");
        return;
      }

      // Update local state
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === selectedAssetForRef
            ? { ...asset, reference: newReferences }
            : asset
        )
      );

      // Reset dialog state
      setReferenceUrl("");
      setSelectedAssetForRef(null);
      setShowAddRefDialog(false);

      toast.success("Reference image URL added successfully!");
    } catch (error) {
      console.error("Error adding reference image URL:", error);
      toast.error("Please enter a valid image URL");
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile || !selectedAssetForRef) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("asset_id", selectedAssetForRef);

      // Determine file type based on extension
      const fileExtension = selectedFile.name.toLowerCase().split(".").pop();
      const fileType = fileExtension === "glb" ? "glb" : "reference";
      formData.append("file_type", fileType);

      const response = await fetch("/api/assets/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      // For all file types, refresh the asset data since everything goes to references now
      const { data: updatedAsset } = await supabase
        .from("onboarding_assets")
        .select("reference, status, glb_link")
        .eq("id", selectedAssetForRef)
        .single();

      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === selectedAssetForRef
            ? {
                ...asset,
                reference: updatedAsset?.reference || asset.reference,
                status: updatedAsset?.status || asset.status,
                glb_link: updatedAsset?.glb_link || asset.glb_link,
              }
            : asset
        )
      );

      // Also update the selected asset for view dialog if it's the same asset
      if (selectedAssetForView?.id === selectedAssetForRef) {
        setSelectedAssetForView((prev: any) =>
          prev
            ? {
                ...prev,
                reference: updatedAsset?.reference || prev.reference,
                status: updatedAsset?.status || prev.status,
                glb_link: updatedAsset?.glb_link || prev.glb_link,
              }
            : prev
        );
      }

      toast.success(
        fileType === "glb"
          ? "GLB file uploaded successfully!"
          : "Reference file uploaded successfully!"
      );

      // Reset dialog state
      setSelectedFile(null);
      setSelectedAssetForRef(null);
      setReferenceUrl("");
      setShowAddRefDialog(false);
      setUploadMode("url");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const statusTotals = {
    total: assets.length,
    in_production: assets.filter((a) => a.status === "in_production").length,
    delivered_by_artist: assets.filter(
      (a) => a.status === "delivered_by_artist"
    ).length,
    revisions: assets.filter((a) => a.status === "revisions").length,
    approved: assets.filter((a) => a.status === "approved").length,
    approved_by_client: assets.filter((a) => a.status === "approved_by_client")
      .length,
  };

  if (!user || user.metadata?.role !== "qa") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for QA reviewers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            QA Review
          </Badge>
        </div>
      </div>

      <Card className="p-6 flex-1 flex flex-col border-0 shadow-none">
        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {/* Total Assigned (no filtering on this card itself) */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters([]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info-muted rounded-lg">
                  <Package className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Assigned
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {statusTotals.total}
                  </p>
                </div>
              </div>
            </Card>

            {/* In Production */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["in_production"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-muted rounded-lg">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    In Production
                  </p>
                  <p className="text-2xl font-bold text-warning">
                    {statusTotals.in_production}
                  </p>
                </div>
              </div>
            </Card>

            {/* Waiting for Review */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["delivered_by_artist"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-purple/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-accent-purple" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Waiting for Approval
                  </p>
                  <p className="text-2xl font-bold text-accent-purple">
                    {statusTotals.delivered_by_artist}
                  </p>
                </div>
              </div>
            </Card>

            {/* Revision */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["revisions"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Revision
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {statusTotals.revisions}
                  </p>
                </div>
              </div>
            </Card>

            {/* Approved */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["approved"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {statusTotals.approved}
                  </p>
                </div>
              </div>
            </Card>

            {/* Delivered by Client */}
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => {
                setStatusFilters(["approved_by_client"]);
                setCurrentPage(1);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Delivered by Client
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {statusTotals.approved_by_client || 0}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4 space-between">
          <div className="flex gap-2">
            {/* Client Filter */}
            <Select
              value={clientFilters.length === 1 ? clientFilters[0] : undefined}
              onValueChange={(value) => {
                if (value === "all") {
                  setClientFilters([]);
                } else if (value) {
                  setClientFilters([value]);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue
                  placeholder={
                    clientFilters.length === 0
                      ? "All clients"
                      : clientFilters.length === 1
                        ? clientFilters[0]
                        : `${clientFilters.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
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
                setCurrentPage(1);
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

            <Select
              value={modelerFilter}
              onValueChange={(value) => setModelerFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Modeler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modelers</SelectItem>
                {availableModelers.map((modeler) => (
                  <SelectItem key={modeler.id} value={modeler.id}>
                    {modeler.title || modeler.email.split("@")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-full md:w-64"
              placeholder="Search by name, article ID, or client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-center">
            <Select value={sort} onValueChange={(value) => setSort(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status-progress">
                  Status Progression
                </SelectItem>
                <SelectItem value="priority">
                  Priority (Highest First)
                </SelectItem>
                <SelectItem value="priority-lowest">
                  Priority (Lowest First)
                </SelectItem>
                <SelectItem value="batch">Batch (1, 2, 3...)</SelectItem>
                <SelectItem value="az"> Name (A-Z)</SelectItem>
                <SelectItem value="za"> Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedAssetIds.size === 0}
              onClick={handleDownloadSelectedGLBs}
            >
              Download GLBs (Selected {selectedAssetIds.size})
            </Button>
          </div>
        </div>

        {/* Assets Table */}
        <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[64vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      areAllCurrentSelected
                        ? true
                        : someCurrentSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAllCurrent}
                  />
                </TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Article ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modeler</TableHead>
                <TableHead className="w-24">Product</TableHead>
                <TableHead className="w-20">GLB</TableHead>
                <TableHead className="w-20">Files</TableHead>
                <TableHead className="w-16">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {/* Checkbox */}
                    <TableCell>
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Product Name */}
                    <TableCell>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Article ID */}
                    <TableCell>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Client */}
                    <TableCell>
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Batch */}
                    <TableCell>
                      <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Priority */}
                    <TableCell>
                      <div className="flex justify-center">
                        <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                      </div>
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </TableCell>
                    {/* Modeler */}
                    <TableCell>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Product */}
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* GLB */}
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* Files */}
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {/* View */}
                    <TableCell>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : currentAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No assets assigned
                      </p>
                      <p className="text-sm text-muted-foreground">
                        You will see assets here once you are allocated to
                        modelers by production management.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className={
                      asset.status === "in_production"
                        ? "table-row-status-in-production"
                        : asset.status === "revisions"
                          ? "table-row-status-revisions"
                          : asset.status === "approved"
                            ? "table-row-status-approved"
                            : asset.status === "approved_by_client"
                              ? "table-row-status-approved-by-client"
                              : asset.status === "delivered_by_artist"
                                ? "table-row-status-delivered-by-artist"
                                : asset.status === "not_started"
                                  ? "table-row-status-not-started"
                                  : "table-row-status-unknown"
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={isAssetSelected(asset.id)}
                        onCheckedChange={() => toggleSelectAsset(asset.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{asset.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {asset.category} • {asset.subcategory}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {asset.article_id}
                      </span>
                    </TableCell>
                    <TableCell>{asset.client}</TableCell>
                    <TableCell>Batch {asset.batch}</TableCell>
                    <TableCell>
                      <div className="flex justify-center items-center">
                        <Select
                          value={asset.priority.toString()}
                          onValueChange={(value) => {
                            const newPriority = parseInt(value);
                            handlePriorityChange(asset.id, newPriority);
                          }}
                          disabled={updatingAssetId === asset.id}
                        >
                          <SelectTrigger
                            className={`border-0 shadow-none p-0 h-auto w-auto bg-transparent hover:opacity-80 transition-opacity cursor-pointer [&>svg]:hidden`}
                          >
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                                asset.priority
                              )}`}
                            >
                              {getPriorityLabel(asset.priority)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">High Priority</SelectItem>
                            <SelectItem value="2">Medium Priority</SelectItem>
                            <SelectItem value="3">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          STATUS_LABELS[
                            asset.status as keyof typeof STATUS_LABELS
                          ]?.color ||
                          "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {STATUS_LABELS[
                          asset.status as keyof typeof STATUS_LABELS
                        ]?.label || asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {asset.modeler ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {asset.modeler.email}
                          </div>
                          {asset.modeler.title && (
                            <div className="text-xs text-muted-foreground">
                              {asset.modeler.title}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    {/* Product */}
                    <TableCell>
                      {asset.product_link ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Open Product Link"
                          onClick={() =>
                            window.open(asset.product_link as string, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* GLB */}
                    <TableCell>
                      {asset.glb_link ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadGLB(asset)}
                          title="Download GLB"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* Files */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs px-3 py-1 h-7"
                          onClick={() => {
                            setSelectedAssetForView(asset);
                            setShowViewRefDialog(true);
                          }}
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          Ref (
                          {separateReferences(asset.reference || null)
                            .imageReferences.length +
                            separateReferences(asset.reference || null).glbFiles
                              .length}
                          )
                        </Button>
                      </div>
                    </TableCell>
                    {/* View */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAsset(asset.id)}
                        title="View Asset"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredAssets.length)} of{" "}
              {filteredAssets.length} assets
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Reference Dialog */}
      <Dialog open={showAddRefDialog} onOpenChange={setShowAddRefDialog}>
        <DialogContent className="sm:max-w-[500px] h-fit">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Add Reference or GLB File
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a reference image URL or upload a reference/GLB file.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={uploadMode === "url" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUploadMode("url")}
              className="flex-1"
            >
              URL
            </Button>
            <Button
              variant={uploadMode === "file" ? "default" : "ghost"}
              size="sm"
              onClick={() => setUploadMode("file")}
              className="flex-1"
            >
              File Upload
            </Button>
          </div>

          <div className="space-y-4">
            {uploadMode === "url" ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Image URL *
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddReferenceUrl();
                    }
                  }}
                  className="border-border focus:border-primary"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Upload File *
                </label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.glb"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="border-border focus:border-primary"
                  key={`file-input-${selectedAssetForRef || "none"}`}
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={() => {
                setReferenceUrl("");
                setSelectedFile(null);
                setSelectedAssetForRef(null);
                setShowAddRefDialog(false);
                setUploadMode("url");
              }}
              variant="outline"
              className="cursor-pointer"
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={
                uploadMode === "url" ? handleAddReferenceUrl : handleFileUpload
              }
              disabled={
                uploading ||
                (uploadMode === "url" ? !referenceUrl.trim() : !selectedFile)
              }
              className="cursor-pointer"
            >
              {uploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Uploading...
                </>
              ) : (
                `Add ${uploadMode === "url" ? "URL" : "File"}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View References Dialog */}
      <Dialog open={showViewRefDialog} onOpenChange={setShowViewRefDialog}>
        <DialogContent className="sm:max-w-[600px] h-fit max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              References - {selectedAssetForView?.product_name || "Asset"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              View and manage all reference images for this asset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(() => {
              // Get all files (GLB + references)
              const allReferences = selectedAssetForView
                ? parseReferences(selectedAssetForView.reference)
                : [];
              const hasDirectGlb = selectedAssetForView?.glb_link;

              // Combine all files into one list
              const allFiles = [];

              // Add direct GLB if exists
              if (hasDirectGlb) {
                allFiles.push({
                  url: selectedAssetForView.glb_link,
                  type: "glb",
                  name: "GLB Model",
                });
              }

              // Add references (filter out duplicates of direct GLB)
              allReferences.forEach((ref, index) => {
                if (!hasDirectGlb || ref !== selectedAssetForView.glb_link) {
                  const isGlb = ref.toLowerCase().endsWith(".glb");
                  allFiles.push({
                    url: ref,
                    type: isGlb ? "glb" : "reference",
                    name: isGlb
                      ? `GLB File ${index + 1}`
                      : `Reference ${index + 1}`,
                  });
                }
              });

              return allFiles.length > 0 ? (
                <div className="space-y-2">
                  {allFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {file.type === "glb" ? (
                          <Package className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {file.url}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (file.type === "glb") {
                            // Download GLB files
                            const link = document.createElement("a");
                            link.href = file.url;
                            link.download = `${selectedAssetForView?.product_name || "model"}.glb`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } else {
                            // Open reference files in new tab
                            window.open(file.url, "_blank");
                          }
                        }}
                        className="text-xs flex-shrink-0"
                      >
                        {file.type === "glb" ? (
                          <>
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No files found</p>
                  <p className="text-xs text-muted-foreground">
                    Click &quot;Add Reference&quot; to upload files
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={() => {
                setSelectedAssetForRef(selectedAssetForView?.id);
                setShowViewRefDialog(false);
                setShowAddRefDialog(true);
              }}
              variant="outline"
              className="cursor-pointer"
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Reference
            </Button>
            <Button
              onClick={() => setShowViewRefDialog(false)}
              className="cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
