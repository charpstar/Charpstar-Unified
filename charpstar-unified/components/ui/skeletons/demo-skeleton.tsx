import { Palette } from "lucide-react";

export function DemoPageSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile Top Bar skeleton */}
        <div className="flex items-center justify-between p-2 border-b border-border bg-card">
          <div className="h-8 w-16 bg-muted/70 rounded animate-pulse" />
          <div className="flex-1 flex justify-center">
            <div className="h-6 w-24 bg-muted/70 rounded animate-pulse" />
          </div>
          <div className="h-8 w-16 bg-muted/70 rounded animate-pulse" />
        </div>

        {/* Mobile 3D Viewer skeleton */}
        <div className="flex-1 p-2 bg-card relative">
          <div className="h-full rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
            <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted/70 rounded-full mx-auto mb-4 animate-pulse" />
                <div className="h-4 w-32 bg-muted/70 rounded mx-auto mb-2 animate-pulse" />
                <div className="h-3 w-24 bg-muted/70 rounded mx-auto animate-pulse" />
              </div>
            </div>
          </div>

          {/* Floating Action Button skeleton */}
          <div className="fixed bottom-4 right-4 z-30">
            <div className="w-12 h-12 bg-card border border-border rounded-full shadow-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full max-h-[calc(100vh]">
      {/* Left side - Model navigation skeleton */}
      <div className="w-1/10 border-r border-border bg-card shadow-inner flex flex-col">
        {/* Search and Filter Controls skeleton */}
        <div className="w-60 bg-background shadow-md ml-2 overflow-hidden flex flex-col">
          <div className="bg-background p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-foreground">
                Model Catalog
              </h3>
            </div>
            <div className="flex-1 pr-5 overflow-auto">
              <div className="h-8 mt-4 w-full bg-muted/70 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Model List skeleton */}
        <div className="flex-1 overflow-y-auto scrollbar-none p-4">
          <div className="h-full bg-muted/70 rounded animate-pulse" />
        </div>
      </div>

      {/* Center - 3D Viewer skeleton */}
      <div className="flex-1 p-4 bg-background h-full max-h-[calc(100vh-100px)]">
        <div className="h-full rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
          <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
            <div className="text-center"></div>
          </div>
        </div>
      </div>

      {/* Right side - Variants panel skeleton */}
      <div className="w-60 bg-background shadow-md  overflow-hidden flex flex-col">
        <div className="bg-background p-2 border-b border-border">
          <div className="flex items-center space-x-1.5">
            <Palette size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-medium text-foreground">
              Material Properties
            </h3>
          </div>
        </div>
        <div className="p-3 flex-1 overflow-auto">
          <div className="h-full bg-muted/70 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
