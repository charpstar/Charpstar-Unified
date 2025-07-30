"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/containers";
import { useUser } from "@/contexts/useUser";
import ErrorBoundary from "@/components/dashboard/error-boundary";
import { Suspense, lazy } from "react";

// Lazy load heavy dashboard widgets
const LazyTotalModelsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.TotalModelsWidget,
  }))
);
const LazyCategoriesWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.CategoriesWidget,
  }))
);
const LazyQuickActionsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.QuickActionsWidget,
  }))
);
const LazyActivityWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.ActivityWidget,
  }))
);
const LazyNewUsersChartWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.NewUsersChartWidget,
  }))
);
const LazyNewModelsChartWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.NewModelsChartWidget,
  }))
);

// Import role-specific widgets
import {
  ModelStatusWidget,
  StatusPieChartWidget,
} from "@/components/dashboard/dashboard-widgets";
import {
  ModelerStatsWidget,
  ModelerEarningsWidget,
  ModelerQuickActionsWidget,
} from "@/components/dashboard/modeler-widgets";
import { PendingAssignmentsWidget } from "@/components/dashboard/pending-assignments-widget";
import {
  QAWidgets,
  PersonalMetricsWidget,
  WaitingForApprovalWidget,
} from "@/components/dashboard";

interface FixedDashboardProps {
  stats?: any;
  profileContent?: React.ReactNode;
}

export function FixedDashboard({ stats, profileContent }: FixedDashboardProps) {
  const user = useUser();
  const isAdmin = user?.metadata?.role === "admin";
  const isClient = user?.metadata?.role === "client";
  const isModeler = user?.metadata?.role === "modeler";
  const isQA = user?.metadata?.role === "qa";

  if (!user) {
    return <div>Loading...</div>;
  }

  // Admin Dashboard Layout
  if (isAdmin) {
    return (
      <div className="grid grid-cols-6 grid-rows-7 gap-4 h-full">
        {/* Profile - grid-area: 1 / 1 / 3 / 4 */}
        <Card className="grid-area-1-1-3-4">
          <CardContent>{profileContent}</CardContent>
        </Card>

        {/* Quick Actions - grid-area: 1 / 4 / 3 / 7 */}
        <Card className="grid-area-1-4-3-7">
          <CardContent>
            <Suspense
              fallback={
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyQuickActionsWidget />
            </Suspense>
          </CardContent>
        </Card>

        {/* Total Models - grid-area: 3 / 1 / 5 / 3 */}
        <Card className="grid-area-3-1-5-3 ">
          <CardContent>
            <Suspense
              fallback={
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyTotalModelsWidget />
            </Suspense>
          </CardContent>
        </Card>

        {/* Categories - grid-area: 3 / 3 / 5 / 5 */}
        <Card className="grid-area-3-3-5-5">
          <CardContent>
            <Suspense
              fallback={
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyCategoriesWidget stats={stats} />
            </Suspense>
          </CardContent>
        </Card>

        {/* New Users Chart - grid-area: 3 / 5 / 5 / 7 */}
        <Card className="grid-area-3-5-5-7">
          <CardContent>
            <Suspense
              fallback={
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyNewUsersChartWidget />
            </Suspense>
          </CardContent>
        </Card>

        {/* Recent Activity - grid-area: 5 / 1 / 7 / 7 */}
        <Card className="grid-area-5-1-7-7">
          <CardContent>
            <Suspense
              fallback={
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyActivityWidget />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Client Dashboard Layout
  if (isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1 */}
        <Card>
          <CardContent>{profileContent}</CardContent>
        </Card>

        <Card>
          <CardContent>
            <Suspense
              fallback={
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyQuickActionsWidget />
            </Suspense>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card>
          <CardContent>
            <ErrorBoundary>
              <ModelStatusWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ErrorBoundary>
              <StatusPieChartWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Modeler Dashboard Layout
  if (isModeler) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1 */}
        <Card>
          <CardContent>{profileContent}</CardContent>
        </Card>

        <Card>
          <CardContent>
            <ErrorBoundary>
              <ModelerQuickActionsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="md:col-span-2">
          <CardContent>
            <ErrorBoundary>
              <ModelerStatsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3 */}
        <Card className="h-4/4">
          <CardContent>
            <ErrorBoundary>
              <PendingAssignmentsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="h-4/4">
          <CardContent className="h-4/4">
            <ErrorBoundary>
              <ModelerEarningsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    );
  }

  // QA Dashboard Layout
  if (isQA) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1 */}
        <Card>
          <CardContent>{profileContent}</CardContent>
        </Card>

        <Card>
          <CardContent>
            <Suspense
              fallback={
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyQuickActionsWidget />
            </Suspense>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="h-4/4">
          <CardContent>
            <ErrorBoundary>
              <PersonalMetricsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="h-4/4">
          <CardContent>
            <ErrorBoundary>
              <QAWidgets />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3 */}
        <Card className="md:col-span-2">
          <CardContent>
            <ErrorBoundary>
              <WaitingForApprovalWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default layout for unknown roles
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardContent>{profileContent}</CardContent>
      </Card>

      <Card>
        <CardContent>
          <Suspense
            fallback={
              <div className="h-32 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyQuickActionsWidget />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
