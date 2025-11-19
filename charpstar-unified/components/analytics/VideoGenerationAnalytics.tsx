import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/display";
import {
  Video,
  TrendingUp,
  Clock,
  CheckCircle,
  Download,
  Save,
  Users,
  Film,
  BarChart3,
  PlayCircle,
} from "lucide-react";

interface VideoGenerationAnalyticsProps {
  data: any;
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const VideoGenerationAnalytics: React.FC<
  VideoGenerationAnalyticsProps
> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>Loading video generation analytics...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.summary || data.summary.totalGenerations === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground">
              No video generation analytics found for the selected time period.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    summary,
    usageOverTime,
    topUsers,
    resolutionDistribution,
    durationDistribution,
    objectTypeDistribution,
    conversionRateTrend,
    detailedGenerations,
    featureAdoption,
  } = data;

  // Chart configurations
  const usageOverTimeConfig = {
    generations: {
      label: "Generations",
      color: "hsl(var(--chart-1))",
    },
    saves: {
      label: "Saves",
      color: "hsl(var(--chart-2))",
    },
    downloads: {
      label: "Downloads",
      color: "hsl(var(--chart-3))",
    },
  } satisfies ChartConfig;

  const conversionConfig = {
    conversionRate: {
      label: "Conversion Rate",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const resolutionChartConfig = Object.fromEntries(
    resolutionDistribution.map((item: any, index: number) => [
      item.resolution,
      {
        label: item.resolution,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      },
    ])
  ) satisfies ChartConfig;

  const durationChartConfig = {
    count: {
      label: "Videos",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const objectTypeChartConfig = Object.fromEntries(
    objectTypeDistribution.map((item: any, index: number) => [
      item.type,
      {
        label: item.type,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      },
    ])
  ) satisfies ChartConfig;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-chart-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Generations
            </CardTitle>
            <Video className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalGenerations}</div>
            <p className="text-xs text-muted-foreground">
              Video generation attempts
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saves</CardTitle>
            <Save className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSaves}</div>
            <p className="text-xs text-muted-foreground">
              Saved to asset library
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Saves per generation
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              Successful generations
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Generation Time
            </CardTitle>
            <Clock className="h-4 w-4 text-chart-5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(summary.averageGenerationTime / 1000)}s
            </div>
            <p className="text-xs text-muted-foreground">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Downloads
            </CardTitle>
            <Download className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDownloads}</div>
            <p className="text-xs text-muted-foreground">Videos downloaded</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inspiration Usage
            </CardTitle>
            <Film className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {featureAdoption.inspirationPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              With inspiration images
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-chart-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Multi-Asset Mode
            </CardTitle>
            <Users className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {featureAdoption.multiAssetPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              Multiple assets used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Usage Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-chart-1" />
              Usage Over Time
            </CardTitle>
            <CardDescription>
              Video generations, saves, and downloads over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={usageOverTimeConfig} className="h-[300px]">
              <AreaChart
                data={usageOverTime}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="fillGenerations"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillSaves" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillDownloads"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="generations"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#fillGenerations)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="saves"
                  stroke="hsl(var(--chart-2))"
                  fill="url(#fillSaves)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="downloads"
                  stroke="hsl(var(--chart-3))"
                  fill="url(#fillDownloads)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Conversion Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-2" />
              Conversion Rate Trend
            </CardTitle>
            <CardDescription>
              Save-to-generation ratio over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={conversionConfig} className="h-[300px]">
              <LineChart
                data={conversionRateTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value: any) => `${value}%`}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="conversionRate"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Resolution Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-chart-3" />
              Resolution Distribution
            </CardTitle>
            <CardDescription>
              Popular video resolutions (720p, 1080p)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={resolutionChartConfig}
              className="h-[300px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={resolutionDistribution}
                  dataKey="count"
                  nameKey="resolution"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ resolution, percentage }) =>
                    `${resolution}: ${percentage}%`
                  }
                >
                  {resolutionDistribution.map((_: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Duration Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-chart-4" />
              Duration Distribution
            </CardTitle>
            <CardDescription>Video duration preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={durationChartConfig} className="h-[300px]">
              <BarChart
                data={durationDistribution}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="duration"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Object Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-chart-5" />
              Object Type Distribution
            </CardTitle>
            <CardDescription>
              Most common object types in videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={objectTypeChartConfig}
              className="h-[300px]"
            >
              <BarChart
                data={objectTypeDistribution}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  dataKey="type"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={70}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-3))"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-chart-2" />
              Top Users
            </CardTitle>
            <CardDescription>Most active video generators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsers.slice(0, 5).map((user: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.client}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-chart-1">
                      {user.generations}
                    </div>
                    <div className="text-xs text-muted-foreground">videos</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Generations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Generations</CardTitle>
          <CardDescription>Last 20 video generation attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead>Downloaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailedGenerations.slice(0, 20).map((gen: any) => (
                  <TableRow key={gen.id}>
                    <TableCell className="font-medium">{gen.date}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {gen.time}
                    </TableCell>
                    <TableCell>{gen.client}</TableCell>
                    <TableCell className="text-sm">{gen.email}</TableCell>
                    <TableCell>{gen.objectType}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{gen.resolution}</Badge>
                    </TableCell>
                    <TableCell>{gen.duration}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          gen.status === "success" ? "default" : "destructive"
                        }
                      >
                        {gen.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {gen.saved ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {gen.downloaded ? (
                        <Download className="h-4 w-4 text-blue-500" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
