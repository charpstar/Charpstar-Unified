"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { usePagePermission } from "@/lib/usePagePermission";
import Image from "next/image";

// To more easily add new menu items, and not make it an array likke before, sometimes messes up the routing and navigation.
// So we'll use a more dynamic approach.

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  // For each menu item, check permission
  const menuWithAccess = menuItems.map((item) => {
    const { hasAccess } = usePagePermission(role, item.href);
    return { ...item, hasAccess };
  });

  return (
    <div className="flex flex-col h-screen w-64 bg-background text-foreground">
      {/* Logo section */}
      <div className="p-4">
        <Image
          src="/images/charpstarGrey.png"
          alt="Charpstar"
          width={200}
          height={100}
          className="mb-1"
        />
        <div className="border-b border-border mb-2"></div>

        {session?.user?.role && (
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">
              {session.user.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {session.user.role}
            </p>
          </div>
        )}
      </div>

      {/* Navigation section */}
      {menuWithAccess
        .filter((item) => item.hasAccess)
        .map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-primary/10"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      {/* Permissions link for admin only */}
      {session?.user?.role === "admin" && (
        <>
          <Link
            href="/admin/permissions"
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors mt-4",
              pathname === "/admin/permissions"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-primary/10"
            )}
          >
            <span className="w-5 h-5 inline-block">🔒</span>
            <span>Permissions</span>
          </Link>
          <Link
            href="/admin/feature-permissions"
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
              pathname === "/admin/feature-permissions"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-primary/10"
            )}
          >
            <span className="w-5 h-5 inline-block">🛠️</span>
            <span>Feature Permissions</span>
          </Link>
        </>
      )}
      {/* Bottom section */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => signOut()}
          className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg text-foreground/60 hover:text-foreground hover:bg-primary/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
