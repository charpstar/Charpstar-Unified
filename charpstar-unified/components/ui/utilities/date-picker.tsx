"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/display";
import { Calendar } from "./calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";

interface DatePickerProps {
  className?: string;
  value?: Date;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disabled?: boolean;
}

export function DatePicker({
  className,
  value,
  onChange,
  placeholder = "Pick a date",
  minDate,
  maxDate,
  disabledDates = [],
  disabled = false,
}: DatePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal cursor-pointer bg-background dark:bg-background",
              !value && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 z-[9999]"
          align="start"
          sideOffset={4}
          style={{ zIndex: 9999 }}
        >
          <Calendar
            initialFocus
            mode="single"
            defaultMonth={value}
            selected={value}
            onSelect={onChange}
            fromDate={minDate}
            toDate={maxDate}
            disabled={disabledDates}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
