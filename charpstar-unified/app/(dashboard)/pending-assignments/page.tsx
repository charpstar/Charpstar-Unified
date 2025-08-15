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
  Link,
  Eye,
  Image,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { notificationService } from "@/lib/notificationService";
import { Badge } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";

interface PendingAssignment {
  asset_id: string;
  price: number;
  onboarding_assets: {
    id: string;
    article_id: string;
    product_name: string;
    product_link: string;
    glb_link: string;
    reference: string[] | string | null;
    client: string;
    batch: number;
  } | null;
}

interface AllocationList {
  id: string;
  name: string;
  number: number;
  deadline: string;
  bonus: number;
  created_at: string;
  asset_assignments: PendingAssignment[];
  totalAssets: number;
  totalPrice: number;
  totalWithBonus: number;
}

// Helper function to check if deadline is overdue
const isOverdue = (deadline: string) => {
  return new Date(deadline) < new Date();
};

// Helper functions for reference management
const getReferenceArray = (reference: string[] | null): string[] => {
  if (!reference) return [];
  if (Array.isArray(reference)) {
    return reference.filter(
      (ref) => ref && typeof ref === "string" && ref.trim() !== ""
    );
  }
  return [];
};

const parseReferences = (reference: string[] | string | null): string[] => {
  if (!reference) return [];
  if (Array.isArray(reference)) return reference;
  try {
    return JSON.parse(reference);
  } catch {
    return [reference];
  }
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "🖼️";
  if (["pdf"].includes(ext || "")) return "📄";
  if (["zip", "rar", "7z"].includes(ext || "")) return "📦";
  if (["doc", "docx"].includes(ext || "")) return "📝";
  return "📎";
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
  const [acceptedLists, setAcceptedLists] = useState<
    Map<string, AllocationList>
  >(new Map());
  const [declinedLists, setDeclinedLists] = useState<
    Map<string, AllocationList>
  >(new Map());

  useEffect(() => {
    if (user?.id) {
      fetchPendingAssignments();
    }
  }, [user?.id]);

  // Mark related notifications as read when visiting this page
  useEffect(() => {
    const markPageNotificationsRead = async () => {
      if (!user?.id) return;
      try {
        const unread = await notificationService.getUnreadNotifications(
          user.id
        );
        const toMark = unread.filter(
          (n) => n.type === "asset_allocation" || n.type === "deadline_reminder"
        );
        if (toMark.length > 0) {
          await Promise.all(
            toMark
              .filter((n) => n.id)
              .map((n) => notificationService.markNotificationAsRead(n.id!))
          );
          // notify bell to refresh immediately
          window.dispatchEvent(new Event("notificationsUpdated"));
        }
      } catch (e) {
        console.error(
          "Failed marking notifications as read on pending page",
          e
        );
      }
    };
    markPageNotificationsRead();
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
          number,
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
      const transformedLists = (lists || []).map((list: any) => ({
        ...list,
        asset_assignments: (list.asset_assignments || []).map(
          (assignment: any) => ({
            ...assignment,
            onboarding_assets: Array.isArray(assignment.onboarding_assets)
              ? assignment.onboarding_assets[0] || null
              : assignment.onboarding_assets,
          })
        ),
        totalAssets: list.asset_assignments.length,
        totalPrice: list.asset_assignments.reduce(
          (sum: number, assignment: any) => sum + (assignment.price || 0),
          0
        ),
        totalWithBonus:
          list.asset_assignments.reduce(
            (sum: number, assignment: any) => sum + (assignment.price || 0),
            0
          ) *
          (1 + (list.bonus || 0) / 100), // Bonus only applies if completed before deadline
      }));
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

      // Optimistic update - immediately remove from the list
      setAllocationLists((prev) => prev.filter((l) => l.id !== listId));
      setAcceptedLists((prev) => new Map(prev).set(listId, list));

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
        // Revert optimistic update on error
        setAllocationLists((prev) => [...prev, list]);
        setAcceptedLists((prev) => {
          const newMap = new Map(prev);
          newMap.delete(listId);
          return newMap;
        });
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

      // Send notification to admin users about allocation list acceptance
      try {
        const firstAsset = list.asset_assignments[0]?.onboarding_assets;
        if (firstAsset && user?.email) {
          console.log("📤 Sending allocation list acceptance notification...");
          console.log("👤 User data:", {
            name: user?.user_metadata?.name,
            email: user?.email,
            hasFirstAsset: !!firstAsset,
          });
          await notificationService.sendAllocationListStatusNotification({
            modelerName: user.user_metadata.name || user.email,
            modelerEmail: user.email,
            allocationListName: list.name,
            allocationListNumber: list.number,
            assetCount: list.totalAssets,
            totalPrice: list.totalPrice,
            client: firstAsset.client,
            batch: firstAsset.batch,
            status: "accepted",
          });
          console.log(
            "Allocation list acceptance notification sent successfully"
          );
        }
      } catch (notificationError) {
        console.error(
          "Failed to send allocation list acceptance notification:",
          notificationError
        );
        // Don't fail the acceptance if notification fails
      }

      // Remove from accepted lists after a delay to show success animation
      setTimeout(() => {
        setAcceptedLists((prev) => {
          const newMap = new Map(prev);
          newMap.delete(listId);
          return newMap;
        });
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to accept list");
      // Revert optimistic update on error
      const list = allocationLists.find((l) => l.id === listId);
      if (list) {
        setAllocationLists((prev) => [...prev, list]);
      }
      setAcceptedLists((prev) => {
        const newMap = new Map(prev);
        newMap.delete(listId);
        return newMap;
      });
    } finally {
      setAccepting(null);
    }
  };

  const handleDeclineList = async (listId: string) => {
    try {
      setDeclining(listId);
      const list = allocationLists.find((l) => l.id === listId);
      if (!list) return;

      // Optimistic update - immediately remove from the list
      setAllocationLists((prev) => prev.filter((l) => l.id !== listId));
      setDeclinedLists((prev) => new Map(prev).set(listId, list));

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
        // Revert optimistic update on error
        setAllocationLists((prev) => [...prev, list]);
        setDeclinedLists((prev) => {
          const newMap = new Map(prev);
          newMap.delete(listId);
          return newMap;
        });
        return;
      }

      toast.success("Allocation list declined successfully!");

      // Send notification to admin users about allocation list decline
      try {
        const firstAsset = list.asset_assignments[0]?.onboarding_assets;
        if (firstAsset && user?.email) {
          console.log("📤 Sending allocation list decline notification...");
          console.log("👤 User data:", {
            name: user?.user_metadata?.name,
            email: user?.email,
            hasFirstAsset: !!firstAsset,
          });
          await notificationService.sendAllocationListStatusNotification({
            modelerName: user.user_metadata.name || user.email,
            modelerEmail: user.email,
            allocationListName: list.name,
            allocationListNumber: list.number,
            assetCount: list.totalAssets,
            totalPrice: list.totalPrice,
            client: firstAsset.client,
            batch: firstAsset.batch,
            status: "declined",
          });
          console.log("Allocation list decline notification sent successfully");
        }
      } catch (notificationError) {
        console.error(
          "Failed to send allocation list decline notification:",
          notificationError
        );
        // Don't fail the decline if notification fails
      }

      // Remove from declined lists after a delay to show success animation
      setTimeout(() => {
        setDeclinedLists((prev) => {
          const newMap = new Map(prev);
          newMap.delete(listId);
          return newMap;
        });
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to decline list");
      // Revert optimistic update on error
      const list = allocationLists.find((l) => l.id === listId);
      if (list) {
        setAllocationLists((prev) => [...prev, list]);
      }
      setDeclinedLists((prev) => {
        const newMap = new Map(prev);
        newMap.delete(listId);
        return newMap;
      });
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
  const [showReferencesDialog, setShowReferencesDialog] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);

  const handleViewReferences = (references: string[]) => {
    setSelectedReferences(references);
    setShowReferencesDialog(true);
  };

  const handleViewFiles = (files: any[]) => {
    setSelectedFiles(files);
    setShowFilesDialog(true);
  };

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-info" />
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
                <Euro className="h-8 w-8 text-success" />
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
                <Euro className="h-8 w-8 text-accent-purple" />
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

            {/* Success Messages */}
            {acceptedLists.size > 0 && (
              <div className="space-y-2">
                {Array.from(acceptedLists.entries()).map(([listId, list]) => {
                  return (
                    <div
                      key={listId}
                      className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top-2 duration-300"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-success-muted rounded-full">
                        <Check className="h-4 w-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-800">
                          {list?.name || "Allocation List"} accepted
                          successfully!
                        </p>
                        <p className="text-sm text-success">
                          The list has been moved to your assignments.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {declinedLists.size > 0 && (
              <div className="space-y-2">
                {Array.from(declinedLists.entries()).map(([listId, list]) => {
                  return (
                    <div
                      key={listId}
                      className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top-2 duration-300"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-error-muted rounded-full">
                        <X className="h-4 w-4 text-error" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-red-800">
                          {list?.name || "Allocation List"} declined
                          successfully!
                        </p>
                        <p className="text-sm text-error">
                          The list has been removed from your pending
                          assignments.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Allocation Lists */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">
                  Loading allocation lists...
                </p>
              </div>
            ) : filteredLists.length === 0 &&
              acceptedLists.size === 0 &&
              declinedLists.size === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No pending allocation lists found
                </h3>
                <p className="text-muted-foreground">
                  You don&apos;t have any pending assignments at the moment.
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
                          <div>
                            <h3 className="text-lg font-semibold">
                              Allocation {list.number} -{" "}
                              {list.deadline ? (
                                <span
                                  className={
                                    isOverdue(list.deadline)
                                      ? "text-red-600 font-medium"
                                      : ""
                                  }
                                >
                                  {new Date(list.deadline).toLocaleDateString()}
                                </span>
                              ) : (
                                "No deadline"
                              )}{" "}
                              - {list.totalAssets} assets
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Review assets and references below before
                              accepting
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-success">
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

                      {/* Assets Summary */}
                      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              Assets Overview:
                            </span>
                          </div>
                          {(() => {
                            const totalRefs = list.asset_assignments.reduce(
                              (sum, assignment) => {
                                const refs = Array.isArray(
                                  assignment.onboarding_assets?.reference
                                )
                                  ? assignment.onboarding_assets.reference
                                  : [];
                                return sum + refs.length;
                              },
                              0
                            );
                            const totalFiles = list.asset_assignments.reduce(
                              (sum, assignment) => {
                                const files =
                                  assetFilesMap[
                                    assignment.onboarding_assets?.id || ""
                                  ] || [];
                                return sum + files.length;
                              },
                              0
                            );
                            const hasGLB = list.asset_assignments.some(
                              (assignment) =>
                                assignment.onboarding_assets?.glb_link
                            );

                            return (
                              <div className="flex items-center gap-4 text-muted-foreground">
                                {hasGLB && (
                                  <span className="flex items-center gap-1">
                                    <File className="h-3 w-3" />
                                    GLB files available
                                  </span>
                                )}
                                {totalRefs > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Image className="h-3 w-3" />
                                    {totalRefs} reference images
                                  </span>
                                )}
                                {totalFiles > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {totalFiles} asset files
                                  </span>
                                )}
                                {!hasGLB &&
                                  totalRefs === 0 &&
                                  totalFiles === 0 && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                      <AlertCircle className="h-3 w-3" />
                                      No assets available
                                    </span>
                                  )}
                              </div>
                            );
                          })()}
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
                            <TableHead className="w-32 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 justify-center cursor-help">
                                    References
                                    <Info className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    View reference images and 3D model files
                                  </p>
                                </TooltipContent>
                              </Tooltip>
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
                                    <Euro className="h-4 w-4 text-success" />
                                    <span className="font-semibold">
                                      €{assignment.price?.toFixed(2)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center w-32">
                                  <div className="flex flex-col items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs px-3 py-1 h-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAssetForView(asset);
                                        setShowViewDialog(true);
                                      }}
                                    >
                                      <FileText className="mr-1 h-3 w-3" />
                                      Ref (
                                      {(() => {
                                        console.log(
                                          "Asset reference:",
                                          asset.reference
                                        );
                                        const separated = separateReferences(
                                          asset.reference
                                        );
                                        console.log(
                                          "Separated references:",
                                          separated
                                        );
                                        return (
                                          separated.imageReferences.length +
                                          separated.glbFiles.length
                                        );
                                      })()}
                                      )
                                    </Button>
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

                                    {/* Show info icon if no references or files are available */}
                                    {(() => {
                                      const refs = Array.isArray(
                                        asset.reference
                                      )
                                        ? asset.reference
                                        : [];
                                      const hasReferences = refs.length > 0;
                                      const files =
                                        assetFilesMap[asset.id] || [];

                                      if (
                                        !asset.product_link &&
                                        !hasReferences &&
                                        files.length === 0
                                      ) {
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground">
                                                <Info className="h-4 w-4" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                No additional links available
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
          </CardContent>
        </Card>
      </div>

      {/* References Preview Dialog */}
      <Dialog
        open={showReferencesDialog}
        onOpenChange={setShowReferencesDialog}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reference Images</DialogTitle>
            <DialogDescription>
              Review the reference images for this asset before accepting the
              assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedReferences.map((ref, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square overflow-hidden rounded-lg border">
                  <img
                    src={ref}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/images/4.png";
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Reference {index + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(ref, "_blank")}
                    className="h-6 px-2 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  selectedReferences.forEach((ref) => {
                    window.open(ref, "_blank");
                  });
                  toast.success(
                    `Opening ${selectedReferences.length} reference images`
                  );
                }}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open All
              </Button>
              <Button onClick={() => setShowReferencesDialog(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Files Preview Dialog */}
      <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Files</DialogTitle>
            <DialogDescription>
              Review the asset files for this assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                  {file.file_type === "glb" ? (
                    <div className="text-center p-4">
                      <File className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">3D Model</p>
                      <p className="text-xs text-muted-foreground">
                        {file.file_name}
                      </p>
                    </div>
                  ) : file.file_type === "reference" ? (
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/images/4.png";
                      }}
                    />
                  ) : file.file_type === "asset" ? (
                    <div className="text-center p-4">
                      <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Asset File</p>
                      <p className="text-xs text-muted-foreground">
                        {file.file_name}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <File className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">File</p>
                      <p className="text-xs text-muted-foreground">
                        {file.file_name}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p
                    className="text-sm font-medium truncate"
                    title={file.file_name}
                  >
                    {file.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.file_type} • {file.uploaded_by}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.file_url, "_blank")}
                      className="h-6 px-2 text-xs flex-1"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = file.file_url;
                        link.download = file.file_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  selectedFiles.forEach((file) => {
                    const link = document.createElement("a");
                    link.href = file.file_url;
                    link.download = file.file_name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  });
                  toast.success(`Downloading ${selectedFiles.length} files`);
                }}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download All
              </Button>
              <Button onClick={() => setShowFilesDialog(false)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog for Asset References */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAssetForView?.product_name} - References
            </DialogTitle>
            <DialogDescription>
              View all references and assets for this assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Asset Info */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Article ID:</span>{" "}
                  {selectedAssetForView?.article_id}
                </div>
                <div>
                  <span className="font-medium">Client:</span>{" "}
                  {selectedAssetForView?.client}
                </div>
                <div>
                  <span className="font-medium">Batch:</span>{" "}
                  {selectedAssetForView?.batch}
                </div>
                {selectedAssetForView?.glb_link && (
                  <div>
                    <span className="font-medium">GLB File:</span>{" "}
                    <a
                      href={selectedAssetForView.glb_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Available
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* References Grid */}
            {selectedAssetForView?.reference && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Reference Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {separateReferences(
                    selectedAssetForView.reference
                  ).imageReferences.map((ref, index) => (
                    <div key={index} className="space-y-2">
                      <div className="aspect-square overflow-hidden rounded-lg border">
                        <img
                          src={ref}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/images/4.png";
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Reference {index + 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(ref, "_blank")}
                          className="h-6 px-2 text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GLB Files */}
            {selectedAssetForView?.reference &&
              separateReferences(selectedAssetForView.reference).glbFiles
                .length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">3D Model Files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {separateReferences(
                      selectedAssetForView.reference
                    ).glbFiles.map((ref, index) => (
                      <div key={index} className="space-y-2">
                        <div className="aspect-square overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                          <div className="text-center p-4">
                            <File className="h-12 w-12 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">3D Model</p>
                            <p className="text-xs text-muted-foreground">
                              {ref.split("/").pop()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            GLB File {index + 1}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(ref, "_blank")}
                            className="h-6 px-2 text-xs"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Asset Files */}
            {selectedAssetForView?.id &&
              assetFilesMap[selectedAssetForView.id] &&
              assetFilesMap[selectedAssetForView.id].length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Asset Files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assetFilesMap[selectedAssetForView.id].map(
                      (file, index) => (
                        <div key={index} className="space-y-2">
                          <div className="aspect-square overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                            <div className="text-center p-4">
                              <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="text-sm font-medium">Asset File</p>
                              <p className="text-xs text-muted-foreground">
                                {file.file_name}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p
                              className="text-sm font-medium truncate"
                              title={file.file_name}
                            >
                              {file.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.file_type} • {file.uploaded_by}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(file.file_url, "_blank")
                                }
                                className="h-6 px-2 text-xs flex-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = file.file_url;
                                  link.download = file.file_name;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
