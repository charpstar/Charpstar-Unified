"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import {
  ShieldCheck,
  TrendingUp,
  Eye,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/display/chart";

interface QAStats {
  id: string;
  email: string;
  title: string;
  totalReviews: number;
  totalApprovals: number;
  approvalRate: number;
  statusBreakdown: {
    approved: number;
    client_approved: number;
    delivered_by_artist: number;
    needs_revision: number;
  };
}

interface ChartData {
  name: string;
  reviews: number;
  approvals: number;
  approvalRate: number;
}

interface TimeSeriesData {
  date: string;
  reviews: number;
  approvals: number;
}

const QAStatisticsPage = () => {
  const router = useRouter();
  const user = useUser();
  const [qaStats, setQaStats] = useState<QAStats[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedQA] = useState<string>("all");

  const fetchQAStatistics = async () => {
    try {
      setLoading(true);

      // Calculate date range based on selected period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(selectedPeriod));

      // 1. Get all QA users
      const { data: qaUsers, error: qaError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "qa");

      if (qaError) {
        console.error("Error fetching QA users:", qaError);
        throw qaError;
      }

      if (!qaUsers || qaUsers.length === 0) {
        setQaStats([]);
        setChartData([]);
        setTimeSeriesData([]);

        return;
      }

      const qaIds = qaUsers.map((qa) => qa.id);

      // 2. Get revision history (QA sends for revision) for all QAs
      const { data: revisionHistory, error: revisionError } = await supabase
        .from("revision_history")
        .select("created_at, created_by")
        .in("created_by", qaIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (revisionError) {
        console.error("Error fetching revision history:", revisionError);
        throw revisionError;
      }

      // 3. Get comments made by QAs
      const { data: qaComments, error: commentError } = await supabase
        .from("asset_comments")
        .select("created_at, created_by")
        .in("created_by", qaIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (commentError) {
        console.error("Error fetching QA comments:", commentError);
        throw commentError;
      }

      // 4. Get annotations made by QAs
      const { data: qaAnnotations, error: annotationError } = await supabase
        .from("asset_annotations")
        .select("created_at, created_by")
        .in("created_by", qaIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (annotationError) {
        console.error("Error fetching QA annotations:", annotationError);
        throw annotationError;
      }

      // 5. Get approval activities from activity log
      const { data: approvalActivities, error: approvalError } = await supabase
        .from("activity_log")
        .select("created_at, user_id, metadata")
        .in("user_id", qaIds)
        .eq("resource_type", "asset")
        .eq("type", "update")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (approvalError) {
        console.error("Error fetching approval activities:", approvalError);
        throw approvalError;
      }

      // Process data for each QA
      const qaStatsMap = new Map<string, QAStats>();
      qaUsers.forEach((qa) => {
        qaStatsMap.set(qa.id, {
          id: qa.id,
          email: qa.email || "",
          title: qa.title || "",
          totalReviews: 0,
          totalApprovals: 0,
          approvalRate: 0,
          statusBreakdown: {
            approved: 0,
            client_approved: 0,
            delivered_by_artist: 0,
            needs_revision: 0,
          },
        });
      });

      // Count revision actions (reviews that resulted in revisions)
      revisionHistory?.forEach((revision) => {
        const qaStats = qaStatsMap.get(revision.created_by);
        if (qaStats) {
          qaStats.totalReviews++;
          qaStats.statusBreakdown.needs_revision++;
        }
      });

      // Count comments (review actions)
      qaComments?.forEach((comment) => {
        const qaStats = qaStatsMap.get(comment.created_by);
        if (qaStats) {
          qaStats.totalReviews++;
        }
      });

      // Count annotations (review actions)
      qaAnnotations?.forEach((annotation) => {
        const qaStats = qaStatsMap.get(annotation.created_by);
        if (qaStats) {
          qaStats.totalReviews++;
        }
      });

      // Count approvals from activity log
      approvalActivities?.forEach((activity: any) => {
        const newStatus = activity?.metadata?.new_status;
        if (
          newStatus === "approved" ||
          newStatus === "client_approved" ||
          newStatus === "delivered_by_artist"
        ) {
          const qaStats = qaStatsMap.get(activity.user_id);
          if (qaStats) {
            qaStats.totalReviews++;
            qaStats.totalApprovals++;

            if (newStatus === "approved") {
              qaStats.statusBreakdown.approved++;
            } else if (newStatus === "client_approved") {
              qaStats.statusBreakdown.client_approved++;
            } else if (newStatus === "delivered_by_artist") {
              qaStats.statusBreakdown.delivered_by_artist++;
            }
          }
        }
      });

      // Calculate approval rates
      const processedStats = Array.from(qaStatsMap.values()).map((stats) => ({
        ...stats,
        approvalRate:
          stats.totalReviews > 0
            ? Math.round((stats.totalApprovals / stats.totalReviews) * 100)
            : 0,
      }));

      setQaStats(processedStats);

      // Prepare chart data
      const chartData = processedStats.map((qa) => ({
        name: qa.email ? qa.email.split("@")[0] : "Unknown",
        reviews: qa.totalReviews,
        approvals: qa.totalApprovals,
        approvalRate: qa.approvalRate,
      }));
      setChartData(chartData);

      // Prepare time series data
      const timeSeriesData = [];
      const days = parseInt(selectedPeriod);

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Count reviews for this day
        const dayReviews = [
          ...(revisionHistory?.filter((r) =>
            r.created_at.startsWith(dateStr)
          ) || []),
          ...(qaComments?.filter((c) => c.created_at.startsWith(dateStr)) ||
            []),
          ...(qaAnnotations?.filter((a) => a.created_at.startsWith(dateStr)) ||
            []),
          ...(approvalActivities?.filter((a) =>
            a.created_at.startsWith(dateStr)
          ) || []),
        ].length;

        // Count approvals for this day
        const dayApprovals =
          approvalActivities?.filter((activity: any) => {
            if (!activity.created_at.startsWith(dateStr)) return false;
            const newStatus = activity?.metadata?.new_status;
            return (
              newStatus === "approved" ||
              newStatus === "client_approved" ||
              newStatus === "delivered_by_artist"
            );
          }).length || 0;

        timeSeriesData.push({
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          reviews: dayReviews,
          approvals: dayApprovals,
        });
      }
      setTimeSeriesData(timeSeriesData);

      // Calculate status distribution
      const totalStatusBreakdown = {
        approved: 0,
        client_approved: 0,
        delivered_by_artist: 0,
        needs_revision: 0,
      };

      processedStats.forEach((qa) => {
        totalStatusBreakdown.approved += qa.statusBreakdown.approved;
        totalStatusBreakdown.client_approved +=
          qa.statusBreakdown.client_approved;
        totalStatusBreakdown.delivered_by_artist +=
          qa.statusBreakdown.delivered_by_artist;
        totalStatusBreakdown.needs_revision +=
          qa.statusBreakdown.needs_revision;
      });

      // const total = Object.values(totalStatusBreakdown).reduce(
      //   (acc, val) => acc + val,
      //   0
      // );

      // const statusDistribution = [
      //   {
      //     name: "Approved",
      //     value: totalStatusBreakdown.approved,
      //     percentage:
      //       total > 0
      //         ? Math.round((totalStatusBreakdown.approved / total) * 100)
      //         : 0,
      //   },
      //   {
      //     name: "Client Approved",
      //     value: totalStatusBreakdown.client_approved,
      //     percentage:
      //       total > 0
      //         ? Math.round((totalStatusBreakdown.client_approved / total) * 100)
      //         : 0,
      //   },
      //   {
      //     name: "Delivered",
      //     value: totalStatusBreakdown.delivered_by_artist,
      //     percentage:
      //       total > 0
      //         ? Math.round(
      //             (totalStatusBreakdown.delivered_by_artist / total) * 100
      //           )
      //         : 0,
      //   },
      //   {
      //     name: "Needs Revision",
      //     value: totalStatusBreakdown.needs_revision,
      //     percentage:
      //       total > 0
      //         ? Math.round((totalStatusBreakdown.needs_revision / total) * 100)
      //         : 0,
      //   },
      // ];
    } catch (error) {
      console.error("Error fetching QA statistics:", error);
      toast.error("Failed to fetch QA statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQAStatistics();
  }, [selectedPeriod, selectedQA]);

  // Check if user has permission to view this page
  if (
    !loading &&
    (!user ||
      (user?.metadata?.role !== "admin" && user?.metadata?.role !== "qa"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have permission to view QA statistics.
            </p>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // const totalQAs = qaStats.length;
  // const totalReviews = qaStats.reduce((sum, qa) => sum + qa.totalReviews, 0);
  // const totalApprovals = qaStats.reduce(
  //   (sum, qa) => sum + qa.totalApprovals,
  //   0
  // );
  // const averageApprovalRate =
  //   totalReviews > 0 ? Math.round((totalApprovals / totalReviews) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>

          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-80 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold tracking-tight">
                QA Statistics
              </h1>
            </div>
            <p className="text-muted-foreground">
              Quality assurance performance metrics and analytics
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="h-4 w-4 text-blue-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-sm">
                  How QA Statistics are Calculated
                </h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    • <strong>QA sets status to approved</strong> = counts for
                    both reviewed and approval
                  </p>
                  <p>
                    • <strong>QA sets status to revision</strong> = counts for
                    only reviewed
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* QA Performance Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                QA Performance Comparison
              </CardTitle>
              <CardDescription>
                Reviews and approvals by QA specialist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    reviews: {
                      label: "Reviews",
                      color: "hsl(var(--chart-1))",
                    },
                    approvals: {
                      label: "Approvals",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[400px]"
                >
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="name"
                      className="fill-muted-foreground text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      className="fill-muted-foreground text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar
                      dataKey="reviews"
                      fill="hsl(var(--chart-1))"
                      name="Reviews"
                      radius={[3, 3, 0, 0]}
                      barSize={40}
                    />
                    <Bar
                      dataKey="approvals"
                      fill="hsl(var(--chart-2))"
                      name="Approvals"
                      radius={[3, 3, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No QA performance data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Review Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Review Trends
              </CardTitle>
              <CardDescription>
                Review and approval activity over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeSeriesData.length > 0 ? (
                <ChartContainer
                  config={{
                    reviews: {
                      label: "Reviews",
                      color: "hsl(var(--chart-1))",
                    },
                    approvals: {
                      label: "Approvals",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[400px]"
                >
                  <AreaChart
                    data={timeSeriesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorReviews"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--chart-1))"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--chart-1))"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorApprovals"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--chart-2))"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--chart-2))"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="date"
                      className="fill-muted-foreground text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      className="fill-muted-foreground text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="reviews"
                      stackId="1"
                      stroke="hsl(var(--chart-1))"
                      fillOpacity={1}
                      fill="url(#colorReviews)"
                      name="Reviews"
                    />
                    <Area
                      type="monotone"
                      dataKey="approvals"
                      stackId="1"
                      stroke="hsl(var(--chart-2))"
                      fillOpacity={1}
                      fill="url(#colorApprovals)"
                      name="Approvals"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No trend data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* QA Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Detailed QA Performance
            </CardTitle>
            <CardDescription>
              Comprehensive breakdown of QA metrics and performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">QA Specialist</TableHead>
                  <TableHead className="text-left">Title</TableHead>
                  <TableHead className="text-left">Reviews</TableHead>
                  <TableHead className="text-left">Approvals</TableHead>
                  <TableHead className="text-left">Approval Rate</TableHead>
                  <TableHead className="text-left">Status Breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qaStats.map((qa) => (
                  <TableRow key={qa.id}>
                    <TableCell className="text-left font-medium">
                      {qa.email}
                    </TableCell>
                    <TableCell className="text-left">{qa.title}</TableCell>
                    <TableCell className="text-left">
                      {qa.totalReviews}
                    </TableCell>
                    <TableCell className="text-left">
                      {qa.totalApprovals}
                    </TableCell>
                    <TableCell className="text-left">
                      <Badge
                        variant={
                          qa.approvalRate >= 90
                            ? "default"
                            : qa.approvalRate >= 80
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {qa.approvalRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          A: {qa.statusBreakdown.approved}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          CA: {qa.statusBreakdown.client_approved}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          D: {qa.statusBreakdown.delivered_by_artist}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          R: {qa.statusBreakdown.needs_revision}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QAStatisticsPage;
