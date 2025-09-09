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
import { supabase } from "@/lib/supabaseClient";
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

  const [guidelineClients, setGuidelineClients] = React.useState<string[]>([]);

  React.useEffect(() => {
    const loadClients = async () => {
      try {
        if (!user?.id) return;

        // Prefer allocation lists' clients if available on assignments
        const { data, error } = await supabase
          .from("asset_assignments")
          .select(
            `
            onboarding_assets!inner(client)
          `
          )
          .eq("user_id", user.id)
          .limit(500);

        if (error) {
          console.error("sidebar guideline clients error", error);
          return;
        }

        const clients: string[] = Array.from(
          new Set(
            (data || [])
              .map((row: any) => row.onboarding_assets?.client)
              .filter((c: any) => typeof c === "string" && c.trim() !== "")
          )
        );
        setGuidelineClients(clients);
      } catch (e) {
        console.error("sidebar guideline clients exception", e);
      }
    };

    loadClients();
  }, [user?.id]);

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
            title: "Onboarding",
            url: "/onboarding",
            icon: Users,
          },
          {
            title: "Production",
            url: "/production",
            icon: Factory,
          },
          {
            title: "Client information",
            url: "/admin/clients",
            icon: Building2,
          },
          // Pending Revisions removed (reverted)

          {
            title: "Create Users",
            url: "/create-users",
            icon: UserPlus,
          },
        ]
      : [];

  // Production-only navigation items (only for admin users)

  // Financial navigation items (admin only)
  const financialNavItems =
    role === "admin"
      ? [
          {
            title: "Cost Tracking",
            url: "/production/cost-tracking",
            icon: DollarSign,
          },
        ]
      : [];

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
    // Modeler
    "My Assignments": 10,
    Guidelines: 80,
    Invoicing: 50,
    // QA
    "QA Review": 10,
  };

  const unsortedNavItems = [
    ...baseNavItems,
    ...adminNavItems,
    ...financialNavItems,
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

  // Add submenu children to Guidelines without changing its main link behavior
  const navMainWithChildren = navMain.map((item) => {
    if (item.title === "Guidelines") {
      const children = guidelineClients.length
        ? guidelineClients.map((client) => ({
            title: client,
            url: `/guidelines/${encodeURIComponent(client)}`,
          }))
        : [];
      return {
        ...item,
        children,
      } as any;
    }
    return item as any;
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
        icon: FileText,
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
        icon: FileText,
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
        <NavMain items={navMainWithChildren as any} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
