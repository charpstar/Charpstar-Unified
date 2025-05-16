"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePagePermission } from "@/lib/usePagePermission";
import { useTheme } from "next-themes";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { hasAccess, loading } = usePagePermission(role, "/settings");
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    notifications: {
      email: true,
      push: false,
      marketing: true,
    },
    theme: "light",
  });
  const { theme, setTheme } = useTheme();

  // Fetch analytics datasetid for the logged-in user
  const [datasetId, setDatasetId] = useState<string | null>(null);
  useEffect(() => {
    async function fetchDatasetId() {
      if (!session?.user?.id) return;
      // 1. Get analytics_profile_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("analytics_profile_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile?.analytics_profile_id) return;
      // 2. Get datasetid from analytics_profiles
      const { data: analytic } = await supabase
        .from("analytics_profiles")
        .select("datasetid")
        .eq("id", profile.analytics_profile_id)
        .single();
      setDatasetId(analytic?.datasetid || null);
    }
    fetchDatasetId();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }
  if (!hasAccess) {
    return <div className="p-6 text-center text-destructive">No Access</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement settings update
    console.log("Settings updated:", formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="mb-4">
        <strong>Your Analytics Dataset ID:</strong>{" "}
        {datasetId ? datasetId : "Not assigned"}
      </div>

      <div className="bg-background rounded-lg shadow-sm">
        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b border-border pb-2 text-foreground">
                Profile
              </h2>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b border-border pb-2 text-foreground">
                Notifications
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Email Notifications
                    </h3>
                    <p className="text-sm text-foreground">
                      Receive email updates about your account
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          email: !formData.notifications.email,
                        },
                      })
                    }
                    className={`${
                      formData.notifications.email
                        ? "bg-primary"
                        : "bg-background"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-border`}
                  >
                    <span
                      className={`$${
                        formData.notifications.email
                          ? "translate-x-6"
                          : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-foreground transition duration-200 ease-in-out mt-1 border border-border`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Push Notifications
                    </h3>
                    <p className="text-sm text-foreground">
                      Receive push notifications in your browser
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          push: !formData.notifications.push,
                        },
                      })
                    }
                    className={`$${
                      formData.notifications.push
                        ? "bg-primary"
                        : "bg-background"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border border-border`}
                  >
                    <span
                      className={`$${
                        formData.notifications.push
                          ? "translate-x-6"
                          : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-foreground transition duration-200 ease-in-out mt-1 border border-border`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Theme Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b border-border pb-2 text-foreground">
                Appearance
              </h2>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-border focus:outline-none focus:ring-primary focus:border-primary rounded-md bg-background text-foreground"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
