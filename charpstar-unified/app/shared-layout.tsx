"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";

export function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // List all routes where you DON'T want the sidebar
  const noSidebarRoutes = ["/auth", "/reset-password"];
  // If you use `/auth/*` structure, you can use: pathname.startsWith("/auth")
  const hideSidebar = noSidebarRoutes.includes(pathname); // or adjust this logic

  return (
    <div className="flex min-h-screen w-full">
      {!hideSidebar && <AppSidebar variant="inset" />}
      <div className="p-4 flex-1 overflow-x-hidden w-full  h-full bg-muted-background dark:bg-muted-background">
        <div className="flex-1 overflow-x-hidden w-full min-h-screen bg-background p-6 rounded-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
