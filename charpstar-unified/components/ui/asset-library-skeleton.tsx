import { AssetCardSkeleton } from "./asset-card-skeleton";

export function AssetLibrarySkeleton() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
          <div className="h-10 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <AssetCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
