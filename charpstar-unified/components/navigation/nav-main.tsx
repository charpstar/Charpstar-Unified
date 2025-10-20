"use client";

import { LucideIcon, ChevronDown, Lock } from "lucide-react";

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
import { Badge } from "@/components/ui/feedback/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";
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
    badge?: string | null;
    disabled?: boolean;
    tooltip?: string;
    children?: {
      title: string;
      url: string;
      icon?: LucideIcon;
      badge?: string | null;
      disabled?: boolean;
      tooltip?: string;
    }[];
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

            const menuButtonContent = item.disabled ? (
              <div className="group flex items-center gap-2 w-full">
                {item.icon && <item.icon className="" />}
                <span className="flex-1">{item.title}</span>
                <Lock className="h-3 w-3 opacity-50" />
                {item.badge && (
                  <Badge variant="extraSmall" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </div>
            ) : (
              <Link href={item.url} className="group">
                {item.icon && <item.icon className="" />}
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <Badge variant="extraSmall" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );

            const menuButton = (
              <SidebarMenuButton
                asChild={!item.disabled}
                isActive={isActive}
                className={`${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {menuButtonContent}
              </SidebarMenuButton>
            );

            return (
              <SidebarMenuItem
                key={item.title}
                isActive={isActive}
                className=""
              >
                {item.disabled && item.tooltip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{menuButton}</TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  menuButton
                )}

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
                        className="min-w-full"
                      >
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === child.url}
                          className="min-w-full [&>span:last-child]:truncate-none hover:bg-black/3.5 dark:hover:bg-background/20 hover:text-accent-foreground dark:hover:text-accent-foreground data-[active=true]:bg-black/8 dark:data-[active=true]:bg-background/90 data-[active=true]:font-medium data-[active=true]:text-accent-foreground data-[active=true]:text-accent-foreground"
                        >
                          <Link href={child.url} className="group w-full">
                            {child.icon && <child.icon className="" />}
                            <span className="whitespace-nowrap flex-1">
                              {child.title}
                            </span>
                            {child.badge && (
                              <Badge variant="outline" className=" text-xs">
                                {child.badge}
                              </Badge>
                            )}
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
