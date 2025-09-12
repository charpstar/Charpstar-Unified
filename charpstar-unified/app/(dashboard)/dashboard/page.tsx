"use client";

import { useUser } from "@/contexts/useUser";
import { useToast } from "@/components/ui/utilities";
import { AvatarPicker } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { ThemeSwitcherCard } from "@/components/ui/utilities";
import { Shield } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import React from "react";
import { FixedDashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { OnboardingDashboard } from "@/components/dashboard/onboarding-dashboard";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientDashboardTour } from "@/components/dashboard/client-dashboard-tour";
import { ModelerDashboardTour } from "@/components/dashboard/modeler-dashboard-tour";

interface DashboardStats {
  totalModels: number;
  totalCategories: number;
  totalMaterials: number;
  totalColors: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const user = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchedRef = React.useRef(false);

  // Get avatar from user metadata (same as nav-user)
  const userAvatar = user?.metadata?.avatar_url || null;

  // Add a fallback for when metadata is not loaded yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [fallbackAvatar, setFallbackAvatar] = useState<string | null>(null);

  // Fetch avatar as fallback if metadata is not available
  useEffect(() => {
    if (!user?.id || user?.metadata?.avatar_url !== undefined) {
      setFallbackAvatar(null);
      return;
    }

    // Only fetch if we don't have metadata yet
    const fetchFallbackAvatar = async () => {
      try {
        const response = await fetch(`/api/users/avatar?user_id=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setFallbackAvatar(data.avatar_url);
        }
      } catch (error) {
        console.error("Error fetching fallback avatar:", error);
      }
    };

    fetchFallbackAvatar();
  }, [user?.id, user?.metadata?.avatar_url]);

  useEffect(() => {
    document.title = "CharpstAR Platform - Dashboard";
  }, []);

  useEffect(() => {
    if (fetchedRef.current) {
      console.log(
        "🚫 Dashboard stats already fetched, skipping duplicate call"
      );
      return; // Prevent duplicate calls
    }
    fetchedRef.current = true;
    console.log("🔄 Fetching dashboard stats...");

    const fetchDashboardData = async () => {
      try {
        const fetchStats = async () => {
          const response = await fetch("/api/dashboard/stats");
          if (response.ok) {
            const data = await response.json();
            setStats(data);
            console.log("✅ Dashboard stats fetched successfully");
          }
        };

        await fetchStats();
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (searchParams.get("refreshUser") === "1") {
      // Option 1: Hard reload (guaranteed fresh user)
      window.location.replace("/dashboard");
      // Option 2: If you have refetchUser, call it here instead
      // await refetchUser();
      // router.replace("/dashboard");
    }
  }, [searchParams, router]);

  // Memoize the handleAvatarChange function to prevent recreation on every render
  const handleAvatarChange = useCallback(
    async (avatarUrl: string | null) => {
      if (!user?.id) return;

      try {
        const response = await fetch("/api/users/avatar", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            avatar_url: avatarUrl,
            user_id: user.id,
          }),
        });
        if (response.ok) {
          // Dispatch avatar update event for other components
          window.dispatchEvent(new CustomEvent("avatarUpdated"));
          toast({
            title: "Avatar updated!",
            description: "Your avatar has been updated successfully.",
          });
        } else {
          throw new Error("Failed to update avatar");
        }
      } catch (error) {
        console.error("Error updating avatar:", error);
        toast({
          title: "Error updating avatar",
          description: "Failed to update your avatar. Please try again.",
          variant: "destructive",
        });
      }
    },
    [user?.id, toast]
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getRoleBadgeVariant = (role: string) => {
    // Use "default" variant for all roles to get bg-primary color
    return "default";
  };

  // Create profile content
  const profileContent = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div className="relative">
          <AvatarPicker
            currentAvatar={userAvatar || undefined}
            onAvatarChange={handleAvatarChange}
          />
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-base sm:text-lg font-medium">
            {user?.email || "User"}
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Badge
              variant={
                getRoleBadgeVariant(user?.metadata?.role || "") as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline"
              }
            >
              {(user?.metadata?.role || "User").charAt(0).toUpperCase() +
                (user?.metadata?.role || "User").slice(1)}
            </Badge>
            {user?.metadata?.role === "admin" && (
              <Shield className="h-4 w-4 text-primary" />
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2"></div>
    </div>
  );

  if (!user) {
    return <DashboardSkeleton />;
  }

  // Show onboarding dashboard if user is still in onboarding (but skip for QA and modeler users)
  if (
    user?.metadata?.onboarding === true &&
    user?.metadata?.role === "client"
  ) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="container mx-auto p-6 space-y-6">
          <OnboardingDashboard />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Add the dashboard tour component for clients */}
        {user?.metadata?.role === "client" && !user?.metadata?.onboarding && (
          <ClientDashboardTour />
        )}
        {/* Add the dashboard tour component for modelers */}
        {user?.metadata?.role === "modeler" && <ModelerDashboardTour />}

        <FixedDashboard stats={stats} profileContent={profileContent} />
      </div>
    </Suspense>
  );
}
