"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30",
      "shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.1),inset_0_1px_2px_0_rgba(0,0,0,0.06)]",
      "dark:shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.3),inset_0_1px_2px_0_rgba(0,0,0,0.2)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 border border-border switch-thumb-spring",
        "bg-white dark:bg-gray-200",
        "shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.05)]",
        "dark:shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.1)]"
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
