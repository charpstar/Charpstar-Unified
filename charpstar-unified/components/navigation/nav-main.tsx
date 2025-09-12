"use client";

import { LucideIcon, ChevronDown } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/navigation/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export default function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    children?: { title: string; url: string; icon?: LucideIcon }[];
  }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    Production: true, // Open Production submenu by default
  });
  const enableSubmenus = !pathname.startsWith("/modeler-review"); // disable submenu UI for modeler-review pages

  // Don't render if no items (loading state)
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2"></SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url;
            const hasChildren = !!(item.children && item.children.length > 0);
            const isOpen = !!open[item.title];

            // Hide Production menu item for modeler-review pages
            if (item.title === "Production" && !enableSubmenus) {
              return null;
            }

            return (
              <SidebarMenuItem
                key={item.title}
                isActive={isActive}
                className="relative overflow-hidden rounded-lg"
                style={
                  isActive
                    ? ({
                        "--shadow-offset": "0",
                        "--shadow-blur": "15px",
                        "--shadow-spread": "-8px",
                        "--shadow-color": "#ffffff",
                        "--tint-color": "215, 215, 215",
                        "--tint-opacity": "0.05",
                        "--frost-blur": "4px",
                        "--noise-frequency": "0.015",
                        "--distortion-strength": "20",
                        "--outer-shadow-blur": "4px",
                        boxShadow: `2px 2px var(--outer-shadow-blur) rgba(255, 255, 255, 0.1)`,
                        isolation: "isolate",
                        touchAction: "none",
                      } as React.CSSProperties)
                    : {}
                }
              >
                {/* Glass tint layer for active items */}
                {isActive && (
                  <>
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        zIndex: 0,
                        background: `rgba(var(--tint-color), var(--tint-opacity))`,
                        boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
                      }}
                    />

                    {/* Frost blur layer */}
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backdropFilter: `blur(var(--frost-blur))`,
                        filter: "url(#glass-distortion)",
                      }}
                    />
                  </>
                )}

                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="relative z-10"
                >
                  <Link href={item.url} className="group">
                    {item.icon && <item.icon className="" />}
                    <span className=" w-full">{item.title}</span>
                  </Link>
                </SidebarMenuButton>

                {hasChildren && enableSubmenus && (
                  <SidebarMenuAction
                    aria-label="Toggle submenu"
                    onClick={() =>
                      setOpen((prev) => ({
                        ...prev,
                        [item.title]: !prev[item.title],
                      }))
                    }
                  >
                    <ChevronDown
                      className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </SidebarMenuAction>
                )}

                {hasChildren && enableSubmenus && isOpen && (
                  <SidebarMenuSub className="min-w-full">
                    {item.children!.map((child) => (
                      <SidebarMenuSubItem
                        key={child.title}
                        className="min-w-full relative overflow-hidden rounded-lg"
                        style={
                          pathname === child.url
                            ? ({
                                "--shadow-offset": "0",
                                "--shadow-blur": "15px",
                                "--shadow-spread": "-6px",
                                "--shadow-color": "#ffffff",
                                "--tint-color": "255, 255, 255",
                                "--tint-opacity": "0.12",
                                "--frost-blur": "1.5px",
                                "--noise-frequency": "0.005",
                                "--distortion-strength": "15",
                                "--outer-shadow-blur": "8px",
                                boxShadow: `0px 3px var(--outer-shadow-blur) rgba(255, 255, 255, 0.08)`,
                                isolation: "isolate",
                                touchAction: "none",
                              } as React.CSSProperties)
                            : {}
                        }
                      >
                        {/* Glass tint layer for active submenu items */}
                        {pathname === child.url && (
                          <>
                            <div
                              className="absolute inset-0 rounded-lg"
                              style={{
                                zIndex: 0,
                                background: `rgba(var(--tint-color), var(--tint-opacity))`,
                                boxShadow: `inset var(--shadow-offset) var(--shadow-offset) var(--shadow-blur) var(--shadow-spread) var(--shadow-color)`,
                              }}
                            />

                            {/* Frost blur layer */}
                            <div
                              className="absolute inset-0 rounded-lg"
                              style={{
                                backdropFilter: `blur(var(--frost-blur))`,
                                filter: "url(#glass-distortion)",
                              }}
                            />
                          </>
                        )}

                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === child.url}
                          className="min-w-full [&>span:last-child]:truncate-none hover:bg-black/3.5 dark:hover:bg-background/20 hover:text-accent-foreground dark:hover:text-accent-foreground data-[active=true]:bg-black/8 dark:data-[active=true]:bg-background/90 data-[active=true]:font-medium data-[active=true]:text-accent-foreground data-[active=true]:text-accent-foreground relative z-10"
                        >
                          <Link href={child.url} className="group w-full">
                            {child.icon && <child.icon className="" />}
                            <span className="whitespace-nowrap flex-1">
                              {child.title}
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
