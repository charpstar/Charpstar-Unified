"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Skeleton } from "@/components/ui/skeletons";
import { Box, Layers, Image, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/display";

interface GeneratorAnalyticsProps {
  data: any;
  isLoading: boolean;
}

export function GeneratorAnalytics({
  data,
  isLoading,
}: GeneratorAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.analytics) {
    return null;
  }

  const analytics = data.analytics;

  // Prepare data for charts
  const typeChartData = Object.entries(analytics.byGenerationType || {}).map(
    ([name, value]) => ({
      name,
      value: value as number,
      fill: `var(--color-${name})`,
    })
  );

  const imageModeData = Object.entries(analytics.byImageMode || {}).map(
    ([name, value]) => ({ name, value: value as number })
  );

  const faceCountData = Object.entries(analytics.faceCountRanges || {}).map(
    ([name, value]) => ({ name, count: value as number })
  );

  const pbrData = [
    {
      name: "PBR Enabled",
      value: analytics.pbrStats?.enabled || 0,
      fill: "hsl(var(--chart-1))",
    },
    {
      name: "PBR Disabled",
      value: analytics.pbrStats?.disabled || 0,
      fill: "hsl(var(--chart-2))",
    },
  ];

  // Chart configs
  const typeChartConfig = {
    value: {
      label: "Count",
    },
    ...Object.fromEntries(
      typeChartData.map((item, index) => [
        item.name,
        {
          label: item.name,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        },
      ])
    ),
  } satisfies ChartConfig;

  const imageModeConfig = {
    value: {
      label: "Generations",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const faceCountConfig = {
    count: {
      label: "Models",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const pbrConfig = {
    value: {
      label: "Models",
    },
    "PBR Enabled": {
      label: "PBR Enabled",
      color: "hsl(var(--chart-1))",
    },
    "PBR Disabled": {
      label: "PBR Disabled",
      color: "hsl(var(--chart-3))",
    },
  } satisfies ChartConfig;

  const trendsConfig = {
    count: {
      label: "Generations",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Generations
            </CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalGenerations || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Average Face Count
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.avgFaceCount?.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Average File Size
            </CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(analytics.avgFileSize || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">PBR Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                (analytics.pbrStats?.enabled / analytics.totalGenerations) * 100
              ) || 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={typeChartConfig}
              className="h-[300px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={typeChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {typeChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Image Mode Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Image Modes</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={imageModeConfig}
              className="h-[300px] w-full"
            >
              <BarChart data={imageModeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Face Count Ranges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Face Count Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={faceCountConfig}
              className="h-[300px] w-full"
            >
              <BarChart data={faceCountData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* PBR Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PBR Material Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pbrConfig} className="h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pbrData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Generation Trends */}
      {analytics.trends && analytics.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Generation Trends (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendsConfig} className="h-[300px] w-full">
              <LineChart data={analytics.trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Users (Admin Only) */}
      {analytics.isAdmin &&
        analytics.topUsers &&
        analytics.topUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Generators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topUsers.map((user: any, index: number) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        #{index + 1} {user.name}
                      </div>
                      {user.email && (
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">
                        {user.count}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        generation{user.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
