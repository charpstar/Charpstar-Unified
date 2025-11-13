"use client";

import * as React from "react";
import {
  Camera,
  LayoutDashboard,
  FileText,
  Folder,
  Users,
  Eye,
  Factory,
  Package,
  MessageSquare,
  DollarSign,
  Bell,
  Palette,
  HelpCircle,
  Bug,
  Layers,
  Sparkles,
  BarChart3,
  UserPlus,
  Monitor,
  Ticket,
  Upload,
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
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [assetCount, setAssetCount] = useState<number | null>(null);

  // Format large numbers (e.g., 13600 -> "13.6k")
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return num.toString();
  };

  // Avoid hydration mismatch by only determining theme after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = mounted && currentTheme === "dark";

  const user = useUser();
  const clientName = user?.metadata?.client_config;
  const role = (user?.metadata?.role || "").toLowerCase();
  const [userProfile, setUserProfile] = useState<{
    client: string[] | null;
    role: string;
  } | null>(null);

  // Fetch user profile when user changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setUserProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("client, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        return;
      }

      setUserProfile(data);
    };

    fetchUserProfile();
  }, [user?.id]);

  // Fetch asset count for client and admin users
  useEffect(() => {
    const fetchAssetCount = async () => {
      if (
        userProfile &&
        (userProfile.role === "client" || userProfile.role === "admin")
      ) {
        try {
          let countQuery = supabase
            .from("assets")
            .select("*", { count: "exact", head: true });

          // For clients, filter by their assigned companies
          if (
            userProfile.role === "client" &&
            userProfile.client &&
            userProfile.client.length > 0
          ) {
            countQuery = countQuery.in("client", userProfile.client);
          }
          // For admins, get count of all assets (no filter)

          const { count, error } = await countQuery;

          if (!error && count !== null) {
            setAssetCount(count);
          }
        } catch (error) {
          console.error("Error fetching asset count:", error);
        }
      }
    };

    fetchAssetCount();
  }, [userProfile]);

  // Debug logging for onboarding navigation

  // Base navigation items - only show when user data is loaded
  const baseNavItems = user
    ? [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        // Hide Analytics and Asset Library for modelers and QA
        ...(role === "modeler"
          ? []
          : role === "qa"
            ? []
            : role === "client"
              ? [
                  {
                    title: "My 3D Models",
                    url: "/asset-library",
                    icon: Folder,
                    badge:
                      assetCount !== null ? formatNumber(assetCount) : null,
                  },
                ]
              : role === "admin"
                ? [
                    {
                      title: "My 3D Models",
                      url: "/asset-library",
                      icon: Folder,
                      badge:
                        assetCount !== null ? formatNumber(assetCount) : null,
                    },
                    {
                      title: "Texture Library",
                      url: "/texture-library",
                      icon: Layers,
                    },
                  ]
                : [
                    {
                      title: "Asset Library",
                      url: "/asset-library",
                      icon: Folder,
                    },
                    {
                      title: "Texture Library",
                      url: "/texture-library",
                      icon: Layers,
                    },
                  ]),
        // FAQ - available to all users except clients
        ...(role !== "client"
          ? [
              {
                title: "FAQ",
                url: "/faq",
                icon: HelpCircle,
              },
            ]
          : []),
        // Bug Reports - available to all users

        // Add Products and Review pages for clients only
        ...(role === "client"
          ? [
              {
                title: "Review Assets",
                url: "/client-review",
                icon: Eye,
              },
              {
                title: "Add Products",
                url: "/add-products",
                icon: Package,
              },
              {
                title: "Invite Members",
                url: "/invite-members",
                icon: UserPlus,
              },
              {
                title: "Integration Guide",
                url: "/client-documentation",
                icon: FileText,
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
                title: "Users",
                url: "/users",
                icon: Users,
              },

              {
                title: "Upload client asset",
                url: "/admin/upload",
                icon: Upload,
              },
              {
                title: "Invoice Review",
                url: "/production/invoice-review",
                icon: FileText,
              },
              {
                title: "Pending Replies",
                url: "/admin/pending-replies",
                icon: MessageSquare,
              },
              {
                title: "Deactivated Assets",
                url: "/production/deactivated-assets",
                icon: Package,
              },
            ],
          },
          {
            title: "CharpstAR Studio AI",
            url: "/scene-render",
            icon: Sparkles,
          },
          {
            title: "Image Studio",
            url: "/product-render",
            icon: Monitor,
          },
          {
            title: "Modular 3D Creator",
            url: "/modular-3d-creator",
            icon: Box,
          },
          {
            title: "Bug Reports",
            url: "/admin/bug-reports",
            icon: Bug,
          },
          {
            title: "Analytics",
            url: "/admin/analytics",
            icon: BarChart3,
          },
          {
            title: " Internal Tickets",
            url: "/reminders",
            icon: Ticket,
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
            title: "3D Generator",
            url: "/generator",
            icon: Sparkles,
            disabled: true,
            tooltip: "Under maintenance",
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
            title: "QA Assignments",
            url: "/qa-assignments",
            icon: Package,
          },
          {
            title: "Asset Lists",
            url: "/asset-lists",
            icon: Layers,
          },
          {
            title: "QA Review",
            url: "/qa-review",
            icon: MessageSquare,
          },
          {
            title: "Guidelines",
            url: "/guidelines",
            icon: FileText,
          },
          {
            title: "Users",
            url: "/users",
            icon: Users,
          },
          {
            title: "Internal Tickets",
            url: "/reminders",
            icon: Ticket,
          },
        ]
      : [];

  // Build navigation items and then sort them by a fixed priority while keeping Dashboard first
  const ORDER: Record<string, number> = {
    Dashboard: 0,
    // Admin
    Production: 10,
    Analytics: 15,
    "Create Users": 40,
    Users: 45,
    "Cost Tracking": 50,

    // General
    "3D Editor": 60,
    "Asset Library": 20, // Moved above Scene Render
    "My 3D Models": 20, // Same order as Asset Library for admin users
    FAQ: 999,
    // Notifications moved to bottom
    Notifications: 1000,
    // Client
    "Add Products": 15,
    "Client Review": 20,
    "Integration Guide": 22,
    "CharpstAR Studio AI": 25,
    "Image Studio": 26,
    "Modular 3D Creator": 27,
    // Modeler
    "My Assignments": 10,
    "3D Generator": 12,
    Guidelines: 15,
    Invoicing: 50,
    // QA
    "QA Assignments": 10,
    "Asset Lists": 11,
    "QA Review": 12,
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
    // Scene Render - for client users only
    ...(role === "client"
      ? [
          {
            title: "Scene Render",
            url: "/scene-render",
            icon: Palette,
          },
          {
            title: "Product Render",
            url: "/product-render",
            icon: Monitor,
          },
          {
            title: "Modular 3D Creator",
            url: "/modular-3d-creator",
            icon: Box,
          },
        ]
      : []),
    // Analytics - for client users only (disabled with tooltip)
    ...(role === "client"
      ? [
          {
            title: "Analytics",
            url: "#",
            icon: BarChart3,
            disabled: true,
            tooltip: "Coming soon!",
          },
        ]
      : []),
    // Notifications - available for all roles
    ...[
      {
        title: "Notifications",
        url: "/notifications",
        icon: Bell,
      },
    ],
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
              variant="default"
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <div className="flex items-center justify-center">
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
                </div>
              </Link>
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
