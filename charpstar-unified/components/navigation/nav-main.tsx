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
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const enableSubmenus = false; // temporarily hide submenu UI

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

            return (
              <SidebarMenuItem
                key={item.title}
                isActive={isActive}
                className=""
              >
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link href={item.url} className="group">
                    {item.icon && <item.icon className="" />}
                    {item.title}
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
                  <SidebarMenuSub>
                    {item.children!.map((child) => (
                      <SidebarMenuSubItem key={child.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === child.url}
                        >
                          <Link href={child.url} className="group">
                            {child.icon && <child.icon className="" />}
                            <span>{child.title}</span>
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
