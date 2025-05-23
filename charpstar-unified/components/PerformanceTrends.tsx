"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMonthlyTrends } from "@/queries/useMonthlyTrends";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PerformanceTrends() {
  const { data: trends, isLoading } = useMonthlyTrends();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <TrendingUp className="h-4 w-4" />
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const chartData = trends?.map((item) => ({
    name: format(new Date(item.month), "MMM yy"),
    AR: item.ar_clicks,
    "3D": item.threed_clicks,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-medium text-foreground">
          <TrendingUp className="h-4 w-4" />
          Performance Trends
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground pl-6 space-y-2">
          <span>Performance trends for the last 6 months</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full [&_.recharts-bar-rectangle]:!fill-current [&_.recharts-cartesian-grid-horizontal]:!stroke-border/20 [&_.recharts-cartesian-grid-vertical]:!stroke-border/20 [&_.recharts-cartesian-axis-line]:!stroke-border">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              className="[&_.recharts-bar-rectangle]:opacity-70 [&_.recharts-bar-rectangle:hover]:opacity-100"
              margin={{
                top: 5,
                right: 32,
                left: 0,
                bottom: 32,
              }}
            >
              <CartesianGrid
                strokeDasharray="10 10"
                className="stroke-border/20"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ className: "fill-muted-foreground text-xs" }}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ className: "fill-muted-foreground text-xs" }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-popover p-2 shadow-md">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              AR
                            </span>
                            <span className="font-bold text-popover-foreground">
                              {payload[0].value}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              3D
                            </span>
                            <span className="font-bold text-popover-foreground">
                              {payload[1].value}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="AR"
                className="fill-primary transition-colors"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="3D"
                className="fill-muted-foreground transition-colors"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
