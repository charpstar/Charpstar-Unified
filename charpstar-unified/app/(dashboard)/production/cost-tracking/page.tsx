"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Badge,
  Progress,
  Alert,
  AlertDescription,
} from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { notificationService } from "@/lib/notificationService";
import {
  Euro,
  AlertTriangle,
  TrendingUp,
  Users,
  Package,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/utilities";
import type { DateRange } from "react-day-picker";

interface CostSummary {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  spentPercentage: number;
  warningThreshold: number;
  criticalThreshold: number;
}

interface MonthlyCosts {
  month: string;
  year: number;
  monthYear: string;
  totalSpent: number;
  completedCost: number;
  pendingCost: number;
  assetCount: number;
  completedAssets: number;
  pendingAssets: number;
}

interface ModelerCosts {
  modelerId: string;
  modelerEmail: string;
  modelerName: string;
  totalAssets: number;
  baseCost: number;
  bonusCost: number;
  totalCost: number;
  completedCost: number;
  pendingCost: number;
  completedAssets: number;
  pendingAssets: number;
}

interface AssetCost {
  id: string;
  product_name: string;
  article_id: string;
  client: string;
  batch: number;
  status: string;
  price: number;
  bonus_percentage: number;
  bonus_amount: number;
  total_cost: number;
  modeler_email: string;
  created_at: string;
  approved_at?: string;
  allocation_list_completed?: boolean;
}

export default function CostTrackingPage() {
  const user = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [costSummary, setCostSummary] = useState<CostSummary>({
    totalBudget: 4500,
    totalSpent: 0,
    remainingBudget: 4500,
    spentPercentage: 0,
    warningThreshold: 3000,
    criticalThreshold: 4000,
  });
  const [modelerCosts, setModelerCosts] = useState<ModelerCosts[]>([]);
  const [assetCosts, setAssetCosts] = useState<AssetCost[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCosts[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedModeler, setSelectedModeler] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("totalCost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Check if user has access
  useEffect(() => {
    if (user && user.metadata?.role === "admin") {
      fetchCostData();
    } else if (user && user.metadata?.role) {
      // User exists but doesn't have the right role
      router.push("/dashboard");
    }
    // Don't redirect if user is still loading (undefined)
  }, [user, router]);

  // Auto-check budget thresholds whenever spending changes (with debounce)
  useEffect(() => {
    if (!loading && costSummary.totalSpent > 0) {
      console.log(
        "💰 Auto-checking budget thresholds - spending changed to €",
        costSummary.totalSpent.toFixed(2)
      );

      // Debounce the budget threshold check to prevent multiple rapid calls
      const timeoutId = setTimeout(() => {
        checkBudgetThresholds(costSummary.totalSpent);
      }, 1000); // Wait 1 second before checking

      return () => clearTimeout(timeoutId);
    }
  }, [costSummary.totalSpent, loading]);

  // Function to show budget threshold notifications using the notification service
  const checkBudgetThresholds = async (totalSpent: number) => {
    try {
      console.log("🔍 Checking budget thresholds for €", totalSpent.toFixed(2));

      // Get all admin users to send notifications to
      const productionUserIds =
        await notificationService.getProductionAdminUsers();
      console.log(
        "👥 Admin users found:",
        productionUserIds.length,
        productionUserIds
      );

      if (productionUserIds.length === 0) {
        console.log("❌ No admin users found for budget notifications");
        return;
      }

      let alertSent = false;
      let thresholdHit = "";

      // TEMPORARY: Lower thresholds for testing - change these back to original values after testing
      const TEST_THRESHOLDS = {
        critical: 100, // Original: 4500
        warning: 50, // Original: 4000
        alert: 10, // Original: 3500
      };

      // Check thresholds and send notifications
      if (totalSpent >= TEST_THRESHOLDS.critical) {
        console.log(
          "🚨 CRITICAL threshold hit: €",
          totalSpent.toFixed(2),
          ">= €",
          TEST_THRESHOLDS.critical
        );
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: TEST_THRESHOLDS.critical,
            alertLevel: "critical",
          }
        );
        alertSent = true;
        thresholdHit = "critical";
      } else if (totalSpent >= TEST_THRESHOLDS.warning) {
        console.log(
          "⚠️ WARNING threshold hit: €",
          totalSpent.toFixed(2),
          ">= €",
          TEST_THRESHOLDS.warning
        );
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: TEST_THRESHOLDS.warning,
            alertLevel: "warning",
          }
        );
        alertSent = true;
        thresholdHit = "warning";
      } else if (totalSpent >= TEST_THRESHOLDS.alert) {
        console.log(
          "🔶 ALERT threshold hit: €",
          totalSpent.toFixed(2),
          ">= €",
          TEST_THRESHOLDS.alert
        );
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: TEST_THRESHOLDS.alert,
            alertLevel: "alert",
          }
        );
        alertSent = true;
        thresholdHit = "alert";
      } else {
        console.log(
          "✅ No thresholds hit - spending €",
          totalSpent.toFixed(2),
          "is below €",
          TEST_THRESHOLDS.alert
        );
      }

      if (alertSent) {
        console.log("📢 Budget alert sent successfully:", thresholdHit);

        // Trigger global notification update event
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));

        // Try to play notification sound
        try {
          const audio = new Audio(
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
          );
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore errors if audio fails
        } catch (e) {
          // Ignore audio errors
        }
      }
    } catch (error) {
      console.error("❌ Error sending budget notifications:", error);
    }
  };

  const fetchCostData = async () => {
    try {
      setLoading(true);

      console.log("Starting to fetch cost data...");

      // First, get all asset assignments for modelers
      const { data: assignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          role,
          status,
          price,
          allocation_list_id
        `
        )
        .eq("role", "modeler");

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        throw assignmentsError;
      }

      console.log("All assignments found:", assignments?.length);
      console.log("Sample assignment:", assignments?.[0]);
      console.log(
        "Assignment statuses:",
        assignments?.map((a) => a.status)
      );

      // Get unique user IDs from assignments to fetch profile information
      const userIds = [...new Set(assignments?.map((a) => a.user_id) || [])];
      console.log("Unique user IDs:", userIds);

      // Get unique allocation list IDs to fetch bonus information
      const allocationListIds = [
        ...new Set(
          assignments?.map((a) => a.allocation_list_id).filter(Boolean) || []
        ),
      ];
      console.log("Allocation list IDs:", allocationListIds);

      // Fetch profile information for all users in assignments
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email
        `
        )
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      // Fetch bonus information from allocation lists
      const { data: allocationLists, error: listsError } = await supabase
        .from("allocation_lists")
        .select(
          `
          id,
          bonus
        `
        )
        .in("id", allocationListIds);

      if (listsError) {
        console.error("Error fetching allocation lists:", listsError);
        throw listsError;
      }

      console.log("Profiles found:", profiles?.length);
      console.log("Sample profile:", profiles?.[0]);
      console.log("Allocation lists found:", allocationLists?.length);
      console.log("Sample allocation list:", allocationLists?.[0]);

      // Create a map of user_id to profile info
      const userToProfile = new Map();
      profiles?.forEach((profile) => {
        userToProfile.set(profile.id, {
          email: profile.email,
          name: profile.email, // Use email as name since full_name doesn't exist
        });
      });

      // Create a map of allocation_list_id to bonus info
      const allocationListToBonus = new Map();
      allocationLists?.forEach((list) => {
        allocationListToBonus.set(list.id, list.bonus || 0);
      });

      // Create a map of asset_id to modeler info and get unique asset IDs
      const assetToModeler = new Map();
      const assignedAssetIds = new Set<string>();

      assignments?.forEach((assignment) => {
        const profile = userToProfile.get(assignment.user_id);
        if (profile) {
          const bonus =
            allocationListToBonus.get(assignment.allocation_list_id) || 0;
          assetToModeler.set(assignment.asset_id, {
            email: profile.email,
            name: profile.name,
            price: assignment.price || 50,
            bonus: bonus,
          });
          assignedAssetIds.add(assignment.asset_id);
        }
      });

      console.log("Asset to modeler mapping:", assetToModeler.size, "entries");
      console.log("Assigned asset IDs:", assignedAssetIds.size);

      // Now fetch the assets that are assigned to modelers
      const { data: assignedAssets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select(
          `
          id,
          product_name,
          article_id,
          client,
          batch,
          status,
          created_at
        `
        )
        .in("id", Array.from(assignedAssetIds));

      if (assetsError) {
        console.error("Error fetching assets:", assetsError);
        throw assetsError;
      }

      console.log("Assigned assets found:", assignedAssets?.length);
      console.log("Sample asset:", assignedAssets?.[0]);
      console.log(
        "Asset statuses:",
        assignedAssets?.map((a) => a.status)
      );

      // Process assets - include all assets that have been assigned to modelers
      const processedAssets: AssetCost[] =
        assignedAssets?.map((asset) => {
          const modelerInfo = assetToModeler.get(asset.id) || {
            email: "Unknown",
            name: "Unknown",
            price: 50,
            bonus: 0,
          };

          // Use assignment price from asset_assignments, fallback to default
          const price = modelerInfo.price || 50;
          // Use bonus percentage from allocation_lists
          const bonusPercentage = modelerInfo.bonus || 0;
          const bonusAmount = price * (bonusPercentage / 100);
          const totalCost = price + bonusAmount;

          return {
            ...asset,
            price: price, // Use the price from asset_assignments
            bonus_percentage: bonusPercentage,
            bonus_amount: bonusAmount,
            total_cost: totalCost,
            modeler_email: modelerInfo.email,
            allocation_list_completed:
              asset.status === "delivered_by_artist" ||
              asset.status === "approved" ||
              asset.status === "approved_by_client",
          };
        }) || [];

      console.log("Processed assets:", processedAssets.length);
      console.log("Sample processed asset:", processedAssets[0]);

      // Calculate cost summary
      const totalSpent = processedAssets.reduce(
        (sum, asset) => sum + asset.total_cost,
        0
      );
      const remainingBudget = costSummary.totalBudget - totalSpent;
      const spentPercentage = (totalSpent / costSummary.totalBudget) * 100;

      setCostSummary((prev) => ({
        ...prev,
        totalSpent,
        remainingBudget,
        spentPercentage,
      }));

      // Group costs by modeler
      const modelerCostMap = new Map<string, ModelerCosts>();

      processedAssets.forEach((asset) => {
        const modelerId = asset.modeler_email;

        if (!modelerCostMap.has(modelerId)) {
          modelerCostMap.set(modelerId, {
            modelerId,
            modelerEmail: asset.modeler_email,
            modelerName: asset.modeler_email,
            totalAssets: 0,
            baseCost: 0,
            bonusCost: 0,
            totalCost: 0,
            completedCost: 0,
            pendingCost: 0,
            completedAssets: 0,
            pendingAssets: 0,
          });
        }

        const modelerCost = modelerCostMap.get(modelerId)!;
        modelerCost.totalAssets++;
        modelerCost.baseCost += asset.price || 50;
        modelerCost.bonusCost += asset.bonus_amount;
        modelerCost.totalCost += asset.total_cost;

        if (asset.allocation_list_completed) {
          modelerCost.completedAssets++;
          modelerCost.completedCost += asset.total_cost;
        } else {
          modelerCost.pendingAssets++;
          modelerCost.pendingCost += asset.total_cost;
        }
      });

      const modelerCostsArray = Array.from(modelerCostMap.values());
      console.log("Modeler costs:", modelerCostsArray);

      setModelerCosts(modelerCostsArray);
      setAssetCosts(processedAssets);

      // Calculate monthly costs
      const monthlyCostsData = calculateMonthlyCosts(processedAssets);
      setMonthlyCosts(monthlyCostsData);

      // Note: Budget thresholds are checked in the useEffect when totalSpent changes
    } catch (error) {
      console.error("Error fetching cost data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCosts = (assets: AssetCost[]): MonthlyCosts[] => {
    const monthlyMap = new Map<string, MonthlyCosts>();

    assets.forEach((asset) => {
      const date = new Date(asset.created_at);
      const month = date.toLocaleString("default", { month: "long" });
      const year = date.getFullYear();
      const monthYear = `${month} ${year}`;

      if (!monthlyMap.has(monthYear)) {
        monthlyMap.set(monthYear, {
          month,
          year,
          monthYear,
          totalSpent: 0,
          completedCost: 0,
          pendingCost: 0,
          assetCount: 0,
          completedAssets: 0,
          pendingAssets: 0,
        });
      }

      const monthlyData = monthlyMap.get(monthYear)!;
      monthlyData.totalSpent += asset.total_cost;
      monthlyData.assetCount++;

      if (asset.allocation_list_completed) {
        monthlyData.completedCost += asset.total_cost;
        monthlyData.completedAssets++;
      } else {
        monthlyData.pendingCost += asset.total_cost;
        monthlyData.pendingAssets++;
      }
    });

    // Sort by year and month
    return Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return months.indexOf(b.month) - months.indexOf(a.month);
    });
  };

  const getBudgetStatus = () => {
    if (costSummary.totalSpent >= costSummary.criticalThreshold) {
      return {
        status: "critical",
        message: "Budget critical! Exceeded €4000 threshold",
      };
    } else if (costSummary.totalSpent >= costSummary.warningThreshold) {
      return {
        status: "warning",
        message: "Budget warning! Approaching €3000 threshold",
      };
    }
    return { status: "safe", message: "Budget within safe limits" };
  };

  const filteredModelerCosts = modelerCosts
    .filter(
      (modeler) =>
        selectedModeler === "all" || modeler.modelerId === selectedModeler
    )
    .sort((a, b) => {
      const aValue = a[sortBy as keyof ModelerCosts] as number;
      const bValue = b[sortBy as keyof ModelerCosts] as number;
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

  const filteredAssetCosts = assetCosts
    .filter(
      (asset) =>
        selectedModeler === "all" || asset.modeler_email === selectedModeler
    )
    .filter(
      (asset) =>
        selectedMonth === "all" ||
        (() => {
          const date = new Date(asset.created_at);
          const month = date.toLocaleString("default", { month: "long" });
          const year = date.getFullYear();
          return `${month} ${year}` === selectedMonth;
        })()
    )
    .filter(
      (asset) =>
        !searchTerm ||
        asset.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.article_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const exportCostData = () => {
    const csvContent = [
      [
        "Modeler",
        "Total Assets",
        "Base Cost",
        "Bonus Cost",
        "Total Cost",
        "Completed Cost",
        "Pending Cost",
        "Completed Assets",
        "Pending Assets",
      ],
      ...filteredModelerCosts.map((modeler) => [
        modeler.modelerEmail,
        modeler.totalAssets.toString(),
        `€${modeler.baseCost.toFixed(2)}`,
        `€${modeler.bonusCost.toFixed(2)}`,
        `€${modeler.totalCost.toFixed(2)}`,
        `€${modeler.completedCost.toFixed(2)}`,
        `€${modeler.pendingCost.toFixed(2)}`,
        modeler.completedAssets.toString(),
        modeler.pendingAssets.toString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-tracking-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportMonthlyData = () => {
    const csvContent = [
      [
        "Month",
        "Total Assets",
        "Total Cost",
        "Completed Cost",
        "Pending Cost",
        "Completed Assets",
        "Pending Assets",
      ],
      ...monthlyCosts.map((month) => [
        month.monthYear,
        month.assetCount.toString(),
        `€${month.totalSpent.toFixed(2)}`,
        `€${month.completedCost.toFixed(2)}`,
        `€${month.pendingCost.toFixed(2)}`,
        month.completedAssets.toString(),
        month.pendingAssets.toString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-costs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!user || user.metadata?.role !== "admin") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for admin users.
          </p>
        </div>
      </div>
    );
  }

  const budgetStatus = getBudgetStatus();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-foreground">
              Cost Tracking
            </h1>
            {/* Notifications are now handled by the notification service */}
          </div>
          <p className="text-muted-foreground mt-2">
            Monitor budget, modeler costs, and bonuses across all projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchCostData} variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Refresh Data
          </Button>
          <Button
            onClick={() => checkBudgetThresholds(costSummary.totalSpent)}
            variant="outline"
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Test Notifications
          </Button>
          <Button
            onClick={async () => {
              console.log("🔍 Debug: Testing admin user query directly...");
              const users = await notificationService.getProductionAdminUsers();
              console.log("👥 Debug: Admin users found:", users);

              // Also test the raw Supabase query
              const { data, error } = await supabase
                .from("profiles")
                .select("id, email, metadata")
                .limit(5);
              console.log("🔍 Debug: Raw profiles query result:", {
                data,
                error,
              });
            }}
            variant="outline"
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Debug Users
          </Button>
          <Badge variant="outline" className="gap-1">
            <DollarSign className="h-3 w-3" />
            Admin Only
          </Badge>
        </div>
      </div>

      {/* Budget Threshold Notifications */}
      {/* Notifications are now handled by the notification service */}

      {/* Notification History */}
      {/* Notifications are now handled by the notification service */}

      {/* Budget Status Alert */}
      <Alert
        className={
          budgetStatus.status === "critical"
            ? "border-red-500 bg-red-50"
            : budgetStatus.status === "warning"
              ? "border-amber-500 bg-amber-50"
              : "border-green-500 bg-green-50"
        }
      >
        <AlertTriangle
          className={`h-4 w-4 ${
            budgetStatus.status === "critical"
              ? "text-red-600"
              : budgetStatus.status === "warning"
                ? "text-amber-600"
                : "text-green-600"
          }`}
        />
        <AlertDescription
          className={
            budgetStatus.status === "critical"
              ? "text-red-800"
              : budgetStatus.status === "warning"
                ? "text-amber-800"
                : "text-green-800"
          }
        >
          {budgetStatus.message}
        </AlertDescription>
      </Alert>

      {/* Cost Breakdown Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cost Breakdown Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.completedCost, 0)
                  .toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                Completed Costs
              </div>
              <div className="text-xs text-green-600 mt-1">
                {(
                  (modelerCosts.reduce((sum, m) => sum + m.completedCost, 0) /
                    costSummary.totalBudget) *
                  100
                ).toFixed(1)}
                % of budget
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600 mb-2">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.pendingCost, 0)
                  .toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Pending Costs</div>
              <div className="text-xs text-amber-600 mt-1">
                {(
                  (modelerCosts.reduce((sum, m) => sum + m.pendingCost, 0) /
                    costSummary.totalBudget) *
                  100
                ).toFixed(1)}
                % of budget
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                €{costSummary.remainingBudget.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                Available Budget
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {(
                  (costSummary.remainingBudget / costSummary.totalBudget) *
                  100
                ).toFixed(1)}
                % of budget
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Cost Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Cost Trends
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthlyCosts.map((month) => (
                    <SelectItem key={month.monthYear} value={month.monthYear}>
                      {month.monthYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={exportMonthlyData}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Monthly
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 py-3">
                  {[...Array(5)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-muted animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : monthlyCosts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Monthly Data</h3>
              <p className="text-muted-foreground">
                No cost data available for monthly analysis.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Total Assets</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Completed Cost</TableHead>
                  <TableHead>Pending Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyCosts
                  .filter(
                    (month) =>
                      selectedMonth === "all" ||
                      month.monthYear === selectedMonth
                  )
                  .map((month) => (
                    <TableRow key={month.monthYear}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{month.monthYear}</div>
                          <div className="text-xs text-muted-foreground">
                            {month.completedAssets} completed,{" "}
                            {month.pendingAssets} pending
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <span className="font-medium">
                            {month.assetCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold">
                            €{month.totalSpent.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-green-600" />
                          <span className="font-medium text-green-700">
                            €{month.completedCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-amber-600" />
                          <span className="font-medium text-amber-700">
                            €{month.pendingCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Euro className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Budget
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €{costSummary.totalBudget.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-xl">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Spent
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €{costSummary.totalSpent.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {costSummary.spentPercentage.toFixed(1)}% of budget
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Remaining Budget
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €{costSummary.remainingBudget.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Available for new projects
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-xl">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Modelers
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {modelerCosts.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  With active assignments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed Cost
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €
                  {modelerCosts
                    .reduce((sum, m) => sum + m.completedCost, 0)
                    .toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Already spent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Cost
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €
                  {modelerCosts
                    .reduce((sum, m) => sum + m.pendingCost, 0)
                    .toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Committed but not spent
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  This Month
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  €
                  {(() => {
                    const currentMonth = new Date().toLocaleString("default", {
                      month: "long",
                    });
                    const currentYear = new Date().getFullYear();
                    const currentMonthKey = `${currentMonth} ${currentYear}`;
                    const currentMonthData = monthlyCosts.find(
                      (m) => m.monthYear === currentMonthKey
                    );
                    return currentMonthData
                      ? currentMonthData.totalSpent.toFixed(2)
                      : "0.00";
                  })()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const currentMonth = new Date().toLocaleString("default", {
                      month: "long",
                    });
                    const currentYear = new Date().getFullYear();
                    const currentMonthKey = `${currentMonth} ${currentYear}`;
                    const currentMonthData = monthlyCosts.find(
                      (m) => m.monthYear === currentMonthKey
                    );
                    return currentMonthData
                      ? `${currentMonthData.assetCount} assets`
                      : "0 assets";
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>€0</span>
              <span>€{costSummary.warningThreshold}</span>
              <span>€{costSummary.criticalThreshold}</span>
              <span>€{costSummary.totalBudget}</span>
            </div>
            <Progress
              value={costSummary.spentPercentage}
              className="h-3"
              style={{
                background: `linear-gradient(to right, 
                  ${
                    costSummary.totalSpent >= costSummary.criticalThreshold
                      ? "#ef4444"
                      : costSummary.totalSpent >= costSummary.warningThreshold
                        ? "#f59e0b"
                        : "#10b981"
                  } 
                  ${costSummary.spentPercentage}%, 
                  #e5e7eb ${costSummary.spentPercentage}%)`,
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Safe</span>
              <span>Warning</span>
              <span>Critical</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Search Assets
              </label>
              <Input
                placeholder="Search by product, client, or article ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthlyCosts.map((month) => (
                    <SelectItem key={month.monthYear} value={month.monthYear}>
                      {month.monthYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Modeler</label>
              <Select
                value={selectedModeler}
                onValueChange={setSelectedModeler}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All modelers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modelers</SelectItem>
                  {modelerCosts.map((modeler) => (
                    <SelectItem
                      key={modeler.modelerId}
                      value={modeler.modelerId}
                    >
                      {modeler.modelerEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalCost">Total Cost</SelectItem>
                  <SelectItem value="baseCost">Base Cost</SelectItem>
                  <SelectItem value="bonusCost">Bonus Cost</SelectItem>
                  <SelectItem value="totalAssets">Total Assets</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium mb-2 block">Order</label>
              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High to Low</SelectItem>
                  <SelectItem value="asc">Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modeler Cost Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Modeler Cost Summary
            </CardTitle>
            <Button
              onClick={exportCostData}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="grid grid-cols-7 gap-4 py-3">
                  {[...Array(7)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-muted animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modeler</TableHead>
                  <TableHead>Total Assets</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Bonus Cost</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Completed Cost</TableHead>
                  <TableHead>Pending Cost</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModelerCosts.map((modeler) => (
                  <TableRow key={modeler.modelerId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {modeler.modelerEmail}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {modeler.totalAssets} assets
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <span className="font-medium">
                          {modeler.totalAssets}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €{modeler.baseCost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €{modeler.bonusCost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          €{modeler.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-green-600" />
                        <span className="font-medium text-green-700">
                          €{modeler.completedCost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-amber-600" />
                        <span className="font-medium text-amber-700">
                          €{modeler.pendingCost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700"
                        >
                          {modeler.completedAssets}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700"
                        >
                          {modeler.pendingAssets}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Asset Cost Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Asset Cost Details
            <Badge variant="outline" className="ml-auto">
              {filteredAssetCosts.length} assets
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-7 gap-4 py-3">
                  {[...Array(7)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-muted animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : filteredAssetCosts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Assets Found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No assets match your search criteria."
                  : "No approved assets found."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Modeler</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssetCosts.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{asset.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {asset.article_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{asset.client}</div>
                        <div className="text-xs text-muted-foreground">
                          Batch {asset.batch}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {asset.modeler_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €{asset.price.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <span>+{asset.bonus_percentage}%</span>
                        <div className="text-xs">
                          €{asset.bonus_amount.toFixed(2)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-bold">
                          €{asset.total_cost.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        {asset.allocation_list_completed ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
