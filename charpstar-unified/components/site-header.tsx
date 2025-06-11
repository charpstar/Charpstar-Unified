"use client";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/analytics": "Analytics",
  "/asset-library": "Asset Library",
  "/asset-library/upload": "Upload Assets",
  "/asset-library/preview-generator": "Preview Generator",
  "/asset-library/[id]": "Asset Details",
};

export function SiteHeader() {
  const pathname = usePathname();

  let pageTitle = "Unified";
  if (
    pathname.startsWith("/asset-library/") &&
    pathname.split("/").length === 3 &&
    !pathname.includes("/upload") &&
    !pathname.includes("/preview-generator")
  ) {
    // Extract the id from the URL

    pageTitle = `Asset Details`;
  } else {
    pageTitle = TITLES[pathname as keyof typeof TITLES] || "Unified";
  }

  return (
    <header className="bg-background flex h-(--header-height) shrink-0 items-center gap-2 border-b  rounded-t-lg border-border transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
        <div className="ml-auto flex items-center gap-2"></div>
      </div>
    </header>
  );
}
