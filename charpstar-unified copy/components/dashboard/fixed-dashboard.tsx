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
  ClientAssetCountWidget,
  AdminPipelineWidget,
  AdminQueuesWidget,
  QAStatisticsWidget,
  CostSummaryWidget,
  UnallocatedModelersWidget,
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
  QACommentsWidget,
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-card">{profileContent}</div>

        <div className="rounded-2xl bg-background">
          <Suspense
            fallback={
              <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
            }
          >
            <LazyQuickActionsWidget />
          </Suspense>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <AdminPipelineWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <AdminQueuesWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <QAStatisticsWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <CostSummaryWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card col-span-2">
          <ErrorBoundary>
            <UnallocatedModelersWidget />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Client Dashboard Layout
  if (isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
        {/* Row 1 */}
        <div className="p-6 rounded-2xl bg-card" data-tour="profile">
          {profileContent}
        </div>

        <div className=" rounded-3xl bg-background " data-tour="quick-actions">
          <Suspense
            fallback={
              <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
            }
          >
            <LazyQuickActionsWidget />
          </Suspense>
        </div>

        {/* Row 2 */}
        <div className=" rounded-2xl bg-background">
          <ErrorBoundary>
            <ClientActionCenterWidget />
          </ErrorBoundary>
        </div>

        <div className=" rounded-2xl bg-background">
          <ErrorBoundary>
            <StatusPieChartWidget />
          </ErrorBoundary>
        </div>

        {/* Row 3 - Asset Usage Widget */}
        <div className="md:col-span-2">
          <ErrorBoundary>
            <ClientAssetCountWidget />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Modeler Dashboard Layout
  if (isModeler) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-card">{profileContent}</div>

        <div className="rounded-2xl bg-card" data-tour="modeler-quick-actions">
          <ErrorBoundary>
            <ModelerQuickActionsWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card" data-tour="modeler-stats">
          <ErrorBoundary>
            <ModelerStatsWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card" data-tour="qa-comments">
          <ErrorBoundary>
            <QACommentsWidget />
          </ErrorBoundary>
        </div>

        <div
          className="rounded-2xl  col-span-2 md:col-span-2 gap-6 bg-card"
          data-tour="modeler-earnings"
        >
          <ErrorBoundary>
            <ModelerEarningsWidget />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // QA Dashboard Layout
  if (isQA) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-card">{profileContent}</div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <PersonalMetricsWidget />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <QAWidgets />
          </ErrorBoundary>
        </div>

        <div className="rounded-2xl bg-card">
          <ErrorBoundary>
            <WaitingForApprovalWidget />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Default layout for unknown roles
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card
        className="group p-6 rounded-2xl border border-border/50 overflow-hidden relative
        bg-gradient-to-br from-card/90 to-card/70
        shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.08)]
        hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.1)]
        dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_20px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.3)]
        dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_24px_rgba(0,0,0,0.2),0_8px_32px_rgba(0,0,0,0.4)]
        transition-all duration-300 hover:translate-y-[-2px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CardContent className="relative z-10">{profileContent}</CardContent>
      </Card>

      <Card
        className="group p-6 rounded-2xl border border-border/50 overflow-hidden relative
        bg-gradient-to-br from-card/90 to-card/70
        shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.08)]
        hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.1)]
        dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_20px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.3)]
        dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_24px_rgba(0,0,0,0.2),0_8px_32px_rgba(0,0,0,0.4)]
        transition-all duration-300 hover:translate-y-[-2px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CardContent className="relative z-10">
          <Suspense
            fallback={
              <div className="h-32 bg-muted/50 animate-pulse rounded-lg shadow-inner" />
            }
          >
            <LazyQuickActionsWidget />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
