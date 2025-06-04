"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import {
  Package,
  TrendingUp,
  Boxes,
  Palette,
  Layers,
  ChartBar,
  User2,
  BarChart3,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { ThemeSwitcherCard } from "@/components/ui/theme-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface User {
  id: string;
  email: string;
  name: string;
  analytics_profile_id?: string;
  metadata?: {
    analytics_profile_id?: string;
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
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
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
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

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
  }: {
    title: string;
    value: number | string;
    icon: any;
    description?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User2 className="h-4 w-4" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-border">
                    <AvatarFallback className="bg-primary/10 text-muted-foreground text-lg">
                      {getInitials(user?.email || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-lg font-medium">
                      {user?.email || "User"}
                    </p>
                    <div className="flex items-center gap-2">
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
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
