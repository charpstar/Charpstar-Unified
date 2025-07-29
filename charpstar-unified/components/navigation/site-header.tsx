"use client";

import { Button } from "@/components/ui/display";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "@/components/ui/containers";
import { usePathname, useParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/utilities";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useAnalyticsCheck } from "@/lib/analyticsCheck";

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
  "/onboarding": "Onboarding",
  "/production": "Production",
  "/auth/signup": "Signup",
  "/onboarding/csv-upload": "CSV Upload",
  "/onboarding/reference-images": "Reference Upload",
  "/client-review": "Client Review",
  "/client-review/[id]": "Review Asset",
  "/add-products": "Add Products",
  "/guidelines": "Guidelines",
  "/pending-assignments": "Pending Assignments",
  "/my-assignments": "My Assignments",
  "/modeler-review": "Modeler Review",
  "/3d-editor": "3D Editor",
  "/create-users": "Create Users",
  "/add-models": "Add Models",
  "/admin-review": "Admin Review",
};

export default function SiteHeader() {
  const pathname = usePathname();
  const params = useParams();
  const clientName = params?.id as string;
  const { pendingRange, setPendingRange, setAppliedRange, isApplyDisabled } =
    useDateRange();
  const { hasAnalyticsProfile } = useAnalyticsCheck();
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
  } else if (
    pathname.startsWith("/client-review/") &&
    pathname.split("/").length === 3
  ) {
    pageTitle = "Client Asset Review";
  } else if (pathname === "/admin-review") {
    // Handle admin-review with query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const client = urlParams.get("client");
    const batch = urlParams.get("batch");
    const modeler = urlParams.get("modeler");
    const email = urlParams.get("email");

    if (client && batch) {
      pageTitle = `${client} Batch ${batch} - Admin Review`;
    } else if (modeler && email) {
      // Decode the email URL parameter
      const decodedEmail = decodeURIComponent(email);
      pageTitle = `Admin Modeler Review - ${decodedEmail}`;
    } else {
      pageTitle = "Admin Review";
    }
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
          {isAnalyticsPage && isLoaded && hasAnalyticsProfile && (
            <div className="flex items-center gap-2 relative ">
              <div className="relative">
                <DateRangePicker
                  data-tour="date-range-picker"
                  value={pendingRange}
                  onChange={(newRange: DateRange | undefined) => {
                    if (newRange?.from && newRange?.to) {
                      setPendingRange(newRange);
                    }
                  }}
                  className="w-auto"
                />
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
