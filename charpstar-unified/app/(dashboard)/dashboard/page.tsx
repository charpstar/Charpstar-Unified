"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";
import { addDays, format, parseISO } from "date-fns";
import useSWR from "swr";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { StatCard } from "@/components/ui/stat-card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function fetchAnalyticsProfiles() {
  return supabase
    .from("analytics_profiles")
    .select("*")
    .order("monitoredsince", { ascending: false });
}

function fetchAdminDashboardData() {
  return Promise.resolve({
    totalUsers: 1234,
    totalSales: 987,
    revenue: "$45,000",
    recentSales: [
      { product: "Widget Pro", amount: "$1,200", date: "2024-03-22" },
      { product: "Gadget X", amount: "$800", date: "2024-03-21" },
    ],
    systemHealth: "All systems operational",
  });
}

function getEventTrends(event: any) {
  // Group sample_events by date for the chart (in real use, get full time series from API)
  const counts: Record<string, number> = {};
  event.sample_events.forEach((row: any) => {
    counts[row.event_date] = (counts[row.event_date] || 0) + 1;
  });
  return Object.entries(counts).map(([x, y]) => ({ x, y }));
}

function getDefaultDateRange() {
  const today = new Date();
  const start = format(addDays(today, -30), "yyyyMMdd");
  const end = format(today, "yyyyMMdd");
  return { start, end };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function BigQueryEventCards() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { start, end } = getDefaultDateRange();

  // Split into pending and applied states
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: new Date(
      start.slice(0, 4) + "-" + start.slice(4, 6) + "-" + start.slice(6, 8)
    ),
    to: new Date(
      end.slice(0, 4) + "-" + end.slice(4, 6) + "-" + end.slice(6, 8)
    ),
  });
  const [pendingRange, setPendingRange] = useState<DateRange>(appliedRange);
  const [minDate, setMinDate] = useState<string>("2024-06-13");
  const [maxDate, setMaxDate] = useState<string>("2025-05-14");

  // Fetch min/max available dates from the API on mount
  useEffect(() => {
    fetch("/api/bigquery-analytics?meta=1")
      .then((res) => res.json())
      .then((data) => {
        if (data?.meta?.minDate) setMinDate(data.meta.minDate);
        if (data?.meta?.maxDate) setMaxDate(data.meta.maxDate);
      });
  }, []);

  // Only update fetch params when user presses Apply
  const params = new URLSearchParams();
  const formatYMD = (d?: Date) =>
    d ? d.toISOString().slice(0, 10).replace(/-/g, "") : "";
  if (appliedRange.from)
    params.append("startDate", formatYMD(appliedRange.from));
  if (appliedRange.to) params.append("endDate", formatYMD(appliedRange.to));
  const url = `/api/bigquery-analytics?${params.toString()}`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 5, // cache for 5 minutes
  });

  const events = data?.data || [];

  // Filter events by date range (using first_seen/last_seen)
  const filteredEvents = events.filter((event: any) => {
    const startDate = appliedRange.from
      ? formatYMD(appliedRange.from)
      : undefined;
    const endDate = appliedRange.to ? formatYMD(appliedRange.to) : undefined;
    if (!startDate && !endDate) return true;
    const first = event.first_seen;
    const last = event.last_seen;
    if (startDate && last < startDate) return false;
    if (endDate && first > endDate) return false;
    return true;
  });

  // Only enable Apply if pending != applied
  const isApplyDisabled =
    (pendingRange.from?.getTime() || 0) ===
      (appliedRange.from?.getTime() || 0) &&
    (pendingRange.to?.getTime() || 0) === (appliedRange.to?.getTime() || 0);

  return (
    <div>
      <div className="flex gap-2 items-end mb-4">
        <DateRangePicker
          value={pendingRange}
          onChange={(range: DateRange | undefined) =>
            range ? setPendingRange(range) : setPendingRange(appliedRange)
          }
          minDate={minDate ? new Date(minDate) : undefined}
          maxDate={maxDate ? new Date(maxDate) : undefined}
        />
        <Button
          className="ml-2"
          disabled={isApplyDisabled}
          onClick={() => setAppliedRange(pendingRange)}
        >
          Apply
        </Button>
      </div>
      {isLoading && <div>Loading BigQuery data...</div>}
      {error && (
        <div className="text-destructive">
          {typeof error === "string"
            ? error
            : error.message || "Something went wrong."}
        </div>
      )}

      {!isLoading && !filteredEvents.length && (
        <div>No analytics events found.</div>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event: any) => {
          return (
            <Card key={event.event_name}>
              <CardHeader className="cursor-pointer select-none">
                <CardTitle>{event.event_name}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  <div>{event.event_count} events</div>
                  <div>{event.unique_users} unique users</div>
                  <div>First seen: {event.first_seen}</div>
                  <div>Last seen: {event.last_seen}</div>
                  {event.top_campaign?.campaign && (
                    <div>
                      Top campaign:{" "}
                      <span className="font-semibold">
                        {event.top_campaign.campaign}
                      </span>{" "}
                      ({event.top_campaign.cnt})
                    </div>
                  )}
                  {event.top_term?.term && (
                    <div>
                      Top term:{" "}
                      <span className="font-semibold">
                        {event.top_term.term}
                      </span>{" "}
                      ({event.top_term.cnt})
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [adminData, setAdminData] = useState<any>(null);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get default date range
  const today = new Date();
  const defaultStartDate = format(addDays(today, -30), "yyyyMMdd");
  const defaultEndDate = format(today, "yyyyMMdd");

  // Fetch analytics data with retry logic
  const {
    data: analyticsData,
    error: analyticsError,
    mutate: refreshAnalytics,
  } = useSWR(
    role === "admin"
      ? `/api/analytics?startDate=${defaultStartDate}&endDate=${defaultEndDate}`
      : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch analytics");
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 300000, // Refresh every 5 minutes
      retryCount: 3,
      onError: (error) => {
        console.error("Analytics fetch error:", error);
      },
    }
  );

  // Admin dashboard logic
  useEffect(() => {
    if (role === "admin") {
      fetchAdminDashboardData().then(setAdminData);
    }
  }, [role]);

  useEffect(() => {
    async function loadClientProfiles() {
      setClientLoading(true);
      try {
        const { data, error } = await fetchAnalyticsProfiles();
        if (error) throw error;
        setClientProfiles(data || []);
      } catch (err: any) {
        setClientError(err.message);
      } finally {
        setClientLoading(false);
      }
    }
    loadClientProfiles();
  }, []);

  useEffect(() => {
    if (
      (role === "admin" && (analyticsData?.data || analyticsError)) ||
      (role !== "admin" && !clientLoading)
    ) {
      setLoading(false);
    }
  }, [role, analyticsData, analyticsError, clientLoading]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (role === "admin" && analyticsError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load analytics data: {analyticsError.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refreshAnalytics()}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (role !== "admin" && clientError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load client data: {clientError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const analytics = analyticsData?.data || {};

  return (
    <div className="p-6">
      {role === "admin" ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Analytics Overview</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAnalytics()}
            >
              Refresh Data
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard
              title="Total Page Views"
              value={analytics.total_page_views || 0}
            />
            <StatCard
              title="Total Unique Users"
              value={analytics.total_unique_users || 0}
            />
            <StatCard
              title="Total Users who activate our services"
              value={analytics.total_users_with_service || 0}
            />
            <StatCard
              title="Percentage of users using our service"
              value={analytics.percentage_users_with_service || 0}
              suffix="%"
            />
            <StatCard
              title="Conversion rate without AR/3D activation"
              value={analytics.conversion_rate_without_ar || 0}
              suffix="%"
            />
            <StatCard
              title="Conversion rate with AR/3D activation"
              value={analytics.conversion_rate_with_ar || 0}
              suffix="%"
            />
            <StatCard
              title="Total Purchases with AR/3D activation"
              value={analytics.total_purchases_with_ar || 0}
            />
            <StatCard
              title="Add to Cart Default"
              value={analytics.add_to_cart_default || 0}
              suffix="%"
            />
            <StatCard
              title="Add to Cart with CharpstAR"
              value={analytics.add_to_cart_with_ar || 0}
              suffix="%"
            />
            <StatCard
              title="Average Order Value without AR/3D activation"
              value={
                analytics.avg_order_value_without_ar?.toLocaleString() || "0"
              }
              suffix="(Store currency)"
            />
            <StatCard
              title="Average Order Value with AR/3D activation"
              value={analytics.avg_order_value_with_ar?.toLocaleString() || "0"}
              suffix="(Store currency)"
            />
            <StatCard
              title="Total AR Clicks"
              value={analytics.total_ar_clicks || 0}
            />
            <StatCard
              title="Total 3D Clicks"
              value={analytics.total_3d_clicks || 0}
            />
            <StatCard
              title="Session time duration without AR/3D activation"
              value={analytics.session_duration_without_ar || 0}
              suffix="seconds"
            />
            <StatCard
              title="Session time duration with AR/3D activation"
              value={analytics.session_duration_with_ar || 0}
              suffix="seconds"
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Event Analytics</h2>
          </div>
          <div className="mb-8">
            {clientLoading ? (
              <div>Loading client profiles...</div>
            ) : clientProfiles.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {clientProfiles.map((profile) => (
                  <Card key={profile.id} className="p-4">
                    <CardHeader>
                      <CardTitle>{profile.name || "Unnamed Profile"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <p>
                          Monitored since: {profile.monitoredsince || "N/A"}
                        </p>
                        <p>Status: {profile.status || "Unknown"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div>No analytics profiles found.</div>
            )}
          </div>
        </>
      )}

      <h2 className="text-2xl font-semibold mb-6">Event Analytics</h2>
      <BigQueryEventCards />
    </div>
  );
}
