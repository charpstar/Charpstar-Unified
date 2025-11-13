"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";

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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

// Reusable header for QA widgets
function QAWidgetHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="relative">
        <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
          <Icon className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

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
  const [, setModelers] = useState<ModelerProgress[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={Users}
          title="Projects"
          subtitle="Your allocated project teams"
        />
        <div className="flex-1 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={Users}
          title="Projects"
          subtitle="Your allocated project teams"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-foreground font-medium mb-2">
              No projects assigned
            </h4>
            <p className="text-muted-foreground text-sm max-w-xs">
              You will see your allocated projects here once production assigns
              modelers to you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <QAWidgetHeader
        icon={Users}
        title="Projects"
        subtitle="Your allocated project teams"
      />
      <div className="flex-1 min-h-0">
        <div className="max-h-[45vh] overflow-y-auto space-y-3">
          {projects.map((p) => {
            const value = `${p.client}-${p.batch}`;
            return (
              <div
                key={value}
                className="group relative rounded-xl p-5 transition-all duration-300
                  bg-gradient-to-br from-card/80 to-card/60
                  shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
                  hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
                  hover:translate-y-[-2px]
                  dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
                  dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
                  border border-border/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="relative p-3 rounded-xl bg-muted 
                      shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1)]
                      dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]
                      group-hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_12px_rgba(0,0,0,0.15)]
                      transition-shadow duration-300"
                    >
                      <Users className="h-5 w-5 text-foreground relative z-10" />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {p.client}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Batch {p.batch}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-muted text-muted-foreground border-border text-xs font-medium px-2 py-1"
                  >
                    {p.modelers.length} modeler
                    {p.modelers.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {p.modelers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/qa-review?modeler=${m.id}&client=${encodeURIComponent(
                            p.client
                          )}&batch=${p.batch}`
                        )
                      }
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-1.5 bg-card rounded-md shadow-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">
                            {m.title || m.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modelsToReview, setModelsToReview] = useState<number>(0);
  // Interactive selection of a day from the chart
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

      // 2. Get comments made by this QA (for reference only, not counted as reviewed)
      const { error: commentError } = await supabase
        .from("asset_comments")
        .select("created_at")
        .eq("created_by", user?.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (commentError) {
        console.error("Error fetching QA comments:", commentError);
      }

      // 2b. Get annotations made by this QA (for reference only, not counted as reviewed)
      const { error: annotationError } = await supabase
        .from("asset_annotations")
        .select("created_at")
        .eq("created_by", user?.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (annotationError) {
        console.error("Error fetching QA annotations:", annotationError);
      }

      // 3. Get QA allocations to find assets this QA is responsible for
      const { error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id")
        .eq("qa_id", user?.id);

      if (allocationError) {
        console.error("Error fetching QA allocations:", allocationError);
      }

      // 4. Track QA review and approval actions from activity_log (status changes)
      const qaApprovals: { approvedAt: string }[] = [];
      const qaReviews: { reviewedAt: string }[] = [];

      const { data: approvalActivities, error: approvalActivityError } =
        await supabase
          .from("activity_log")
          .select("created_at, metadata, resource_type, type")
          .eq("user_id", user?.id)
          .eq("resource_type", "asset")
          .eq("type", "update")
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: true });

      if (approvalActivityError) {
        console.error(
          "Error fetching approval activities:",
          approvalActivityError
        );
      } else if (approvalActivities) {
        approvalActivities.forEach((act: any) => {
          const newStatus = act?.metadata?.new_status;
          if (newStatus === "approved") {
            qaApprovals.push({ approvedAt: act.created_at });
          } else if (newStatus === "revisions") {
            qaReviews.push({ reviewedAt: act.created_at });
          }
        });
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

      // Comments and annotations are no longer counted as review actions
      // Only status changes (revisions and approvals) count as reviews

      // Process QA review actions (from activity log - when QA sets status to revisions)
      qaReviews.forEach((review) => {
        const dateStr = review.reviewedAt.split("T")[0];
        if (dailyMetrics[dateStr]) {
          // Count as reviewed only (not approved)
          dailyMetrics[dateStr].reviewed++;
        }
      });

      // Process QA approval actions (from activity log)
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { data: _, error: assetsError } = await supabase
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
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={BarChart3}
          title="Personal Metrics"
          subtitle="Your QA performance overview"
        />
        <div className="flex-1">
          <div className="h-48 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={BarChart3}
          title="Personal Metrics"
          subtitle="Your QA performance overview"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-foreground font-medium mb-2">
              No metrics available yet
            </h4>
            <p className="text-muted-foreground text-sm max-w-xs">
              Start reviewing assets to see your performance metrics and
              progress tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Transform data for the new chart format (include raw date for selection)
  const chartData = metrics.weeklyData.map((day) => ({
    dayLabel: new Date(day.date).toLocaleDateString("en-US", {
      weekday: "short",
    }),
    date: day.date,
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

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedDayData = selectedDay
    ? chartData.find((d) => d.date === selectedDay)
    : null;

  // Calculate trend percentage
  const totalReviewed = metrics.weeklyData.reduce(
    (sum, day) => sum + day.reviewed,
    0
  );
  const totalApproved = metrics.weeklyData.reduce(
    (sum, day) => sum + day.approved,
    0
  );
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trendPercentage =
    totalReviewed > 0
      ? ((totalApproved / totalReviewed) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="h-full flex flex-col p-6">
      <QAWidgetHeader
        icon={BarChart3}
        title="Personal Metrics"
        subtitle="Your QA performance overview"
      />

      <div className="flex-1 space-y-6">
        {/* Chart */}
        <div
          className="relative rounded-xl p-6 transition-all duration-300
          bg-gradient-to-br from-card/80 to-card/60
          shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
          dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
          border border-border/50"
        >
          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-1">
              Weekly Activity
            </h4>
            <p className="text-sm text-muted-foreground">
              Daily review and approval trends
            </p>
          </div>
          <div className="h-50">
            <ChartContainer config={chartConfig} className="h-50 w-full">
              <BarChart accessibilityLayer data={chartData} height={96}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="dayLabel"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  fontSize={12}
                  fill="#6b7280"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={12}
                  fill="#6b7280"
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar
                  dataKey="reviewed"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                  name="Reviewed"
                  onClick={(data: any) => {
                    const date = data?.payload?.date as string | undefined;
                    if (date) setSelectedDay(date);
                  }}
                />
                <Bar
                  dataKey="approved"
                  fill="#10b981"
                  radius={[2, 2, 0, 0]}
                  name="Approved"
                  onClick={(data: any) => {
                    const date = data?.payload?.date as string | undefined;
                    if (date) setSelectedDay(date);
                  }}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
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
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={Clock}
          title="Waiting for Approval"
          subtitle="Assets ready for your review"
        />
        <div className="flex-1 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="h-full flex flex-col p-6">
        <QAWidgetHeader
          icon={Clock}
          title="Waiting for Approval"
          subtitle="Assets ready for your review"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-foreground font-medium mb-2">All caught up!</h4>
            <p className="text-muted-foreground text-sm max-w-xs">
              No assets are currently waiting for your approval. Great job
              staying on top of your review queue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <QAWidgetHeader
          icon={Clock}
          title="Waiting for Approval"
          subtitle="Assets ready for your review"
        />
        <div className="bg-muted px-3 py-1 rounded-full">
          <span className="text-sm font-semibold text-muted-foreground">
            {assets.length}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div
          className={
            expanded
              ? "space-y-3 max-h-[60vh] overflow-y-auto pr-1"
              : "space-y-3"
          }
        >
          {(expanded ? assets : assets.slice(0, 5)).map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded-xl p-4 transition-all duration-300 cursor-pointer
                bg-gradient-to-br from-card/80 to-card/60
                shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
                hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
                hover:translate-y-[-2px]
                dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
                dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
                border border-border/50"
              onClick={() =>
                window.open(`/client-review/${asset.id}`, "_blank")
              }
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-foreground text-sm truncate">
                      {asset.product_name}
                    </h4>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {asset.article_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{asset.client}</span>
                    </div>
                    <span>•</span>
                    <span>Batch {asset.batch}</span>
                    {asset.modeler_email && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">
                            {asset.modeler_email.split("@")[0]}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityClass(
                      asset.priority
                    )}`}
                  >
                    {getPriorityLabel(asset.priority)}
                  </span>
                  <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            </div>
          ))}

          {assets.length > 5 && (
            <div className="text-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    Show Less <AlertCircle className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    View All ({assets.length}) <Eye className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
