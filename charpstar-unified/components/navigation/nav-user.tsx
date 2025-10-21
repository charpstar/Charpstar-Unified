"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import { MoreVertical, LogOut, Settings, Sparkle } from "lucide-react";
import { Badge } from "@/components/ui/feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/navigation/sidebar";
import { SettingsDialog } from "@/app/components/settings-dialog";
import { useEffect } from "react";
import {
  User,
  Users,
  Crown,
  Star,
  Heart,
  Zap,
  Target,
  Palette,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/inputs";
import { motion } from "framer-motion";

export default function NavUser() {
  const supaUser = useUser() as any; // Type assertion to handle metadata property
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

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
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    // Remove any extra session data YOUR app stores
    localStorage.removeItem("user"); // if you store user info
    localStorage.removeItem("token"); // if you store a JWT
    sessionStorage.clear(); // if you use sessionStorage

    // If you use cookies, you might want to clear them here

    // Supabase: remove session, sign out user
    await supabase.auth.signOut();

    // Redirect to login/auth page
    router.push("/auth");
  };

  return (
    <>
      {/* Theme Toggle */}

      <div className="px-3 py-4 text-center  border-t border-border/50  ">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Charpstar Platform
            </h2>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Badge
                variant="secondary"
                className=" text-[10px] px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-sm"
              >
                <Sparkle className="h-3 w-3 mr-1" />
                Beta
              </Badge>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 border-b border-t rounded-lg  border-border/50 ">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 pb-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Light</span>
          </div>
          <motion.div
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.2 }}
            className="items-center"
          >
            {mounted ? (
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 cursor-pointer transition-all duration-200"
                data-tour="theme-switcher"
              />
            ) : (
              <div className="h-6 w-11 rounded-full bg-muted" />
            )}
          </motion.div>

          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-muted-foreground">Dark</span>
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                data-tour="user-profile"
              >
                {renderAvatar(displayAvatar, name)}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {email}
                  </span>
                </div>
                <MoreVertical className="ml-auto size-4" />
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
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
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
