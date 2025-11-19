"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

interface ListAssetSummary {
  id: string;
  status: string | null;
  priority: number | null;
  client: string | null;
  productName: string | null;
  articleId: string | null;
}

interface AllocationListSummary {
  id: string;
  name: string | null;
  number: number | null;
  status: string | null;
  deadline: string | null;
  createdAt: string | null;
  bonus: number | null;
  modelerId: string | null;
  modelerEmail?: string | null;
  modelerTitle?: string | null;
  assetIds: string[];
  assetCount: number;
  urgentCount: number;
  statusBreakdown: Record<string, number>;
  clients: string[];
  assets: ListAssetSummary[];
}

interface QAProfileOption {
  id: string;
  email: string | null;
  title?: string | null;
}

const formatDate = (dateInput?: string | null) => {
  if (!dateInput) return "No deadline";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isDeadlineOverdue = (deadline?: string | null) => {
  if (!deadline) return false;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
};

const getStatusBadgeClasses = (status?: string | null) => {
  switch ((status || "").toLowerCase()) {
    case "in_production":
    case "in_progress":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "revisions":
    case "client_revision":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "approved":
    case "approved_by_client":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pending":
    case "not_started":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const getStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function QAAssignedListsPage() {
  const user = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [listSummaries, setListSummaries] = useState<AllocationListSummary[]>(
    []
  );
  const [availableQAs, setAvailableQAs] = useState<QAProfileOption[]>([]);
  const [selectedQAByList, setSelectedQAByList] = useState<
    Record<string, string>
  >({});
  const [transferLoading, setTransferLoading] = useState<Set<string>>(
    new Set()
  );
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "CharpstAR Platform - Asset Lists";
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableQAs();
      fetchAssignedLists();
    }
  }, [user?.id]);

  const fetchAvailableQAs = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "qa")
        .order("email", { ascending: true });

      if (error) {
        console.error("Error fetching QA profiles:", error);
        return;
      }

      setAvailableQAs(data ?? []);
    } catch (err) {
      console.error("Unexpected error fetching QA profiles:", err);
    }
  };

  const fetchAssignedLists = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/qa/asset-lists", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to load asset lists.");
      }

      const payload = (await response.json()) as {
        lists?: AllocationListSummary[];
      };
      setListSummaries(payload?.lists ?? []);
    } catch (err) {
      console.error("Unexpected error loading asset lists:", err);
      setError("An unexpected error occurred while loading asset lists.");
      setListSummaries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedLists();
  };

  const handleTransfer = async (listId: string) => {
    const selectedQa = selectedQAByList[listId];
    if (!selectedQa) {
      toast.error("Select a QA before transferring this list.");
      return;
    }

    setTransferLoading((prev) => new Set(prev).add(listId));

    try {
      const response = await fetch(
        `/api/allocation-lists/${encodeURIComponent(listId)}/transfer-qa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newQaId: selectedQa }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || "Failed to transfer allocation list."
        );
      }

      const payload = await response.json().catch(() => ({ success: true }));
      toast.success(
        payload?.message ??
          "Allocation list transferred successfully. You will no longer see it once reassigned."
      );
      setSelectedQAByList((prev) => ({ ...prev, [listId]: "" }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("qaAssetAssignmentsUpdated"));
      }
      await fetchAssignedLists();
    } catch (err) {
      console.error("Error transferring allocation list:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to transfer allocation list."
      );
    } finally {
      setTransferLoading((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }
  };

  const handleQaSelectionChange = (listId: string, qaId: string) => {
    setSelectedQAByList((prev) => ({
      ...prev,
      [listId]: qaId,
    }));
  };

  const toggleListExpansion = (listId: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return listSummaries;
    const term = searchTerm.toLowerCase();
    return listSummaries.filter((summary) => {
      const numberMatch =
        summary.number !== null && summary.number !== undefined
          ? summary.number.toString().includes(term)
          : false;
      const nameMatch = (summary.name || "").toLowerCase().includes(term);
      const clientMatch = summary.clients.some((client) =>
        (client || "").toLowerCase().includes(term)
      );
      const modelerMatch = (summary.modelerEmail || summary.modelerTitle || "")
        .toLowerCase()
        .includes(term);
      const assetMatch = summary.assets.some((asset) =>
        (asset.productName || "").toLowerCase().includes(term)
      );
      return (
        numberMatch || nameMatch || clientMatch || modelerMatch || assetMatch
      );
    });
  }, [listSummaries, searchTerm]);

  const summaryTotals = useMemo(() => {
    const totalAssets = listSummaries.reduce(
      (sum, list) => sum + list.assetCount,
      0
    );
    const urgentAssets = listSummaries.reduce(
      (sum, list) => sum + list.urgentCount,
      0
    );
    return {
      totalLists: listSummaries.length,
      totalAssets,
      urgentAssets,
    };
  }, [listSummaries]);

  const qaOptions = availableQAs.filter((qa) => qa.id !== user?.id);

  if (user === null) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.metadata?.role?.toLowerCase() !== "qa") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for QA team members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/qa-assignments")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to QA Assignments
          </Button>
          <Badge variant="outline" className="gap-1 text-xs sm:text-sm">
            <Layers className="h-3 w-3" />
            Asset Lists
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing || loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Active Lists
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold">{summaryTotals.totalLists}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              <span className="text-sm text-muted-foreground">
                Total Assets
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold">
              {summaryTotals.totalAssets}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-sm text-muted-foreground">
                Urgent Assets
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold">
              {summaryTotals.urgentAssets}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by list number, client, or modeler"
            className="pl-9"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p>Loading your asset lists…</p>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <Card className="p-8 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">
            No asset lists assigned
          </h2>
          <p className="text-muted-foreground">
            You are not currently assigned to any allocation lists.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredSummaries.map((list) => {
            const statusClasses = getStatusBadgeClasses(list.status);
            const selectedQa = selectedQAByList[list.id] ?? "";
            const isTransferring = transferLoading.has(list.id);
            const disableTransferButton = !selectedQa || isTransferring;
            const isExpanded = expandedLists.has(list.id);

            return (
              <Card
                key={list.id}
                className="border-border/70 shadow-sm transition hover:shadow-md"
              >
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          Allocation {list.number ?? "—"}
                        </h3>
                        <Badge variant="outline" className={statusClasses}>
                          {getStatusLabel(list.status)}
                        </Badge>
                      </div>
                      {list.name && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {list.name}
                        </p>
                      )}
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() =>
                            router.push(`/qa-review?allocation=${list.id}`)
                          }
                        >
                          <ExternalLink className="h-3 w-3" />
                          View in QA Review
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Calendar className="h-4 w-4" />
                        <span
                          className={
                            isDeadlineOverdue(list.deadline)
                              ? "text-destructive font-medium"
                              : undefined
                          }
                        >
                          {formatDate(list.deadline)}
                        </span>
                      </div>
                      {list.modelerEmail && (
                        <div className="flex items-center gap-2 justify-end">
                          <Users className="h-4 w-4" />
                          <span className="truncate max-w-[14rem]">
                            {list.modelerTitle
                              ? `${list.modelerTitle} (${list.modelerEmail})`
                              : list.modelerEmail}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => toggleListExpansion(list.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {isExpanded ? "Hide Assets" : "View Assets"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Assets</p>
                      <p className="text-base font-semibold">
                        {list.assetCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Urgent</p>
                      <p className="text-base font-semibold text-warning">
                        {list.urgentCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clients</p>
                      <p className="text-base font-semibold">
                        {list.clients.length > 0
                          ? list.clients.join(", ")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bonus</p>
                      <p className="text-base font-semibold">
                        {list.bonus && list.bonus > 0 ? `${list.bonus}%` : "—"}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="rounded-md border border-border/60 p-3 space-y-2 bg-muted/30">
                      <p className="text-sm font-semibold">
                        Assets in this list
                      </p>
                      {list.assets.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No assets found for this allocation list.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {list.assets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-border/40 bg-background p-3 text-sm"
                            >
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {asset.productName || "Unnamed Asset"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {asset.articleId
                                    ? `Article ID: ${asset.articleId}`
                                    : "No article ID"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                <Badge
                                  variant="outline"
                                  className={getStatusBadgeClasses(
                                    asset.status
                                  )}
                                >
                                  {getStatusLabel(asset.status)}
                                </Badge>
                                {typeof asset.priority === "number" && (
                                  <Badge variant="outline" className="text-xs">
                                    Priority {asset.priority}
                                  </Badge>
                                )}
                                {asset.client && (
                                  <Badge variant="outline" className="text-xs">
                                    {asset.client}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {Object.keys(list.statusBreakdown).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Status Breakdown
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(list.statusBreakdown).map(
                          ([status, count]) => (
                            <Badge
                              key={status}
                              variant="outline"
                              className="text-xs"
                            >
                              {getStatusLabel(status)} • {count}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border border-dashed border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          Transfer allocation list
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Move this list to another QA. You will lose access
                          after transfer.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Select
                        value={selectedQa}
                        onValueChange={(value) =>
                          handleQaSelectionChange(list.id, value)
                        }
                        disabled={qaOptions.length === 0}
                      >
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder="Select QA teammate" />
                        </SelectTrigger>
                        <SelectContent>
                          {qaOptions.length === 0 ? (
                            <SelectItem value="" disabled>
                              No other QA members available
                            </SelectItem>
                          ) : (
                            qaOptions.map((qa) => (
                              <SelectItem key={qa.id} value={qa.id}>
                                {qa.title?.trim() || qa.email || "QA User"}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        className="sm:w-48 flex items-center gap-2"
                        onClick={() => handleTransfer(list.id)}
                        disabled={disableTransferButton}
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Transferring…
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4" />
                            Transfer List
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
