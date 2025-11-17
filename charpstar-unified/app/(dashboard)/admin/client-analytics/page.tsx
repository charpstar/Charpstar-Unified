/**
 * ⚠️ DEPRECATED - THIS PAGE IS NO LONGER USED
 *
 * This Client Analytics page has been merged into the Admin Analytics page (/admin/analytics).
 * All client analytics functionality is now available through the "Client Analytics" tab
 * in the Admin Analytics dashboard.
 *
 * This file is kept for reference only and should not be accessed directly.
 * Navigation to this page has been removed from the sidebar.
 */

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
  LogIn,
} from "lucide-react";
import { SceneRenderStats } from "@/components/analytics/SceneRenderStats";
import { UsageOverTimeChart } from "@/components/analytics/UsageOverTimeChart";
import { TopUsersChart } from "@/components/analytics/TopUsersChart";
import { FormatDistributionChart } from "@/components/analytics/FormatDistributionChart";
import { ConversionRateChart } from "@/components/analytics/ConversionRateChart";
import { SceneRendersTable } from "@/components/analytics/SceneRendersTable";

interface AnalyticsData {
  // Scene Render Analytics
  sceneRenderSummary: {
    totalRenders: number;
    totalSaves: number;
    totalDownloads: number;
    conversionRate: number;
    averageGenerationTime: number;
    successRate: number;
  };
  usageOverTime: Array<{
    date: string;
    renders: number;
    saves: number;
    downloads: number;
  }>;
  topUsers: Array<{
    client: string;
    email: string;
    renders: number;
    saves: number;
    downloads: number;
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
  // Client Activities
  clientActivities?: {
    summary: {
      uniqueUsers: number;
      totalLogins: number;
      totalSceneRenders: number;
      totalActivities: number;
    };
    dailyActivity: Array<{
      date: string;
      logins: number;
      sceneRenders: number;
      other: number;
    }>;
    rawData: Array<any>;
  };
}

export default function ClientAnalyticsPage() {
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

      // Fetch both scene render analytics and client activities
      const [sceneRenderResponse, clientActivitiesResponse] = await Promise.all(
        [
          fetch(`/api/analytics/scene-render?${params}`),
          fetch(`/api/analytics/client-activities?${params}`),
        ]
      );

      const sceneRenderData = sceneRenderResponse.ok
        ? await sceneRenderResponse.json()
        : null;
      const clientActivitiesData = clientActivitiesResponse.ok
        ? await clientActivitiesResponse.json()
        : null;

      if (sceneRenderData) {
        setAnalyticsData({
          sceneRenderSummary: sceneRenderData.summary,
          usageOverTime: sceneRenderData.usageOverTime,
          topUsers: sceneRenderData.topUsers,
          formatDistribution: sceneRenderData.formatDistribution,
          conversionRateTrend: sceneRenderData.conversionRateTrend,
          detailedRenders: sceneRenderData.detailedRenders,
          clientActivities: clientActivitiesData || undefined,
        });
      }
      setLastUpdated(new Date());
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
            Client Analytics
          </h1>
          <p className="text-muted-foreground">
            Track client activity including logins, scene renders, and user
            engagement
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
          {/* Scene Render Stats */}
          <SceneRenderStats
            title="Total Renders"
            value={analyticsData.sceneRenderSummary.totalRenders}
            icon={BarChart3}
            description="Scene render attempts"
          />
          <SceneRenderStats
            title="Total Saves"
            value={analyticsData.sceneRenderSummary.totalSaves}
            icon={Save}
            description="Scenes saved to library"
          />
          <SceneRenderStats
            title="Conversion Rate"
            value={`${analyticsData.sceneRenderSummary.conversionRate}%`}
            icon={TrendingUp}
            description="Saves per render"
          />
          <SceneRenderStats
            title="Avg Generation Time"
            value={`${Math.round(analyticsData.sceneRenderSummary.averageGenerationTime / 1000)}s`}
            icon={Clock}
            description="Average processing time"
          />
          {/* Client Activities Stats */}
          {analyticsData.clientActivities && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Logins
                </CardTitle>
                <LogIn className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData.clientActivities.summary.totalLogins}
                </div>
                <p className="text-xs text-muted-foreground">User logins</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts and Tables */}
      {analyticsData && (
        <Tabs defaultValue="overview" className="space-y-4 cursor-pointer">
          <TabsList className="cursor-pointer">
            <TabsTrigger className="cursor-pointer" value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="activities">
              Activities
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="users">
              Users
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="formats">
              Formats
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="details">
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Render Scene Usage Over Time</CardTitle>
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

          <TabsContent value="activities" className="space-y-4">
            {analyticsData.clientActivities && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Activity</CardTitle>
                    <CardDescription>
                      Logins and scene renders over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.clientActivities.dailyActivity
                        .slice(0, 10)
                        .map((day) => (
                          <div
                            key={day.date}
                            className="flex items-center justify-between border-b pb-2"
                          >
                            <div className="text-sm font-medium">
                              {new Date(day.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-2">
                                <LogIn className="h-4 w-4 text-green-500" />
                                <span>{day.logins} logins</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span>{day.sceneRenders} renders</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
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
