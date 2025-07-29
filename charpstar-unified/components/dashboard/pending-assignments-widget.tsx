"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalAssets === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No pending assignments
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Pending Assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-medium text-info">{totalAssets}</div>
            <div className="text-xs text-muted-foreground">Total Assets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-medium text-success">
              ${totalWithBonus.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Potential Earnings
            </div>
          </div>
        </div>

        {/* Allocation Lists Summary */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Allocation Lists ({allocationLists.length})
          </div>
          {allocationLists.slice(0, 3).map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between p-2 bg-muted rounded-lg"
            >
              <div>
                <div className="text-sm font-medium">{list.name}</div>
                <div className="text-xs text-muted-foreground">
                  {list.totalAssets} assets • ${list.totalWithBonus.toFixed(2)}
                </div>
              </div>
              <Badge variant="secondary">+{list.bonus}%</Badge>
            </div>
          ))}
          {allocationLists.length > 3 && (
            <div className="text-xs text-muted-foreground text-center">
              +{allocationLists.length - 3} more lists
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={() => router.push("/pending-assignments")}
          className="w-full"
          variant="outline"
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}
