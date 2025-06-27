"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { DashboardProfileSkeleton } from "@/components/ui/skeletons";
import { User2, TrendingUp } from "lucide-react";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 pt-19">
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
              <div className="space-y-4 h-full min-h-[400px]">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <DashboardProfileSkeleton className="h-3 w-26 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <DashboardProfileSkeleton className="h-70 w-full rounded-md" />
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
              <div className="grid gap-4 sm:gap-4 grid-cols-4 sm:grid-cols-2 lg:grid-cols-2 h-full min-h-[400px]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 border rounded-md"
                  >
                    <DashboardProfileSkeleton className="h-full flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
