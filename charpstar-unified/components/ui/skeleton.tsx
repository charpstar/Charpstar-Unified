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
      <div className="h-8 w-full bg-background rounded-lg dark:bg-muted mb-2.5"></div>
      <div className="h-6 w-full bg-background rounded-lg dark:bg-muted"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export { Skeleton };

export function TableSkeleton() {
  return (
    <div
      role="status"
      className="p-4 border border-gray-200 rounded shadow animate-pulse md:p-6 dark:border-gray-700"
    >
      <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700 mb-2.5"></div>
      <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700 mb-2.5"></div>
      <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
