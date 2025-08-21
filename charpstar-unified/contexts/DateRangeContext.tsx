"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { addDays } from "date-fns";

interface DateRangeContextType {
  pendingRange: DateRange;
  appliedRange: DateRange;
  setPendingRange: (range: DateRange) => void;
  setAppliedRange: (range: DateRange) => void;
  isApplyDisabled: boolean;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(
  undefined
);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const today = new Date();
  const thirtyDaysAgo = addDays(today, -30);

  const [pendingRange, setPendingRange] = useState<DateRange>({
    from: thirtyDaysAgo,
    to: today,
  });
  const [appliedRange, setAppliedRange] = useState<DateRange>(pendingRange);

  // Only enable Apply if pending != applied
  const isApplyDisabled =
    (pendingRange.from?.getTime() || 0) ===
      (appliedRange.from?.getTime() || 0) &&
    (pendingRange.to?.getTime() || 0) === (appliedRange.to?.getTime() || 0);

  return (
    <DateRangeContext.Provider
      value={{
        pendingRange,
        appliedRange,
        setPendingRange,
        setAppliedRange,
        isApplyDisabled,
      }}
    >
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
