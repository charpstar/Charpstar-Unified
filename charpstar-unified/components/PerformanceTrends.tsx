"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMonthlyTrends } from "@/queries/useMonthlyTrends";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { useTheme } from "next-themes";

export default function PerformanceTrends() {
  const { data: trends, isLoading } = useMonthlyTrends();
  const { resolvedTheme } = useTheme(); // 'light' or 'dark'

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
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <TrendingUp className="h-4 w-4" />
          Performance Trends ( Last 6 months )
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 10,
                right: 10,
                left: 10,
                bottom: 20,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-muted"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor:
                    resolvedTheme === "dark" ? "#18181b" : "#fff",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.09)",
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                }}
                itemStyle={{
                  color: "hsl(var(--foreground))",
                  fontSize: "0.875rem",
                }}
              />

              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                dataKey="AR"
                fill="#414143"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.9}
              />
              <Bar
                dataKey="3D"
                fill="#939395"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.9}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
