"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import {
  Package,
  TrendingUp,
  Boxes,
  ChartBar,
  User2,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { ThemeSwitcherCard } from "@/components/ui/theme-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";
import React from "react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis } from "recharts";

interface User {
  id: string;
  email: string;
  name: string;
  analytics_profile_id?: string;
  metadata?: {
    analytics_profile_id?: string;
    role?: string;
  };
}

interface UserProfile {
  id: string;
  role: string;
  user_id: string;
}

interface DashboardStats {
  totalModels: number;
  totalCategories: number;
  totalMaterials: number;
  totalColors: number;
}

interface AnalyticsProfile {
  id: string;
  projectid: string;
  datasetid: string;
  tablename: string;
}

type StatCardProps = { title: string; value: number; icon: React.ReactNode };
function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="bg-card rounded shadow p-4 flex items-center space-x-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="font-bold text-lg">{value}</div>
      </div>
    </div>
  );
}

type ChartDatum = { date: string; uploads: number; registrations: number };
function AdminDashboardWidgets() {
  const [chartData, setChartData] = React.useState<ChartDatum[]>([]);
  const [modelCount, setModelCount] = React.useState(0);
  const [userCount, setUserCount] = React.useState(0);

  React.useEffect(() => {
    async function fetchData() {
      const { data: uploads } = await supabase
        .from("assets")
        .select("created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      const { data: users } = await supabase
        .from("profiles")
        .select("created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      const uploadsByDay = days.map(
        (date) =>
          uploads?.filter((u) => u.created_at.slice(0, 10) === date).length || 0
      );
      const usersByDay = days.map(
        (date) =>
          users?.filter((u) => u.created_at.slice(0, 10) === date).length || 0
      );
      setChartData(
        days.map((date, i) => ({
          date,
          uploads: uploadsByDay[i],
          registrations: usersByDay[i],
        }))
      );
      setModelCount(uploads?.length || 0);
      setUserCount(users?.length || 0);
    }
    fetchData();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-card rounded shadow p-4 flex flex-col">
        <StatCard title="Models Uploaded (7d)" value={modelCount} icon="📦" />
        <div className="mt-2">
          <ChartContainer
            config={{ uploads: { label: "Uploads", color: "#6366f1" } }}
          >
            <BarChart data={chartData} height={60}>
              <XAxis dataKey="date" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={24} />
              <ChartTooltip />
              <Bar dataKey="uploads" fill="var(--color-uploads)" barSize={7} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
      <div className="bg-card rounded shadow p-4 flex flex-col">
        <StatCard title="New Users (7d)" value={userCount} icon="👤" />
        <div className="mt-2">
          <ChartContainer
            config={{
              registrations: { label: "Registrations", color: "#22c55e" },
            }}
          >
            <BarChart data={chartData} height={60}>
              <XAxis dataKey="date" fontSize={10} />
              <YAxis allowDecimals={false} fontSize={10} width={24} />
              <ChartTooltip />
              <Bar
                dataKey="registrations"
                fill="var(--color-registrations)"
                barSize={7}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const user = useUser() as User | null;

  useEffect(() => {
    document.title = "CharpstAR Platform - Dashboard";
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient();

      try {
        // Fetch user profile with role
        if (user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profileError || !profile) {
            console.error("Error fetching profile:", profileError);
            return;
          }

          setUserProfile(profile);
        }

        // Fetch total models
        const { count: totalModels } = await supabase
          .from("assets")
          .select("*", { count: "exact", head: true });

        // Fetch categories
        const { data: categories } = await supabase
          .from("categories")
          .select("id");

        // Get unique materials and colors
        const { data: assets } = await supabase
          .from("assets")
          .select("materials, colors");

        const materials = new Set();
        const colors = new Set();

        assets?.forEach((asset) => {
          asset.materials?.forEach((m: string) => materials.add(m));
          asset.colors?.forEach((c: string) => colors.add(c));
        });

        // Fetch analytics profile if user has one
        const analyticsProfileId =
          user?.analytics_profile_id || user?.metadata?.analytics_profile_id;
        if (analyticsProfileId) {
          const { data: analytics } = await supabase
            .from("analytics_profiles")
            .select("*")
            .eq("id", analyticsProfileId)
            .single();

          if (analytics) {
            setAnalyticsProfile(analytics);
          }
        }

        setStats({
          totalModels: totalModels || 0,
          totalCategories: categories?.length || 0,
          totalMaterials: materials.size,
          totalColors: colors.size,
        });
      } catch {
        console.error("Error fetching dashboard stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "blue";
      case "editor":
        return "green";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User2 className="h-4 w-4" />
                  User Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border border-border">
                      <AvatarFallback className="bg-primary/10 text-muted-foreground text-base sm:text-lg">
                        {getInitials(user?.email || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="text-base sm:text-lg font-medium">
                        {user?.email || "User"}
                      </p>
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <Badge
                          variant={
                            getRoleBadgeVariant(userProfile?.role || "") as any
                          }
                        >
                          {(userProfile?.role || "User")
                            .charAt(0)
                            .toUpperCase() +
                            (userProfile?.role || "User").slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User2 className="h-4 w-4" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border border-border">
                    <AvatarFallback className="bg-primary/10 text-muted-foreground text-base sm:text-lg">
                      {getInitials(user?.email || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-base sm:text-lg font-medium">
                      {user?.email || "User"}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Badge
                        variant={
                          getRoleBadgeVariant(userProfile?.role || "") as any
                        }
                      >
                        {(userProfile?.role || "User").charAt(0).toUpperCase() +
                          (userProfile?.role || "User").slice(1)}
                      </Badge>
                      {userProfile?.role === "admin" && (
                        <Shield className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <ThemeSwitcherCard />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Link
                    href="/asset-library/upload"
                    className="flex items-center gap-2"
                  >
                    <Package className="h-4 w-4" />
                    Upload New Model
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Link
                    href="/asset-library"
                    className="flex items-center gap-2"
                  >
                    <Boxes className="h-4 w-4" />
                    Browse Models
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Link href="/analytics" className="flex items-center gap-2">
                    <ChartBar className="h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={`/3d-editor/${(user?.metadata as any)?.client_config}`}
                    className="flex items-center gap-2"
                  >
                    <Boxes className="h-4 w-4" />
                    Editor
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {user?.metadata?.role === "admin" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4">
          <AdminDashboardWidgets />
        </div>
      )}
    </div>
  );
}
