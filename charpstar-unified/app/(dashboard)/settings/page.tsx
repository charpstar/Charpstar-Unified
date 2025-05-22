"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { useTheme } from "next-themes";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LogOut, Sun, Moon, User2, BarChart3 } from "lucide-react";
import { ThemeSwitcherCard } from "@/components/ui/theme-switcher";
import { FontSettings } from "@/components/ui/font-setting";
import { ColorThemePicker } from "@/components/ui/color-picker";
import { SiteHeader } from "@/components/site-header";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  updated_at: string;
  created_at: string;
  analytics_profile_id: string | null;
}

interface AnalyticsProfile {
  id: string;
  projectid: string;
  datasetid: string;
  tablename: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Page permission logic
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(user?.role, "/settings");

  // Fetch user & analytics profile
  useEffect(() => {
    const fetchUserAndAnalytics = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          router.push("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          return;
        }

        setUser(profile);

        // Fetch analytics profile if exists
        if (profile.analytics_profile_id) {
          const { data: analytics, error: analyticsError } = await supabase
            .from("analytics_profiles")
            .select("*")
            .eq("id", profile.analytics_profile_id)
            .single();

          if (!analyticsError) {
            setAnalyticsProfile(analytics);
          }
        }
      } catch (err) {
        // handle error if needed
      }
    };

    fetchUserAndAnalytics();
  }, [router]);

  // Permission error
  if (permissionError) {
    return (
      <div className="flex justify-center items-center min-h-[300px] p-4">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTitle>Permission Error</AlertTitle>
          <AlertDescription>{permissionError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="flex justify-center items-center min-h-[300px] p-4"></div>
    );
  }

  // Actions
  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-3">
              <User2 className="w-5 h-5 text-muted-foreground" />
              Account Settings
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email and Role */}
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground">Email</Label>
            <div className="text-lg font-medium text-foreground">
              {user?.email}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground">Role</Label>
            <div className="text-base text-foreground capitalize">
              {user?.role || "User"}
            </div>
          </div>
          {/* Theme toggle */}
          <div className="flex flex-col gap-1">
            <ThemeSwitcherCard />
          </div>

          {/* Analytics Profile */}
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground mb-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Analytics Profile
            </Label>
            {user?.analytics_profile_id ? (
              analyticsProfile ? (
                <div className="rounded-lg border border-muted p-3 bg-muted/40">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Dataset ID:</span>{" "}
                    {analyticsProfile.datasetid}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Table Name:</span>{" "}
                    {analyticsProfile.tablename}
                  </div>
                </div>
              ) : null
            ) : (
              <div className="text-sm text-muted-foreground">
                No analytics profile assigned
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? "Logging out..." : "Log Out"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
