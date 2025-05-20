"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Update page name to match database format
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(user?.role, "/settings");

  useEffect(() => {
    const fetchUserAndAnalytics = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          console.log("Auth error:", authError);
          router.push("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          console.error("Failed to fetch profile:", profileError?.message);
          return;
        }

        setUser(profile);

        // Fetch analytics profile if ID exists
        if (profile.analytics_profile_id) {
          const { data: analytics, error: analyticsError } = await supabase
            .from("analytics_profiles")
            .select("*")
            .eq("id", profile.analytics_profile_id)
            .single();

          if (analyticsError) {
            console.error(
              "Failed to fetch analytics profile:",
              analyticsError.message
            );
          } else {
            setAnalyticsProfile(analytics);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndAnalytics();
  }, [router]);

  // Show loading state while checking permissions or loading data
  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error message if permission check failed
  if (permissionError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          Error checking permissions: {permissionError}
        </p>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600">
          You don't have permission to access the settings page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">Settings</h1>
      <div className="grid gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-gray-600">Email: {user?.email}</p>
              <p className="text-gray-600">Role: {user?.role || "User"}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Theme</h3>
              <div className="flex items-center space-x-2">
                <Switch
                  id="dark-mode"
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
                <Label htmlFor="dark-mode">Dark Mode</Label>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Analytics Profile</h3>
              {user?.analytics_profile_id ? (
                analyticsProfile ? (
                  <>
                    <p className="text-gray-600">
                      Dataset ID: {analyticsProfile.datasetid}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-600">
                    Loading analytics profile details...
                  </p>
                )
              ) : (
                <p className="text-gray-600">No analytics profile assigned</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
