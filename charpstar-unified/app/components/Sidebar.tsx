"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  BarChart,
} from "lucide-react";
import Image from "next/image";
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const getUserAndRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUser(user);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!error && profile) {
        setRole(profile.role);
      }
    };

    getUserAndRole();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <>
              {/* Light Mode Logo */}
              <Image
                src="/images/charpstarWhite.png"
                alt="Logo (dark mode)"
                width={200}
                height={100}
                className="hidden dark:block"
              />

              <Image
                src="/images/charpstarGrey.png"
                alt="Logo"
                width={200}
                height={100}
                className="block dark:hidden"
              />

              {/* Dark Mode Logo */}
            </>
          </div>
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Dashboard
          </h2>

          <div className="space-y-1">
            <Link href="/dashboard">
              <Button
                variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                className="w-full justify-start cursor-pointer"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Overview
              </Button>
            </Link>

            {role === "admin" && (
              <Link href="/analytics">
                <Button
                  variant={pathname === "/analytics" ? "secondary" : "ghost"}
                  className="w-full justify-start cursor-pointer"
                >
                  <BarChart className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
              </Link>
            )}

            {role === "admin" && (
              <Link href="/users">
                <Button
                  variant={pathname === "/users" ? "secondary" : "ghost"}
                  className="w-full justify-start cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
              </Link>
            )}

            <Link href="/settings">
              <Button
                variant={pathname === "/settings" ? "secondary" : "ghost"}
                className="w-full justify-start cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>

            {/* ✅ Conditionally show for admins */}
            {role === "admin" && (
              <Link href="/admin/permissions">
                <Button
                  variant={pathname === "/permissions" ? "secondary" : "ghost"}
                  className="w-full justify-start cursor-pointer  "
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Permissions
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="px-3 py-2">
          <div className="space-y-1">
            {user && (
              <div className="px-4 py-2">
                <p className="text-sm font-medium">{user.email}</p>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
