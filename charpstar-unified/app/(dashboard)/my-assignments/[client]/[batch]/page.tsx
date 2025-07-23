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
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";

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
  created_at: string;
  revision_count: number;
  glb_link: string | null;
  product_link: string | null;
  reference: string[] | null;
  price?: number;
  bonus?: number;
}

interface BatchStats {
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
  waitingForApprovalAssets: number;
  completionPercentage: number;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const client = decodeURIComponent(params.client as string);
  const batch = parseInt(params.batch as string);

  const [assets, setAssets] = useState<BatchAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<BatchAsset[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    totalAssets: 0,
    completedAssets: 0,
    inProgressAssets: 0,
    pendingAssets: 0,
    revisionAssets: 0,
    waitingForApprovalAssets: 0,
    completionPercentage: 0,
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
  }, [assets, searchTerm, statusFilter, sortBy]);

  const fetchBatchAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      // Get user's individual asset assignments for this specific client and batch
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          status,
          price,
          bonus,
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
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted")
        .eq("onboarding_assets.client", client)
        .eq("onboarding_assets.batch", batch);

      if (assignmentError) {
        console.error("Error fetching asset assignments:", assignmentError);
        toast.error("Failed to fetch batch assets");
        return;
      }

      if (!assetAssignments || assetAssignments.length === 0) {
        toast.error("You don't have any assigned assets in this batch");
        router.push("/my-assignments");
        return;
      }

      // Extract assets from assignments and include pricing data
      const batchAssets = assetAssignments
        .map((assignment) => ({
          ...assignment.onboarding_assets,
          price: assignment.price,
          bonus: assignment.bonus,
        }))
        .filter(Boolean) as any[];

      setAssets(batchAssets);

      // Calculate batch statistics
      const totalAssets = batchAssets.length;
      const completedAssets = batchAssets.filter(
        (asset) => asset.status === "approved"
      ).length;
      const inProgressAssets = batchAssets.filter(
        (asset) => asset.status === "in_production"
      ).length;
      const pendingAssets = batchAssets.filter(
        (asset) => asset.status === "not_started"
      ).length;
      const revisionAssets = batchAssets.filter(
        (asset) => asset.status === "revisions"
      ).length;
      const waitingForApprovalAssets = batchAssets.filter(
        (asset) => asset.status === "delivered_by_artist"
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
    let filtered = [...assets];

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

      // Find the asset to get article_id
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) {
        throw new Error("Asset not found");
      }

      // Validate file
      if (!file.name.toLowerCase().endsWith(".glb")) {
        toast.error("Please select a GLB file");
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        toast.error("File size must be less than 100MB");
        return;
      }

      // Upload to Supabase Storage
      const fileName = `${asset.article_id}_${Date.now()}.glb`;
      const filePath = `models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(filePath);

      // Update the asset with the new GLB link
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: urlData.publicUrl,
          status: "in_production",
        })
        .eq("id", assetId);

      if (updateError) {
        throw updateError;
      }

      toast.success("GLB file uploaded successfully!");

      // Refresh the assets list
      fetchBatchAssets();
    } catch (error) {
      console.error("Error uploading GLB:", error);
      toast.error("Failed to upload GLB file");
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

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      toast.success("File uploaded successfully!");

      // Refresh the assets list
      fetchBatchAssets();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
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

  if (!user) {
    return null;
  }

  if (user.metadata?.role !== "modeler") {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
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
          {assets.length > 0 && assets[0]?.delivery_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Deadline:{" "}
                {new Date(assets[0].delivery_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Batch Statistics */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Assets
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {batchStats.totalAssets}
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
                  Completed
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {batchStats.completedAssets}
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
                  In Progress
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {batchStats.inProgressAssets}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Waiting for Approval
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {batchStats.waitingForApprovalAssets}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {batchStats.pendingAssets}
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
            {filteredAssets.length} of {assets.length} assets
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
        ) : assets.length === 0 ? (
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="w-32">Article ID</TableHead>
                  <TableHead className="w-24">Priority</TableHead>
                  <TableHead className="w-24">Price</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="w-32">Deadline</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
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
                      <div className="font-medium">{asset.product_name}</div>
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
                          {asset.bonus && asset.bonus > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-600"
                            >
                              +{asset.bonus}%
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
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
                      {asset.delivery_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(asset.delivery_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
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

                          <DropdownMenuItem asChild>
                            <label
                              htmlFor={`glb-upload-${asset.id}`}
                              className="flex items-center cursor-pointer"
                            >
                              {uploadingGLB === asset.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              {asset.glb_link ? "Update GLB" : "Upload GLB"}
                            </label>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <label
                              htmlFor={`asset-upload-${asset.id}`}
                              className="flex items-center cursor-pointer"
                            >
                              {uploadingFile === asset.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2" />
                              ) : (
                                <Image className="h-4 w-4 mr-2" />
                              )}
                              Upload Asset
                            </label>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Hidden file inputs */}
                      <input
                        type="file"
                        accept=".glb,.gltf"
                        onChange={(e) =>
                          handleFileInputChange(asset.id, "glb", e)
                        }
                        className="hidden"
                        id={`glb-upload-${asset.id}`}
                      />
                      <input
                        type="file"
                        accept=".obj,.fbx,.dae,.blend,.max,.ma,.mb,.3ds,.stl,.ply,.wrl,.x3d,.usd,.abc,.c4d,.skp,.dwg,.dxf,.iges,.step,.stp,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tga,.hdr,.exr,.psd,.ai,.eps,.svg,.pdf"
                        onChange={(e) =>
                          handleFileInputChange(asset.id, "asset", e)
                        }
                        className="hidden"
                        id={`asset-upload-${asset.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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
    </div>
  );
}
