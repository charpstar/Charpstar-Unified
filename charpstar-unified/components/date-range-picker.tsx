"use client";

import * as React from "react";

import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import dayjs from "@/utils/dayjs";
import { dayjsToComp } from "@/utils/uiutils";

export function CalendarDateRangePicker({
  className,
  range,
  setRange,
  minDate,
}: React.HTMLAttributes<HTMLDivElement> & {
  range?: DateRange;
  setRange: (range: DateRange | undefined) => void;
  minDate: Date;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !range && "text-muted-foreground"
            )}
          >
            {range?.from && range.to ? (
              <>
                {dayjsToComp(dayjs(range.from))} -{" "}
                {dayjsToComp(dayjs(range.to))}
              </>
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
            disabled={{
              after: new Date(),
              before: minDate,
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
