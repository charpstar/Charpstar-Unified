"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";
import { Badge } from "@/components/ui/feedback/badge";
import { Button } from "@/components/ui/display/button";
import { Input } from "@/components/ui/inputs/input";
import { Label } from "@/components/ui/display/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";
import {
  Package,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  Building2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { format } from "date-fns";
import Image from "next/image";

interface DeactivatedAsset {
  id: string;
  product_name: string;
  category: string;
  client: string;
  glb_link: string;
  preview_image: string;
  glb_status: string;
  updated_at: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 50;

export default function DeactivatedAssetsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const { toast } = useToast();
  const [assets, setAssets] = useState<DeactivatedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [clients, setClients] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (user?.metadata?.role === "admin") {
      fetchDeactivatedAssets();
    }
  }, [user]);

  // Initialize filters and page from URL on mount (ONCE)
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    const urlClient = searchParams.get("client") || "all";
    const urlCategory = searchParams.get("category") || "all";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    setSearchTerm(urlSearch);
    setClientFilter(urlClient);
    setCategoryFilter(urlCategory);
    if (urlPage > 0) {
      setCurrentPage(urlPage);
    }

    setIsInitialized(true);
  }, []); // Only run once on mount

  // Handle URL changes from browser navigation (back/forward)
  useEffect(() => {
    if (!isInitialized) return;

    const urlSearch = searchParams.get("search") || "";
    const urlClient = searchParams.get("client") || "all";
    const urlCategory = searchParams.get("category") || "all";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    // Update state if URL changed
    if (urlSearch !== searchTerm) setSearchTerm(urlSearch);
    if (urlClient !== clientFilter) setClientFilter(urlClient);
    if (urlCategory !== categoryFilter) setCategoryFilter(urlCategory);
    if (urlPage !== currentPage && urlPage > 0) setCurrentPage(urlPage);
  }, [searchParams.toString(), isInitialized]); // Run when URL changes

  // Update URL when filters or page changes
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();

    if (searchTerm) params.set("search", searchTerm);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (currentPage > 1) params.set("page", currentPage.toString());

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl, { scroll: false });
  }, [
    searchTerm,
    clientFilter,
    categoryFilter,
    currentPage,
    pathname,
    router,
    isInitialized,
  ]);

  // Admin check
  if (user?.metadata?.role !== "admin") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don&apos;t have permission to access this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchDeactivatedAssets = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("active", false)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching assets:", error);
        toast({
          title: "Error",
          description: "Failed to fetch deactivated assets",
          variant: "destructive",
        });
        return;
      }

      setAssets(data || []);

      // Extract unique values for filters
      const uniqueClients = [
        ...new Set(data?.map((a) => a.client).filter(Boolean)),
      ] as string[];
      const uniqueCategories = [
        ...new Set(data?.map((a) => a.category).filter(Boolean)),
      ] as string[];

      setClients(uniqueClients.sort());
      setCategories(uniqueCategories.sort());

      toast({
        title: "Success",
        description: `Loaded ${data?.length || 0} deactivated assets`,
      });
    } catch (error) {
      console.error("Error fetching deactivated assets:", error);
      toast({
        title: "Error",
        description: "Failed to fetch deactivated assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClient =
      clientFilter === "all" || asset.client === clientFilter;
    const matchesCategory =
      categoryFilter === "all" || asset.category === categoryFilter;

    return matchesSearch && matchesClient && matchesCategory;
  });

  const handleDownloadCSV = () => {
    const csvContent = [
      [
        "Asset Name",
        "Category",
        "Client",
        "Status",
        "Deactivated At",
        "GLB URL",
      ],
      ...filteredAssets.map((asset) => [
        asset.product_name || "N/A",
        asset.category || "N/A",
        asset.client || "N/A",
        asset.glb_status || "N/A",
        format(new Date(asset.updated_at), "yyyy-MM-dd HH:mm:ss"),
        asset.glb_link || "N/A",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deactivated-assets-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setClientFilter("all");
    setCategoryFilter("all");
    setCurrentPage(1);
  };

  const recentDeactivations = assets.filter((asset) => {
    const deactivatedDate = new Date(asset.updated_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return deactivatedDate > weekAgo;
  }).length;

  // Calculate pagination
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Deactivated Assets</h1>
              <p className="text-muted-foreground">
                Loading deactivated assets...
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deactivated Assets</h1>
          <p className="text-muted-foreground">
            Track and manage assets that have been deactivated
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchDeactivatedAssets}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assets.length}</p>
                <p className="text-sm text-muted-foreground">
                  Total Deactivated
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">Unique Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Filter className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredAssets.length}</p>
                <p className="text-sm text-muted-foreground">
                  Filtered Results
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentDeactivations}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (isInitialized) setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="cursor-pointer" htmlFor="client-filter">
                Client
              </Label>
              <Select
                value={clientFilter}
                onValueChange={(value) => {
                  setClientFilter(value);
                  if (isInitialized) setCurrentPage(1);
                }}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="All clients" />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  if (isInitialized) setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Actions</Label>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Assets ({filteredAssets.length})</CardTitle>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No deactivated assets found
              </h3>
              <p className="text-muted-foreground">
                {assets.length === 0
                  ? "No assets have been deactivated yet."
                  : "Try adjusting your filters to see more results."}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-
                  {Math.min(endIndex, filteredAssets.length)} of{" "}
                  {filteredAssets.length} assets
                </p>
              </div>
              <div className="space-y-3">
                {currentAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      {asset.preview_image ? (
                        <Image
                          height={64}
                          width={64}
                          src={asset.preview_image}
                          alt={asset.product_name || "Asset"}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Asset Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {asset.product_name || "Unnamed Asset"}
                        </h3>
                        {asset.category && (
                          <Badge variant="secondary">{asset.category}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {asset.client && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            <span>{asset.client}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Deactivated{" "}
                            {format(new Date(asset.updated_at), "MMM dd, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {asset.glb_link && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(asset.glb_link, "_blank")
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = asset.glb_link;
                              link.download = asset.product_name || "asset.glb";
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
