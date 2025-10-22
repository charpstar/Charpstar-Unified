"use client";

import { Button } from "@/components/ui/display";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "@/components/ui/containers";
import { usePathname, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/utilities";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useAnalyticsCheck } from "@/lib/analyticsCheck";
import { NotificationBell } from "@/components/ui/feedback/notification-bell";
import { Badge } from "@/components/ui/feedback";

import { useState, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { Bug, ExternalLink } from "lucide-react";

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
  "/invite-members": "Invite Members",
  "/guidelines": "Guidelines",
  "/pending-assignments": "Pending Assignments",
  "/my-assignments": "My Assignments",
  "/modeler-review": "Modeler Review",
  "/3d-editor": "3D Editor",
  "/add-models": "Add Models",
  "/admin-review": "Admin Review",
  "/invoicing": "Invoicing",
  "/notifications": "Notifications",
  "/qa-review": "QA Review",
  "/production/cost-tracking": "Cost Tracking",
  "/admin/clients": "Client Information",
  "/admin/bug-reports": "Bug Reports",
  "/my-assignments/[client]/[batch]": "My Assignments",
  "/bug-report": "Report Bug",
};

export default function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientName = searchParams?.get("id") as string;
  const { pendingRange, setPendingRange, setAppliedRange, isApplyDisabled } =
    useDateRange();
  const { hasAnalyticsProfile } = useAnalyticsCheck();
  const [isLoaded, setIsLoaded] = useState(false);

  let pageTitle: string | React.ReactNode = "Unified";

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
    // Handle admin-review with query parameters using useSearchParams
    const client = searchParams.get("client");
    const batch = searchParams.get("batch");
    const modeler = searchParams.get("modeler");
    const email = searchParams.get("email");

    if (client && batch) {
      pageTitle = (
        <>
          <span className="text-blue-600">{client}</span>
          <span> Batch {batch} - Admin Review</span>
        </>
      );
    } else if (modeler && email) {
      // Decode the email URL parameter
      const decodedEmail = decodeURIComponent(email);
      pageTitle = (
        <>
          <span className="text-blue-600">{decodedEmail}</span>
          <span> - Admin Modeler Review</span>
        </>
      );
    } else {
      pageTitle = "Admin Review";
    }
  } else if (
    pathname.startsWith("/my-assignments/") &&
    pathname.split("/").length === 4
  ) {
    // Handle my-assignments/[client]/[batch] dynamic route
    const pathParts = pathname.split("/");
    const client = decodeURIComponent(pathParts[2]);
    const batch = pathParts[3];
    pageTitle = (
      <>
        <span className="text-blue-600">{client}</span>
        <span> Batch {batch} - My Assignments</span>
      </>
    );
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
        <h1 className="text-base font-medium">
          {typeof pageTitle === "string" ? pageTitle : pageTitle}
        </h1>

        {/* Beta Badge */}
        <Badge variant="outline" className="ml-2 text-xs">
          CharpstAR Platform
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          {/* Report Bug Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const currentUrl = encodeURIComponent(window.location.href);
              const currentPage = encodeURIComponent(document.title);
              window.open(
                `/bug-report?url=${currentUrl}&page=${currentPage}`,
                "_blank"
              );
            }}
            className="gap-2 text-xs cursor-pointer"
          >
            <Bug className="h-3 w-3" />
            Report Bug
            <ExternalLink className="h-3 w-3" />
          </Button>

          {/* Notification Bell - Available for all users */}
          <NotificationBell />

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
