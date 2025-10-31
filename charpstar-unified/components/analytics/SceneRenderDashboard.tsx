"use client";

import { SceneRenderStats } from "./SceneRenderStats";
import { UsageOverTimeChart } from "./UsageOverTimeChart";
import { TopUsersChart } from "./TopUsersChart";
import { FormatDistributionChart } from "./FormatDistributionChart";
import { ConversionRateChart } from "./ConversionRateChart";
import { SceneRendersTable } from "./SceneRendersTable";

interface SceneRenderDashboardProps {
  data: {
    summary: {
      totalRenders: number;
      totalSaves: number;
      conversionRate: number;
      averageGenerationTime: number;
      successRate: number;
    };
    usageOverTime: Array<{
      date: string;
      renders: number;
      saves: number;
    }>;
    topUsers: Array<{
      client: string;
      email: string;
      renders: number;
      saves: number;
      conversionRate: number;
    }>;
    formatDistribution: Array<{
      format: string;
      count: number;
      percentage: number;
    }>;
    conversionRateTrend: Array<{
      date: string;
      conversionRate: number;
    }>;
    detailedRenders: Array<{
      id: string;
      date: string;
      time: string;
      client: string;
      email: string;
      objectType: string;
      format: string;
      status: string;
      saved: boolean;
      generationTime: number;
      errorMessage?: string;
    }>;
  };
}

export function SceneRenderDashboard({ data }: SceneRenderDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SceneRenderStats
          title="Total Renders"
          value={data.summary.totalRenders}
          icon={BarChart3}
          description="Scene render attempts"
        />
        <SceneRenderStats
          title="Total Saves"
          value={data.summary.totalSaves}
          icon={Save}
          description="Scenes saved to library"
        />
        <SceneRenderStats
          title="Conversion Rate"
          value={`${data.summary.conversionRate}%`}
          icon={TrendingUp}
          description="Saves per render"
        />
        <SceneRenderStats
          title="Avg Generation Time"
          value={`${Math.round(data.summary.averageGenerationTime / 1000)}s`}
          icon={Clock}
          description="Average processing time"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Usage Over Time</h3>
          <UsageOverTimeChart data={data.usageOverTime} />
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Conversion Rate Trend</h3>
          <ConversionRateChart data={data.conversionRateTrend} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Top Users</h3>
          <TopUsersChart data={data.topUsers} />
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Format Distribution</h3>
          <FormatDistributionChart data={data.formatDistribution} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recent Renders</h3>
        <SceneRendersTable data={data.detailedRenders} />
      </div>
    </div>
  );
}

// Import icons
import { BarChart3, Save, TrendingUp, Clock } from "lucide-react";
