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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ">
        <Card className="p-6 rounded-2xl border-none bg-background  shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">{profileContent}</CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
            <Suspense
              fallback={
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyQuickActionsWidget />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
            <ErrorBoundary>
              <AdminPipelineWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background  shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
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
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent>{profileContent}</CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
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
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
            <ErrorBoundary>
              <ClientActionCenterWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
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
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">{profileContent}</CardContent>
        </Card>

        <Card
          className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300"
          data-tour="modeler-quick-actions"
        >
          <CardContent className="">
            <ErrorBoundary>
              <ModelerQuickActionsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card
          className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300"
          data-tour="modeler-stats"
        >
          <CardContent className="">
            <ErrorBoundary>
              <ModelerStatsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3: Pending Assignments card removed for modelers */}

        <Card
          className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300"
          data-tour="modeler-earnings"
        >
          <CardContent className="h-4/4 ">
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
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">{profileContent}</CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
            <ErrorBoundary>
              <PersonalMetricsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
            <ErrorBoundary>
              <QAWidgets />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3 */}
        <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
          <CardContent className="">
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
      <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
        <CardContent className="">{profileContent}</CardContent>
      </Card>

      <Card className="p-6 rounded-2xl border-none bg-background shadow-[inset_0_0_12px_rgba(0,0,0,0.15),inset_0_0_6px_rgba(255,255,255,0.1)] transition-all duration-300">
        <CardContent className="">
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
