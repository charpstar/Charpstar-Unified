"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/interactive";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Save,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { SceneRenderStats } from "@/components/analytics/SceneRenderStats";
import { UsageOverTimeChart } from "@/components/analytics/UsageOverTimeChart";
import { TopUsersChart } from "@/components/analytics/TopUsersChart";
import { FormatDistributionChart } from "@/components/analytics/FormatDistributionChart";
import { ConversionRateChart } from "@/components/analytics/ConversionRateChart";
import { SceneRendersTable } from "@/components/analytics/SceneRendersTable";

interface AnalyticsData {
  summary: {
    totalRenders: number;
    totalSaves: number;
    conversionRate: number;
    averageGenerationTime: number;
    successRate: number;
  };
  usageOverTime: Array<{
    date: string;
    renders: number;
    saves: number;
  }>;
  topUsers: Array<{
    client: string;
    email: string;
    renders: number;
    saves: number;
    conversionRate: number;
  }>;
  formatDistribution: Array<{
    format: string;
    count: number;
    percentage: number;
  }>;
  conversionRateTrend: Array<{
    date: string;
    conversionRate: number;
  }>;
  detailedRenders: Array<{
    id: string;
    date: string;
    time: string;
    client: string;
    email: string;
    objectType: string;
    format: string;
    status: string;
    saved: boolean;
    generationTime: number;
    errorMessage?: string;
  }>;
}

export default function SceneRenderAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        timeRange,
        ...(clientFilter &&
          clientFilter !== "all" && { clientName: clientFilter }),
      });

      const response = await fetch(`/api/analytics/scene-render?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
        setLastUpdated(new Date());
      } else {
        console.error("Failed to fetch analytics data");
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, clientFilter]);

  const timeRangeOptions = [
    { value: "real-time", label: "Real-time (24h)" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading analytics data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Scene Render Analytics
          </h1>
          <p className="text-muted-foreground">
            Track scene render usage, conversion rates, and user engagement
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchAnalyticsData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Time Range:</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Client:</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {analyticsData?.topUsers.map((user) => (
                    <SelectItem key={user.client} value={user.client}>
                      {user.client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {analyticsData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SceneRenderStats
            title="Total Renders"
            value={analyticsData.summary.totalRenders}
            icon={BarChart3}
            description="Scene render attempts"
          />
          <SceneRenderStats
            title="Total Saves"
            value={analyticsData.summary.totalSaves}
            icon={Save}
            description="Scenes saved to library"
          />
          <SceneRenderStats
            title="Conversion Rate"
            value={`${analyticsData.summary.conversionRate}%`}
            icon={TrendingUp}
            description="Saves per render"
          />
          <SceneRenderStats
            title="Avg Generation Time"
            value={`${Math.round(analyticsData.summary.averageGenerationTime / 1000)}s`}
            icon={Clock}
            description="Average processing time"
          />
        </div>
      )}

      {/* Charts and Tables */}
      {analyticsData && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="formats">Formats</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Usage Over Time</CardTitle>
                  <CardDescription>
                    Renders and saves over the selected time period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UsageOverTimeChart data={analyticsData.usageOverTime} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rate Trend</CardTitle>
                  <CardDescription>
                    Daily conversion rate over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConversionRateChart
                    data={analyticsData.conversionRateTrend}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Render Count</CardTitle>
                <CardDescription>
                  Most active users in the selected time period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopUsersChart data={analyticsData.topUsers} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="formats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Image Format Distribution</CardTitle>
                <CardDescription>
                  Popular image formats used for scene rendering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormatDistributionChart
                  data={analyticsData.formatDistribution}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Renders</CardTitle>
                <CardDescription>
                  Recent render attempts with full details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SceneRendersTable data={analyticsData.detailedRenders} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!analyticsData && !loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                No analytics data found for the selected time period.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
