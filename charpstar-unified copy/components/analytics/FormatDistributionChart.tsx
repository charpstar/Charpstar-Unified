"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface FormatDistributionChartProps {
  data: Array<{
    format: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function FormatDistributionChart({
  data,
}: FormatDistributionChartProps) {
  // Filter out invalid data and ensure valid percentages
  const validData = data.filter(
    (item) =>
      item.count > 0 &&
      !isNaN(item.percentage) &&
      isFinite(item.percentage) &&
      item.format
  );

  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <p>No format data available</p>
      </div>
    );
  }

  const RADIAN = Math.PI / 180;

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={validData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            innerRadius={40}
            fill="#8884d8"
            dataKey="count"
            paddingAngle={2}
          >
            {validData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
            formatter={(value, name, props) => {
              const payload = props.payload;
              return [
                `${value} (${payload?.percentage?.toFixed(1) ?? "0"}%)`,
                "Count",
              ];
            }}
            labelFormatter={(label, payload) =>
              payload && payload[0]
                ? `Format: ${payload[0].payload.format}`
                : ""
            }
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => {
              const entry = validData.find((d) => d.format === value);
              return `${value} (${entry?.percentage?.toFixed(1) ?? "0"}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
