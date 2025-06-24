import { Card, CardContent, CardHeader } from "@/components/ui/containers";

export function AssetCardSkeleton() {
  return (
    <Card className="group flex flex-col h-full overflow-hidden border-border/50">
      <CardHeader className="p-0">
        <div className="h-140 w-full bg-muted rounded-t-lg animate-pulse" />
      </CardHeader>
      <CardContent className="flex-1 p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="flex justify-between items-center gap-2">
          <div className="h-10 w-90 bg-muted rounded animate-pulse" />
          <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
