import React from "react";
import { type DateRange } from "react-day-picker";
import { CalendarDateRangePicker } from "@/components/date-range-picker";
import { DateRangeProvider } from "@/contexts/DateRangeContext";

export function DateRangePickerWithContext(
  ...args: Parameters<typeof CalendarDateRangePicker>
) {
  const { children } = args[0];

  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2023, 0, 20),
    to: new Date(2023, 0, 20),
  });

  return (
    <>
      <CalendarDateRangePicker
        range={range}
        setRange={setRange}
        minDate={new Date()}
        {...args}
      />

      <DateRangeProvider dateRange={range}>{children}</DateRangeProvider>
    </>
  );
}
