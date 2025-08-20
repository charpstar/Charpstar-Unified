"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  getCurrentTime, 
  isTimeOverridden, 
  getOverrideTime, 
  parseTimeFromURL,
  clearTimeOverride 
} from "@/lib/timeOverride";

interface TimeOverrideContextType {
  currentTime: Date;
  isOverridden: boolean;
  overrideTime: Date | null;
  clearOverride: () => void;
  refreshTime: () => void;
}

const TimeOverrideContext = createContext<TimeOverrideContextType | undefined>(undefined);

export function TimeOverrideProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTime] = useState<Date>(getCurrentTime());
  const [isOverridden, setIsOverridden] = useState<boolean>(isTimeOverridden());
  const [overrideTime, setOverrideTimeState] = useState<Date | null>(getOverrideTime());

  // Parse URL parameters on mount and when URL changes
  useEffect(() => {
    parseTimeFromURL();
    updateTimeState();

    // Listen for URL changes
    const handleUrlChange = () => {
      parseTimeFromURL();
      updateTimeState();
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Update time every second when not overridden
  useEffect(() => {
    if (!isOverridden) {
      const interval = setInterval(() => {
        setCurrentTime(getCurrentTime());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOverridden]);

  const updateTimeState = () => {
    setCurrentTime(getCurrentTime());
    setIsOverridden(isTimeOverridden());
    setOverrideTimeState(getOverrideTime());
  };

  const clearOverride = () => {
    clearTimeOverride();
    updateTimeState();
  };

  const refreshTime = () => {
    updateTimeState();
  };

  return (
    <TimeOverrideContext.Provider
      value={{
        currentTime,
        isOverridden,
        overrideTime,
        clearOverride,
        refreshTime,
      }}
    >
      {children}
    </TimeOverrideContext.Provider>
  );
}

export function useTimeOverride() {
  const context = useContext(TimeOverrideContext);
  if (context === undefined) {
    throw new Error("useTimeOverride must be used within a TimeOverrideProvider");
  }
  return context;
}
