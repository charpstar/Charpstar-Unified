"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User2, BarChart3 } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-3">
              <User2 className="w-5 h-5 text-muted-foreground" />
              Account Settings
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email skeleton */}
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-48" />
          </div>

          {/* Role skeleton */}
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-24" />
          </div>

          {/* Theme switcher skeleton */}
          <div className="flex flex-col gap-1">
            <Skeleton className="h-20 w-full" />
          </div>

          {/* Analytics Profile skeleton */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="rounded-lg border border-muted p-3 bg-muted/40">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-24" />
        </CardFooter>
      </Card>
    </div>
  );
}
