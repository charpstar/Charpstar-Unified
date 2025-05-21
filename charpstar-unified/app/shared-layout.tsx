"use client";

import { AppSidebar } from "@/components/app-sidebar";

export function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar variant="inset" />
      <div className="flex-1 overflow-x-hidden w-full bg-background p-4">
        {children}
      </div>
    </div>
  );
}
