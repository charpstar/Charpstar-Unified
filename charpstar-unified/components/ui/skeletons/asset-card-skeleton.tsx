import { Card, CardHeader } from "@/components/ui/containers";

export function AssetCardSkeleton() {
  return (
    <Card className="group flex flex-col h-full overflow-hidden border-border/50 min-h-[220px] min-w-[220px]">
      <CardHeader className="p-2">
        <div className="relative rounded-xl overflow-hidden bg-muted w-full h-30 animate-pulse" />
      </CardHeader>
      <CardHeader className="p-2">
        <div className="relative rounded-xl overflow-hidden bg-muted w-full h-10 animate-pulse" />
      </CardHeader>
    </Card>
  );
}
