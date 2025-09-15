"use client";

import * as React from "react";
import {
  Camera,
  BarChart3,
  LayoutDashboard,
  FileText,
  Folder,
  Users,
  ClipboardList,
  Eye,
  Factory,
  UserPlus,
  Package,
  MessageSquare,
  DollarSign,
  Bell,
  Building2,
  Palette,
} from "lucide-react";

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
  const role = (user?.metadata?.role || "").toLowerCase();

  // Debug logging for onboarding navigation

  // Base navigation items - only show when user data is loaded
  const baseNavItems = user
    ? [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        // Hide Notifications for clients in onboarding (either onboarding flag or incomplete CSV upload)
        ...(role === "client" &&
        (user?.metadata?.onboarding === true ||
          user?.metadata?.csv_uploaded === false)
          ? []
          : [
              {
                title: "Notifications",
                url: "/notifications",
                icon: Bell,
              },
            ]),
        // Hide Analytics and Asset Library for clients in onboarding, modelers, and QA
        ...(role === "client" && user?.metadata?.onboarding === true
          ? []
          : role === "modeler"
            ? []
            : role === "qa"
              ? []
              : [
                  {
                    title: "Analytics",
                    url: "/analytics",
                    icon: BarChart3,
                  },
                  {
                    title: "Asset Library",
                    url: "/asset-library",
                    icon: Folder,
                  },
                ]),
        // Add Products and Review pages for clients only
        ...(role === "client" && user?.metadata?.onboarding === false
          ? [
              {
                title: "Add Products",
                url: "/add-products",
                icon: ClipboardList,
              },
              {
                title: "Client Review",
                url: "/client-review",
                icon: Eye,
              },
              {
                title: "Scene Render",
                url: "/scene-render",
                icon: Palette,
              },
            ]
          : []),
      ]
    : [
        // Show only dashboard while loading
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
      ];

  // Admin-only navigation items
  const adminNavItems =
    role === "admin"
      ? [
          {
            title: "Production",
            url: "/production",
            icon: Factory,
            children: [
              {
                title: "Client Information",
                url: "/admin/clients",
                icon: Building2,
              },
              {
                title: "Onboarding",
                url: "/onboarding",
                icon: Users,
              },
              {
                title: "Cost Tracking",
                url: "/production/cost-tracking",
                icon: DollarSign,
              },
              {
                title: "Create Users",
                url: "/create-users",
                icon: UserPlus,
              },
              {
                title: "Pending Replies",
                url: "/admin/pending-replies",
                icon: MessageSquare,
              },
            ],
          },
          {
            title: "Scene Render",
            url: "/scene-render",
            icon: Palette,
          },
        ]
      : [];

  // Production-only navigation items (only for admin users)

  // Modeler-only navigation items
  const modelerNavItems =
    role === "modeler"
      ? [
          {
            title: "My Assignments",
            url: "/my-assignments",
            icon: Package,
          },

          {
            title: "Guidelines",
            url: "/guidelines",
            icon: FileText,
          },
          {
            title: "Invoicing",
            url: "/invoicing",
            icon: DollarSign,
          },
        ]
      : [];

  // QA-only navigation items
  const qaNavItems =
    role === "qa"
      ? [
          {
            title: "QA Review",
            url: "/qa-review",
            icon: MessageSquare,
          },
        ]
      : [];

  // Build navigation items and then sort them by a fixed priority while keeping Dashboard first
  const ORDER: Record<string, number> = {
    Dashboard: 0,
    // Admin
    Production: 10,
    "Client information": 20,
    Onboarding: 30,
    "Create Users": 40,
    "Cost Tracking": 50,
    // General
    "3D Editor": 60,
    Analytics: 70,
    "Asset Library": 80,
    Notifications: 90,
    // Client
    "Add Products": 15,
    "Client Review": 20,
    "Scene Render": 25,
    // Modeler
    "My Assignments": 10,
    Guidelines: 15,
    Invoicing: 50,
    // QA
    "QA Review": 10,
  };

  const unsortedNavItems = [
    ...baseNavItems,
    ...adminNavItems,
    ...modelerNavItems,
    ...qaNavItems,
    ...(clientName && clientName.trim() !== ""
      ? [
          {
            title: "3D Editor",
            url: `/3d-editor/${clientName}`,
            icon: Box,
          },
        ]
      : []),
  ];

  const navMain = unsortedNavItems.sort((a, b) => {
    const orderA = ORDER[a.title] ?? 999;
    const orderB = ORDER[b.title] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });

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
        icon: Camera,
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
        icon: Folder,
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
        icon: Folder,
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
        <NavMain items={navMain as any} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
