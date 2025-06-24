"use client";

import { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/display";
import { cn } from "@/lib/utils";

interface CalendarTourNotificationProps {
  onDismiss: () => void;
  className?: string;
}

export function CalendarTourNotification({
  onDismiss,
  className,
}: CalendarTourNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure the calendar is rendered
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    if (isVisible) {
      const autoDismissTimer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for animation
      }, 5000);

      return () => clearTimeout(autoDismissTimer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute z-50 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 shadow-lg max-w-xs animate-in slide-in-from-bottom-2 duration-300",
        "transform translate-y-2", // Position it slightly below
        className
      )}
      style={{
        top: "100%",
        right: "0px",
        marginTop: "8px",
      }}
    >
      {/* Arrow pointing up to calendar */}
      <div className="absolute top-0 right-4 transform -translate-y-full">
        <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-blue-200 dark:border-b-blue-800"></div>
      </div>

      <div className="flex items-start gap-2">
        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Date Range Picker
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Click here to select your date range for analytics data
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300); // Wait for animation
          }}
          className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
