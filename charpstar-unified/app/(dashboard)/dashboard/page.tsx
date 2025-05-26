"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { addDays, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/contexts/useUser";
import { usePagePermission } from "@/lib/usePagePermission";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayFactor = (days - i) / days;

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

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();
  const isUserLoading = typeof user === "undefined";
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"1d" | "7d" | "30d">("30d");

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/dashboard");

  // Only check hasAnalytics after user is loaded
  const hasAnalytics = user && user.metadata?.analytics_profile_id;

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

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
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
        } else {
          setAnalyticsData(null);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
        setAnalyticsData(null);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch after user is loaded AND analytics is available AND has permission
    if (!isUserLoading && hasAnalytics && hasAccess) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, isUserLoading, hasAnalytics, hasAccess]);

  const isInitialLoading =
    isUserLoading || !userRole || permissionLoading || (hasAccess && loading);

  // Show loading state for any initial loading condition
  if (isInitialLoading || !userRole) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardContent key={i} className="p-6">
              <div className="space-y-3">
                {/* Title */}
                <Skeleton className="h-4 w-24" />
                {/* Value */}
              </div>
            </CardContent>
          ))}
        </div>
      </div>
    );
  }

  // Only show error states after we've loaded the user role
  if (permissionError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
        <Card className="border-destructive">
          <CardHeader>
            <CardDescription>
              An error occurred while checking permissions: {permissionError}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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

  // Rest of the component remains the same
  return (
    <div className="flex flex-1 flex-col p-6">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>

      {!hasAnalytics ? (
        <div className="text-center mt-24">
          <div className="text-2xl font-semibold mb-2">
            Analytics Not Available
          </div>
          <div className="text-gray-500">
            No analytics profile has been set up for your account. Please
            contact support for assistance.
          </div>
        </div>
      ) : !analyticsData ? (
        <div className="text-red-500">No analytics data available</div>
      ) : (
        <div className="space-y-6">
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
        </div>
      )}
    </div>
  );
}
