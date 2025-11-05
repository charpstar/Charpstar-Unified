"use client";

import { AppSidebar } from "@/components/navigation";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/navigation";

/**
 * Shared Layout Component
 *
 * This component handles the actual page structure and layout logic.
 * Responsibilities:
 * - Determines when to show/hide sidebar based on current route
 * - Manages the main content area layout
 * - Handles responsive design and spacing
 * - Provides consistent layout structure across different pages
 *
 * This layout is used by the root layout to structure the actual page content.
 * It's a client component because it needs to access the current pathname.
 */
export function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // List all routes where you DON'T want the sidebar (and bg-muted)
  // These are typically authentication pages or standalone pages
  const noSidebarRoutes = ["/auth", "/reset-password", "/shared-review"];
  const hideSidebar = noSidebarRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Conditional class for the main content wrapper
  // Applies different styling based on whether sidebar is present
  const mainContentClass = [
    "flex-1 flex flex-col w-full overflow-x-hidden p-4 bg-muted",
    !hideSidebar && "bg-muted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-h-screen w-full bg-background rounded-lg">
      {/* Sidebar - only shown on pages that need navigation */}
      {!hideSidebar && <AppSidebar variant="inset" />}

      {/* Main content area - column layout */}
      <div className={mainContentClass}>
        {/* Site header - only shown when sidebar is present */}
        {!hideSidebar && <SiteHeader />}

        {/* Main content container with scrolling and proper sizing */}

        <div className="flex-1 overflow-y-auto rounded-b-lg justify-center items-center bg-background h-full max-h-[calc(100vh-35px)] scrollbar-gutter-stable">
          {children}
        </div>
      </div>
    </div>
  );
}
