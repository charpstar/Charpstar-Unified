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
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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

interface ClientModelerBreakdown {
  modelerId: string;
  modelerEmail: string;
  totalAssets: number;
  baseCost: number;
  bonusCost: number;
  totalCost: number;
  completedCost: number;
  pendingCost: number;
  completedAssets: number;
  pendingAssets: number;
}

interface ClientCosts {
  client: string;
  assetCount: number;
  completedCost: number;
  pendingCost: number;
  completedAssets: number;
  pendingAssets: number;
  modelers: ClientModelerBreakdown[];
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
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clientCosts, setClientCosts] = useState<ClientCosts[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedModeler, setSelectedModeler] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("totalCost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedClients, setExpandedClients] = useState<
    Record<string, boolean>
  >({});

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
      // Get all admin users to send notifications to
      const productionUserIds =
        await notificationService.getProductionAdminUsers();

      if (productionUserIds.length === 0) {
        return;
      }

      let alertSent = false;

      // Budget threshold configuration
      // These thresholds trigger notifications when spending reaches certain levels
      const BUDGET_THRESHOLDS = {
        critical: 4500, // Critical: 100% of budget (€4500)
        warning: 4000, // Warning: 88.9% of budget (€4000)
        alert: 3500, // Alert: 77.8% of budget (€3500)
      };

      // Check thresholds and send notifications
      if (totalSpent >= BUDGET_THRESHOLDS.critical) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.critical,
            alertLevel: "critical",
          }
        );
        alertSent = true;
      } else if (totalSpent >= BUDGET_THRESHOLDS.warning) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.warning,
            alertLevel: "warning",
          }
        );
        alertSent = true;
      } else if (totalSpent >= BUDGET_THRESHOLDS.alert) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.alert,
            alertLevel: "alert",
          }
        );
        alertSent = true;
      } else {
      }

      if (alertSent) {
        // Trigger global notification update event
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));

        // Try to play notification sound
        try {
          const audio = new Audio(
            "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
          );
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore errors if audio fails
        } catch {
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

      // Get unique user IDs from assignments to fetch profile information
      const userIds = [...new Set(assignments?.map((a) => a.user_id) || [])];

      // Get unique allocation list IDs to fetch bonus information
      const allocationListIds = [
        ...new Set(
          assignments?.map((a) => a.allocation_list_id).filter(Boolean) || []
        ),
      ];

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

          // Only mark as completed when client has approved, not when modeler delivers
          // delivered_by_artist = modeler finished, waiting for QA review
          // approved = QA approved, waiting for client review
          // approved_by_client = client approved, truly completed
          return {
            ...asset,
            price: price, // Use the price from asset_assignments
            bonus_percentage: bonusPercentage,
            bonus_amount: bonusAmount,
            total_cost: totalCost,
            modeler_email: modelerInfo.email,
            status: asset.status, // Preserve the original status
            allocation_list_completed:
              asset.status === "approved" ||
              asset.status === "approved_by_client",
          };
        }) || [];

      // Calculate cost summary - only include completed costs (approved by client, not just delivered by artist)
      const totalSpent = processedAssets
        .filter((asset) => asset.allocation_list_completed)
        .reduce((sum, asset) => sum + asset.total_cost, 0);
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

        if (asset.allocation_list_completed) {
          modelerCost.completedAssets++;
          modelerCost.completedCost += asset.total_cost;
          modelerCost.totalCost += asset.total_cost; // Only add completed costs to totalCost
        } else {
          modelerCost.pendingAssets++;
          modelerCost.pendingCost += asset.total_cost;
          // Don't add pending costs to totalCost since they'll be invoiced later
        }
      });

      const modelerCostsArray = Array.from(modelerCostMap.values());

      setModelerCosts(modelerCostsArray);
      setAssetCosts(processedAssets);

      // Calculate monthly costs
      const monthlyCostsData = calculateMonthlyCosts(processedAssets);
      setMonthlyCosts(monthlyCostsData);

      // Calculate client costs with modeler breakdown
      const clientCostsData = calculateClientCosts(processedAssets);
      setClientCosts(clientCostsData);

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
      monthlyData.assetCount++;

      if (asset.allocation_list_completed) {
        monthlyData.completedCost += asset.total_cost;
        monthlyData.completedAssets++;
        monthlyData.totalSpent += asset.total_cost; // Only add completed costs to totalSpent
      } else {
        monthlyData.pendingCost += asset.total_cost;
        monthlyData.pendingAssets++;
        // Don't add pending costs to totalSpent since they'll be invoiced later
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

  const calculateClientCosts = (assets: AssetCost[]): ClientCosts[] => {
    const clientMap = new Map<string, ClientCosts>();

    assets.forEach((asset) => {
      if (!clientMap.has(asset.client)) {
        clientMap.set(asset.client, {
          client: asset.client,
          assetCount: 0,
          completedCost: 0,
          pendingCost: 0,
          completedAssets: 0,
          pendingAssets: 0,
          modelers: [],
        });
      }

      const clientData = clientMap.get(asset.client)!;
      clientData.assetCount++;

      // Find or create modeler breakdown entry
      let modelerEntry = clientData.modelers.find(
        (m) => m.modelerEmail === asset.modeler_email
      );
      if (!modelerEntry) {
        modelerEntry = {
          modelerId: asset.modeler_email,
          modelerEmail: asset.modeler_email,
          totalAssets: 0,
          baseCost: 0,
          bonusCost: 0,
          totalCost: 0,
          completedCost: 0,
          pendingCost: 0,
          completedAssets: 0,
          pendingAssets: 0,
        };
        clientData.modelers.push(modelerEntry);
      }

      modelerEntry.totalAssets++;
      modelerEntry.baseCost += asset.price || 50;
      modelerEntry.bonusCost += asset.bonus_amount;

      if (asset.allocation_list_completed) {
        clientData.completedAssets++;
        clientData.completedCost += asset.total_cost;
        modelerEntry.completedAssets++;
        modelerEntry.completedCost += asset.total_cost;
        modelerEntry.totalCost += asset.total_cost;
      } else {
        clientData.pendingAssets++;
        clientData.pendingCost += asset.total_cost;
        modelerEntry.pendingAssets++;
        modelerEntry.pendingCost += asset.total_cost;
        // Do not add pending to totalCost (not spent yet)
      }
    });

    // Sort modelers within each client by completed cost desc
    const results = Array.from(clientMap.values());
    results.forEach((c) => {
      c.modelers.sort((a, b) => b.completedCost - a.completedCost);
    });

    // Sort clients by completed cost desc
    results.sort((a, b) => b.completedCost - a.completedCost);
    return results;
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

  const filteredClientCosts = React.useMemo(() => {
    const filteredAssets = assetCosts
      .filter(
        (asset) =>
          selectedModeler === "all" || asset.modeler_email === selectedModeler
      )
      .filter((asset) => {
        if (selectedMonth === "all") return true;
        const date = new Date(asset.created_at);
        const month = date.toLocaleString("default", { month: "long" });
        const year = date.getFullYear();
        return `${month} ${year}` === selectedMonth;
      });

    let grouped = calculateClientCosts(filteredAssets);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      grouped = grouped.filter((c) => c.client.toLowerCase().includes(q));
    }
    return grouped;
  }, [assetCosts, selectedModeler, selectedMonth, searchTerm]);

  const exportCostData = () => {
    const csvContent = [
      [
        "Modeler",
        "Total Assets",
        "Base Cost",
        "Bonus Cost",
        "Total Cost ",
        "Approved Cost",
        "Pending Cost",
        "Approved Assets",
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
        "Completed Cost",
        "Pending Cost",
        "Completed Assets",
        "Pending Assets",
      ],
      ...monthlyCosts.map((month) => [
        month.monthYear,
        month.assetCount.toString(),
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

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied only after user context has loaded and user doesn't have access
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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Cost Tracking
            </h1>
            {/* Notifications are now handled by the notification service */}
          </div>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Monitor budget, modeler costs, and bonuses across all projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-xs sm:text-sm">
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
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Cost Breakdown Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.completedCost, 0)
                  .toFixed(2)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Approved Costs
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
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mb-2">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.pendingCost, 0)
                  .toFixed(2)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Pending Costs
              </div>
              <div className="text-xs text-amber-600 mt-1">
                {(
                  (modelerCosts.reduce((sum, m) => sum + m.pendingCost, 0) /
                    costSummary.totalBudget) *
                  100
                ).toFixed(1)}
                % of budget
              </div>
            </div>
            <div className="text-center sm:col-span-2 lg:col-span-1">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">
                €{costSummary.remainingBudget.toFixed(2)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
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
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              Monthly Cost Trends
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-40 text-sm">
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
                className="gap-2 text-sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Export Monthly</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3"
                >
                  {[...Array(4)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-muted animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : monthlyCosts.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <Calendar className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                No Monthly Data
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                No cost data available for monthly analysis.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Month
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Total Assets
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Completed Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Pending Cost
                    </TableHead>
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
                        <TableCell className="text-left">
                          <div>
                            <div className="font-medium text-sm sm:text-base">
                              {month.monthYear}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {month.completedAssets} completed,{" "}
                              {month.pendingAssets} pending
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div>
                            <span className="font-medium text-sm sm:text-base">
                              {month.assetCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Euro className="h-3 w-3 text-green-600" />
                            <span className="font-medium text-green-700 text-sm sm:text-base">
                              €{month.completedCost.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Euro className="h-3 w-3 text-amber-600" />
                            <span className="font-medium text-amber-700 text-sm sm:text-base">
                              €{month.pendingCost.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Budget */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-blue-100">
              <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Budget
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                €{costSummary.totalBudget.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-green-100">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Spent
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                €{costSummary.totalSpent.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {costSummary.spentPercentage.toFixed(1)}% of budget
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Remaining Budget */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-amber-100">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Remaining Budget
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                €{costSummary.remainingBudget.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Available for projects
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Modelers */}

        {/* Completed Cost */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-green-100">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Approved Cost
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.completedCost, 0)
                  .toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Client approved & invoiced
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Cost */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-amber-100">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Pending Cost
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                €
                {modelerCosts
                  .reduce((sum, m) => sum + m.pendingCost, 0)
                  .toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Committed, not spent
              </p>
            </div>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-indigo-100">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                This Month (Completed)
              </p>
              <p className="text-xl sm:text-2xl font-bold">
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
                    ? `${currentMonthData.completedAssets} completed assets`
                    : "0 completed assets";
                })()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bar */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Budget Progress (Approved Costs Only)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between text-xs sm:text-sm">
              <span>€0</span>
              <span>€{costSummary.warningThreshold}</span>
              <span>€{costSummary.criticalThreshold}</span>
              <span>€{costSummary.totalBudget}</span>
            </div>
            <Progress
              value={costSummary.spentPercentage}
              className="h-2 sm:h-3"
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
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="text-xs sm:text-sm font-medium mb-2 block">
                Search Assets
              </label>
              <Input
                placeholder="Search by product, client, or article ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm sm:text-base"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium mb-2 block">
                  Month
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="text-sm">
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
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium mb-2 block">
                  Modeler
                </label>
                <Select
                  value={selectedModeler}
                  onValueChange={setSelectedModeler}
                >
                  <SelectTrigger className="text-sm">
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
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium mb-2 block">
                  Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-sm">
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
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium mb-2 block">
                  Order
                </label>
                <Select
                  value={sortOrder}
                  onValueChange={(value) =>
                    setSortOrder(value as "asc" | "desc")
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">High to Low</SelectItem>
                    <SelectItem value="asc">Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modeler Cost Summary */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              Modeler Cost Summary
            </CardTitle>
            <Button
              onClick={exportCostData}
              variant="outline"
              className="gap-2 text-sm w-full sm:w-auto"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 py-3"
                >
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Modeler
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Total Assets
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Base Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Bonus Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Total Cost (Approved)
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Approved Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Pending Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Approved
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Pending
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModelerCosts.map((modeler) => (
                    <TableRow key={modeler.modelerId}>
                      <TableCell className="text-left">
                        <div>
                          <div className="font-medium text-sm sm:text-base">
                            {modeler.modelerEmail}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {modeler.totalAssets} assets
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div>
                          <span className="font-medium text-sm sm:text-base">
                            {modeler.totalAssets}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-sm sm:text-base">
                            €{modeler.baseCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-sm sm:text-base">
                            €{modeler.bonusCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold text-sm sm:text-lg">
                            €{modeler.totalCost.toFixed(2)}
                          </span>
                          <div className="text-xs text-muted-foreground ml-1 hidden sm:block">
                            (Approved)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-green-600" />
                          <span className="font-medium text-green-700 text-sm sm:text-base">
                            €{modeler.completedCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-amber-600" />
                          <span className="font-medium text-amber-700 text-sm sm:text-base">
                            €{modeler.pendingCost.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 text-xs"
                          >
                            {modeler.completedAssets}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div>
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 text-xs"
                          >
                            {modeler.pendingAssets}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Cost Overview */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            Client Cost Overview
            <Badge variant="outline" className="ml-auto text-xs sm:text-sm">
              {filteredClientCosts.length} clients
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 py-3"
                >
                  {[...Array(6)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-muted animate-pulse rounded"
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : filteredClientCosts.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <Package className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                No Clients Found
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                No client cost data available.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm text-left"></TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Client
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Completed Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Pending Cost
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Completed
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Pending
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientCosts.map((client) => (
                    <React.Fragment key={client.client}>
                      <TableRow>
                        <TableCell className="w-8 sm:w-10 text-left">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-5 w-5 sm:h-6 sm:w-6"
                            onClick={() =>
                              setExpandedClients((prev) => ({
                                ...prev,
                                [client.client]: !prev[client.client],
                              }))
                            }
                          >
                            {expandedClients[client.client] ? (
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                            ) : (
                              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="font-medium text-sm sm:text-base">
                            {client.client}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {client.completedAssets} completed,{" "}
                            {client.pendingAssets} pending
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Euro className="h-3 w-3 text-green-600" />
                            <span className="font-medium text-green-700 text-sm sm:text-base">
                              €{client.completedCost.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Euro className="h-3 w-3 text-amber-600" />
                            <span className="font-medium text-amber-700 text-sm sm:text-base">
                              €{client.pendingCost.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 text-xs"
                          >
                            {client.completedAssets}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 text-xs"
                          >
                            {client.pendingAssets}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {expandedClients[client.client] && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="p-3 rounded-md bg-muted/40">
                              <div className="text-xs sm:text-sm font-medium mb-2">
                                Modeler breakdown
                              </div>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Modeler
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Assets
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Base
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Bonus
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Completed
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Pending
                                      </TableHead>
                                      <TableHead className="text-xs sm:text-sm text-left">
                                        Total (Approved)
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {client.modelers.map((m) => (
                                      <TableRow key={m.modelerEmail}>
                                        <TableCell className="text-left">
                                          <div className="text-xs sm:text-sm">
                                            {m.modelerEmail}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-left text-xs sm:text-sm">
                                          {m.totalAssets}
                                        </TableCell>
                                        <TableCell className="text-left text-xs sm:text-sm">
                                          €{m.baseCost.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-left text-xs sm:text-sm">
                                          €{m.bonusCost.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-left text-green-700 text-xs sm:text-sm">
                                          €{m.completedCost.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-left text-amber-700 text-xs sm:text-sm">
                                          €{m.pendingCost.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-left font-medium text-xs sm:text-sm">
                                          €{m.totalCost.toFixed(2)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
