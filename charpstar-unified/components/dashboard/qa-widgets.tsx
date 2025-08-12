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
import { Progress } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeletons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/interactive";
import {
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  User,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { getPriorityLabel } from "@/lib/constants";

// Helper function to get priority CSS class
const getPriorityClass = (priority: number): string => {
  if (priority === 1) return "priority-high";
  if (priority === 2) return "priority-medium";
  return "priority-low";
};
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/display/chart";

interface ModelerProgress {
  id: string;
  email: string;
  title?: string;
  totalAssets: number;
  completedAssets: number;
  inProgressAssets: number;
  pendingAssets: number;
  revisionAssets: number;
  completionPercentage: number;
  recentAssets: Array<{
    id: string;
    product_name: string;
    status: string;
    created_at: string;
  }>;
}

interface DailyMetrics {
  reviewed: number;
  approved: number;
}

interface PersonalMetrics {
  reviewedToday: number;
  approvedToday: number;
  weeklyData: Array<{
    date: string;
    reviewed: number;
    approved: number;
  }>;
}

interface WaitingForApprovalAsset {
  id: string;
  product_name: string;
  article_id: string;
  priority: number;
  client: string;
  batch: number;
  delivery_date: string;
  modeler_email?: string;
}

export default function QAWidgets() {
  const user = useUser();
  const router = useRouter();
  const [modelers, setModelers] = useState<ModelerProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [projects, setProjects] = useState<
    Array<{
      client: string;
      batch: number;
      modelers: Array<{ id: string; email: string; title?: string }>;
    }>
  >([]);

  useEffect(() => {
    if (user?.id) {
      fetchModelerProgress();
    }
  }, [user?.id]);

  const fetchModelerProgress = async () => {
    try {
      setLoading(true);

      // Get modelers allocated to this QA user
      const { data: qaAllocations, error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", user?.id);

      if (allocationError) {
        toast.error("Failed to fetch your modeler allocations");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        setModelers([]);
        return;
      }

      const allocatedModelerIds = qaAllocations.map((a) => a.modeler_id);

      // Get modeler details
      const { data: modelerDetails, error: modelerError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", allocatedModelerIds);

      if (modelerError) {
        return;
      }

      // Get assets assigned to these modelers
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          onboarding_assets!inner(
            id,
            product_name,
            status,
            created_at,
            client,
            batch
          )
        `
        )
        .in("user_id", allocatedModelerIds)
        .eq("role", "modeler");

      if (assignmentError) {
        return;
      }

      // Calculate progress for each modeler
      const modelerProgressMap = new Map<string, ModelerProgress>();

      // Initialize modelers
      modelerDetails?.forEach((modeler) => {
        modelerProgressMap.set(modeler.id, {
          id: modeler.id,
          email: modeler.email,
          title: modeler.title,
          totalAssets: 0,
          completedAssets: 0,
          inProgressAssets: 0,
          pendingAssets: 0,
          revisionAssets: 0,
          completionPercentage: 0,
          recentAssets: [],
        });
      });

      // Process asset assignments
      assetAssignments?.forEach((assignment) => {
        const modeler = modelerProgressMap.get(assignment.user_id);
        if (!modeler) return;

        const asset = assignment.onboarding_assets as any;
        if (!asset) return;

        modeler.totalAssets++;
        modeler.recentAssets.push({
          id: asset.id,
          product_name: asset.product_name,
          status: asset.status,
          created_at: asset.created_at,
        });

        switch (asset.status) {
          case "approved":
            modeler.completedAssets++;
            break;
          case "in_production":
            modeler.inProgressAssets++;
            break;
          case "delivered_by_artist":
            modeler.pendingAssets++;
            break;
          case "revisions":
            modeler.revisionAssets++;
            break;
        }
      });

      // Calculate completion percentages and sort by recent activity
      const modelerProgress: ModelerProgress[] = Array.from(
        modelerProgressMap.values()
      ).map((modeler) => ({
        ...modeler,
        completionPercentage:
          modeler.totalAssets > 0
            ? Math.round((modeler.completedAssets / modeler.totalAssets) * 100)
            : 0,
        recentAssets: modeler.recentAssets
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 3), // Keep only 3 most recent assets
      }));

      // Sort by completion percentage (highest first), then by total assets
      modelerProgress.sort((a, b) => {
        if (b.completionPercentage !== a.completionPercentage) {
          return b.completionPercentage - a.completionPercentage;
        }
        return b.totalAssets - a.totalAssets;
      });

      setModelers(modelerProgress);

      // Build projects list (client + batch) with modelers working on them
      const modelerDetailMap = new Map(
        (modelerDetails || []).map((m) => [m.id, m])
      );
      const projectMap = new Map<
        string,
        { client: string; batch: number; modelerIds: Set<string> }
      >();

      assetAssignments?.forEach((assignment) => {
        const asset = assignment.onboarding_assets as any;
        if (!asset?.client || asset.batch === undefined || asset.batch === null)
          return;
        const key = `${asset.client}__${asset.batch}`;
        if (!projectMap.has(key)) {
          projectMap.set(key, {
            client: asset.client,
            batch: asset.batch,
            modelerIds: new Set<string>(),
          });
        }
        projectMap.get(key)!.modelerIds.add(assignment.user_id);
      });

      const projectsArr = Array.from(projectMap.values())
        .map((p) => ({
          client: p.client,
          batch: p.batch,
          modelers: Array.from(p.modelerIds).map((id) => ({
            id,
            email: modelerDetailMap.get(id)?.email || id,
            title: modelerDetailMap.get(id)?.title,
          })),
        }))
        .sort((a, b) =>
          a.client === b.client
            ? a.batch - b.batch
            : a.client.localeCompare(b.client)
        );

      setProjects(projectsArr);
    } catch {
      toast.error("Failed to fetch modeler progress");
    } finally {
      setLoading(false);
    }
  };

  const displayedModelers = showAll ? modelers : modelers.slice(0, 4);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-2 w-40 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold text-sm text-foreground">
            <Users className="h-5 w-5" />
            Projects
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground">
              You will see your allocated projects here once production assigns
              modelers to you.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <User className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Projects</h3>
      </div>
      <div className="flex-1 min-h-0 space-y-2">
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <Accordion type="single" collapsible className="space-y-1">
            {projects.map((p) => {
              const value = `${p.client}-${p.batch}`;
              return (
                <AccordionItem key={value} value={value}>
                  <AccordionTrigger className="px-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {p.client} - Batch {p.batch}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {p.modelers.length} modelers
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {p.modelers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 border rounded-md"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {m.title || m.email.split("@")[0]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {m.email}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View QA review for this modeler"
                            onClick={() =>
                              router.push(
                                `/qa-review?modeler=${m.id}&client=${encodeURIComponent(
                                  p.client
                                )}&batch=${p.batch}`
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

// Standalone Personal Metrics Widget Component
export function PersonalMetricsWidget() {
  const user = useUser();
  const [metrics, setMetrics] = useState<PersonalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelsToReview, setModelsToReview] = useState<number>(0);

  // Custom event listener to track QA approval actions
  useEffect(() => {
    const handleQAApproval = () => {
      // Refresh metrics when QA approves an asset
      fetchPersonalMetrics();
    };

    // Listen for QA approval events
    window.addEventListener("qaApproval", handleQAApproval as EventListener);

    return () => {
      window.removeEventListener(
        "qaApproval",
        handleQAApproval as EventListener
      );
    };
  }, [user?.id]);

  const fetchPersonalMetrics = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Initialize daily metrics for the last 7 days
      const dailyMetrics: Record<string, DailyMetrics> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyMetrics[dateStr] = { reviewed: 0, approved: 0 };
      }

      // 1. Get revision history (when QA sends for revision)
      const { data: statusChanges, error: statusError } = await supabase
        .from("revision_history")
        .select("created_at, revision_number")
        .eq("created_by", user?.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (statusError) {
        console.error("Error fetching status changes:", statusError);
      }

      // 2. Get comments made by this QA
      const { data: qaComments, error: commentError } = await supabase
        .from("asset_comments")
        .select("created_at")
        .eq("created_by", user?.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (commentError) {
        console.error("Error fetching QA comments:", commentError);
      }

      // 3. Get QA allocations to find assets this QA is responsible for
      const { error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", user?.id);

      if (allocationError) {
        console.error("Error fetching QA allocations:", allocationError);
      }

      // 4. Track QA approval actions from qa_approvals table
      const qaApprovals: { assetId: string; approvedAt: string }[] = [];

      // Get QA approvals from the dedicated table
      const { data: approvalRecords, error: approvalError } = await supabase
        .from("qa_approvals")
        .select("asset_id, approved_at")
        .eq("qa_id", user?.id)
        .gte("approved_at", sevenDaysAgo.toISOString())
        .order("approved_at", { ascending: true });

      if (approvalError) {
        console.error("Error fetching QA approvals:", approvalError);
      } else if (approvalRecords) {
        qaApprovals.push(
          ...approvalRecords.map((record) => ({
            assetId: record.asset_id,
            approvedAt: record.approved_at,
          }))
        );
      }

      // Process revision history (these are "Send for Revision" actions)
      statusChanges?.forEach((change) => {
        const dateStr = change.created_at.split("T")[0];
        if (dailyMetrics[dateStr]) {
          // Count as reviewed (QA reviewed the asset)
          dailyMetrics[dateStr].reviewed++;
          // Do NOT count as approved - this is a revision action
        }
      });

      // Process comments (each comment counts as a review action)
      qaComments?.forEach((comment) => {
        const dateStr = comment.created_at.split("T")[0];
        if (dailyMetrics[dateStr]) {
          dailyMetrics[dateStr].reviewed++;
        }
      });

      // Process QA approval actions (tracked via localStorage)
      qaApprovals.forEach((approval) => {
        const dateStr = approval.approvedAt.split("T")[0];
        if (dailyMetrics[dateStr]) {
          // Count as both reviewed and approved
          dailyMetrics[dateStr].reviewed++;
          dailyMetrics[dateStr].approved++;
        }
      });

      // For now, let's add some sample data to test the chart
      // In a real implementation, you'd remove this and rely on actual data
      if (
        Object.values(dailyMetrics).every(
          (day) => day.reviewed === 0 && day.approved === 0
        )
      ) {
        // Add sample data for demonstration
        const sampleData = [
          { date: "2024-01-15", reviewed: 5, approved: 3 },
          { date: "2024-01-16", reviewed: 8, approved: 6 },
          { date: "2024-01-17", reviewed: 12, approved: 9 },
          { date: "2024-01-18", reviewed: 6, approved: 4 },
          { date: "2024-01-19", reviewed: 10, approved: 7 },
          { date: "2024-01-20", reviewed: 7, approved: 5 },
          { date: "2024-01-21", reviewed: 9, approved: 6 },
        ];

        sampleData.forEach((sample) => {
          const dateStr = sample.date;
          if (dailyMetrics[dateStr]) {
            dailyMetrics[dateStr].reviewed = sample.reviewed;
            dailyMetrics[dateStr].approved = sample.approved;
          }
        });
      }

      // Convert to array format for the chart
      const weeklyData = Object.entries(dailyMetrics).map(
        ([date, metrics]) => ({
          date,
          reviewed: metrics.reviewed,
          approved: metrics.approved,
        })
      );

      // Calculate today's metrics
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const todayData = dailyMetrics[todayStr] || { reviewed: 0, approved: 0 };

      setMetrics({
        reviewedToday: todayData.reviewed,
        approvedToday: todayData.approved,
        weeklyData,
      });

      // Calculate total models to review ("Waiting for Approval" / delivered_by_artist)
      try {
        // For QA users, count assets from their allocated modelers
        if (user?.metadata?.role === "qa") {
          const { data: qaAllocations, error: qaError } = await supabase
            .from("qa_allocations")
            .select("modeler_id")
            .eq("qa_id", user.id);

          if (qaError) {
            console.error("Error fetching QA allocations:", qaError);
            setModelsToReview(0);
          } else if (!qaAllocations || qaAllocations.length === 0) {
            setModelsToReview(0);
          } else {
            const modelerIds = qaAllocations.map((a: any) => a.modeler_id);
            const { data: assetAssignments, error: assignmentError } =
              await supabase
                .from("asset_assignments")
                .select(
                  `
                asset_id,
                onboarding_assets!inner(
                  id,
                  status
                )
              `
                )
                .in("user_id", modelerIds)
                .eq("role", "modeler")
                .eq("onboarding_assets.status", "delivered_by_artist");

            if (assignmentError) {
              console.error(
                "Error fetching asset assignments:",
                assignmentError
              );
              setModelsToReview(0);
            } else {
              setModelsToReview(assetAssignments?.length || 0);
            }
          }
        } else {
          // For other roles, count all assets waiting for approval
          const { data: allAssets, error: assetsError } = await supabase
            .from("onboarding_assets")
            .select("id", { count: "exact", head: true })
            .eq("status", "delivered_by_artist");

          if (assetsError) {
            console.error("Error counting waiting assets:", assetsError);
            setModelsToReview(0);
          } else {
            // When using head:true with count:exact, data is null; count is in the response
            // However, supabase-js v2 requires select without head to return data; fallback: another query
            // Do a lightweight query to fetch ids and count length
            const { data: ids, error: idsError } = await supabase
              .from("onboarding_assets")
              .select("id")
              .eq("status", "delivered_by_artist");
            if (idsError) {
              console.error("Error fetching waiting asset ids:", idsError);
              setModelsToReview(0);
            } else {
              setModelsToReview(ids?.length || 0);
            }
          }
        }
      } catch (err) {
        console.error("Error computing models to review:", err);
        setModelsToReview(0);
      }
    } catch {
      console.error("Error fetching personal metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonalMetrics();
  }, [user?.id]);

  if (loading) {
    return (
      <Card className="p-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Personal Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 rounded" />
            <Skeleton className="h-20 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Personal Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No metrics available yet</p>
            <p className="text-xs mt-1">
              Start reviewing assets to see your metrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for the new chart format
  const chartData = metrics.weeklyData.map((day) => ({
    day: new Date(day.date).toLocaleDateString("en-US", { weekday: "short" }),
    reviewed: day.reviewed,
    approved: day.approved,
  }));

  const chartConfig = {
    reviewed: {
      label: "Reviewed",
      color: "var(--color-chart-1)",
    },
    approved: {
      label: "Approved",
      color: "var(--color-chart-2)",
    },
  } satisfies ChartConfig;

  // Calculate trend percentage
  const totalReviewed = metrics.weeklyData.reduce(
    (sum, day) => sum + day.reviewed,
    0
  );
  const totalApproved = metrics.weeklyData.reduce(
    (sum, day) => sum + day.approved,
    0
  );
  const trendPercentage =
    totalReviewed > 0
      ? ((totalApproved / totalReviewed) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Personal Metrics
          </h3>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">
            {totalReviewed} reviewed, {totalApproved} approved
          </div>
          <div className="text-xs text-foreground">
            To review: <span className="font-semibold">{modelsToReview}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {trendPercentage}% approval rate
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} height={40}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={5}
              axisLine={false}
              fontSize={10}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="reviewed" fill="var(--status-reviewed)" radius={4} />
            <Bar
              dataKey="approved"
              fill="var(--status-approved-alt)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export function WaitingForApprovalWidget() {
  const [assets, setAssets] = useState<WaitingForApprovalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUser();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchWaitingForApprovalAssets = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // For QA users, get assets from their allocated modelers
        if (user?.metadata?.role === "qa") {
          // First get QA allocations to find modelers
          const { data: qaAllocations, error: qaError } = await supabase
            .from("qa_allocations")
            .select("modeler_id")
            .eq("qa_id", user.id);

          if (qaError) {
            console.error("Error fetching QA allocations:", qaError);
            return;
          }

          if (!qaAllocations || qaAllocations.length === 0) {
            setAssets([]);
            setLoading(false);
            return;
          }

          const modelerIds = qaAllocations.map(
            (allocation) => allocation.modeler_id
          );

          // Get assets assigned to these modelers with waiting for approval status
          const { data: assetAssignments, error: assignmentError } =
            await supabase
              .from("asset_assignments")
              .select(
                `
              asset_id,
              onboarding_assets!inner(
                id,
                product_name,
                article_id,
                priority,
                client,
                batch,
                delivery_date,
                status
              )
            `
              )
              .in("user_id", modelerIds)
              .eq("role", "modeler")
              .eq("onboarding_assets.status", "delivered_by_artist");

          if (assignmentError) {
            console.error("Error fetching asset assignments:", assignmentError);
            return;
          }

          // Get modeler emails for display
          const { data: modelerProfiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", modelerIds);

          if (profileError) {
            console.error("Error fetching modeler profiles:", profileError);
          }

          const modelerEmailMap = new Map();
          modelerProfiles?.forEach((profile) => {
            modelerEmailMap.set(profile.id, profile.email);
          });

          // Transform data and sort by priority
          const waitingAssets =
            assetAssignments
              ?.map((assignment: any) => ({
                id: assignment.onboarding_assets.id,
                product_name: assignment.onboarding_assets.product_name,
                article_id: assignment.onboarding_assets.article_id,
                priority: assignment.onboarding_assets.priority || 2,
                client: assignment.onboarding_assets.client,
                batch: assignment.onboarding_assets.batch,
                delivery_date: assignment.onboarding_assets.delivery_date,
                modeler_email: modelerEmailMap.get(assignment.user_id),
              }))
              .sort((a, b) => a.priority - b.priority) || [];

          setAssets(waitingAssets);
        } else {
          // For other roles, get all waiting for approval assets
          const { data: allAssets, error: assetsError } = await supabase
            .from("onboarding_assets")
            .select(
              `
              id,
              product_name,
              article_id,
              priority,
              client,
              batch,
              delivery_date
            `
            )
            .eq("status", "delivered_by_artist")
            .order("priority", { ascending: true });

          if (assetsError) {
            console.error("Error fetching waiting assets:", assetsError);
            return;
          }

          setAssets(allAssets || []);
        }
      } catch (error) {
        console.error("Error in fetchWaitingForApprovalAssets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWaitingForApprovalAssets();
  }, [user?.id, user?.metadata?.role]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Waiting for Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                </div>
                <div className="w-16 h-6 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Waiting for Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No assets waiting for approval</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Waiting for Approval ({assets.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={
            expanded
              ? "space-y-3 max-h-[50vh] overflow-y-auto pr-1"
              : "space-y-3"
          }
        >
          {(expanded ? assets : assets.slice(0, 5)).map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">
                    {asset.product_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {asset.article_id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{asset.client}</span>
                  <span>•</span>
                  <span>Batch {asset.batch}</span>
                  {asset.modeler_email && (
                    <>
                      <span>•</span>
                      <span className="truncate">{asset.modeler_email}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityClass(
                    asset.priority
                  )}`}
                >
                  {getPriorityLabel(asset.priority)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`/client-review/${asset.id}`, "_blank")
                  }
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {assets.length > 5 && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Collapse" : `View All (${assets.length})`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
