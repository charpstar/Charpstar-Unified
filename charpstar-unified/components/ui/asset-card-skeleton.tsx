import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AssetCardSkeleton() {
  return (
    <Card className="group flex flex-col h-full overflow-hidden border-border/50">
      <CardHeader className="p-0">
        <div className="h-40 w-full bg-muted rounded-t-lg animate-pulse" />
      </CardHeader>
      <CardContent className="flex-1 p-4 space-y-3">
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="mt-auto pt-4 flex items-center gap-2">
          <div className="h-9 flex-1 bg-muted rounded animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
