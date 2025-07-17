"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
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
import { Button } from "@/components/ui/display";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Users,
  Eye,
  Package,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/interactive/dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";

const STATUS_LABELS = {
  in_production: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  revisions: { label: "Revisions", color: "bg-red-100 text-red-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  delivered_by_artist: {
    label: "Delivered by Artist",
    color: "bg-blue-100 text-blue-700",
  },
};

const PAGE_SIZE = 18;

const getPriorityColor = (priority: number) => {
  if (priority === 1) return "bg-red-100 text-red-800";
  if (priority === 2) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
};

const getPriorityLabel = (priority: number) => {
  if (priority === 1) return "High";
  if (priority === 2) return "Medium";
  return "Low";
};

const AdminReviewTableSkeleton = () => (
  <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[79vh]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
          <TableHead>
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-8 bg-muted rounded animate-pulse" />
              </div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </TableCell>
            <TableCell>
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminReviewPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("batch");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState<
    Record<string, number>
  >({});
  const [clients, setClients] = useState<string[]>([]);

  // Calculate status totals based on filtered data
  const statusTotals = useMemo(() => {
    const totals = {
      total: filtered.length,
      in_production: 0,
      revisions: 0,
      approved: 0,
      delivered_by_artist: 0,
    };

    filtered.forEach((asset) => {
      let displayStatus = asset.status;
      // Treat "not_started" as "in_production" for client view
      if (asset.status === "not_started") {
        displayStatus = "in_production";
      }

      if (displayStatus && totals.hasOwnProperty(displayStatus)) {
        totals[displayStatus as keyof typeof totals]++;
      }
    });

    // Calculate percentages
    const percentages = {
      total: 100,
      in_production:
        filtered.length > 0
          ? Math.round((totals.in_production / filtered.length) * 100)
          : 0,
      revisions:
        filtered.length > 0
          ? Math.round((totals.revisions / filtered.length) * 100)
          : 0,
      approved:
        filtered.length > 0
          ? Math.round((totals.approved / filtered.length) * 100)
          : 0,
      delivered_by_artist:
        filtered.length > 0
          ? Math.round((totals.delivered_by_artist / filtered.length) * 100)
          : 0,
    };

    return { totals, percentages };
  }, [filtered]);

  // Handle URL parameters for client and batch filter
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const batchParam = searchParams.get("batch");

    if (clientParam) {
      setClientFilter(clientParam);
    }

    if (batchParam) {
      setBatchFilter(batchParam);
    }
  }, [searchParams]);

  // Check if user is admin
  useEffect(() => {
    if (user && user.metadata?.role !== "admin") {
      router.push("/dashboard");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [user, router]);

  // Fetch all assets for admin review
  useEffect(() => {
    async function fetchAssets() {
      if (!user || user.metadata?.role !== "admin") return;
      startLoading();
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select(
          "id, product_name, article_id, delivery_date, status, batch, priority, revision_count, client"
        );
      if (!error && data) {
        setAssets(data);
        // Extract unique clients
        const uniqueClients = [
          ...new Set(data.map((asset) => asset.client).filter(Boolean)),
        ];
        setClients(uniqueClients);
      }
      setLoading(false);
      stopLoading();
    }
    fetchAssets();
  }, [user?.metadata?.role]);

  // Fetch annotation counts for assets
  useEffect(() => {
    async function fetchAnnotationCounts() {
      if (assets.length === 0) return;

      try {
        const assetIds = assets.map((asset) => asset.id);
        const { data, error } = await supabase
          .from("asset_annotations")
          .select("asset_id")
          .in("asset_id", assetIds);

        if (!error && data) {
          const counts: Record<string, number> = {};
          data.forEach((annotation) => {
            counts[annotation.asset_id] =
              (counts[annotation.asset_id] || 0) + 1;
          });
          setAnnotationCounts(counts);
        }
      } catch (error) {
        console.error("Error fetching annotation counts:", error);
      }
    }

    fetchAnnotationCounts();
  }, [assets]);

  // Filtering, sorting, searching
  useEffect(() => {
    let data = [...assets];

    // Filter by client
    if (clientFilter && clientFilter !== "all") {
      data = data.filter((a) => a.client === clientFilter);
    }

    // Filter by batch
    if (batchFilter && batchFilter !== "all") {
      data = data.filter((a) => a.batch === parseInt(batchFilter));
    }

    // Filter by status
    if (statusFilter) data = data.filter((a) => a.status === statusFilter);

    // Search
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (a) =>
          a.product_name?.toLowerCase().includes(s) ||
          a.article_id?.toLowerCase().includes(s) ||
          a.client?.toLowerCase().includes(s)
      );
    }

    // Sorting
    if (sort === "az")
      data.sort((a, b) => a.product_name.localeCompare(b.product_name));
    if (sort === "za")
      data.sort((a, b) => b.product_name.localeCompare(a.product_name));
    if (sort === "date")
      data.sort((a, b) =>
        (b.delivery_date || "").localeCompare(a.delivery_date || "")
      );
    if (sort === "date-oldest")
      data.sort((a, b) =>
        (a.delivery_date || "").localeCompare(b.delivery_date || "")
      );
    if (sort === "batch") data.sort((a, b) => (a.batch || 1) - (b.batch || 1));
    if (sort === "priority")
      data.sort((a, b) => (a.priority || 2) - (b.priority || 2));
    if (sort === "priority-lowest")
      data.sort((a, b) => (b.priority || 2) - (a.priority || 2));
    if (sort === "client")
      data.sort((a, b) => (a.client || "").localeCompare(b.client || ""));

    setFiltered(data);
    setPage(1); // Reset to first page on filter/sort/search
  }, [assets, statusFilter, clientFilter, batchFilter, sort, search]);

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (user && user.metadata?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Access denied. Admin privileges required.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-4 hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className=" mx-auto p-6 flex flex-col h-full">
      <Card className="p-6 flex-1 flex flex-col ">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4 space-between">
          <div className="flex gap-2">
            <Select
              value={clientFilter}
              onValueChange={(value) => setClientFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={batchFilter}
              onValueChange={(value) => setBatchFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
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
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
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
                <SelectItem value="batch">
                  Sort by: Batch (1, 2, 3...)
                </SelectItem>
                <SelectItem value="client">Sort by: Client (A-Z)</SelectItem>
                <SelectItem value="date">
                  Sort by: Delivery Date (Newest)
                </SelectItem>
                <SelectItem value="date-oldest">
                  Sort by: Delivery Date (Oldest)
                </SelectItem>
                <SelectItem value="priority">
                  Sort by: Priority (Highest First)
                </SelectItem>
                <SelectItem value="priority-lowest">
                  Sort by: Priority (Lowest First)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {statusTotals.totals.total}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Package className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    In Progress
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {statusTotals.totals.in_production +
                      statusTotals.totals.revisions}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {statusTotals.percentages.in_production +
                      statusTotals.percentages.revisions}
                    %
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
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {statusTotals.totals.approved}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {statusTotals.percentages.approved}%
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
                    Returned for Revision
                  </p>
                  <p className="text-sm font-bold text-red-600">
                    (Coming Soon)
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Delivered
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {statusTotals.totals.delivered_by_artist}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {statusTotals.percentages.delivered_by_artist}%
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {loading ? (
          <AdminReviewTableSkeleton />
        ) : (
          <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1 rounded hover:bg-accent cursor-pointer"
                          aria-label="Sort"
                        >
                          <Menu className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setSort("batch")}>
                          Batch
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSort("client")}>
                          Client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSort("az")}>
                          A-Z
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSort("za")}>
                          Z-A
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSort("date")}>
                          Delivery Date
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Article ID</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(asset.id)}
                          onChange={() => toggleSelect(asset.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {asset.product_name}
                          </span>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {annotationCounts[asset.id] || 0} annotation
                              {(annotationCounts[asset.id] || 0) !== 1
                                ? "s"
                                : ""}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <Badge variant="outline" className="text-xs">
                              Batch {asset.batch || 1}
                            </Badge>
                            {(asset.revision_count || 0) > 0 && (
                              <>
                                <span className="text-xs text-slate-500">
                                  •
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                                >
                                  R{asset.revision_count}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {asset.client || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{asset.article_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(
                              asset.priority || 2
                            )}`}
                          >
                            {getPriorityLabel(asset.priority || 2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({asset.priority || 2})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{asset.delivery_date || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          {(() => {
                            let displayStatus = asset.status;
                            // Treat "not_started" as "in_production" for client view
                            if (asset.status === "not_started") {
                              displayStatus = "in_production";
                            }

                            return (
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  displayStatus in STATUS_LABELS
                                    ? STATUS_LABELS[
                                        displayStatus as keyof typeof STATUS_LABELS
                                      ].color
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {displayStatus in STATUS_LABELS
                                  ? STATUS_LABELS[
                                      displayStatus as keyof typeof STATUS_LABELS
                                    ].label
                                  : displayStatus}
                              </span>
                            );
                          })()}
                          {(asset.revision_count || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                            >
                              R{asset.revision_count}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/client-review/${asset.id}`)
                          }
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Pagination - Always at bottom */}
        <div className="flex items-center justify-center  gap-2  ">
          <div className="text-sm text-muted-foreground">
            {filtered.length === 0
              ? "No items"
              : `
                ${1 + (page - 1) * PAGE_SIZE}
                -
                ${Math.min(page * PAGE_SIZE, filtered.length)}
                of
                ${filtered.length}
                Items
              `}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
