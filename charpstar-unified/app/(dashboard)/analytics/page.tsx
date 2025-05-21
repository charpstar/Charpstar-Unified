"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { format, addDays } from "date-fns";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
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

// Fetch function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch analytics data");
  }
  return res.json();
};

export default function AnalyticsDashboard() {
  // Date range state with pending and applied states
  const today = new Date();
  const thirtyDaysAgo = addDays(today, -30);
  const [pendingRange, setPendingRange] = useState<DateRange>({
    from: thirtyDaysAgo,
    to: today,
  });
  const [appliedRange, setAppliedRange] = useState<DateRange>(pendingRange);

  // Only enable Apply if pending != applied
  const isApplyDisabled =
    (pendingRange.from?.getTime() || 0) ===
      (appliedRange.from?.getTime() || 0) &&
    (pendingRange.to?.getTime() || 0) === (appliedRange.to?.getTime() || 0);

  // Create the URL for SWR based on applied date range
  const getAnalyticsUrl = (from: Date, to: Date) => {
    const startDate = format(from, "yyyyMMdd");
    const endDate = format(to, "yyyyMMdd");
    return `/api/analytics?startDate=${startDate}&endDate=${endDate}`;
  };

  // Fetch analytics data
  const {
    data: analyticsData,
    error: analyticsError,
    isLoading: analyticsLoading,
  } = useSWR(
    appliedRange.from && appliedRange.to
      ? getAnalyticsUrl(appliedRange.from, appliedRange.to)
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 5 * 60 * 1000,
      dedupingInterval: 60 * 1000,
    }
  );

  const stats = analyticsData?.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
        <div className="flex gap-2 items-end">
          <DateRangePicker
            value={pendingRange}
            onChange={(newRange) => {
              if (newRange?.from && newRange?.to) {
                setPendingRange(newRange);
              }
            }}
          />
          <Button
            className="ml-2 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-black dark:text-white font-medium border border-gray-300 dark:border-gray-700"
            disabled={isApplyDisabled}
            onClick={() => setAppliedRange(pendingRange)}
          >
            Apply
          </Button>
        </div>
      </div>

      <div>
        Analytics data for{" "}
        {appliedRange.from && appliedRange.to
          ? `${format(appliedRange.from, "MMM d, yyyy")} - ${format(appliedRange.to, "MMM d, yyyy")}`
          : "selected date range"}
      </div>

      {analyticsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-30 w-full" />
          ))}
        </div>
      ) : analyticsError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-red-500">Error: {analyticsError.message}</div>
          </CardContent>
        </Card>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Page Views" value={stats.total_page_views} />
          <StatCard
            title="Total Unique Users"
            value={stats.total_unique_users}
          />
          <StatCard
            title="Total Users who activate our services"
            value={stats.total_users_with_service}
          />
          <StatCard
            title="Percentage of users using our service"
            value={stats.percentage_users_with_service}
            suffix="%"
          />
          <StatCard
            title="Conversion rate without AR/3D activation"
            value={stats.conversion_rate_without_ar}
            suffix="%"
          />
          <StatCard
            title="Conversion rate with AR/3D activation"
            value={stats.conversion_rate_with_ar}
            suffix="%"
          />
          <StatCard
            title="Total Purchases with AR/3D activation"
            value={stats.total_purchases_with_ar}
          />
          <StatCard
            title="Add to Cart Default"
            value={stats.add_to_cart_default}
            suffix="%"
          />
          <StatCard
            title="Add to Cart with CharpstAR"
            value={stats.add_to_cart_with_ar}
            suffix="%"
          />
          <StatCard
            title="Average Order Value without AR/3D activation"
            value={stats.avg_order_value_without_ar}
            suffix="(Store currency)"
          />
          <StatCard
            title="Average Order Value with AR/3D activation"
            value={stats.avg_order_value_with_ar}
            suffix="(Store currency)"
          />
          <StatCard title="Total AR Clicks" value={stats.total_ar_clicks} />
          <StatCard title="Total 3D Clicks" value={stats.total_3d_clicks} />
          <StatCard
            title="Session time duration without AR/3D activation"
            value={stats.session_duration_without_ar}
            suffix="seconds"
          />
          <StatCard
            title="Session time duration with AR/3D activation"
            value={stats.session_duration_with_ar}
            suffix="seconds"
          />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500">No analytics data available</div>
          </CardContent>
        </Card>
      )}

      <PerformanceTrends />
    </div>
  );
}
