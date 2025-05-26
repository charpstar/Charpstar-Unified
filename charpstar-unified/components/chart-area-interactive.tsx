// "use client";

// import * as React from "react";
// import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

// import { useIsMobile } from "@/hooks/use-mobile";
// import {
//   Card,
//   CardAction,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   ChartContainer,
//   ChartTooltip,
//   ChartTooltipContent,
// } from "@/components/ui/chart";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// export interface ChartDataItem {
//   date: string;
//   pageViews: number;
//   uniqueUsers: number;
//   arClicks: number;
//   threeDClicks: number;
// }

// interface ChartMetricConfig {
//   label: string;
//   color: string;
// }

// type MetricKey = "pageViews" | "uniqueUsers" | "arClicks" | "threeDClicks";

// interface ChartConfigType {
//   analytics: {
//     label: string;
//   };
//   pageViews: ChartMetricConfig;
//   uniqueUsers: ChartMetricConfig;
//   arClicks: ChartMetricConfig;
//   threeDClicks: ChartMetricConfig;
// }

// interface ChartAreaInteractiveProps {
//   data: ChartDataItem[];
//   onTimeRangeChange: (range: "1d" | "7d" | "30d") => void;
//   timeRange: "1d" | "7d" | "30d";
// }

// const timeRangeLabels: Record<ChartAreaInteractiveProps["timeRange"], string> =
//   {
//     "1d": "Last 24 Hours",
//     "7d": "Last 7 Days",
//     "30d": "Last 30 Days",
//   };

// const chartConfig: ChartConfigType = {
//   analytics: {
//     label: "Usage Analytics",
//   },
//   pageViews: {
//     label: "Page Views",
//     color: "var(--blue-600)",
//   },
//   uniqueUsers: {
//     label: "Unique Users",
//     color: "var(--green-600)",
//   },
//   arClicks: {
//     label: "AR Clicks",
//     color: "var(--purple-600)",
//   },
//   threeDClicks: {
//     label: "3D Clicks",
//     color: "var(--orange-600)",
//   },
// };

// export function ChartAreaInteractive({
//   data,
//   onTimeRangeChange,
//   timeRange,
// }: ChartAreaInteractiveProps) {
//   const isMobile = useIsMobile();

//   return (
//     <Card className="@container/card">
//       <CardHeader>
//         <CardTitle>Usage Analytics</CardTitle>
//         <CardDescription>Tracking key metrics over time</CardDescription>
//         <CardAction>
//           <ToggleGroup
//             type="single"
//             value={timeRange}
//             onValueChange={(value) =>
//               value && onTimeRangeChange(value as "1d" | "7d" | "30d")
//             }
//             variant="outline"
//             className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
//           >
//             <ToggleGroupItem value="30d">
//               {timeRangeLabels["30d"]}
//             </ToggleGroupItem>
//             <ToggleGroupItem value="7d">
//               {timeRangeLabels["7d"]}
//             </ToggleGroupItem>
//             <ToggleGroupItem value="1d">
//               {timeRangeLabels["1d"]}
//             </ToggleGroupItem>
//           </ToggleGroup>
//           <Select
//             value={timeRange}
//             onValueChange={(value) =>
//               onTimeRangeChange(value as "1d" | "7d" | "30d")
//             }
//           >
//             <SelectTrigger
//               className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
//               size="sm"
//               aria-label="Select time range"
//             >
//               <SelectValue placeholder={timeRangeLabels[timeRange]} />
//             </SelectTrigger>
//             <SelectContent className="rounded-xl">
//               <SelectItem value="30d" className="rounded-lg">
//                 {timeRangeLabels["30d"]}
//               </SelectItem>
//               <SelectItem value="7d" className="rounded-lg">
//                 {timeRangeLabels["7d"]}
//               </SelectItem>
//               <SelectItem value="1d" className="rounded-lg">
//                 {timeRangeLabels["1d"]}
//               </SelectItem>
//             </SelectContent>
//           </Select>
//         </CardAction>
//       </CardHeader>
//       <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
//         <ChartContainer
//           config={chartConfig as ChartConfig}
//           className="aspect-auto h-[250px] w-full"
//         >
//           <AreaChart data={data}>
//             <defs>
//               {(Object.keys(chartConfig) as (keyof ChartConfigType)[]).map(
//                 (key) => {
//                   if (key === "analytics") return null;
//                   const config = chartConfig[key] as ChartMetricConfig;
//                   return (
//                     <linearGradient
//                       key={key}
//                       id={`fill${key}`}
//                       x1="0"
//                       y1="0"
//                       x2="0"
//                       y2="1"
//                     >
//                       <stop
//                         offset="5%"
//                         stopColor={config.color}
//                         stopOpacity={0.8}
//                       />
//                       <stop
//                         offset="95%"
//                         stopColor={config.color}
//                         stopOpacity={0.1}
//                       />
//                     </linearGradient>
//                   );
//                 }
//               )}
//             </defs>
//             <CartesianGrid vertical={false} />
//             <XAxis
//               dataKey="date"
//               tickLine={false}
//               axisLine={false}
//               tickMargin={8}
//               minTickGap={32}
//               tickFormatter={(date) => {
//                 const d = new Date(date);
//                 return d.toLocaleDateString("en-US", {
//                   month: "short",
//                   day: "numeric",
//                 });
//               }}
//             />
//             <ChartTooltip
//               cursor={false}
//               content={<ChartTooltipContent indicator="dot" />}
//               labelFormatter={(label) => {
//                 const d = new Date(label);
//                 return d.toLocaleDateString("en-US", {
//                   weekday: "long",
//                   year: "numeric",
//                   month: "long",
//                   day: "numeric",
//                 });
//               }}
//             />
//             {(Object.keys(chartConfig) as (keyof ChartConfigType)[]).map(
//               (key) => {
//                 if (key === "analytics") return null;
//                 const config = chartConfig[key] as ChartMetricConfig;
//                 return (
//                   <Area
//                     key={key}
//                     dataKey={key}
//                     name={config.label}
//                     type="monotone"
//                     fill={`url(#fill${key})`}
//                     stroke={config.color}
//                   />
//                 );
//               }
//             )}
//           </AreaChart>
//         </ChartContainer>
//       </CardContent>
//     </Card>
//   );
// }
