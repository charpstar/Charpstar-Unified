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
import { Package, DollarSign, ArrowRight } from "lucide-react";

interface PendingAssignment {
  asset_id: string;
  deadline: string;
  price: number;
  bonus: number;
  onboarding_assets: {
    id: string;
    article_id: string;
    product_name: string;
    client: string;
    batch: number;
  } | null;
}

interface AssignmentGroup {
  batch: number;
  client: string;
  deadline: string;
  bonus: number;
  assignments: PendingAssignment[];
  totalAssets: number;
  totalPrice: number;
  totalWithBonus: number;
}

export function PendingAssignmentsWidget() {
  const user = useUser();
  const router = useRouter();
  const [pendingAssignments, setPendingAssignments] = useState<
    PendingAssignment[]
  >([]);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchPendingAssignments();
    }
  }, [user?.id]);

  useEffect(() => {
    groupAssignments();
  }, [pendingAssignments]);

  const fetchPendingAssignments = async () => {
    try {
      setLoading(true);

      // First, let's see ALL assignments for this user to debug
      const { data: allAssignments, error: allError } = await supabase
        .from("asset_assignments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("role", "modeler");

      // Check the status values of existing assignments
      const statusCounts = allAssignments?.reduce(
        (acc, assignment) => {
          const status = assignment.status || "null";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const { data: assignments, error } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          deadline,
          price,
          bonus,
          status,
          onboarding_assets(
            id,
            article_id,
            product_name,
            client,
            batch
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "pending"); // Pending assignments have "pending" status

      if (error) {
        console.error("Error fetching pending assignments:", error);
        return;
      }

      setPendingAssignments((assignments || []) as any);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupAssignments = () => {
    const groups = new Map<string, AssignmentGroup>();

    pendingAssignments.forEach((assignment) => {
      const asset = assignment.onboarding_assets;
      if (!asset) return;

      const groupKey = `${asset.client}-${asset.batch}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          batch: asset.batch,
          client: asset.client,
          deadline: assignment.deadline,
          bonus: assignment.bonus,
          assignments: [],
          totalAssets: 0,
          totalPrice: 0,
          totalWithBonus: 0,
        });
      }

      const group = groups.get(groupKey)!;
      group.assignments.push(assignment);
      group.totalAssets += 1;
      group.totalPrice += assignment.price || 0;
      group.totalWithBonus +=
        (assignment.price || 0) * (1 + (assignment.bonus || 0) / 100);
    });

    const groupedArray = Array.from(groups.values());
    setAssignmentGroups(groupedArray);
  };

  // Calculate summary statistics
  const totalAssets = pendingAssignments.length;
  const totalBasePay = pendingAssignments.reduce(
    (sum, assignment) => sum + (assignment.price || 0),
    0
  );
  const totalWithBonus = pendingAssignments.reduce(
    (sum, assignment) =>
      sum + (assignment.price || 0) * (1 + (assignment.bonus || 0) / 100),
    0
  );
  const totalBonus = totalWithBonus - totalBasePay;

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
            <div className="text-2xl font-bold text-blue-600">
              {totalAssets}
            </div>
            <div className="text-xs text-muted-foreground">Total Assets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${totalWithBonus.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Potential Earnings
            </div>
          </div>
        </div>

        {/* Group Summary */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Assigned Batches ({assignmentGroups.length})
          </div>
          {assignmentGroups.slice(0, 3).map((group, index) => (
            <div
              key={`${group.client}-${group.batch}`}
              className="flex items-center justify-between p-2 bg-muted rounded-lg"
            >
              <div>
                <div className="text-sm font-medium">
                  {group.client} - Batch {group.batch}
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.totalAssets} assets • $
                  {group.totalWithBonus.toFixed(2)}
                </div>
              </div>
              <Badge variant="secondary">+{group.bonus}%</Badge>
            </div>
          ))}
          {assignmentGroups.length > 3 && (
            <div className="text-xs text-muted-foreground text-center">
              +{assignmentGroups.length - 3} more groups
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
