"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User2, TrendingUp } from "lucide-react";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* User Profile Skeleton */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User2 className="h-4 w-4" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-full" />
                  <div className="space-y-1 text-center sm:text-left">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 border rounded-md"
                  >
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin Dashboard Widgets Skeleton */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4">
        <div className="bg-card rounded-lg shadow p-4 flex flex-col border border-border">
          <div className="flex items-center space-x-3 mb-4">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-3 w-32 mb-1" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
          <div className="mt-2">
            {/* Chart skeleton with bars */}
            <div className="h-16 w-full flex items-end justify-between gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-2 rounded-sm"
                  style={{
                    height: `${Math.random() * 60 + 20}%`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between mt-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-2 w-6" />
              ))}
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg shadow p-4 flex flex-col border border-border">
          <div className="flex items-center space-x-3 mb-4">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-5 w-10" />
            </div>
          </div>
          <div className="mt-2">
            {/* Chart skeleton with bars */}
            <div className="h-16 w-full flex items-end justify-between gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-2 rounded-sm"
                  style={{
                    height: `${Math.random() * 60 + 20}%`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between mt-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-2 w-6" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
