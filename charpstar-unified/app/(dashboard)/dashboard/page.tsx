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

  // Admin dashboard logic
  useEffect(() => {
    setLoading(true);
    if (role === "admin") {
      fetchAdminDashboardData().then((data) => {
        setAdminData(data);
        setLoading(false);
      });
    } else if (role === "client") {
      setClientLoading(true);
      fetchAnalyticsProfiles().then(({ data, error }) => {
        if (error) setClientError(error.message);
        else setClientProfiles(data || []);
        setClientLoading(false);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [role]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 bg-background text-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (role === "admin" && adminData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">Total Users</h3>
            <p className="text-3xl font-bold mt-2 text-primary">
              {adminData.totalUsers}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">Total Sales</h3>
            <p className="text-3xl font-bold mt-2 text-primary">
              {adminData.totalSales}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">Revenue</h3>
            <p className="text-3xl font-bold mt-2 text-primary">
              {adminData.revenue}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">System Health</h3>
            <p className="text-lg mt-2 text-foreground">
              {adminData.systemHealth}
            </p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-foreground mb-2">Recent Sales</h3>
          <ul className="space-y-1">
            {adminData.recentSales.map((s: any, i: number) => (
              <li key={i} className="text-foreground">
                {s.product} -{" "}
                <span className="font-semibold text-primary">{s.amount}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  ({s.date})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <BigQueryEventCards />
      </div>
    );
  }

  if (role === "client") {
    if (clientLoading) {
      return (
        <div className="flex justify-center items-center h-64 bg-background text-foreground">
          Loading analytics profiles...
        </div>
      );
    }
    if (clientError) {
      return (
        <div className="space-y-6">
          <div className="p-4 bg-destructive text-destructive-foreground rounded-md">
            {clientError}
          </div>
          <BigQueryEventCards />
        </div>
      );
    }
    // Summary stats
    const totalProfiles = clientProfiles.length;
    const mostRecent = clientProfiles[0]?.monitoredsince
      ? new Date(clientProfiles[0].monitoredsince).toLocaleDateString()
      : "-";
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">
          Client Analytics Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">
              Total Analytics Profiles
            </h3>
            <p className="text-3xl font-bold mt-2 text-primary">
              {totalProfiles}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-foreground">
              Most Recent Monitored
            </h3>
            <p className="text-lg mt-2 text-primary">{mostRecent}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-foreground mb-2">
            Analytics Profiles
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-border bg-card text-foreground">
              <thead>
                <tr className="bg-primary">
                  <th className="px-4 py-2 text-left text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-muted-foreground">
                    Project ID
                  </th>
                  <th className="px-4 py-2 text-left text-muted-foreground">
                    Dataset ID
                  </th>
                  <th className="px-4 py-2 text-left text-muted-foreground">
                    Table Name
                  </th>
                  <th className="px-4 py-2 text-left text-muted-foreground">
                    Monitored Since
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientProfiles.map((profile) => (
                  <tr key={profile.id} className="border-b">
                    <td className="px-4 py-2 text-foreground">
                      {profile.name}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      {profile.projectid}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      {profile.datasetid}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      {profile.tablename}
                    </td>
                    <td className="px-4 py-2 text-foreground">
                      {profile.monitoredsince
                        ? new Date(profile.monitoredsince).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
                {clientProfiles.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-4 text-muted-foreground"
                    >
                      No analytics profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <BigQueryEventCards />
      </div>
    );
  }

  // For all other roles or fallback, always show BigQueryEventCards
  return (
    <div className="p-6 text-center text-muted-foreground">
      No dashboard data available for your role.
    </div>
  );
}
