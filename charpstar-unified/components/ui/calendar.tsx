"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-2 w-full",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 transition-opacity duration-200 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-medium text-xs tracking-wide text-center",
        row: "flex w-full mt-1",
        cell: [
          "h-9 w-9 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-accent/30",
          "[&:has([aria-selected])]:bg-accent/60",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
        ].join(" "),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          [
            "h-9 w-9 p-0 font-normal transition-all duration-150",
            "aria-selected:opacity-100 aria-selected:bg-primary/80 aria-selected:text-primary-foreground",
            "hover:bg-primary/10 hover:text-primary focus:bg-primary/20",
          ].join(" ")
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary focus:bg-primary",
        day_today:
          "border-2 border-primary bg-accent text-accent-foreground font-semibold",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled:
          "text-muted-foreground opacity-30 line-through pointer-events-none",
        day_range_middle:
          "aria-selected:bg-accent/80 aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...(classNames || {}),
      }}
      components={{
        IconLeft: ({ ...props }) => (
          <ChevronLeft className="h-4 w-4 cursor-pointer" />
        ),
        IconRight: ({ ...props }) => (
          <ChevronRight className="h-4 w-4 cursor-pointer" />
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
