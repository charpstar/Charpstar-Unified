"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import { Package, ArrowRight } from "lucide-react";

interface PendingAssignment {
  asset_id: string;
  price: number;
  onboarding_assets: {
    id: string;
    article_id: string;
    product_name: string;
    client: string;
    batch: number;
  } | null;
}

interface AllocationList {
  id: string;
  name: string;
  number: number;
  deadline: string;
  bonus: number;
  created_at: string;
  asset_assignments: PendingAssignment[];
  totalAssets: number;
  totalPrice: number;
  totalWithBonus: number;
}

export function PendingAssignmentsWidget() {
  const user = useUser();
  const router = useRouter();
  const [allocationLists, setAllocationLists] = useState<AllocationList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchPendingAssignments();
    }
  }, [user?.id]);

  const fetchPendingAssignments = async () => {
    try {
      setLoading(true);

      // Get pending allocation lists for this user
      const { data: lists, error: listsError } = await supabase
        .from("allocation_lists")
        .select(
          `
          id,
          name,
          number,
          deadline,
          bonus,
          created_at,
          asset_assignments!inner(
            asset_id,
            price,
            status,
            onboarding_assets(
              id,
              article_id,
              product_name,
              client,
              batch
            )
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("asset_assignments.status", "pending");

      if (listsError) {
        console.error("Error fetching pending allocation lists:", listsError);
        return;
      }

      // Transform the data to include calculated totals
      const transformedLists =
        lists?.map((list) => {
          const totalAssets = list.asset_assignments.length;
          const totalPrice = list.asset_assignments.reduce(
            (sum: number, assignment: any) => sum + (assignment.price || 0),
            0
          );
          // Note: Bonus only applies if completed before deadline
          const totalWithBonus = totalPrice * (1 + (list.bonus || 0) / 100);

          return {
            ...list,
            totalAssets,
            totalPrice,
            totalWithBonus,
          };
        }) || [];
      //@ts-expect-error - TODO: fix somehow- this is a bug in the types
      setAllocationLists(transformedLists);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const totalAssets = allocationLists.reduce(
    (sum, list) => sum + list.totalAssets,
    0
  );

  const totalWithBonus = allocationLists.reduce(
    (sum, list) => sum + list.totalWithBonus,
    0
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 bg-muted rounded-lg w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-muted rounded-lg w-64 animate-pulse"></div>
          </div>
          <div className="h-8 bg-muted rounded-full w-24 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-2 gap-6 flex-1 mb-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-gradient-to-br from-muted/50 to-muted animate-pulse rounded-2xl"
            />
          ))}
        </div>

        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-muted/50 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (totalAssets === 0) {
    return (
      <div className="h-full flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-1">
              Pending Assignments
            </h3>
            <p className="text-sm text-muted-foreground">
              Review and accept new work opportunities
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 dark:bg-muted/30 rounded-full">
            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
            <span className="text-xs text-muted-foreground font-medium">
              No Pending
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 rounded-2xl flex items-center justify-center mx-auto">
                <Package className="h-10 w-10 text-blue-500 dark:text-blue-400" />
              </div>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">
              All Caught Up!
            </h4>
            <p className="text-sm text-muted-foreground max-w-sm">
              You don&apos;t have any pending assignments at the moment. Check
              back later for new opportunities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-[320px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            Pending Assignments
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and accept new work opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pending Lists Count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 rounded-full border border-amber-200 dark:border-amber-800">
            <div className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {allocationLists.length} Lists
            </span>
          </div>
          {/* Assets Count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-full border border-blue-200 dark:border-blue-800">
            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              {totalAssets} Assets
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20">
          <div className="absolute inset-0 opacity-5 dark:opacity-10">
            <div className="absolute top-0 right-0 w-16 h-16 transform rotate-45 translate-x-6 -translate-y-6 bg-current rounded-full"></div>
          </div>
          <div className="relative p-6 text-center">
            <div className="p-3 rounded-xl bg-blue-500 dark:bg-blue-600 shadow-lg shadow-blue-500/20 dark:shadow-blue-400/20 mx-auto mb-3 w-fit">
              <Package className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1 transition-all duration-300 group-hover:scale-110">
              {totalAssets}
            </p>
            <p className="text-sm font-semibold text-foreground/80 dark:text-foreground/90">
              Total Assets
            </p>
            <p className="text-xs text-muted-foreground">Ready to assign</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 dark:bg-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left"></div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50 transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-400/20">
          <div className="absolute inset-0 opacity-5 dark:opacity-10">
            <div className="absolute bottom-0 left-0 w-16 h-16 transform -rotate-45 -translate-x-6 translate-y-6 bg-current rounded-full"></div>
          </div>
          <div className="relative p-6 text-center">
            <div className="p-3 rounded-xl bg-emerald-500 dark:bg-emerald-600 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-400/20 mx-auto mb-3 w-fit">
              <span className="text-white font-bold text-lg">€</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1 transition-all duration-300 group-hover:scale-110">
              {totalWithBonus.toFixed(0)}
            </p>
            <p className="text-sm font-semibold text-foreground/80 dark:text-foreground/90">
              Potential Earnings
            </p>
            <p className="text-xs text-muted-foreground">With bonuses</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 dark:bg-emerald-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out origin-left"></div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-auto">
        <Button
          onClick={() => router.push("/pending-assignments")}
          className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 border-0 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 dark:shadow-blue-400/25 dark:hover:shadow-blue-400/30 transition-all duration-300 ease-out hover:scale-[1.02]"
          size="lg"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
          <ArrowRight className="h-5 w-5 mr-2 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
          <span className="relative z-10 font-semibold">
            Review & Accept Assignments
          </span>
        </Button>
      </div>
    </div>
  );
}
