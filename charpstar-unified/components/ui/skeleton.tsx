import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md animate-pulse",
        className
      )}
      {...props}
    >
      <div className="h-10 w-1/3 rounded bg-muted/30" />
      <div className="mt-4 h-10 w-1/2 rounded bg-primary/15" />
    </div>
  );
}

export { Skeleton };
