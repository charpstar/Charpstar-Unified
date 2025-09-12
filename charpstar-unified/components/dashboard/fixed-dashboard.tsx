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
      <div className="grid grid-cols-2 md:grid-cols-1 gap-6">
        {/* SVG filter for glass distortion */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="0"
          height="0"
          style={{ position: "absolute", overflow: "hidden" }}
        >
          <defs>
            <filter
              id="glass-distortion"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.015 0.015"
                numOctaves="2"
                seed="50"
                result="noise"
              />
              <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="blurred"
                scale="40"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        <div className="grid grid-cols-2 gap-6">
          {/* Row 1 */}
          <Card
            className="p-6 rounded-2xl m-0 border-none relative overflow-hidden   transition-all duration-300"
            data-tour="profile"
            style={
              {
                "--shadow-offset": "0",
                "--shadow-blur": "30px",
                "--shadow-spread": "-10px",
                "--shadow-color": "#4f4f4f",
                "--tint-color": "138, 138, 138",
                "--tint-opacity": "0.11",
                "--frost-blur": "2px",
                "--noise-frequency": "0.0005",
                "--distortion-strength": "10",
                "--outer-shadow-blur": "24px",
                boxShadow: `0px 6px var(--outer-shadow-blur) rgba(93, 92, 92, 0.86)`,
                isolation: "isolate",
                touchAction: "none",
              } as React.CSSProperties
            }
          >
            {/* Glass tint layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                zIndex: 0,
                boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
                backgroundColor: `rgba(var(--tint-color), var(--tint-opacity))`,
              }}
            />

            {/* Frost blur layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                backdropFilter: `blur(var(--frost-blur))`,
                filter: "url(#glass-distortion)",
                isolation: "isolate",
                WebkitBackdropFilter: `blur(var(--frost-blur))`,
                WebkitFilter: "url(#glass-distortion)",
              }}
            />

            {/* Content */}
            <div className="relative z-1">
              <CardContent>{profileContent}</CardContent>
            </div>
          </Card>

          <Card
            className="p-6 rounded-2xl mb-0 border-none relative overflow-hidden transition-all duration-300"
            data-tour="quick-actions"
            style={
              {
                "--shadow-offset": "0",
                "--shadow-blur": "30px",
                "--shadow-spread": "-10px",
                "--shadow-color": "#4f4f4f",
                "--tint-color": "138, 138, 138",
                "--tint-opacity": "0.11",
                "--frost-blur": "2px",
                "--noise-frequency": "0.005",
                "--distortion-strength": "20",
                "--outer-shadow-blur": "24px",
                boxShadow: `0px 6px var(--outer-shadow-blur) rgba(93, 92, 92, 0.86)`,
                isolation: "isolate",
                touchAction: "none",
              } as React.CSSProperties
            }
          >
            {/* Glass tint layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                zIndex: 0,
                boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
                backgroundColor: `rgba(var(--tint-color), var(--tint-opacity))`,
              }}
            />

            {/* Frost blur layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                backdropFilter: `blur(var(--frost-blur))`,
                filter: "url(#glass-distortion)",
                isolation: "isolate",
                WebkitBackdropFilter: `blur(var(--frost-blur))`,
                WebkitFilter: "url(#glass-distortion)",
              }}
            />

            {/* Content */}
            <div className="relative z-1">
              <CardContent className="">
                <Suspense
                  fallback={
                    <div className="h-32 bg-muted animate-pulse rounded-lg" />
                  }
                >
                  <LazyQuickActionsWidget />
                </Suspense>
              </CardContent>
            </div>
          </Card>

          {/* Row 2 */}
          <Card
            className="p-6 rounded-2xl mb-0 border-none relative overflow-hidden"
            style={
              {
                "--shadow-offset": "0",
                "--shadow-blur": "30px",
                "--shadow-spread": "-10px",
                "--shadow-color": "#4f4f4f",
                "--tint-color": "138, 138, 138",
                "--tint-opacity": "0.11",
                "--frost-blur": "2px",
                "--noise-frequency": "0.005",
                "--distortion-strength": "20",
                "--outer-shadow-blur": "24px",
                boxShadow: `0px 6px var(--outer-shadow-blur) rgba(93, 92, 92, 0.47)`,
                isolation: "isolate",
                touchAction: "none",
              } as React.CSSProperties
            }
          >
            {/* Glass tint layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                zIndex: 0,
                background: `rgba(var(--tint-color), var(--tint-opacity))`,
                boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
              }}
            />

            {/* Frost blur layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                backdropFilter: `blur(var(--frost-blur))`,
                filter: "url(#glass-distortion)",
              }}
            />

            {/* Content */}
            <div className="relative z-1">
              <CardContent className="">
                <ErrorBoundary>
                  <ClientActionCenterWidget />
                </ErrorBoundary>
              </CardContent>
            </div>
          </Card>

          <Card
            className="p-6 rounded-2xl mb-0 border-none relative overflow-hidden"
            style={
              {
                "--shadow-offset": "0",
                "--shadow-blur": "30px",
                "--shadow-spread": "-10px",
                "--shadow-color": "#4f4f4f",
                "--tint-color": "138, 138, 138",
                "--tint-opacity": "0.11",
                "--frost-blur": "2px",
                "--noise-frequency": "0.005",
                "--distortion-strength": "20",
                "--outer-shadow-blur": "24px",
                boxShadow: `0px 6px var(--outer-shadow-blur) rgba(93, 92, 92, 0.47)`,
                isolation: "isolate",
                touchAction: "none",
              } as React.CSSProperties
            }
          >
            {/* Glass tint layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                zIndex: 0,
                background: `rgba(var(--tint-color), var(--tint-opacity))`,
                boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
              }}
            />

            {/* Frost blur layer */}
            <div
              className="absolute inset-0 rounded-2xl mb-0"
              style={{
                backdropFilter: `blur(var(--frost-blur))`,
                filter: "url(#glass-distortion)",
              }}
            />

            {/* Content */}
            <div className="relative z-1">
              <CardContent className="">
                <ErrorBoundary>
                  <StatusPieChartWidget />
                </ErrorBoundary>
              </CardContent>
            </div>
          </Card>
        </div>
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
