"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { ROLES, useHasPermission } from "@/lib/auth";
import Image from "next/image";

// To more easily add new menu items, and not make it an array likke before, sometimes messes up the routing and navigation.
// So we'll use a more dynamic approach.

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    requiredRole: ROLES.USER,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
    requiredRole: ROLES.MANAGER,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    requiredRole: ROLES.USER,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter((item) =>
    useHasPermission(item.requiredRole)
  );

  return (
    <div className="flex flex-col h-screen w-64 bg-sidebar text-sidebar-foreground">
      {/* Logo section */}
      <div className="p-4">
        <Image
          src="/images/charpstarWhite.png"
          alt="Charpstar"
          width={200}
          height={100}
          className="mb-1"
        />
        <div className="border-b border-sidebar-border mb-2"></div>

        {session?.user?.role && (
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-sidebar-foreground">
              {session.user.name}
            </p>
            <p className="text-xs text-sidebar-accent capitalize">
              {session.user.role}
            </p>
          </div>
        )}
      </div>

      {/* Navigation section */}
      <nav className="flex-1 space-y-1 px-4">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
        {/* Permissions link for admin only */}
        {session?.user?.role === "admin" && (
          <Link
            href="/admin/permissions"
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors mt-4",
              pathname === "/admin/permissions"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10"
            )}
          >
            <span className="w-5 h-5 inline-block">🔒</span>
            <span>Page Permissions</span>
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={() => signOut()}
          className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
