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
        <Card
          className="
          rounded-2xl bg-background 
          shadow-[inset_0_0_12px_rgba(0,0,0,0.25)] 
          dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]
          hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.35)]
          dark:hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]
          transition-all duration-300
        "
        >
          <CardContent className="p-6">{profileContent}</CardContent>
        </Card>

        <Card
          className="
          rounded-2xl bg-background 
          shadow-[inset_0_0_12px_rgba(0,0,0,0.25)] 
          dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]
          hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.35)]
          dark:hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]
          transition-all duration-300
        "
        >
          <CardContent className="p-6">
            <Suspense
              fallback={
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              }
            >
              <LazyQuickActionsWidget />
            </Suspense>
          </CardContent>
        </Card>

        <Card
          className="
          rounded-2xl bg-background 
          shadow-[inset_0_0_12px_rgba(0,0,0,0.25)] 
          dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]
          hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.35)]
          dark:hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]
          transition-all duration-300
        "
        >
          <CardContent className="p-6">
            <ErrorBoundary>
              <AdminPipelineWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card
          className="
          rounded-2xl bg-background 
          shadow-[inset_0_0_12px_rgba(0,0,0,0.25)] 
          dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]
          hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.35)]
          dark:hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]
          transition-all duration-300
        "
        >
          <CardContent className="p-6">
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
        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent>{profileContent}</CardContent>
        </Card>

        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
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
        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
            <ErrorBoundary>
              <ClientActionCenterWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="p-8 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
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
        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">{profileContent}</CardContent>
        </Card>

        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
            <ErrorBoundary>
              <ModelerQuickActionsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="md:col-span-2 p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
            <ErrorBoundary>
              <ModelerStatsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3: Pending Assignments card removed for modelers */}

        <Card className="h-4/4 p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="h-4/4 p-6">
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
        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">{profileContent}</CardContent>
        </Card>

        <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
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
        <Card className="h-4/4 p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
            <ErrorBoundary>
              <PersonalMetricsWidget />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card className="h-4/4 p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
            <ErrorBoundary>
              <QAWidgets />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Row 3 */}
        <Card className="md:col-span-2 p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
          <CardContent className="p-6">
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
      <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
        <CardContent className="p-6">{profileContent}</CardContent>
      </Card>

      <Card className="p-6 rounded-2xl bg-background shadow-[inset_2px_2px_6px_rgba(0,0,0,0.25),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_6px_6px_16px_rgba(0,0,0,0.35),inset_6px_6px_16px_rgba(255,255,255,0.08)] transition-all duration-300">
        <CardContent className="p-6">
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
