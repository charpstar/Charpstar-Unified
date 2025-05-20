"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
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
import { usePagePermission } from "@/lib/usePagePermission";

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
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [adminData, setAdminData] = useState<any>(null);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/dashboard");

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
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAdminDashboardData().then(setAdminData);
    }
  }, [user?.role]);

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
      (user?.role === "admin" && adminData) ||
      (user?.role !== "admin" && !clientLoading)
    ) {
      setLoading(false);
    }
  }, [user?.role, adminData, clientLoading]);

  // Show loading state while checking permissions
  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error message if permission check failed
  if (permissionError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          Error checking permissions: {permissionError}
        </p>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

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

  if (user.role === "admin" && !adminData) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load analytics data: {clientError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const analytics = adminData || {};

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
      <div className="grid gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
          <p className="text-gray-600">You are logged in as {user.email}</p>
        </div>
      </div>

      {user.role === "admin" ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Analytics Overview</h2>
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
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold p-6">Event Analytics</h2>
          </div>

          <div className="mb-8 px-6">
            {clientLoading ? (
              <div>Loading client profiles...</div>
            ) : clientProfiles.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Name
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Monitored Since
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {clientProfiles.map((profile) => (
                      <tr
                        key={profile.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          {profile.name || "Unnamed Profile"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {profile.monitoredsince || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {profile.status || "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>No analytics profiles found.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
