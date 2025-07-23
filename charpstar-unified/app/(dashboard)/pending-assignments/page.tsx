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
  deadline: string;
  price: number;
  bonus: number;
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

interface AssignmentGroup {
  batch: number;
  client: string;
  deadline: string;
  bonus: number;
  assignments: PendingAssignment[];
  totalAssets: number;
  totalPrice: number;
  totalWithBonus: number;
}

export default function PendingAssignmentsPage() {
  const user = useUser();
  const router = useRouter();
  const [assignments, setAssignments] = useState<PendingAssignment[]>([]);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>(
    []
  );
  const [filteredGroups, setFilteredGroups] = useState<AssignmentGroup[]>([]);
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
    groupAssignments();
  }, [assignments]);

  useEffect(() => {
    filterGroups();
  }, [assignmentGroups, searchTerm, clientFilter, batchFilter]);

  // Check for asset files when assignments are loaded
  useEffect(() => {
    if (assignments.length > 0) {
      assignments.forEach((assignment) => {
        if (assignment.onboarding_assets?.id) {
          checkAssetFiles(assignment.onboarding_assets.id);
        }
      });
    }
  }, [assignments]);

  const fetchPendingAssignments = async () => {
    try {
      setLoading(true);
      // First, let's see ALL assignments for this user to debug
      const { data: allAssignments, error: allError } = await supabase
        .from("asset_assignments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      // Check the status values of existing assignments
      const statusCounts = allAssignments?.reduce(
        (acc, assignment) => {
          const status = assignment.status || "null";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Now get the pending ones
      const { data: assignments, error } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          deadline,
          price,
          bonus,
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
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "pending"); // Pending assignments have "pending" status

      if (error) {
        console.error("Error fetching pending assignments:", error);
        toast.error("Failed to fetch pending assignments");
        return;
      }

      setAssignments((assignments || []) as any);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const groupAssignments = () => {
    const groups = new Map<string, AssignmentGroup>();

    assignments.forEach((assignment) => {
      const asset = assignment.onboarding_assets;
      if (!asset) return;

      const groupKey = `${asset.client}-${asset.batch}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          batch: asset.batch,
          client: asset.client,
          deadline: assignment.deadline,
          bonus: assignment.bonus,
          assignments: [],
          totalAssets: 0,
          totalPrice: 0,
          totalWithBonus: 0,
        });
      }

      const group = groups.get(groupKey)!;
      group.assignments.push(assignment);
      group.totalAssets += 1;
      group.totalPrice += assignment.price || 0;
      group.totalWithBonus +=
        (assignment.price || 0) * (1 + (assignment.bonus || 0) / 100);
    });

    const groupedArray = Array.from(groups.values());
    setAssignmentGroups(groupedArray);
  };

  const filterGroups = () => {
    let filtered = assignmentGroups;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((group) => {
        return group.assignments.some((assignment) => {
          const asset = assignment.onboarding_assets;
          return (
            asset &&
            (asset.product_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
              asset.article_id
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              asset.client.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        });
      });
    }

    // Filter by client
    if (clientFilter !== "all") {
      filtered = filtered.filter((group) => group.client === clientFilter);
    }

    // Filter by batch
    if (batchFilter !== "all") {
      filtered = filtered.filter(
        (group) => group.batch.toString() === batchFilter
      );
    }

    setFilteredGroups(filtered);
  };

  const handleAcceptGroup = async (groupKey: string) => {
    try {
      setAccepting(groupKey);
      const group = assignmentGroups.find(
        (g) => `${g.client}-${g.batch}` === groupKey
      );
      if (!group) return;

      const assetIds = group.assignments.map((a) => a.asset_id);

      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .in("asset_id", assetIds)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error accepting group:", error);
        toast.error("Failed to accept group");
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

      toast.success("Group accepted successfully!");
      fetchPendingAssignments(); // Refresh the data
      // Force a page refresh to update all dashboard widgets
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to accept group");
    } finally {
      setAccepting(null);
    }
  };

  const handleDeclineGroup = async (groupKey: string) => {
    try {
      setDeclining(groupKey);
      const group = assignmentGroups.find(
        (g) => `${g.client}-${g.batch}` === groupKey
      );
      if (!group) return;

      const assetIds = group.assignments.map((a) => a.asset_id);

      // Delete the assignments when declined (this makes assets unassigned again)
      const { error } = await supabase
        .from("asset_assignments")
        .delete()
        .in("asset_id", assetIds)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error declining group:", error);
        toast.error("Failed to decline group");
        return;
      }

      toast.success("Group declined successfully!");
      fetchPendingAssignments(); // Refresh the data
      // Force a page refresh to update all dashboard widgets
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to decline group");
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
  const totalAssets = assignments.length;
  const totalBasePay = assignments.reduce(
    (sum, assignment) => sum + (assignment.price || 0),
    0
  );
  const totalWithBonus = assignments.reduce(
    (sum, assignment) =>
      sum + (assignment.price || 0) * (1 + (assignment.bonus || 0) / 100),
    0
  );
  const totalBonus = totalWithBonus - totalBasePay;

  // Get unique clients and batches for filter
  const clients = Array.from(
    new Set(
      assignments
        .map((a) => a.onboarding_assets?.client)
        .filter(Boolean) as string[]
    )
  );

  const batches = Array.from(
    new Set(
      assignments
        .map((a) => a.onboarding_assets?.batch)
        .filter(Boolean) as number[]
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
              <span>Pending Assignment Groups ({filteredGroups.length})</span>
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

            {/* Assignment Groups */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">
                  Loading assignments...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroups.map((group) => {
                  const groupKey = `${group.client}-${group.batch}`;

                  return (
                    <Card key={groupKey} className="p-6">
                      {/* Group Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {group.client} - Batch {group.batch}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {group.totalAssets} assets • Deadline:{" "}
                            {group.deadline
                              ? new Date(group.deadline).toLocaleDateString()
                              : "No deadline"}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-green-600">
                              €{group.totalWithBonus.toFixed(2)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Base: €{group.totalPrice.toFixed(2)} • Bonus: +
                              {group.bonus}%
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => handleAcceptGroup(groupKey)}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              disabled={accepting === groupKey}
                            >
                              <Check className="h-4 w-4" />
                              Accept Group
                            </Button>
                            <Button
                              onClick={() => handleDeclineGroup(groupKey)}
                              variant="outline"
                              className="flex items-center gap-2"
                              disabled={declining === groupKey}
                            >
                              <X className="h-4 w-4" />
                              Decline Group
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
                          {group.assignments.map((assignment) => {
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

            {filteredGroups.length === 0 && !loading && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No pending assignment groups found
                </h3>
                <p className="text-muted-foreground">
                  {assignments.length === 0
                    ? "You don't have any pending assignments at the moment."
                    : "No assignment groups match your current filters."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
