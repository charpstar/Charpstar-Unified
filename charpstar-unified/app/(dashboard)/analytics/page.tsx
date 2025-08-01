"use client";

import * as React from "react";
import { useState, useEffect, Suspense, lazy } from "react";
import { StatCard } from "@/components/ui/display";
import { Card, CardContent } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { format } from "date-fns";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeletons";

import { useClientQuery } from "@/queries/useClientQuery";
import { compToBq } from "@/utils/uiutils";
import { useUser } from "@/contexts/useUser";
import { ProductMetrics } from "@/utils/BigQuery/types";
import { usePagePermission } from "@/lib/usePagePermission";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAnalyticsCheck } from "@/lib/analyticsCheck";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import {
  Eye,
  TrendingUp,
  ShoppingCart,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { AnalyticsTour } from "@/components/analytics";

// Lazy load heavy analytics components
const LazyPerformanceTrends = lazy(() =>
  import("@/components/analytics").then((module) => ({
    default: module.PerformanceTrends,
  }))
);
const LazyCVRTable = lazy(() =>
  import("@/components/analytics").then((module) => ({
    default: module.CVRTable,
  }))
);

interface AnalyticsRow {
  metric_name: string;
  metrics: string;
}

interface ImpersonatedProfile {
  id: string;
  email: string;
  role: string;
  analytics_profile_id?: string;
  datasetid?:
    | "analytics_287358793"
    | "analytics_317975816"
    | "analytics_371791627"
    | "analytics_320210445"
    | "analytics_274422295"
    | "ewheelsGA4"
    | "analytics_351120479"
    | "analytics_389903836"
    | "analytics_311675532"
    | "analytics_296845812";
  projectid?: string;
  monitoredsince?: string;
  tablename?: string;
  name?: string;
}

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

interface ParsedMetric {
  value: string | number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: "include", // <-- THIS IS CRITICAL!
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch analytics data");
  }
  return res.json();
};

function capPercentage(value: number): number {
  return Math.min(value, 100);
}

