"use client";

import React, { createContext, useContext, useState } from "react";
import { buildDateRange } from "@/utils/uiutils";
import { useUser } from "@/contexts/useUser";
import dayjs from "@/utils/dayjs";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(
  undefined
);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const monitoredSince =
    user?.metadata?.analytics_profiles?.[0]?.monitoredsince;

  const [dateRange, setDateRange] = useState<DateRange>(() =>
    buildDateRange(monitoredSince ? dayjs(monitoredSince) : undefined)
  );

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}
