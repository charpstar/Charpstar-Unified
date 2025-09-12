"use client";

import { Button } from "@/components/ui/display";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "@/components/ui/containers";
import { usePathname, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/utilities";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useAnalyticsCheck } from "@/lib/analyticsCheck";
import { NotificationBell } from "@/components/ui/feedback/notification-bell";

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
  "/invoicing": "Invoicing",
  "/notifications": "Notifications",
  "/qa-review": "QA Review",
  "/production/cost-tracking": "Cost Tracking",
  "/admin/clients": "Client Information",
  "/my-assignments/[client]/[batch]": "My Assignments",
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
    <header className="bg-[#606d64] flex h-(--header-height) shrink-0 items-center gap-2 shadow-md shadow-black/20 rounded-half   rounded-t-lg border-border transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) relative overflow-hidden">
      {/* Animated Space Background for Header */}
      <div className="absolute inset-0">
        {/* Stars Layer 1 - Large stars */}
        <div className="absolute inset-0 opacity-40">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={`header-star1-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Stars Layer 2 - Medium stars */}
        <div className="absolute inset-0 opacity-30">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={`header-star2-${i}`}
              className="absolute w-0.5 h-0.5 bg-blue-200 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Stars Layer 3 - Small stars */}
        <div className="absolute inset-0 opacity-20">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={`header-star3-${i}`}
              className="absolute w-px h-px bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 4}s`,
              }}
            />
          ))}
        </div>

        {/* Moving particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`header-particle-${i}`}
              className="absolute w-1 h-1 bg-cyan-300 rounded-full opacity-50"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${8 + Math.random() * 15}s linear infinite`,
                animationDelay: `${Math.random() * 8}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 relative z-10">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">
          {typeof pageTitle === "string" ? pageTitle : pageTitle}
        </h1>

        <div className="ml-auto flex items-center gap-2">
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

      <style jsx>{`
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes float {
          0% {
            transform: translateY(100%) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px)
              translateX(${Math.random() * 200 - 100}px);
            opacity: 0;
          }
        }
      `}</style>
    </header>
  );
}
