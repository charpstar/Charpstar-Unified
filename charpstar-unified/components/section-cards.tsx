import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Total Revenue */}
      <Card
        className="
      w-[260px] 
      rounded-2xl
      shadow-sm 
      p-4
      border 
      font-sans
      transition
      duration-150
      bg-[oklch(var(--card))]
      text-[oklch(var(--card-foreground))]
      font-semibold    
    "
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-[15px] font-medium text-muted-foreground">
            Total Revenue
          </span>
          <span
            className="
          flex items-center gap-1 px-2 py-0.5 rounded-full 
          text-xs font-medium 
          border border-[oklch(var(--border))]
          bg-[oklch(var(--background))]
          shadow-sm
        "
          >
            <IconTrendingUp className="w-4 h-4" />
            +12.5%
          </span>
        </div>
        <div className="text-2xl font-semibold mb-3 leading-tight text-[oklch(var(--foreground))] ">
          $1,250.00
        </div>
        <div className="flex items-center gap-2 font-semibold text-[15px] mb-0.5 text-[oklch(var(--foreground))]">
          Trending up this month
          <IconTrendingUp className="w-4 h-4" />
        </div>
        <div className="text-sm text-muted-foreground">
          Visitors for the last 6 months
        </div>
      </Card>

      {/* New Customers */}
      <Card
        className="
      w-[260px] 
      rounded-2xl
      shadow-sm 
      p-4
      border 
      font-sans
      transition
      duration-150
      bg-[oklch(var(--card))]
      text-[oklch(var(--card-foreground))]
      font-semibold    
    "
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-[15px] font-medium text-muted-foreground">
            New Customers
          </span>
          <span
            className="
          flex items-center gap-1 px-2 py-0.5 rounded-full 
          text-xs font-medium 
          border border-[oklch(var(--border))]
          bg-[oklch(var(--background))]
          shadow-sm

        "
          >
            <IconTrendingDown className="w-4 h-4" />
            -20%
          </span>
        </div>
        <div className="text-2xl font-semibold mb-3 leading-tight text-[oklch(var(--foreground))]">
          1,234
        </div>
        <div className="flex items-center gap-2 font-semibold text-[15px] mb-0.5 text-[oklch(var(--foreground))]">
          Down 20% this period
          <IconTrendingDown className="w-4 h-4" />
        </div>
        <div className="text-sm text-muted-foreground">
          Acquisition needs attention
        </div>
      </Card>

      {/* Active Accounts */}
      <Card
        className="
      w-[260px] 
      rounded-2xl
      shadow-sm 
      p-4
      border 
      font-sans
      transition
      duration-150
      bg-[oklch(var(--card))]
      text-[oklch(var(--card-foreground))]
      font-semibold    
    "
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-[15px] font-medium text-muted-foreground">
            Active Accounts
          </span>
          <span
            className="
          flex items-center gap-1 px-2 py-0.5 rounded-full 
          text-xs font-medium 
          border border-[oklch(var(--border))]
          bg-[oklch(var(--background))]
          shadow-sm
        "
          >
            <IconTrendingUp className="w-4 h-4" />
            +12.5%
          </span>
        </div>
        <div className="text-2xl font-semibold mb-3 leading-tight text-[oklch(var(--foreground))]">
          45,678
        </div>
        <div className="flex items-center gap-2 font-semibold text-[15px] mb-0.5 text-[oklch(var(--foreground))]">
          Strong user retention
          <IconTrendingUp className="w-4 h-4" />
        </div>
        <div className="text-sm text-muted-foreground">
          Engagement exceed targets
        </div>
      </Card>

      {/* Growth Rate */}
      <Card
        className="
      w-[260px] 
      rounded-2xl
      shadow-sm 
      p-4
      border 
      font-sans
      transition
      duration-150
      bg-[oklch(var(--card))]
      text-[oklch(var(--card-foreground))]
      font-semibold    
    "
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-[15px] font-medium text-muted-foreground">
            Growth Rate
          </span>
          <span
            className="
          flex items-center gap-1 px-2 py-0.5 rounded-full 
          text-xs font-medium 
          border border-[oklch(var(--border))]
          bg-[oklch(var(--background))]
          shadow-sm
        "
          >
            <IconTrendingUp className="w-4 h-4" />
            +4.5%
          </span>
        </div>
        <div className="text-2xl font-semibold mb-3 leading-tight text-[oklch(var(--foreground))]">
          4.5%
        </div>
        <div className="flex items-center gap-2 font-semibold text-[15px] mb-0.5 text-[oklch(var(--foreground))]">
          Steady performance increase
          <IconTrendingUp className="w-4 h-4" />
        </div>
        <div className="text-sm text-muted-foreground">
          Meets growth projections
        </div>
      </Card>
    </div>
  );
}
