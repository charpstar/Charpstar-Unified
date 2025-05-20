"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePagePermission } from "@/lib/usePagePermission";
import AnalyticsDashboard from "../analytics/page";

function fetchAnalyticsProfiles() {
  return supabase
    .from("analytics_profiles")
    .select("*")
    .order("monitoredsince", { ascending: false });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/dashboard");

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
      }
    };

    fetchUserRole();
  }, [router]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [router]);

  // Fetch analytics profiles for admin view
  useEffect(() => {
    async function loadClientProfiles() {
      if (userRole !== "admin") return;

      setClientLoading(true);
      try {
        const { data, error } = await fetchAnalyticsProfiles();
        if (error) throw error;
        setClientProfiles(data || []);
      } catch (err: any) {
        setClientError(err.message);
      } finally {
        setClientLoading(false);
      }
    }
    loadClientProfiles();
  }, [userRole]);

  // Show loading state while checking permissions
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Regular user view
  if (userRole === "user") {
    return (
      <div className="p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Welcome to Charpstar Analytics!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                Hello {user?.email}, thank you for joining Charpstar Analytics.
              </p>
              <p className="text-gray-600">
                Our team will be setting up your analytics connection shortly.
                Once the setup is complete, you'll be able to access your
                analytics dashboard here.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  If you have any questions or need assistance, please don't
                  hesitate to contact our support team.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Client view - show analytics dashboard
  if (userRole === "client") {
    return <AnalyticsDashboard />;
  }

  // Admin view
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, Admin!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">You are logged in as {user?.email}</p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => router.push("/analytics")}
                  className="text-blue-600 hover:underline"
                >
                  View Analytics
                </button>
              </li>
              <li>
                <button
                  onClick={() => router.push("/settings")}
                  className="text-blue-600 hover:underline"
                >
                  Manage Settings
                </button>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Analytics Profiles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Analytics Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            {clientLoading ? (
              <div>Loading analytics profiles...</div>
            ) : clientError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{clientError}</AlertDescription>
              </Alert>
            ) : clientProfiles.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Name
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Monitored Since
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {clientProfiles.map((profile) => (
                      <tr
                        key={profile.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          {profile.name || "Unnamed Profile"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {profile.monitoredsince || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {profile.status || "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-600">No analytics profiles found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
