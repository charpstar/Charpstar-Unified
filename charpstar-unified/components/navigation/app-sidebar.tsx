"use client";

import * as React from "react";
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconFileAi,
  IconFileDescription,
  IconFolder,
} from "@tabler/icons-react";

import NavMain from "@/components/navigation/nav-main";
import NavSecondary from "@/components/navigation/nav-secondary";
import NavUser from "@/components/navigation/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/navigation/sidebar";
import Image from "next/image";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useUser } from "@/contexts/useUser";
import { Box } from "lucide-react";

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  const user = useUser();
  const clientName = user?.metadata?.client_config;

  // Base navigation items
  const baseNavItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: "Asset Library",
      url: "/asset-library",
      icon: IconFolder,
    },
  ];

  // Add 3D Editor only if user has client_config
  const navMain =
    clientName && clientName.trim() !== ""
      ? [
          ...baseNavItems,
          {
            title: "3D Editor",
            url: `/3d-editor/${clientName}`,
            icon: Box,
          },
        ]
      : baseNavItems;

  const data = {
    user: {
      name: "shadcn",
      email: "m@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
    navMain,
    navClouds: [
      {
        title: "Capture",
        icon: IconCamera,
        isActive: true,
        url: "#",
        items: [
          {
            title: "Active Proposals",
            url: "#",
          },
          {
            title: "Archived",
            url: "#",
          },
        ],
      },
      {
        title: "Proposal",
        icon: IconFileDescription,
        url: "#",
        items: [
          {
            title: "Active Proposals",
            url: "#",
          },
          {
            title: "Archived",
            url: "#",
          },
        ],
      },
      {
        title: "Prompts",
        icon: IconFileAi,
        url: "#",
        items: [
          {
            title: "Active Proposals",
            url: "#",
          },
          {
            title: "Archived",
            url: "#",
          },
        ],
      },
    ],
    navSecondary: [],
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="flex items-center justify-center">
                <Link href="/dashboard">
                  <Image
                    src={
                      isDark
                        ? "/images/charpstarWhite.png"
                        : "/images/charpstarGrey.png"
                    }
                    alt="logo"
                    width={150}
                    height={150}
                    priority
                  />
                </Link>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
