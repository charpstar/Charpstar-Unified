"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { format, addDays } from "date-fns";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import PerformanceTrends from "@/components/PerformanceTrends";
import { useClientQuery } from "@/queries/useClientQuery";
import { compToBq } from "@/utils/uiutils";
import { useUser } from "@/contexts/useUser";
import { ProductMetrics } from "@/utils/BigQuery/types";
import CVRTable from "@/components/CVRTable";
import { SiteHeader } from "@/components/site-header";
import { usePagePermission } from "@/lib/usePagePermission";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@/components/ui/tooltip";
import { useAnalyticsCheck } from "@/lib/analyticsCheck";

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch analytics data");
  }
  return res.json();
};

export default function AnalyticsDashboard() {
  const user = useUser();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();
  const isUserLoading = typeof user === "undefined";
  const {
    hasAnalyticsProfile,
    analyticsProfile,
    isLoading: analyticsCheckLoading,
    error: analyticsCheckError,
  } = useAnalyticsCheck();
  const { hasAccess, loading: permissionLoading } = usePagePermission(
    userRole,
    "/analytics"
  );

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
      }
    };

    fetchUserRole();
  }, [router]);

  // --- Date range state with pending and applied states ---
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
    if (!analyticsProfile?.datasetid || !analyticsProfile?.projectid) {
      return null;
    }
    const startDate = format(from, "yyyyMMdd");
    const endDate = format(to, "yyyyMMdd");
    return `/api/analytics?startDate=${startDate}&endDate=${endDate}&analytics_profile_id=${analyticsProfile.datasetid}&projectid=${analyticsProfile.projectid}`;
  };

  // Fetch analytics data
  const {
    data: analyticsData,
    error: analyticsError,
    isLoading: analyticsLoading,
  } = useSWR(
    appliedRange.from && appliedRange.to && hasAnalyticsProfile
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

  const stats: AnalyticsData | undefined = analyticsData?.data;

  const startTableName = appliedRange.from
    ? compToBq(format(appliedRange.from, "yyyyMMdd"))
    : "";
  const endTableName = appliedRange.to
    ? compToBq(format(appliedRange.to, "yyyyMMdd"))
    : "";

  const { clientQueryResult, isQueryLoading } = useClientQuery({
    startTableName,
    endTableName,
    limit: 100,
  });

  // Show loading state for any initial loading condition
  if (
    isUserLoading ||
    permissionLoading ||
    !userRole ||
    analyticsCheckLoading
  ) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
          <div className="flex gap-2 items-end"></div>
        </div>
        <div>
          <Skeleton className="h-6 w-60 rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-30 w-full bg-background rounded-md "
            />
          ))}
        </div>
      </div>
    );
  }

  // User is loaded but not logged in
  if (user === null) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">Not logged in</h2>
              <p className="text-gray-500">Please sign in to view analytics.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No permission to access analytics
  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-500">
                You don't have permission to view analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No analytics profile or error
  if (!hasAnalyticsProfile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">
                Analytics Not Available
              </h2>
              <p className="text-gray-500">
                {analyticsCheckError ||
                  "No analytics profile has been set up for your account. Please contact support for assistance."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main dashboard ---
  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
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
              variant={"outline"}
              disabled={isApplyDisabled}
              onClick={() => setAppliedRange(pendingRange)}
            >
              Apply
            </Button>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-30 w-full bg-background rounded-md "
              />
            ))}
          </div>
        ) : analyticsError ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-red-500">
                Error: {analyticsError.message}
              </div>
            </CardContent>
          </Card>
        ) : stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total Page Views"
                      value={stats.total_page_views}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total Views on CharpstAR service enabled PDPs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total Unique Users"
                      value={stats.total_unique_users}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total Unique Users on CharpstAR service enabled PDPs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total Users who activate our services"
                      value={stats.total_users_with_service}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Total Users on PDPs who click either of the AR/3D buttons
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Percentage of users using our service"
                      value={stats.percentage_users_with_service}
                      suffix="%"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The percentage of users who have visited a page with our
                    script and have clicked either the AR or 3D Button <br />
                    <br />
                    <b>Formula:</b> (Total Unique Users with AR or 3D uses /
                    Total Unique Users on entire store) × 100
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Conversion rate without AR/3D activation"
                      value={stats.conversion_rate_without_ar}
                      suffix="%"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The average conversion rate of users who do not use our
                    services <br />
                    <br />
                    <b>Formula:</b> (Total Purchases on entire store / Total
                    Unique Users on entire store) × 100
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Conversion rate with AR/3D activation"
                      value={stats.conversion_rate_with_ar}
                      suffix="%"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The average conversion rate of users when using either of
                    our services <br />
                    <br />
                    <b>Formula:</b> (Total Purchases with AR or 3D / Total
                    Unique Users with AR or 3D uses) × 100
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total Purchases with AR/3D activation"
                      value={stats.total_purchases_with_ar}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Total Purchases made after interacting with our services
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Add to Cart Default"
                      value={stats.add_to_cart_default}
                      suffix="%"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The percentage of users adding a product to cart when they
                    have not interacted with CharpstAR services <br />
                    <br />
                    <b>Formula:</b> (Cart Additions on entire store / Total
                    Unique Users on entire store) × 100
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Add to Cart with CharpstAR"
                      value={stats.add_to_cart_with_ar}
                      suffix="%"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The percentage of users adding a product to cart after they
                    have interacted with either of the AR/3D buttons <br />
                    <br />
                    <b>Formula:</b> (Cart Additions with AR or 3D uses / Total
                    Unique Users with AR or 3D uses) × 100
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Average Order Value without AR/3D activation"
                      value={stats.avg_order_value_without_ar}
                      suffix="(Store currency)"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The Average value in the store's default currency of orders
                    made by customers when they have not interacted with
                    CharpstAR services
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Average Order Value with AR/3D activation"
                      value={stats.avg_order_value_with_ar}
                      suffix="(Store currency)"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The Average value in the store's default currency of orders
                    made by customers after they have interacted with either of
                    the AR/3D buttons
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total AR Clicks"
                      value={stats.total_ar_clicks}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total clicks by users on the 'View in AR' Button</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Total 3D Clicks"
                      value={stats.total_3d_clicks}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total clicks by users on the 'View in 3D' Button</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Session time duration without AR/3D activation"
                      value={stats.session_duration_without_ar}
                      suffix="seconds"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The average session time of users on CharpstAR service
                    enabled PDPs when they have not interacted with our services
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Session time duration with AR/3D activation"
                      value={stats.session_duration_with_ar}
                      suffix="seconds"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The average session time of users who have visited a page
                    with our services and clicked either the AR or 3D Button
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-gray-500">No analytics data available</div>
            </CardContent>
          </Card>
        )}

        <PerformanceTrends />

        <CVRTable
          isLoading={isQueryLoading}
          data={clientQueryResult as ProductMetrics[]}
          showColumns={{
            ar_sessions: true,
            _3d_sessions: true,
            total_purchases: true,
            purchases_with_service: true,
            avg_session_duration_seconds: true,
          }}
          showSearch={true}
        />
      </div>
    </>
  );
}
