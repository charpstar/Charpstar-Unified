"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display";
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
  ArrowRightLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
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

function TransferListDialog({
  listId,
  qaOptions,
  onTransfer,
}: {
  listId: string;
  qaOptions: QAProfileOption[];
  onTransfer: (listId: string, newQaId: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQa, setSelectedQa] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTransfer = async () => {
    if (!selectedQa) return;
    setIsSubmitting(true);
    try {
      await onTransfer(listId, selectedQa);
      setIsOpen(false);
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handling is done in the parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer Allocation List</DialogTitle>
          <DialogDescription>
            Move this list to another QA team member. You will lose access to
            this list after transferring.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select QA Member</label>
            <Select value={selectedQa} onValueChange={setSelectedQa}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {qaOptions.length === 0 ? (
                  <SelectItem value="none" disabled>
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
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedQa || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer List"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditListNameDialog({
  listId,
  currentName,
  onUpdate,
}: {
  listId: string;
  currentName: string | null;
  onUpdate: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(currentName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/allocation-lists/${listId}/name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update list name.");
      }

      toast.success("Allocation list name updated successfully.");
      await onUpdate();
      setIsOpen(false);
    } catch (err) {
      console.error("Error updating list name:", err);
      toast.error("Failed to update list name.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary ml-1"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Allocation List Name</DialogTitle>
          <DialogDescription>
            Give this allocation list a descriptive name to help you identify
            it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">List Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Priority Batch A"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

  const handleTransfer = async (listId: string, newQaId: string) => {
    try {
      const response = await fetch(
        `/api/allocation-lists/${encodeURIComponent(listId)}/transfer-qa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newQaId }),
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
      throw err; // Re-throw to let the dialog know it failed
    }
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
    <TooltipProvider>
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
              <p className="text-3xl font-semibold">
                {summaryTotals.totalLists}
              </p>
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
              const isExpanded = expandedLists.has(list.id);

              return (
                <Card
                  key={list.id}
                  className="border-border/70 shadow-sm transition hover:shadow-md overflow-hidden"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Badge variant="outline" className={statusClasses}>
                            {getStatusLabel(list.status)}
                          </Badge>
                          <span>Allocation #{list.number ?? "—"}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <h3 className="text-xl font-bold cursor-help truncate leading-tight">
                                {list.name || `Allocation #${list.number}`}
                              </h3>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {list.name
                                  ? `List Name: ${list.name}`
                                  : "No custom name set"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <EditListNameDialog
                                  listId={list.id}
                                  currentName={list.name}
                                  onUpdate={fetchAssignedLists}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit List Name</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 cursor-help">
                                <Calendar className="h-3 w-3" />
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
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isDeadlineOverdue(list.deadline)
                                  ? "Deadline Overdue"
                                  : "Target Deadline"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          {list.modelerEmail && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Users className="h-3 w-3" />
                                  <span className="truncate max-w-[12rem]">
                                    {list.modelerTitle || list.modelerEmail}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Assigned Modeler:{" "}
                                  {list.modelerEmail || "Unknown"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() =>
                                router.push(`/qa-review?allocation=${list.id}`)
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View in QA Review</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <TransferListDialog
                                listId={list.id}
                                qaOptions={qaOptions}
                                onTransfer={handleTransfer}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Transfer List</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex gap-6">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                                Assets
                              </span>
                              <span className="font-bold">
                                {list.assetCount}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total assets in this list</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                                Urgent
                              </span>
                              <span className="font-bold text-warning">
                                {list.urgentCount}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Assets marked as urgent</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                                Bonus
                              </span>
                              <span className="font-bold">
                                {list.bonus && list.bonus > 0
                                  ? `${list.bonus}%`
                                  : "—"}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Bonus percentage for this list</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                                Client
                              </span>
                              <span className="font-medium text-xs">
                                {list.clients.length > 0
                                  ? list.clients.join(", ")
                                  : "—"}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {list.clients.length > 0
                                ? list.clients.join(", ")
                                : "No client assigned"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {Object.keys(list.statusBreakdown).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(list.statusBreakdown).map(
                          ([status, count]) => (
                            <Tooltip key={status}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-5 font-normal cursor-help"
                                >
                                  {getStatusLabel(status)}: {count}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {count} assets are {getStatusLabel(status)}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between h-8 text-xs font-normal text-muted-foreground hover:text-foreground"
                        onClick={() => toggleListExpansion(list.id)}
                      >
                        <span>
                          {isExpanded
                            ? "Hide Asset Details"
                            : "View Asset Details"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          {list.assets.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No assets found.
                            </p>
                          ) : (
                            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
                              {list.assets.map((asset) => (
                                <div
                                  key={asset.id}
                                  className="flex items-center justify-between rounded-md border border-border/40 bg-background p-2 text-xs"
                                >
                                  <div className="min-w-0 flex-1 mr-2">
                                    <p className="font-medium truncate">
                                      {asset.productName || "Unnamed Asset"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {asset.articleId || "No ID"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 h-5 whitespace-nowrap ${getStatusBadgeClasses(
                                      asset.status
                                    )}`}
                                  >
                                    {getStatusLabel(asset.status)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
