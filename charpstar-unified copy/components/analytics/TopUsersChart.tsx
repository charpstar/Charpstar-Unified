"use client";

interface TopUsersChartProps {
  data: Array<{
    client: string;
    email: string;
    renders: number;
    saves: number;
    conversionRate: number;
  }>;
}

const RANK_COLORS = [
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-slate-400/10 text-slate-600 border-slate-400/20",
  "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "bg-purple-500/10 text-purple-600 border-purple-500/20",
];

export function TopUsersChart({ data }: TopUsersChartProps) {
  const getRankStyle = (index: number) => {
    if (index < RANK_COLORS.length) {
      return RANK_COLORS[index];
    }
    return "bg-muted/50 text-muted-foreground border-border";
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <p>No user data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((user, index) => (
        <div
          key={user.client}
          className={`flex items-center gap-4 p-4 rounded-lg border ${getRankStyle(
            index
          )} transition-all hover:shadow-md`}
        >
          {/* Rank Badge */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-background/80">
            {getRankIcon(index)}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">
              {user.client}
            </div>
            {user.email && (
              <div className="text-sm text-muted-foreground truncate">
                {user.email}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {user.renders}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Renders
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {user.saves}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Saves
              </div>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="text-2xl font-bold text-foreground">
                {user.conversionRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Rate
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
