"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

export function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // List all routes where you DON'T want the sidebar
  const noSidebarRoutes = ["/auth", "/reset-password"];
  // If you use `/auth/*` structure, you can use: pathname.startsWith("/auth")
  const hideSidebar = noSidebarRoutes.includes(pathname); // or adjust this logic

  return (
    <div className="flex min-h-screen w-full bg- dark:bg-muted rounded-lg ">
      {/* Sidebar */}
      {!hideSidebar && <AppSidebar variant="inset" />}
      {/* Main area: column */}
      <div className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden p-4">
        {!hideSidebar && <SiteHeader />}
        {/* Main content, no w-full! */}
        <div className="flex-1  bg-background p-6 dark:bg-muted overflow-hidden rounded-lg justify-center items-center ">
          {children}
        </div>
      </div>
    </div>
  );
}
