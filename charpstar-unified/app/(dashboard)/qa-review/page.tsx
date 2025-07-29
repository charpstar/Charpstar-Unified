"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/inputs";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

const STATUS_LABELS = {
  in_production: {
    label: "In Production",
    color: "bg-warning-muted text-warning border-warning/20",
  },
  revisions: {
    label: "Ready for Revision",
    color: "bg-info-muted text-info border-info/20",
  },
  approved: {
    label: "Approved",
    color: "bg-success-muted text-success border-success/20",
  },
  delivered_by_artist: {
    label: "Waiting for Review",
    color: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  },
  not_started: {
    label: "Not Started",
    color: "bg-error-muted text-error border-error/20",
  },
};

const PAGE_SIZE = 18;

const getPriorityColor = (priority: number) => {
  if (priority === 1) return "bg-error-muted text-error border-error/20";
  if (priority === 2) return "bg-warning-muted text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
};

const getPriorityLabel = (priority: number) => {
  if (priority === 1) return "High";
  if (priority === 2) return "Medium";
  return "Low";
};

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelerFilter, setModelerFilter] = useState("all");
  const [sort, setSort] = useState("priority");
  const [availableModelers, setAvailableModelers] = useState<
    Array<{ id: string; email: string; title?: string }>
  >([]);

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

  useEffect(() => {
    if (user?.id) {
      fetchAssignedAssets();
    }
  }, [user?.id]);

  useEffect(() => {
    filterAndSortAssets();
  }, [assets, search, statusFilter, modelerFilter, sort]);

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
            created_at
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
            modeler: modelerMap.get(assignment.user_id),
          };
        }) || [];

      setAssets(transformedAssets);
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

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((asset) => asset.status === statusFilter);
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
        case "priority":
          return b.priority - a.priority;
        case "priority-lowest":
          return a.priority - b.priority;
        case "batch":
          return a.batch - b.batch;
        case "az":
          return a.product_name.localeCompare(b.product_name);
        case "za":
          return b.product_name.localeCompare(a.product_name);
        case "date":
          return (
            new Date(b.delivery_date).getTime() -
            new Date(a.delivery_date).getTime()
          );
        case "date-oldest":
          return (
            new Date(a.delivery_date).getTime() -
            new Date(b.delivery_date).getTime()
          );
        default:
          return 0;
      }
    });

    setFilteredAssets(filtered);
  };

  const handleViewAsset = (assetId: string) => {
    router.push(`/client-review/${assetId}`);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setModelerFilter("all");
    setSort("priority");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  const statusTotals = {
    total: assets.length,
    in_production: assets.filter((a) => a.status === "in_production").length,
    delivered_by_artist: assets.filter(
      (a) => a.status === "delivered_by_artist"
    ).length,
    revisions: assets.filter((a) => a.status === "revisions").length,
    approved: assets.filter((a) => a.status === "approved").length,
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
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4 space-between">
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
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
          <div className="flex gap-2">
            <Select value={sort} onValueChange={(value) => setSort(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">
                  Sort by: Priority (Highest First)
                </SelectItem>
                <SelectItem value="priority-lowest">
                  Sort by: Priority (Lowest First)
                </SelectItem>
                <SelectItem value="batch">
                  Sort by: Batch (1, 2, 3...)
                </SelectItem>
                <SelectItem value="az">Sort by: Name (A-Z)</SelectItem>
                <SelectItem value="za">Sort by: Name (Z-A)</SelectItem>
                <SelectItem value="date">
                  Sort by: Delivery Date (Newest)
                </SelectItem>
                <SelectItem value="date-oldest">
                  Sort by: Delivery Date (Oldest)
                </SelectItem>
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
          </div>
        </div>

        {/* Status Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="p-4">
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

            <Card className="p-4">
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

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-purple/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-accent-purple" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Waiting for Review
                  </p>
                  <p className="text-2xl font-bold text-accent-purple">
                    {statusTotals.delivered_by_artist}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Ready for Revision
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {statusTotals.revisions}
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
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {statusTotals.approved}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Assets Table */}
        <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[64vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input type="checkbox" className="rounded" />
                </TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Article ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modeler</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : currentAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
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
                  <TableRow key={asset.id}>
                    <TableCell>
                      <input type="checkbox" className="rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{asset.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {asset.category} • {asset.subcategory}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {asset.article_id}
                      </code>
                    </TableCell>
                    <TableCell>{asset.client}</TableCell>
                    <TableCell>Batch {asset.batch}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPriorityColor(asset.priority)}`}
                      >
                        {getPriorityLabel(asset.priority)}
                      </Badge>
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
                    <TableCell>
                      <div className="text-sm">
                        {new Date(asset.delivery_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewAsset(asset.id)}
                        className="h-8 w-8 p-0"
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
    </div>
  );
}
