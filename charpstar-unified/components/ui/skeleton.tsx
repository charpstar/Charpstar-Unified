import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      className={cn(
        "p-4 border border-border rounded-lg shadow animate-pulse md:p-6 dark:border-border bg-muted dark:bg-background",
        className
      )}
      {...props}
    >
      <div className="h-8 w-full bg-gray-100 rounded-lg dark:bg-muted mb-2.5"></div>
      <div className="h-6 w-full bg-gray-100 rounded-lg dark:bg-muted"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export { Skeleton };

export function TableSkeleton() {
  return (
    <div
      role="status"
      className="p-4 border w-full h-full border-border rounded-lg shadow animate-pulse md:p-6 dark:border-border bg-muted dark:bg-background"
    >
      {/* Header row */}
      <div className="flex gap-4 mb-4 w-full">
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        <div className="h-8 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
      </div>

      {/* Table rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3 w-full">
          <div className="h-6 w-full bg-gray-200 rounded-lg dark:bg-muted"></div>
        </div>
      ))}

      <span className="sr-only">Loading table...</span>
    </div>
  );
}
