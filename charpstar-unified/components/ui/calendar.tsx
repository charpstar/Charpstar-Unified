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
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-blue-50 dark:[&:has([aria-selected])]:bg-blue-950",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-range-start)]:rounded-l-md",
          "[&:has([aria-selected].day-range-start)]:bg-teal-600 [&:has([aria-selected].day-range-end)]:bg-teal-600"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          "cursor-pointer",
          "hover:bg-teal-100 hover:text-teal-900 dark:hover:bg-teal-800 dark:hover:text-teal-100",
          "focus:bg-teal-100 focus:text-teal-900 dark:focus:bg-teal-800 dark:focus:text-teal-100 focus:outline-none",
          "active:bg-teal-200 active:text-teal-900 dark:active:bg-teal-700 dark:active:text-teal-100"
        ),
        day_selected:
          "bg-teal-600 text-white hover:bg-teal-700 hover:text-white dark:bg-teal-500 dark:hover:bg-teal-600 font-medium",
        day_today:
          "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 font-medium",
        day_outside: "text-gray-400 dark:text-gray-500 opacity-50",
        day_disabled: "text-gray-300 dark:text-gray-600 opacity-50",
        day_range_start:
          "rounded-l-md bg-blue-600 text-white dark:bg-blue-500 font-medium shadow-sm",
        day_range_end:
          "rounded-r-md bg-teal-600 text-white dark:bg-teal-500 font-medium shadow-sm",
        day_range_middle: "bg-teal-50 dark:bg-teal-900",
        day_hidden: "invisible",
        ...classNames,
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
