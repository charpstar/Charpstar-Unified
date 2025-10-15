"use client";

import { useState, useEffect } from "react";
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/display/avatar";
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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { format } from "date-fns";
import Image from "next/image";
interface DeactivatedAsset {
  id: string;
  name: string;
  category: string;
  client: string;
  client_name: string;
  deactivated_at: string;
  deactivated_by: string;
  deactivated_by_name: string;
  deactivated_by_email: string;
  glb_url: string;
  thumbnail_url: string;
  status: string;
  company_name: string;
}

export default function DeactivatedAssetsPage() {
  const user = useUser();
  const { toast } = useToast();
  const [assets, setAssets] = useState<DeactivatedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [clients, setClients] = useState<{ name: string; value: string }[]>([]);
  const [categories, setCategories] = useState<
    { name: string; value: string }[]
  >([]);

  useEffect(() => {
    if (user?.metadata?.role === "admin") {
      fetchDeactivatedAssets();
      fetchFilters();
    }
  }, [user]);

  // Check if user has admin role
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

      // Fetch deactivated assets with client information
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select(
          `
          id,
          name,
          category,
          client,
          glb_url,
          thumbnail_url,
          status,
          updated_at,
          clients!client(
            name,
            company_name
          )
        `
        )
        .eq("active", false)
        .order("updated_at", { ascending: false });

      if (assetsError) {
        console.error("Error fetching assets:", assetsError);
        toast({
          title: "Error",
          description: "Failed to fetch deactivated assets",
          variant: "destructive",
        });
        return;
      }

      // Fetch user information for who deactivated the assets
      const assetIds = assetsData?.map((asset) => asset.id) || [];
      const { data: changesData, error: changesError } = await supabase
        .from("asset_changes")
        .select(
          `
          asset_id,
          changed_by,
          changed_at,
          profiles!changed_by(
            full_name,
            email
          )
        `
        )
        .in("asset_id", assetIds)
        .order("changed_at", { ascending: false });

      if (changesError) {
        console.error("Error fetching asset changes:", changesError);
      }

      // Combine the data
      const combinedAssets =
        assetsData?.map((asset) => {
          const change = changesData?.find((c) => c.asset_id === asset.id);
          return {
            id: asset.id,
            name: asset.name,
            category: asset.category,
            client: asset.client,
            client_name: asset.client?.name || "Unknown Client",
            company_name: asset.client?.company_name || "Unknown Company",
            deactivated_at: asset.updated_at,
            deactivated_by: change?.changed_by || "Unknown",
            deactivated_by_name:
              change?.profiles?.[0]?.full_name || "Unknown User",
            deactivated_by_email:
              change?.profiles?.[0]?.email || "Unknown Email",
            glb_url: asset.glb_url,
            thumbnail_url: asset.thumbnail_url,
            status: asset.status,
          };
        }) || [];

      setAssets(combinedAssets);
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

  const fetchFilters = async () => {
    try {
      // Fetch unique clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("name")
        .order("name");

      if (!clientsError && clientsData) {
        setClients(
          clientsData.map((client) => ({
            name: client.name,
            value: client.name,
          }))
        );
      }

      // Fetch unique categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("assets")
        .select("category")
        .eq("active", false)
        .not("category", "is", null);

      if (!categoriesError && categoriesData) {
        const uniqueCategories = [
          ...new Set(categoriesData.map((item) => item.category)),
        ];
        setCategories(
          uniqueCategories.map((category) => ({
            name: category,
            value: category,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching filters:", error);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient =
      clientFilter === "all" || asset.client_name === clientFilter;
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
        "Company",
        "Deactivated At",
        "Deactivated By",
        "Status",
      ],
      ...filteredAssets.map((asset) => [
        asset.name,
        asset.category,
        asset.client_name,
        asset.company_name,
        format(new Date(asset.deactivated_at), "yyyy-MM-dd HH:mm:ss"),
        asset.deactivated_by_name,
        asset.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deactivated-assets-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Deactivated Assets</h1>
              <p className="text-muted-foreground">
                Track assets that clients have deactivated
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
            Track assets that clients have deactivated for CDN management
          </p>
        </div>
        <Button onClick={handleDownloadCSV} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
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
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">
                  Affected Clients
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
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
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {
                    assets.filter((asset) => {
                      const deactivatedDate = new Date(asset.deactivated_at);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return deactivatedDate > weekAgo;
                    }).length
                  }
                </p>
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
                  placeholder="Search assets, clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-filter">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.value} value={client.value}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Actions</Label>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setClientFilter("all");
                  setCategoryFilter("all");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deactivated Assets ({filteredAssets.length})</CardTitle>
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
            <div className="space-y-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {asset.thumbnail_url ? (
                      <Image
                        height={64}
                        width={64}
                        src={asset.thumbnail_url}
                        alt={asset.name}
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
                      <h3 className="font-semibold truncate">{asset.name}</h3>
                      <Badge variant="secondary">{asset.category}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        <span>{asset.client_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(
                            new Date(asset.deactivated_at),
                            "MMM dd, yyyy"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Deactivated By */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-xs">
                        {asset.deactivated_by_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <p className="font-medium">{asset.deactivated_by_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {asset.deactivated_by_email}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={asset.glb_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={asset.glb_url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
