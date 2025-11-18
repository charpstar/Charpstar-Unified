"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Skeleton } from "@/components/ui/skeletons";
import { Camera, Package, Palette, TrendingUp } from "lucide-react";
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

interface ProductRenderAnalyticsProps {
  data: any;
  isLoading: boolean;
}

export function ProductRenderAnalytics({
  data,
  isLoading,
}: ProductRenderAnalyticsProps) {
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
  const resolutionData = Object.entries(analytics.byResolution || {}).map(
    ([name, value]) => ({ name: name + "px", value: value as number })
  );

  const formatData = Object.entries(analytics.byFormat || {}).map(
    ([name, value]) => ({ name, value: value as number })
  );

  const viewData = Object.entries(analytics.byView || {}).map(
    ([name, value]) => ({ name, value: value as number })
  );

  const backgroundData = Object.entries(analytics.byBackground || {}).map(
    ([name, value]) => ({ name, value: value as number })
  );

  const clientData = Object.entries(analytics.byClient || {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Chart configs
  const resolutionConfig = {
    value: {
      label: "Renders",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const formatConfig = {
    value: {
      label: "Count",
    },
    ...Object.fromEntries(
      formatData.map((item, index) => [
        item.name,
        {
          label: item.name,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        },
      ])
    ),
  } satisfies ChartConfig;

  const viewConfig = {
    value: {
      label: "Renders",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const backgroundConfig = {
    value: {
      label: "Count",
    },
    ...Object.fromEntries(
      backgroundData.map((item, index) => [
        item.name,
        {
          label: item.name,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        },
      ])
    ),
  } satisfies ChartConfig;

  const clientConfig = {
    value: {
      label: "Renders",
      color: "hsl(var(--chart-4))",
    },
  } satisfies ChartConfig;

  const trendsConfig = {
    count: {
      label: "Renders",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Renders</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalRenders || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Assets Rendered
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalAssetsRendered || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Renders/Asset
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.avgRendersPerAsset || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Most Popular Format
            </CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(analytics.byFormat || {}).sort(
                (a: any, b: any) => b[1] - a[1]
              )[0]?.[0] || "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resolution Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Render Resolutions</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={resolutionConfig}
              className="h-[300px] w-full"
            >
              <BarChart data={resolutionData}>
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

        {/* Format Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Output Formats</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={formatConfig} className="h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={formatData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {formatData.map((entry, index) => (
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

        {/* View Angles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Camera Views</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={viewConfig} className="h-[300px] w-full">
              <BarChart data={viewData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Background Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Background Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={backgroundConfig}
              className="h-[300px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={backgroundData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {backgroundData.map((entry, index) => (
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
      </div>

      {/* Render Trends */}
      {analytics.trends && analytics.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Render Trends (Last 30 Days)
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

      {/* Client Distribution */}
      {clientData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renders by Client</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={clientConfig} className="h-[300px] w-full">
              <BarChart data={clientData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-4))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Rendered Assets */}
      {analytics.topAssets && analytics.topAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Rendered Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topAssets.map((asset: any, index: number) => (
                <div
                  key={asset.asset_id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      #{index + 1} {asset.asset_name || asset.article_id}
                    </div>
                    {asset.article_id && asset.asset_name && (
                      <div className="text-xs text-muted-foreground">
                        ID: {asset.article_id}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {asset.count}
                    </div>
                    <div className="text-xs text-muted-foreground">renders</div>
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
