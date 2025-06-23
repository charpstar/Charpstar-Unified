"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

export function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // List all routes where you DON'T want the sidebar (and bg-muted)
  const noSidebarRoutes = ["/auth", "/reset-password"];
  const hideSidebar = noSidebarRoutes.includes(pathname);

  // Conditional class for the main content wrapper
  const mainContentClass = [
    "flex-1 flex flex-col min-h-screen w-full overflow-x-hidden p-4 bg-muted ",
    !hideSidebar && "bg-muted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-h-screen w-full bg-background rounded-lg">
      {/* Sidebar */}
      {!hideSidebar && <AppSidebar variant="inset" />}
      {/* Main area: column */}
      <div className={mainContentClass}>
        {!hideSidebar && <SiteHeader />}
        {/* Main content, no w-full! */}
        <div className="flex-1 overflow-y-auto rounded-b-lg justify-center items-center bg-background h-full max-h-[calc(100vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
