"use client";

import React from "react";
import { useTimeOverride } from "@/contexts/TimeOverrideContext";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { Clock, X } from "lucide-react";
import { format } from "date-fns";

export function TimeOverrideIndicator() {
  const { isOverridden, overrideTime, clearOverride } = useTimeOverride();

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isOverridden) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2 shadow-lg">
      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <div className="flex flex-col">
        <Badge variant="secondary" className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
          TEST MODE
        </Badge>
        <span className="text-xs text-yellow-700 dark:text-yellow-300">
          {overrideTime && format(overrideTime, "MMM dd, yyyy 'at' HH:mm")}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearOverride}
        className="h-6 w-6 p-0 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-800"
        title="Clear time override"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
