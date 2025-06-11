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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  AR: {
    label: "AR Clicks",
    color: "hsl(var(--chart-1))",
  },
  "3D": {
    label: "3D Clicks",
    color: "hsl(var(--chart-2))",
  },
} as const;

export default function PerformanceTrends({
  effectiveProfile,
}: {
  effectiveProfile: any;
}) {
  const { data: trends, isLoading } = useMonthlyTrends(effectiveProfile);

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
    month: format(new Date(item.month), "MMM yy"),
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
        <ChartContainer
          config={chartConfig}
          className="h-[400px] w-full max-w-[600px] mx-auto"
        >
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 20,
              left: 20,
              bottom: 20,
            }}
            barSize={80}
            barGap={12}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="10 10"
              className="stroke-border/20"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ className: "fill-muted-foreground text-xs" }}
              padding={{ left: 5, right: 5 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ className: "fill-muted-foreground text-xs" }}
              tickFormatter={(value) => `${value}`}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Bar
              dataKey="AR"
              fill="var(--color-AR)"
              radius={[4, 4, 0, 0]}
              className="opacity-70 hover:opacity-100 transition-opacity"
            />
            <Bar
              dataKey="3D"
              fill="var(--color-3D)"
              radius={[4, 4, 0, 0]}
              className="opacity-70 hover:opacity-100 transition-opacity"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
