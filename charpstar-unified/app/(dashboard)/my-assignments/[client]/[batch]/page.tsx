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
} from "lucide-react";
import { toast } from "sonner";

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
}

interface BatchStats {
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
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
    completionPercentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");

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
          onboarding_assets!inner(*)
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
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

      // Extract assets from assignments
      const batchAssets = assetAssignments
        .map((assignment) => assignment.onboarding_assets)
        .filter(Boolean) as any[];

      setAssets(batchAssets);

      // Calculate batch statistics
      const totalAssets = batchAssets.length;
      const completedAssets = batchAssets.filter(
        (asset) =>
          asset.status === "approved" || asset.status === "delivered_by_artist"
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

      setBatchStats({
        totalAssets,
        completedAssets,
        inProgressAssets,
        pendingAssets,
        revisionAssets,
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
      case "delivered_by_artist":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
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
      case "delivered_by_artist":
        return "bg-green-100 text-green-800 border-green-200";
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
    <div className="flex flex-1 flex-col p-4 sm:p-6">
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
        <p className="text-muted-foreground">
          Manage and review all assets in this batch
        </p>
      </div>

      {/* Batch Statistics */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Batch Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Overall Progress
                </span>
                <span className="font-semibold text-lg">
                  {batchStats.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${batchStats.completionPercentage}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {batchStats.totalAssets}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Assets
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {batchStats.completedAssets}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {batchStats.inProgressAssets}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    In Progress
                  </div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {batchStats.pendingAssets}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <SelectItem value="revisions">Ready for Revision</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="delivered_by_artist">Delivered</SelectItem>
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

      {/* Assets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Batch Assets</h2>
          <Badge variant="outline">
            {filteredAssets.length} of {assets.length} assets
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </Card>
            ))}
          </div>
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
          <div className="space-y-4">
            {filteredAssets.map((asset) => (
              <Card
                key={asset.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewAsset(asset.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(asset.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {asset.product_name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getPriorityColor(asset.priority)}`}
                          >
                            Priority {asset.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono text-xs">
                            {asset.article_id}
                          </span>
                          <span>•</span>
                          <span>{asset.category}</span>
                          {asset.subcategory && (
                            <>
                              <span>•</span>
                              <span>{asset.subcategory}</span>
                            </>
                          )}
                          {asset.delivery_date && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  asset.delivery_date
                                ).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(asset.status)}`}
                      >
                        {asset.status === "delivered_by_artist"
                          ? "Delivered"
                          : asset.status === "not_started"
                            ? "Not Started"
                            : asset.status === "in_production"
                              ? "In Progress"
                              : asset.status === "revisions"
                                ? "Ready for Revision"
                                : asset.status}
                      </Badge>
                      {asset.revision_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {asset.revision_count} revision
                          {asset.revision_count !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {asset.glb_link && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-50 text-green-700 border-green-200"
                        >
                          GLB
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
