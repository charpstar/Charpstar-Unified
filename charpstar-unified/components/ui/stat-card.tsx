"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  description?: string;
}

export function StatCard({ title, value, suffix, description }: StatCardProps) {
  return (
    <Card className="pl-10 ">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value.toLocaleString()}
          {suffix && <span className="text-xs font-normal ml-1">{suffix}</span>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
