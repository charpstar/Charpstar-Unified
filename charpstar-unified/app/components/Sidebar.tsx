"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/display";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  BarChart,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

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
    router.push("/auth");
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
            <div className="flex items-center justify-between   ">
              {user && (
                <p className="text-sm font-medium text-gray-500">
                  {user.email}
                </p>
              )}
            </div>
            Dashboard
          </h2>

          <div className="space-y-1">
            <Link href="/dashboard">
              <Button
                variant={pathname === "/dashboard" ? "secondary" : "ghost"}
                className="w-full justify-start cursor-pointer  transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Overview
              </Button>
            </Link>

            {role === "admin" && (
              <Link href="/analytics">
                <Button
                  variant={pathname === "/analytics" ? "secondary" : "ghost"}
                  className="w-full justify-start cursor-pointer  transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
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
                  className="w-full justify-start cursor-pointer  transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
              </Link>
            )}

            <Link href="/settings">
              <Button
                variant={pathname === "/settings" ? "secondary" : "ghost"}
                className="w-full justify-start cursor-pointer  transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
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
                  className="w-full justify-start cursor-pointer  transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
                >
                  <ShieldCheck className="mr-2 h-4 w-4 hover:scale-110 transition-all duration-300" />
                  Permissions
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="space-y-1">
          {user && (
            <div className="px-4 py-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100  cursor-pointer  transition-all duration-300"
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
  );
}
