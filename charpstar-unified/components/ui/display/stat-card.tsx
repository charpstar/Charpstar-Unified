"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
}

export function StatCard({
  title,
  value,
  suffix,
  description,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300  hover:shadow-lg hover:shadow-muted/20 border-border hover:border-border">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {trend && trendValue && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                trend === "up" && "text-success bg-success-muted",
                trend === "down" && "text-error bg-error-muted",
                trend === "neutral" && "text-muted-foreground bg-muted"
              )}
            >
              {trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trend === "down" && <TrendingDown className="h-3 w-3" />}
              {trendValue > 0 && "+"}
              {trendValue}%
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        <div className="text-3xl font-bold tracking-tight group-hover:text-foreground transition-colors duration-200">
          {value.toLocaleString()}
          {suffix && (
            <span className="text-sm font-normal ml-1 text-muted-foreground group-hover:text-foreground/70 transition-colors duration-200">
              {suffix}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed group-hover:text-foreground/70 transition-colors duration-200">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
