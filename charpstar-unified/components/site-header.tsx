"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { usePathname, useParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useAnalyticsTour } from "@/hooks/use-analytics-tour";
import { CalendarTourNotification } from "@/components/ui/calendar-tour-notification";
import { useState, useEffect } from "react";
import type { DateRange } from "react-day-picker";

const TITLES = {
  "/dashboard": "Dashboard",
  "/analytics": "Analytics",
  "/asset-library": "Asset Library",
  "/users": "Users",
  "/admin": "Admin",
  "/cvr": "CVR",
  "/settings": "Settings",
};

export function SiteHeader() {
  const pathname = usePathname();
  const params = useParams();
  const clientName = params?.id as string;
  const { pendingRange, setPendingRange, setAppliedRange, isApplyDisabled } =
    useDateRange();
  const { showTourNotification, dismissNotification, showNotification } =
    useAnalyticsTour();
  const [isLoaded, setIsLoaded] = useState(false);

  let pageTitle = "Unified";

  if (pathname.startsWith("/3d-editor/")) {
    if (pathname.includes("/demo")) {
      pageTitle = `${clientName} Demo`;
    } else {
      pageTitle = `${clientName} Editor`;
    }
  } else if (
    pathname.startsWith("/asset-library/") &&
    pathname.split("/").length === 3 &&
    !pathname.includes("/upload") &&
    !pathname.includes("/preview-generator")
  ) {
    pageTitle = "Asset Details";
  } else {
    pageTitle = TITLES[pathname as keyof typeof TITLES] || "Unified";
  }

  const isAnalyticsPage = pathname === "/analytics";

  // Set loaded state after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Show tour notification when user first visits analytics page
  useEffect(() => {
    if (!isLoaded) return;

    console.log("Site header effect running:", { isAnalyticsPage, pathname });
    if (isAnalyticsPage) {
      console.log("On analytics page, setting up tour notification");
      // Small delay to ensure the page is fully loaded
      const timer = setTimeout(() => {
        console.log("Timer fired, calling showTourNotification");
        showTourNotification();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isAnalyticsPage, showTourNotification, isLoaded]);

  return (
    <header className="bg-background flex h-(--header-height) shrink-0 items-center gap-2 border-b  rounded-t-lg border-border transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>

        <div className="ml-auto flex items-center gap-2">
          {isAnalyticsPage && isLoaded && (
            <div className="flex items-center gap-2 relative">
              <div className="relative">
                <DateRangePicker
                  value={pendingRange}
                  onChange={(newRange: DateRange | undefined) => {
                    if (newRange?.from && newRange?.to) {
                      setPendingRange(newRange);
                    }
                  }}
                  className="w-auto"
                />
                {showNotification && (
                  <CalendarTourNotification onDismiss={dismissNotification} />
                )}
              </div>
              <Button
                onClick={() => setAppliedRange(pendingRange)}
                disabled={isApplyDisabled}
                size="sm"
                className="h-8 px-3 py-1 text-xs"
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
