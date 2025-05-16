"use client";

import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";

export default function AnalyticsDashboard() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Page Views" value={570824} />
        <StatCard title="Total Unique Users" value={188481} />
        <StatCard title="Total Users who activate our services" value={11367} />
        <StatCard
          title="Percentage of users using our service"
          value={6.03}
          suffix="%"
        />
        <StatCard
          title="Conversion rate without AR/3D activation"
          value={0.79}
          suffix="%"
        />
        <StatCard
          title="Conversion rate with AR/3D activation"
          value={1.34}
          suffix="%"
        />
        <StatCard title="Total Purchases with AR/3D activation" value={324} />
        <StatCard title="Add to Cart Default" value={4.58} suffix="%" />
        <StatCard title="Add to Cart with CharpstAR" value={16.28} suffix="%" />
        <StatCard
          title="Average Order Value without AR/3D activation"
          value="4 569,47"
          suffix="(Store currency)"
        />
        <StatCard
          title="Average Order Value with AR/3D activation"
          value="10 114,57"
          suffix="(Store currency)"
        />
        <StatCard title="Total AR Clicks" value={9026} />
        <StatCard title="Total 3D Clicks" value={15195} />
        <StatCard
          title="Session time duration without AR/3D activation"
          value={9.97}
          suffix="seconds"
        />
        <StatCard
          title="Session time duration with AR/3D activation"
          value={132.23}
          suffix="seconds"
        />
      </div>
    </div>
  );
}