export default function AnalyticsDashboard() {
  useEffect(() => {
    document.title = "CharpstAR Platform - Analytics";
  }, []);
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const [impersonatedProfile, setImpersonatedProfile] =
    useState<ImpersonatedProfile | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [showAnalyticsTour, setShowAnalyticsTour] = useState(false);
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

  // Use the date range from context instead of local state
  const { appliedRange } = useDateRange();

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

  // Check if analytics tour should be shown
  useEffect(() => {
    const analyticsTourCompleted = localStorage.getItem(
      "analytics-tour-completed"
    );
    if (
      !analyticsTourCompleted &&
      hasAnalyticsProfile &&
      !analyticsCheckLoading
    ) {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        setShowAnalyticsTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasAnalyticsProfile, analyticsCheckLoading]);

  const handleAnalyticsTourComplete = () => {
    localStorage.setItem("analytics-tour-completed", "true");
    setShowAnalyticsTour(false);
  };

  const handleAnalyticsTourSkip = () => {
    localStorage.setItem("analytics-tour-completed", "true");
    setShowAnalyticsTour(false);
  };

  useEffect(() => {
    async function fetchImpersonatedProfile() {
      if (impersonateId && userRole === "admin") {
        // Fetch the impersonated user&apos;s profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", impersonateId)
          .single();
        if (profile && profile.analytics_profile_id) {
          // Fetch the analytics profile using analytics_profile_id
          const { data: analyticsProfile } = await supabase
            .from("analytics_profiles")
            .select("datasetid, projectid, monitoredsince")
            .eq("id", profile.analytics_profile_id)
            .single();
          setImpersonatedProfile({
            ...profile,
            datasetid: analyticsProfile?.datasetid,
            projectid: analyticsProfile?.projectid,
            monitoredsince: analyticsProfile?.monitoredsince,
          });
        } else {
          setImpersonatedProfile(profile || null);
        }
      } else {
        setImpersonatedProfile(null);
      }
    }
    fetchImpersonatedProfile();
  }, [impersonateId, userRole]);

  // Use impersonated profile if present
  const effectiveProfile = impersonatedProfile || analyticsProfile;

  // Create the URL for SWR based on applied date range
  const getAnalyticsUrl = (from: Date, to: Date) => {
    if (!effectiveProfile?.datasetid || !effectiveProfile?.projectid) {
      return null;
    }
    const startDate = format(from, "yyyyMMdd");
    const endDate = format(to, "yyyyMMdd");
    return `/api/analytics?startDate=${startDate}&endDate=${endDate}&analytics_profile_id=${effectiveProfile.datasetid}&projectid=${effectiveProfile.projectid}`;
  };

  // Log the effective profile and API URL for debugging

  if (
    appliedRange.from &&
    appliedRange.to &&
    effectiveProfile?.datasetid &&
    effectiveProfile?.projectid
  ) {
  }

  // Fetch analytics data
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useSWR(
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

  // Helper function to parse metrics
  const parseMetric = (row: AnalyticsRow | undefined): number => {
    if (!row?.metrics) return 0;
    try {
      const parsed = JSON.parse(row.metrics) as ParsedMetric;
      return parsed.value ? parseFloat(parsed.value.toString()) : 0;
    } catch (e) {
      console.error("Error parsing metrics:", e);
      return 0;
    }
  };

  // Ensure analyticsData is an array
  const analyticsArray = Array.isArray(analyticsData) ? analyticsData : [];

  // Process the raw analytics data into the expected format
  const stats: AnalyticsData | undefined =
    analyticsArray.length > 0
      ? {
          total_page_views: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "charpstAR_Load"
            )
          ),
          total_unique_users: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "total_unique_users"
            )
          ),
          total_users_with_service: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "total_activated_users"
            )
          ),
          percentage_users_with_service: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "percentage_charpstAR"
            )
          ),
          conversion_rate_without_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "overall_conv_rate"
            )
          ),
          conversion_rate_with_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "overall_conv_rate_CharpstAR"
            )
          ),
          total_purchases_with_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "total_purchases_after_ar"
            )
          ),
          add_to_cart_default: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "cart_percentage_default"
            )
          ),
          add_to_cart_with_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "cart_after_ar_percentage"
            )
          ),
          avg_order_value_without_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "average_order_value_all_users"
            )
          ),
          avg_order_value_with_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "average_order_value_ar_users"
            )
          ),
          total_ar_clicks: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "charpstAR_AR_Button_Click"
            )
          ),
          total_3d_clicks: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "charpstAR_3D_Button_Click"
            )
          ),
          session_duration_without_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) => row.metric_name === "session_time_default"
            )
          ),
          session_duration_with_ar: parseMetric(
            analyticsArray.find(
              (row: AnalyticsRow) =>
                row.metric_name === "session_time_charpstAR"
            )
          ),
        }
      : undefined;

  // Debug individual metrics

  const startTableName = appliedRange.from
    ? compToBq(format(appliedRange.from, "yyyyMMdd"))
    : "";
  const endTableName = appliedRange.to
    ? compToBq(format(appliedRange.to, "yyyyMMdd"))
    : "";

  // Add validation for date range
  useEffect(() => {
    if (appliedRange.from && appliedRange.to) {
      const fromDate = new Date(appliedRange.from);
      const toDate = new Date(appliedRange.to);
      const today = new Date();

      if (fromDate > today || toDate > today) {
        console.warn("Date range includes future dates:", {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd"),
          today: format(today, "yyyy-MM-dd"),
        });
      }
    }
  }, [appliedRange]);

  const { clientQueryResult, isQueryLoading } = useClientQuery({
    startTableName,
    endTableName,
    limit: 100,
    // @ts-expect-error - effectiveProfile is compatible at runtime
    effectiveProfile,
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
          <div className="flex gap-2 items-end"></div>
        </div>
        <div></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>
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

  // No permission to access analytics - only show after we&apos;re sure about permissions
  if (!hasAccess && !permissionLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-gray-500">
                You don&apos;t have permission to view analytics.
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
    <div className="container mx-auto p-6 space-y-6">
      {showAnalyticsTour && (
        <AnalyticsTour
          onComplete={handleAnalyticsTourComplete}
          onSkip={handleAnalyticsTourSkip}
        />
      )}

      {impersonatedProfile && (
        <Alert variant="default" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Viewing analytics as: {impersonatedProfile.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/analytics")}
            >
              Exit
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {/* User Engagement & Service Activation */}
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {/* User Engagement Metrics */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                <Eye className="h-4 w-4" />
                User Engagement
              </h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total Page Views"
                            value={stats?.total_page_views || 0}
                          />
                        )}
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
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total Users who activate our services"
                            value={stats?.total_users_with_service || 0}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Total Users on PDPs who click either of the AR/3D
                        buttons
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Percentage of users using our service"
                            value={capPercentage(
                              stats?.percentage_users_with_service || 0
                            )}
                            suffix="%"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The percentage of users who have visited a page with our
                        script and have clicked either the AR or 3D Button{" "}
                        <br />
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
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total Unique Users"
                            value={stats?.total_unique_users || 0}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Total Unique Users on CharpstAR service enabled PDPs
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Service Activation */}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border/50" />

        {/* Conversion & Performance Metrics */}
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {/* Conversion Metrics */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Conversion Performance
              </h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Conversion rate without AR/3D activation"
                            value={stats?.conversion_rate_without_ar || 0}
                            suffix="%"
                          />
                        )}
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
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Add to Cart Default"
                            value={stats?.add_to_cart_default || 0}
                            suffix="%"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The percentage of users adding a product to cart when
                        they have not interacted with CharpstAR services <br />
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
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Add to Cart with CharpstAR"
                            value={stats?.add_to_cart_with_ar || 0}
                            suffix="%"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The percentage of users adding a product to cart after
                        they have interacted with either of the AR/3D buttons{" "}
                        <br />
                        <br />
                        <b>Formula:</b> (Cart Additions with AR or 3D uses /
                        Total Unique Users with AR or 3D uses) × 100
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Conversion rate with AR/3D activation"
                            value={stats?.conversion_rate_with_ar || 0}
                            suffix="%"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The average conversion rate of users when using either
                        of our services <br />
                        <br />
                        <b>Formula:</b> (Total Purchases with AR or 3D / Total
                        Unique Users with AR or 3D uses) × 100
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Cart Performance */}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border/50" />

        {/* Revenue & Purchase Metrics */}
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {/* Purchase Metrics */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Purchase Metrics
              </h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total Purchases with AR/3D activation"
                            value={stats?.total_purchases_with_ar || 0}
                          />
                        )}
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
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Average Order Value with AR/3D activation"
                            value={stats?.avg_order_value_with_ar || 0}
                            suffix="(Store currency)"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The Average value in the store&apos;s default currency
                        of orders made by customers after they have interacted
                        with either of the AR/3D buttons
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Average Order Value without AR/3D activation"
                            value={stats?.avg_order_value_without_ar || 0}
                            suffix="(Store currency)"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The Average value in the store&apos;s default currency
                        of orders made by customers when they have not
                        interacted with CharpstAR services
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border/50" />

        {/* User Interactions & Session Duration */}
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {/* Interaction Metrics */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                <Activity className="h-4 w-4" />
                User Interactions
              </h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total AR Clicks"
                            value={stats?.total_ar_clicks || 0}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Total clicks by users on the &apos;View in AR&apos;
                        Button
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Total 3D Clicks"
                            value={stats?.total_3d_clicks || 0}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Total clicks by users on the &apos;View in 3D&apos;
                        Button
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Session time duration without AR/3D activation"
                            value={stats?.session_duration_without_ar || 0}
                            suffix="seconds"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The average session time of users on CharpstAR service
                        enabled PDPs when they have not interacted with our
                        services
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        {isAnalyticsLoading ? (
                          <Skeleton className="bg-background" />
                        ) : (
                          <StatCard
                            title="Session time duration with AR/3D activation"
                            value={stats?.session_duration_with_ar || 0}
                            suffix="seconds"
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The average session time of users who have visited a
                        page with our services and clicked either the AR or 3D
                        Button
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Session Duration */}
            <div className="lg:col-span-2">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-4"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className=" sm:h-[400px] bg-card rounded-lg border">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <LazyPerformanceTrends effectiveProfile={effectiveProfile} />
          </Suspense>
        </div>
      </div>

      <div className="mt-14 sm:mt-35">
        <div className="bg-card rounded-lg border">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <LazyCVRTable
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
              effectiveProfile={effectiveProfile || undefined}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
