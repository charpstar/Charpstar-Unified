"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display";
import {
  Search,
  RotateCcw,
  ArrowLeft,
  Euro,
  Package,
  ExternalLink,
  Download,
  Check,
  X,
  File,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface PendingAssignment {
  asset_id: string;
  price: number;
  onboarding_assets: {
    id: string;
    article_id: string;
    product_name: string;
    product_link: string;
    glb_link: string;
    reference: string[] | null;
    client: string;
    batch: number;
  } | null;
}

interface AllocationList {
  id: string;
  name: string;
  deadline: string;
  bonus: number;
  created_at: string;
  asset_assignments: PendingAssignment[];
  totalAssets: number;
  totalPrice: number;
  totalWithBonus: number;
}

export default function PendingAssignmentsPage() {
  const user = useUser();
  const router = useRouter();
  const [allocationLists, setAllocationLists] = useState<AllocationList[]>([]);
  const [filteredLists, setFilteredLists] = useState<AllocationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchPendingAssignments();
    }
  }, [user?.id]);

  useEffect(() => {
    filterLists();
  }, [allocationLists, searchTerm, clientFilter, batchFilter]);

  // Check for asset files when allocation lists are loaded
  useEffect(() => {
    if (allocationLists.length > 0) {
      allocationLists.forEach((list) => {
        list.asset_assignments.forEach((assignment) => {
          if (assignment.onboarding_assets?.id) {
            checkAssetFiles(assignment.onboarding_assets.id);
          }
        });
      });
    }
  }, [allocationLists]);

  const fetchPendingAssignments = async () => {
    try {
      setLoading(true);

      // Get pending allocation lists for this user
      const { data: lists, error: listsError } = await supabase
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
            price,
            status,
            onboarding_assets(
              id,
              article_id,
              product_name,
              product_link,
              glb_link,
              reference,
              client,
              batch
            )
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("asset_assignments.status", "pending");

      if (listsError) {
        console.error("Error fetching pending allocation lists:", listsError);
        toast.error("Failed to fetch pending assignments");
        return;
      }

      // Transform the data to include calculated totals
      const transformedLists =
        lists?.map((list) => {
          const totalAssets = list.asset_assignments.length;
          const totalPrice = list.asset_assignments.reduce(
            (sum: number, assignment: any) => sum + (assignment.price || 0),
            0
          );
          const totalWithBonus = totalPrice * (1 + (list.bonus || 0) / 100);

          return {
            ...list,
            totalAssets,
            totalPrice,
            totalWithBonus,
          };
        }) || [];

      setAllocationLists(transformedLists);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const filterLists = () => {
    let filtered = [...allocationLists];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (list) =>
          list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          list.asset_assignments.some(
            (assignment) =>
              assignment.onboarding_assets?.product_name
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              assignment.onboarding_assets?.article_id
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          )
      );
    }

    // Filter by client
    if (clientFilter !== "all") {
      filtered = filtered.filter((list) =>
        list.asset_assignments.some(
          (assignment) => assignment.onboarding_assets?.client === clientFilter
        )
      );
    }

    // Filter by batch
    if (batchFilter !== "all") {
      filtered = filtered.filter((list) =>
        list.asset_assignments.some(
          (assignment) =>
            assignment.onboarding_assets?.batch === parseInt(batchFilter)
        )
      );
    }

    setFilteredLists(filtered);
  };

  const handleAcceptList = async (listId: string) => {
    try {
      setAccepting(listId);
      const list = allocationLists.find((l) => l.id === listId);
      if (!list) return;

      const assetIds = list.asset_assignments.map((a) => a.asset_id);

      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .in("asset_id", assetIds)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error accepting list:", error);
        toast.error("Failed to accept list");
        return;
      }

      // Update asset status to in_production when accepted
      const { error: statusError } = await supabase
        .from("onboarding_assets")
        .update({ status: "in_production" })
        .in("id", assetIds);

      if (statusError) {
        console.error("Error updating asset status:", statusError);
        // Don't fail the acceptance if status update fails
      }

      toast.success("Allocation list accepted successfully!");
      fetchPendingAssignments(); // Refresh the data
      // Force a page refresh to update all dashboard widgets
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to accept list");
    } finally {
      setAccepting(null);
    }
  };

  const handleDeclineList = async (listId: string) => {
    try {
      setDeclining(listId);
      const list = allocationLists.find((l) => l.id === listId);
      if (!list) return;

      const assetIds = list.asset_assignments.map((a) => a.asset_id);

      // Delete the assignments when declined (this makes assets unassigned again)
      const { error } = await supabase
        .from("asset_assignments")
        .delete()
        .in("asset_id", assetIds)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error declining list:", error);
        toast.error("Failed to decline list");
        return;
      }

      toast.success("Allocation list declined successfully!");
      fetchPendingAssignments(); // Refresh the data
      // Force a page refresh to update all dashboard widgets
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to decline list");
    } finally {
      setDeclining(null);
    }
  };

  const handleDownloadReferences = (referenceImages: string[]) => {
    // Filter out invalid URLs
    const validUrls = referenceImages.filter(
      (url) =>
        url &&
        typeof url === "string" &&
        url.trim() !== "" &&
        url.startsWith("http")
    );

    if (validUrls.length === 0) {
      toast.error("No valid reference images found");
      return;
    }

    validUrls.forEach((url) => {
      window.open(url, "_blank");
    });

    toast.success(`Opening ${validUrls.length} reference images`);
  };

  const [assetFilesMap, setAssetFilesMap] = useState<Record<string, any[]>>({});
  const [checkingFiles, setCheckingFiles] = useState<Record<string, boolean>>(
    {}
  );

  const checkAssetFiles = async (assetId: string) => {
    if (assetFilesMap[assetId] !== undefined) {
      return assetFilesMap[assetId];
    }

    setCheckingFiles((prev) => ({ ...prev, [assetId]: true }));

    try {
      const response = await fetch(`/api/assets/${assetId}/files`);
      if (!response.ok) {
        throw new Error("Failed to fetch asset files");
      }

      const data = await response.json();
      const files = data.files || [];

      setAssetFilesMap((prev) => ({ ...prev, [assetId]: files }));
      return files;
    } catch (error) {
      console.error("Error checking asset files:", error);
      setAssetFilesMap((prev) => ({ ...prev, [assetId]: [] }));
      return [];
    } finally {
      setCheckingFiles((prev) => ({ ...prev, [assetId]: false }));
    }
  };

  const handleDownloadAssetFiles = async (assetId: string) => {
    try {
      const files = assetFilesMap[assetId] || [];
      if (files.length > 0) {
        // Download each file
        files.forEach((file: any) => {
          const link = document.createElement("a");
          link.href = file.file_url;
          link.download = file.file_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
        toast.success(`Downloading ${files.length} asset files`);
      } else {
        toast.info("No asset files found for this asset");
      }
    } catch (error) {
      console.error("Error downloading asset files:", error);
      toast.error("Failed to download asset files");
    }
  };

  // Calculate summary statistics
  const totalAssets = allocationLists.reduce(
    (sum, list) => sum + list.totalAssets,
    0
  );
  const totalBasePay = allocationLists.reduce(
    (sum, list) => sum + list.totalPrice,
    0
  );
  const totalWithBonus = allocationLists.reduce(
    (sum, list) => sum + list.totalWithBonus,
    0
  );
  const totalBonus = totalWithBonus - totalBasePay;

  // Get unique clients and batches for filter
  const clients = Array.from(
    new Set(
      allocationLists.flatMap(
        (list) =>
          list.asset_assignments
            .map((a) => a.onboarding_assets?.client)
            .filter(Boolean) as string[]
      )
    )
  );

  const batches = Array.from(
    new Set(
      allocationLists.flatMap(
        (list) =>
          list.asset_assignments
            .map((a) => a.onboarding_assets?.batch)
            .filter(Boolean) as number[]
      )
    )
  ).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pending Assignments</h1>
            <p className="text-muted-foreground">
              Review and accept your pending assignment groups
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{totalAssets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Euro className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Earnings
                  </p>
                  <p className="text-2xl font-bold">
                    €{totalWithBonus.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Euro className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Bonus</p>
                  <p className="text-2xl font-bold">€{totalBonus.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pending Allocation Lists ({filteredLists.length})</span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setClientFilter("all");
                    setBatchFilter("all");
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by product name, article ID, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by client" />
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
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch} value={batch.toString()}>
                      Batch {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Allocation Lists */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">
                  Loading allocation lists...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredLists.map((list) => {
                  return (
                    <Card key={list.id} className="p-6">
                      {/* List Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{list.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {list.totalAssets} assets • Deadline:{" "}
                            {list.deadline
                              ? new Date(list.deadline).toLocaleDateString()
                              : "No deadline"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-green-600">
                              €{list.totalWithBonus.toFixed(2)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Base: €{list.totalPrice.toFixed(2)} • Bonus: +
                              {list.bonus}%
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => handleAcceptList(list.id)}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              disabled={accepting === list.id}
                            >
                              <Check className="h-4 w-4" />
                              Accept List
                            </Button>
                            <Button
                              onClick={() => handleDeclineList(list.id)}
                              variant="outline"
                              className="flex items-center gap-2"
                              disabled={declining === list.id}
                            >
                              <X className="h-4 w-4" />
                              Decline List
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Assets Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Article ID</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="w-24 text-center">
                              Price
                            </TableHead>
                            <TableHead className="w-24 text-center">
                              Links
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.asset_assignments.map((assignment) => {
                            const asset = assignment.onboarding_assets;
                            if (!asset) return null;

                            return (
                              <TableRow key={assignment.asset_id}>
                                <TableCell className="font-mono text-sm w-32">
                                  {asset.article_id}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {asset.product_name}
                                </TableCell>
                                <TableCell className="text-center w-24">
                                  <div className="flex items-center justify-center gap-1">
                                    <Euro className="h-4 w-4 text-green-600" />
                                    <span className="font-semibold">
                                      €{assignment.price?.toFixed(2)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center w-24">
                                  <div className="flex items-center justify-center space-x-1">
                                    {asset.product_link && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <a
                                            href={asset.product_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Product link</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}

                                    {asset.reference &&
                                      Array.isArray(asset.reference) &&
                                      asset.reference.length > 0 &&
                                      asset.reference.some(
                                        (ref: any) =>
                                          ref &&
                                          typeof ref === "string" &&
                                          ref.trim() !== ""
                                      ) && (
                                        <button
                                          onClick={() =>
                                            handleDownloadReferences(
                                              asset.reference as string[]
                                            )
                                          }
                                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                                          title="Download reference images"
                                        >
                                          <Download className="h-4 w-4" />
                                        </button>
                                      )}
                                    {(() => {
                                      const files =
                                        assetFilesMap[asset.id] || [];
                                      const isChecking =
                                        checkingFiles[asset.id];

                                      if (isChecking) {
                                        return (
                                          <div className="inline-flex items-center justify-center h-8 w-8">
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-muted-foreground" />
                                          </div>
                                        );
                                      }

                                      if (files.length > 0) {
                                        return (
                                          <button
                                            onClick={() =>
                                              handleDownloadAssetFiles(asset.id)
                                            }
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                                            title={`Download ${files.length} asset files`}
                                          >
                                            <File className="h-4 w-4" />
                                          </button>
                                        );
                                      }

                                      return null;
                                    })()}

                                    {/* Show info icon if no references or files are available */}
                                    {(() => {
                                      const hasProductLink =
                                        !!asset.product_link;
                                      const hasReferences =
                                        asset.reference &&
                                        Array.isArray(asset.reference) &&
                                        asset.reference.length > 0 &&
                                        asset.reference.some(
                                          (ref: any) =>
                                            ref &&
                                            typeof ref === "string" &&
                                            ref.trim() !== ""
                                        );
                                      const files =
                                        assetFilesMap[asset.id] || [];
                                      const isChecking =
                                        checkingFiles[asset.id];
                                      const hasFiles =
                                        !isChecking && files.length > 0;

                                      // Show info icon if no other links/buttons are shown
                                      // Temporarily always show for testing
                                      if (true) {
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground">
                                                <Info className="h-4 w-4" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                No reference images or asset
                                                files available
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      }

                                      return null;
                                    })()}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Card>
                  );
                })}
              </div>
            )}

            {filteredLists.length === 0 && !loading && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No pending allocation lists found
                </h3>
                <p className="text-muted-foreground">
                  {allocationLists.length === 0
                    ? "You don't have any pending assignments at the moment."
                    : "No allocation lists match your current filters."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
