import { Layers, Box, Palette } from "lucide-react";

export function ThreeDEditorSkeleton({
  isMobile = false,
}: {
  isMobile?: boolean;
}) {
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile FABs skeleton */}
        <div className="fixed bottom-4 left-4 z-30">
          <div className="w-12 h-12 bg-background border border-border rounded-full shadow-lg animate-pulse" />
        </div>
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
          <div className="w-12 h-12 bg-background border border-border rounded-full shadow-lg animate-pulse" />
        </div>
        <div className="fixed bottom-4 right-4 z-30">
          <div className="w-12 h-12 bg-background border border-border rounded-full shadow-lg animate-pulse" />
        </div>

        {/* Mobile 3D Viewer skeleton */}
        <div className="flex-1 p-2 bg-background relative">
          <div className="h-[60vh] rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
            <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted/70 rounded-full mx-auto mb-4 animate-pulse" />
                <div className="h-4 w-32 bg-muted/70 rounded mx-auto mb-2 animate-pulse" />
                <div className="h-3 w-24 bg-muted/70 rounded mx-auto animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Left panel - Scene Hierarchy skeleton */}
      <div className="w-64 bg-background shadow-md overflow-hidden flex flex-col">
        <div className="bg-background p-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <Layers size={18} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">
              Scene Hierarchy
            </h3>
          </div>
        </div>
        <div className="p-3 flex-1 overflow-auto">
          {/* Scene tree skeleton items */}
          <div className="h-full bg-muted/70 rounded animate-pulse" />
        </div>
      </div>

      {/* Center panel - 3D Viewer skeleton */}
      <div className="flex-1 bg-background shadow-md overflow-hidden relative p-4 ">
        <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="w-20 h-20 bg-muted/70 rounded-full mx-auto mb-6 animate-pulse" />
            <div className="h-5 w-40 bg-muted/70 rounded mx-auto mb-3 animate-pulse" />
            <div className="h-4 w-32 bg-muted/70 rounded mx-auto animate-pulse" />
          </div>
        </div>

        {/* Overlay buttons skeleton */}
      </div>

      {/* Right side panels container */}
      <div className="flex mr-2">
        {/* Variant panel skeleton */}
        <div className="w-64 bg-background shadow-md overflow-hidden flex flex-col">
          <div className="bg-background p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <Box size={18} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Variants</h3>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-auto">
            <div className="h-full bg-muted/70 rounded animate-pulse" />
          </div>
        </div>

        {/* Material panel skeleton */}
        <div className="w-80 bg-background shadow-md ml-2 overflow-hidden flex flex-col">
          <div className="bg-background p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <Palette size={18} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">
                Material Properties
              </h3>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-auto">
            <div className="h-full bg-muted/70 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
