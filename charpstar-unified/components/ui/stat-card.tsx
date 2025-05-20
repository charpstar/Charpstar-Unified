"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  className?: string;
}

export function StatCard({ title, value, suffix, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-6 shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-3xl font-semibold text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {suffix && (
          <span className="ml-1 text-xl font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
