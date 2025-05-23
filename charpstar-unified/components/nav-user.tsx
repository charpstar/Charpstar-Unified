"use client";

ssionimport {
  IconDotsVertical,
  IconLogout,
  IconSettings,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { useState } from "react";

export function NavUser() {
  const supaUser = useUser();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fallback avatar (initials)
  const initials = supaUser?.metadata?.analytics_profiles?.[0]?.name
    ? supaUser.metadata.analytics_profiles[0].name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  // Use metadata for name/email/avatar or fallback to main user fields
  const name =
    supaUser?.metadata?.analytics_profiles?.[0]?.name ||
    supaUser?.email ||
    "User";
  const email = supaUser?.email || "No email";
  const avatar = ""; // fallback to blank

  const { isMobile } = useSidebar();

  const handleLogout = async () => {
    // Remove any extra session data YOUR app stores
    localStorage.removeItem("user"); // if you store user info
    localStorage.removeItem("token"); // if you store a JWT
    sessionStorage.clear(); // if you use sessionStorage

    // If you use cookies, you might want to clear them here

    // Supabase: remove session, sign out user
    await supabase.auth.signOut();

    // Redirect to login/auth page
    window.location.href = "/auth";
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {email}
                  </span>
                </div>
                <IconDotsVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg bg-background dark:bg-background"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsSettingsOpen(true)}
                className="cursor-pointer"
              >
                <IconSettings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer"
              >
                <IconLogout className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
