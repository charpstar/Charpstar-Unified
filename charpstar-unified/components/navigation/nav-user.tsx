"use client";

import {
  IconDotsVertical,
  IconLogout,
  IconSettings,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/navigation/sidebar";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { useState, useEffect } from "react";
import {
  User,
  Users,
  Crown,
  Star,
  Heart,
  Zap,
  Target,
  Palette,
} from "lucide-react";

export default function NavUser() {
  const supaUser = useUser() as any; // Type assertion to handle metadata property
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  console.log("NavUser component rendered, user:", supaUser?.id);
  console.log("Full user object:", supaUser);

  // Get avatar from user metadata (same as dashboard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const userAvatar = supaUser?.metadata?.avatar_url || null;

  // Add a fallback for when metadata is not loaded yet
  const [fallbackAvatar, setFallbackAvatar] = useState<string | null>(null);

  // Fetch avatar as fallback if metadata is not available
  useEffect(() => {
    if (!supaUser?.id || supaUser?.metadata?.avatar_url !== undefined) {
      setFallbackAvatar(null);
      return;
    }

    // Add a delay to give metadata time to load first
    const timeoutId = setTimeout(async () => {
      // Double-check that metadata still isn't available after delay
      if (supaUser?.metadata?.avatar_url !== undefined) {
        return;
      }

      // Only fetch if we don't have metadata yet
      const fetchFallbackAvatar = async () => {
        try {
          const response = await fetch(
            `/api/users/avatar?user_id=${supaUser.id}`
          );
          if (response.ok) {
            const data = await response.json();
            setFallbackAvatar(data.avatar_url);
          }
        } catch (error) {
          console.error("Error fetching fallback avatar:", error);
        }
      };

      fetchFallbackAvatar();
    }, 1000); // 1 second delay

    return () => clearTimeout(timeoutId);
  }, [supaUser?.id, supaUser?.metadata?.avatar_url]);

  // Use fallback avatar if metadata avatar is not available
  const displayAvatar = supaUser?.metadata?.avatar_url || fallbackAvatar;

  // Refetch avatar when settings dialog closes (in case avatar was changed)
  useEffect(() => {
    if (!isSettingsOpen) {
      // Trigger a refetch of user metadata by dispatching an event
      window.dispatchEvent(new CustomEvent("avatarUpdated"));
    }
  }, [isSettingsOpen]);

  // Helper function to render avatars with support for both custom and preset avatars
  const renderAvatar = (
    avatar: string | null | undefined,
    name: string,
    size: "sm" | "md" = "md"
  ) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-8 w-8",
    };

    if (!avatar) {
      return (
        <Avatar className={`${sizeClasses[size]} rounded-lg`}>
          <AvatarFallback className="bg-primary/10 text-muted-foreground rounded-lg">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      );
    }

    if (avatar.startsWith("http")) {
      return (
        <Avatar className={`${sizeClasses[size]} rounded-lg`}>
          <AvatarImage src={avatar} alt={name} className="rounded-lg" />
          <AvatarFallback className="bg-primary/10 text-muted-foreground rounded-lg">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Preset avatar
    const presetAvatars = [
      { id: "default", icon: User, color: "bg-blue-500 dark:bg-blue-500" },
      { id: "team", icon: Users, color: "bg-green-500 dark:bg-green-500" },
      { id: "premium", icon: Crown, color: "bg-yellow-500 dark:bg-yellow-500" },
      { id: "star", icon: Star, color: "bg-purple-500 dark:bg-purple-500" },
      { id: "heart", icon: Heart, color: "bg-pink-500 dark:bg-pink-500" },
      { id: "zap", icon: Zap, color: "bg-orange-500 dark:bg-orange-500" },
      { id: "target", icon: Target, color: "bg-red-500 dark:bg-red-500" },
      {
        id: "palette",
        icon: Palette,
        color: "bg-indigo-500 dark:bg-indigo-500",
      },
    ];

    const preset = presetAvatars.find((p) => p.id === avatar);
    if (preset) {
      const IconComponent = preset.icon;
      return (
        <Avatar className={`${sizeClasses[size]} rounded-lg`}>
          <AvatarFallback className={`${preset.color} text-white rounded-lg`}>
            <IconComponent className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }

    // Fallback to initials
    return (
      <Avatar className={`${sizeClasses[size]} rounded-lg`}>
        <AvatarFallback className="bg-primary/10 text-muted-foreground rounded-lg">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Fallback avatar (initials)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const initials = supaUser?.metadata?.analytics_profiles?.[0]?.name
    ? supaUser.metadata.analytics_profiles[0].name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : getInitials(supaUser?.email || "U");

  // Use metadata for name/email or fallback to main user fields
  const name =
    supaUser?.metadata?.analytics_profiles?.[0]?.name ||
    supaUser?.email ||
    "User";
  const email = supaUser?.email || "No email";

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
                {renderAvatar(displayAvatar, name)}
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
                  {renderAvatar(displayAvatar, name)}
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
