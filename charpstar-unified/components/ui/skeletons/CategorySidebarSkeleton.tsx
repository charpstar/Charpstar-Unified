import React from "react";

// Adjust classes for your theme as needed!
export const CategorySidebarSkeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <div
    className={`w-62 h-cover bg-muted/30 border-r border-border p-4 space-y-4 ${className}`}
  >
    {/* Header Skeleton */}
    <div className="pb-3 border-b border-border">
      <div className=" w-32 bg-foreground  animate-pulse" />
      <span className="text-foreground font-bold">Categories</span>
      <div className=" w-24 bg-foreground  animate-pulse" />
      <span className="text-muted-foreground text-sm">Browse by category</span>
      <div className=" w-24 bg-foreground  animate-pulse" />
    </div>

    {/* All Categories Button Skeleton */}
    <div>
      <div className="flex items-center w-full h-10 px-3 rounded bg-muted/90 animate-pulse mb-1">
        <div className="h-4 w-4 bg-muted/60 rounded mr-2" />
        <div className="h-4 w-28 bg-muted/60 rounded" />
        <div className="ml-auto h-4 w-6 bg-muted/70 rounded" />
      </div>
    </div>

    {/* Separator */}
    <div className="border-t border-border/50" />

    {/* Categories List Skeleton */}
    <div>
      <div className="border border-border/50 rounded-md bg-background/50 max-h-[800px] overflow-y-auto">
        <div className="p-1 space-y-1">
          {/* Simulate 4 category rows, each possibly with subcategories */}
          {[...Array(16)].map((_, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center w-full h-10 px-3 rounded bg-muted/40 animate-pulse mb-1">
                <div className="h-4 w-4 bg-muted/60 rounded mr-2" />
                <div className="h-4 w-20 bg-muted/60 rounded" />
                <div className="ml-auto h-4 w-4 bg-muted/70 rounded" />
              </div>
              {/* Simulate open subcategory tree for the first item */}
              {idx === 0 && (
                <div className="pl-6 space-y-1">
                  <div className="flex items-center w-full h-8 px-3 rounded bg-muted/30 animate-pulse mb-1"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Footer Skeleton */}
    <div className="pt-3 border-t border-border">
      <div className="h-4 w-20 bg-muted/40 rounded animate-pulse mb-1" />
      <div className="h-4 w-16 bg-muted/40 rounded animate-pulse" />
    </div>
  </div>
);
