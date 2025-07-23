"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { DollarSign, Calendar, Gift, Check, X, Package } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { format } from "date-fns";
import { toast } from "sonner";

interface AssignmentSummary {
  totalAssets: number;
  totalPay: number;
  deadline: string;
  bonus: number;
  client: string;
  assetIds: string[];
  assetNames: string[];
}

export function AssignmentWidget() {
  const user = useUser();
  const [assignmentSummary, setAssignmentSummary] =
    useState<AssignmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const fetchAssignmentSummary = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get all modeler assignments for the current user
      const { data: assignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          deadline,
          price,
          bonus,
          onboarding_assets!inner(
            id,
            product_name,
            client,
            status
          )
        `
        )
        .eq("user_id", user.id)
        .eq("role", "modeler")
        .eq("onboarding_assets.status", "in_production");

      if (assignmentError) throw assignmentError;

      if (!assignments || assignments.length === 0) {
        setAssignmentSummary(null);
        return;
      }

      // Group by deadline and bonus (assuming same deadline/bonus for grouped assignments)
      const firstAssignment = assignments[0];
      const totalPay = assignments.reduce(
        (sum, assignment) => sum + (assignment.price || 0),
        0
      );
      const assetIds = assignments.map((a) => a.asset_id);
      const assetNames = assignments.map(
        (a) => (a.onboarding_assets as any).product_name
      );
      const client = (firstAssignment.onboarding_assets as any).client;

      setAssignmentSummary({
        totalAssets: assignments.length,
        totalPay,
        deadline: firstAssignment.deadline,
        bonus: firstAssignment.bonus || 0,
        client,
        assetIds,
        assetNames,
      });
    } catch (error) {
      console.error("Error fetching assignment summary:", error);
      toast.error("Failed to load assignment summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentSummary();
  }, [user?.id]);

  const handleAccept = async () => {
    if (!assignmentSummary || !user?.id) return;

    try {
      setAccepting(true);

      // Update all assignments to accepted status
      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("role", "modeler")
        .in("asset_id", assignmentSummary.assetIds);

      if (error) throw error;

      toast.success("Assignment accepted successfully!");

      // Refresh the summary
      await fetchAssignmentSummary();
    } catch (error) {
      console.error("Error accepting assignment:", error);
      toast.error("Failed to accept assignment");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!assignmentSummary || !user?.id) return;

    try {
      setDeclining(true);

      // Update all assignments to declined status
      const { error } = await supabase
        .from("asset_assignments")
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("role", "modeler")
        .in("asset_id", assignmentSummary.assetIds);

      if (error) throw error;

      toast.success("Assignment declined successfully!");

      // Refresh the summary
      await fetchAssignmentSummary();
    } catch (error) {
      console.error("Error declining assignment:", error);
      toast.error("Failed to decline assignment");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assignment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignmentSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assignment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active assignments</p>
            <p className="text-sm">
              You&apos;ll see assignment details here when assets are allocated
              to you.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalAssets, totalPay, deadline, bonus, client, assetNames } =
    assignmentSummary;
  const deadlineDate = new Date(deadline);
  const isOverdue = deadlineDate < new Date();
  const daysUntilDeadline = Math.ceil(
    (deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Assignment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client and Asset Count */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{client}</h3>
            <p className="text-sm text-muted-foreground">
              {totalAssets} asset{totalAssets !== 1 ? "s" : ""} assigned
            </p>
          </div>
          <Badge variant={isOverdue ? "destructive" : "default"}>
            {isOverdue
              ? "Overdue"
              : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} left`}
          </Badge>
        </div>

        {/* Asset List */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Assigned Assets:</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {assetNames.map((name, index) => (
              <div
                key={index}
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></div>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Pay</p>
              <p className="font-semibold text-green-600">
                ${totalPay.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Deadline</p>
              <p className="font-semibold text-blue-600">
                {format(deadlineDate, "MMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
            <Gift className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Bonus</p>
              <p className="font-semibold text-purple-600">{bonus}%</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleAccept}
            disabled={accepting || declining}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-2" />
            {accepting ? "Accepting..." : "Accept Assignment"}
          </Button>

          <Button
            onClick={handleDecline}
            disabled={accepting || declining}
            variant="outline"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {declining ? "Declining..." : "Decline Assignment"}
          </Button>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-muted-foreground text-center">
          <p>
            By accepting, you agree to complete the assigned assets by the
            deadline.
          </p>
          <p>Total with bonus: ${(totalPay * (1 + bonus / 100)).toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
