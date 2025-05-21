"use client";

import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { addDays, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import PerformanceTrends from "@/components/PerformanceTrends";

interface AnalyticsData {
  total_page_views: number;
  total_unique_users: number;
  total_users_with_service: number;
  percentage_users_with_service: number;
  conversion_rate_without_ar: number;
  conversion_rate_with_ar: number;
  total_purchases_with_ar: number;
  add_to_cart_default: number;
  add_to_cart_with_ar: number;
  avg_order_value_without_ar: number;
  avg_order_value_with_ar: number;
  total_ar_clicks: number;
  total_3d_clicks: number;
  session_duration_without_ar: number;
  session_duration_with_ar: number;
}

function generateTimeSeriesData(
  analyticsData: AnalyticsData,
  timeRange: "1d" | "7d" | "30d"
) {
  const now = new Date();
  const days = timeRange === "1d" ? 1 : timeRange === "7d" ? 7 : 30;
  const data = [];

  // Generate data points for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // For demo purposes, we'll distribute the total values across days
    // In a real implementation, you'd get daily data from your API
    const dayFactor = (days - i) / days; // Creates a simple progression

    data.push({
      date: date.toISOString(),
      pageViews: Math.round(
        ((analyticsData.total_page_views || 0) * dayFactor) / days
      ),
      uniqueUsers: Math.round(
        ((analyticsData.total_unique_users || 0) * dayFactor) / days
      ),
      arClicks: Math.round(
        ((analyticsData.total_ar_clicks || 0) * dayFactor) / days
      ),
      threeDClicks: Math.round(
        ((analyticsData.total_3d_clicks || 0) * dayFactor) / days
      ),
    });
  }

  return data;
}

export default function Page() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"1d" | "7d" | "30d">("30d");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const today = new Date();
        const startDate = format(
          addDays(
            today,
            timeRange === "1d" ? -1 : timeRange === "7d" ? -7 : -30
          ),
          "yyyyMMdd"
        );
        const endDate = format(today, "yyyyMMdd");

        const response = await fetch(
          `/api/analytics?startDate=${startDate}&endDate=${endDate}`
        );
        const result = await response.json();

        if (result.data) {
          setAnalyticsData(result.data);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  // Transform analytics data for the chart
  const chartData = analyticsData
    ? generateTimeSeriesData(analyticsData, timeRange)
    : [];

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !analyticsData ? (
          <div className="text-red-500">No analytics data available</div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Page Views"
                value={analyticsData.total_page_views}
              />
              <StatCard
                title="Total Unique Users"
                value={analyticsData.total_unique_users}
              />
              <StatCard
                title="Total AR Clicks"
                value={analyticsData.total_ar_clicks}
              />
              <StatCard
                title="Total 3D Clicks"
                value={analyticsData.total_3d_clicks}
              />
            </div>

            {/* <PerformanceTrends /> */}
          </div>
        )}
      </div>
    </>
  );
}
