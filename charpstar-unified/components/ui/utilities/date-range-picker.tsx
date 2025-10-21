"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/display";
import { Calendar } from "./calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";

interface DateRangePickerProps {
  className?: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
}

export function DateRangePicker({
  className,
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates = [],
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size="sm"
            className={cn(
              "w-[300px] justify-start text-left font-normal text-xs cursor-pointer bg-background dark:bg-background h-8 px-3 py-1",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y")} -{" "}
                  {format(value.to, "LLL dd, y")}
                </>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            fromDate={minDate}
            toDate={maxDate}
            disabled={disabledDates}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
