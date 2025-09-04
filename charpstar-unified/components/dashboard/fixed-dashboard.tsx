"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/containers";
import { useUser } from "@/contexts/useUser";
import ErrorBoundary from "@/components/dashboard/error-boundary";
import { Suspense, lazy } from "react";

// Lazy load heavy dashboard widgets
const LazyQuickActionsWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.QuickActionsWidget,
  }))
);
//eslint-disable-next-line @typescript-eslint/no-unused-vars
const LazyActivityWidget = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.ActivityWidget,
  }))
);

// Import role-specific widgets
import {
  StatusPieChartWidget,
  ClientActionCenterWidget,
  AdminPipelineWidget,
  AdminQueuesWidget,
} from "@/components/dashboard/dashboard-widgets";
import {
  ModelerStatsWidget,
  ModelerEarningsWidget,
  ModelerQuickActionsWidget,
} from "@/components/dashboard/modeler-widgets";
import {
  QAWidgets,
  PersonalMetricsWidget,
  WaitingForApprovalWidget,
} from "@/components/dashboard";

interface FixedDashboardProps {
  stats?: any;
  profileContent?: React.ReactNode;
}

export function FixedDashboard({ profileContent }: FixedDashboardProps) {
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
              <AdminPipelineWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ErrorBoundary>
              <AdminQueuesWidget />
            </ErrorBoundary>
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
              <ClientActionCenterWidget />
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

        {/* Row 3: Pending Assignments card removed for modelers */}

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
