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
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
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
  BarChart3,
  Calendar,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  PieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

interface PricingBreakdown {
  name: string;
  totalCost: number;
  count: number;
  color: string;
}

interface PricingOption {
  id: string;
  label: string;
  price: number;
  description: string;
}

// Pricing options matching admin-review page
const PRICING_OPTIONS: PricingOption[] = [
  {
    id: "pbr_3d_model_after_second",
    label: "PBR 3D Model (Premium)",
    price: 30,
    description: "Premium PBR 3D model creation",
  },
  {
    id: "additional_colors_after_second",
    label: "Additional Colors",
    price: 1.5,
    description: "Additional colors",
  },
  {
    id: "additional_textures_after_second",
    label: "Additional Textures",
    price: 7,
    description: "Additional textures/materials",
  },
  {
    id: "additional_sizes_after_second",
    label: "Additional Sizes",
    price: 5,
    description: "Additional sizes",
  },
  {
    id: "custom_pricing",
    label: "Custom Pricing",
    price: 0,
    description: "Custom pricing",
  },
];

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
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown[]>(
    []
  );
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

      // Calculate pricing breakdown
      const pricingBreakdownData = await calculatePricingBreakdown();
      setPricingBreakdown(pricingBreakdownData);

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

  const calculatePricingBreakdown = async () => {
    try {
      // Fetch assets with pricing options
      const { data: pricingAssets, error: pricingError } = await supabase
        .from("onboarding_assets")
        .select("pricing_option_id, price, status")
        .not("pricing_option_id", "is", null);

      if (pricingError) {
        console.error("Error fetching pricing assets:", pricingError);
        return [];
      }

      // Fetch allocation lists with corrections
      const { data: corrections, error: correctionsError } = await supabase
        .from("allocation_lists")
        .select("correction_amount, status, approved_at")
        .not("correction_amount", "is", null)
        .gt("correction_amount", 0);

      if (correctionsError) {
        console.error("Error fetching corrections:", correctionsError);
      }

      // Define color palette
      const colors = [
        "#10b981",
        "#3b82f6",
        "#8b5cf6",
        "#f59e0b",
        "#ef4444",
        "#6b7280",
      ];
      const breakdown = new Map<string, { totalCost: number; count: number }>();

      // Process pricing options
      pricingAssets?.forEach((asset) => {
        const isCompleted =
          asset.status === "approved" || asset.status === "approved_by_client";
        if (!isCompleted) return; // Only count completed assets

        const option = PRICING_OPTIONS.find(
          (opt) => opt.id === asset.pricing_option_id
        );
        const label = option ? option.label : "Other";
        const price = asset.price || 0;

        if (!breakdown.has(label)) {
          breakdown.set(label, { totalCost: 0, count: 0 });
        }

        const entry = breakdown.get(label)!;
        entry.totalCost += price;
        entry.count++;
      });

      // Process corrections
      const completedCorrections =
        corrections?.filter((c) => c.status === "approved" && c.approved_at) ||
        [];

      if (completedCorrections.length > 0) {
        const totalCorrections = completedCorrections.reduce(
          (sum, c) => sum + (c.correction_amount || 0),
          0
        );
        breakdown.set("Corrections", {
          totalCost: totalCorrections,
          count: completedCorrections.length,
        });
      }

      // Convert to array and add colors
      const result: PricingBreakdown[] = Array.from(breakdown.entries())
        .map(([name, { totalCost, count }], index) => ({
          name,
          totalCost: Math.round(totalCost * 100) / 100,
          count,
          color: colors[index % colors.length],
        }))
        .sort((a, b) => b.totalCost - a.totalCost);

      return result;
    } catch (error) {
      console.error("Error calculating pricing breakdown:", error);
      return [];
    }
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
    <div className="min-h-screen surface-base">
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="surface-raised rounded-xl p-6 shadow-depth-md border border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <BarChart3 className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Cost Tracking
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                    Monitor budget, modeler costs, and bonuses across all
                    projects
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Threshold Notifications */}
        {/* Notifications are now handled by the notification service */}

        {/* Notification History */}
        {/* Notifications are now handled by the notification service */}

        {/* Budget Status Alert */}
        <Alert
          className={`shadow-depth-md border-2 ${
            budgetStatus.status === "critical"
              ? "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
              : budgetStatus.status === "warning"
                ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg ${
                budgetStatus.status === "critical"
                  ? "bg-red-100/50 dark:bg-red-900/20"
                  : budgetStatus.status === "warning"
                    ? "bg-amber-100/50 dark:bg-amber-900/20"
                    : "bg-green-100/50 dark:bg-green-900/20"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  budgetStatus.status === "critical"
                    ? "text-red-600 dark:text-red-400"
                    : budgetStatus.status === "warning"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                }`}
              />
            </div>
            <AlertDescription
              className={`font-medium ${
                budgetStatus.status === "critical"
                  ? "text-red-800 dark:text-red-300"
                  : budgetStatus.status === "warning"
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-green-800 dark:text-green-300"
              }`}
            >
              {budgetStatus.message}
            </AlertDescription>
          </div>
        </Alert>

        {/* Cost Breakdown Summary */}
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                <BarChart3 className="h-5 w-5 text-foreground" />
              </div>
              Cost Breakdown Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="surface-raised rounded-xl p-5 shadow-depth-md border border-border/30 hover-lift">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-full bg-green-500/10 border border-green-500/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    €
                    {modelerCosts
                      .reduce((sum, m) => sum + m.completedCost, 0)
                      .toFixed(2)}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Approved Costs
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                      {(
                        (modelerCosts.reduce(
                          (sum, m) => sum + m.completedCost,
                          0
                        ) /
                          costSummary.totalBudget) *
                        100
                      ).toFixed(1)}
                      % of budget
                    </span>
                  </div>
                </div>
              </div>
              <div className="surface-raised rounded-xl p-5 shadow-depth-md border border-border/30 hover-lift">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/30">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                    €
                    {modelerCosts
                      .reduce((sum, m) => sum + m.pendingCost, 0)
                      .toFixed(2)}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Pending Costs
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {(
                        (modelerCosts.reduce(
                          (sum, m) => sum + m.pendingCost,
                          0
                        ) /
                          costSummary.totalBudget) *
                        100
                      ).toFixed(1)}
                      % of budget
                    </span>
                  </div>
                </div>
              </div>
              <div className="surface-raised rounded-xl p-5 shadow-depth-md border border-border/30 hover-lift sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/30">
                    <Euro className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    €{costSummary.remainingBudget.toFixed(2)}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Available Budget
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {(
                        (costSummary.remainingBudget /
                          costSummary.totalBudget) *
                        100
                      ).toFixed(1)}
                      % of budget
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Corrections Breakdown Chart */}
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                <PieChart className="h-5 w-5 text-foreground" />
              </div>
              Pricing Options & Corrections Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : pricingBreakdown.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-center">
                <div>
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No pricing data available
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pricingBreakdown}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/30"
                      />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as PricingBreakdown;
                            return (
                              <div className="surface-elevated shadow-depth-lg border border-border rounded-lg p-3">
                                <p className="font-semibold mb-1">
                                  {data.name}
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-400">
                                  Total: €{data.totalCost.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Count: {data.count}{" "}
                                  {data.count === 1 ? "item" : "items"}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar
                        barSize={100}
                        radius={[10, 10, 0, 0]}
                        dataKey="totalCost"
                        name="Total Cost (€)"
                      >
                        {pricingBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    const totalCost = pricingBreakdown.reduce(
                      (sum, item) => sum + item.totalCost,
                      0
                    );
                    return pricingBreakdown.map((item) => {
                      const percentage =
                        totalCost > 0
                          ? ((item.totalCost / totalCost) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <div
                          key={item.name}
                          className="surface-raised rounded-lg p-3 shadow-depth-sm border border-border/30"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-3 h-3 rounded-full shadow-depth-sm"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-sm font-semibold">
                              {item.name}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                €{item.totalCost.toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.count}{" "}
                                {item.count === 1 ? "item" : "items"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: item.color,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-muted-foreground min-w-[3rem] text-right">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Cost Trends */}
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <Calendar className="h-5 w-5 text-foreground" />
                </div>
                Monthly Cost Trends
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-40 text-sm shadow-depth-sm hover-lift">
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
                  className="gap-2 text-sm shadow-depth-sm hover-lift"
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
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted/50 border border-border shadow-depth-sm">
                  <Euro className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Budget
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    €{costSummary.totalBudget.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Spent */}
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 shadow-depth-sm">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Spent
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    €{costSummary.totalSpent.toFixed(2)}
                  </p>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mt-1">
                    {costSummary.spentPercentage.toFixed(1)}% of budget
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remaining Budget */}
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted/50 border border-border shadow-depth-sm">
                  <Clock className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Remaining Budget
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    €{costSummary.remainingBudget.toFixed(2)}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    Available for projects
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Cost */}
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 shadow-depth-sm">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Approved Cost
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    €
                    {modelerCosts
                      .reduce((sum, m) => sum + m.completedCost, 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mt-1">
                    Client approved & invoiced
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Cost */}
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-depth-sm">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Pending Cost
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
                    €
                    {modelerCosts
                      .reduce((sum, m) => sum + m.pendingCost, 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">
                    Committed, not spent
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* This Month */}
          <Card className="surface-elevated shadow-depth-md border border-border/50 overflow-hidden hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted/50 border border-border shadow-depth-sm">
                  <Calendar className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    This Month (Completed)
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    €
                    {(() => {
                      const currentMonth = new Date().toLocaleString(
                        "default",
                        {
                          month: "long",
                        }
                      );
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
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    {(() => {
                      const currentMonth = new Date().toLocaleString(
                        "default",
                        {
                          month: "long",
                        }
                      );
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress Bar */}
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                <BarChart3 className="h-5 w-5 text-foreground" />
              </div>
              Budget Progress (Approved Costs Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-5">
              <div className="flex justify-between text-xs sm:text-sm font-semibold text-muted-foreground">
                <span className="px-2 py-1 rounded-md bg-muted/50">€0</span>
                <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  €{costSummary.warningThreshold}
                </span>
                <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-700 dark:text-red-400">
                  €{costSummary.criticalThreshold}
                </span>
                <span className="px-2 py-1 rounded-md bg-muted/50">
                  €{costSummary.totalBudget}
                </span>
              </div>
              <div className="relative">
                <div className="h-4 sm:h-5 rounded-full overflow-hidden bg-muted/30 border border-border/50 shadow-depth-inner">
                  <div
                    className={`h-full transition-all duration-500 ease-out shadow-depth-sm ${
                      costSummary.totalSpent >= costSummary.criticalThreshold
                        ? "bg-gradient-to-r from-red-500 to-red-600"
                        : costSummary.totalSpent >= costSummary.warningThreshold
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-green-500 to-emerald-500"
                    }`}
                    style={{ width: `${costSummary.spentPercentage}%` }}
                  >
                    <div className="h-full w-full bg-gradient-to-b from-white/20 to-transparent"></div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-depth-sm"></div>
                  <span className="text-muted-foreground">Safe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-depth-sm"></div>
                  <span className="text-muted-foreground">Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 shadow-depth-sm"></div>
                  <span className="text-muted-foreground">Critical</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                <Filter className="h-5 w-5 text-foreground" />
              </div>
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
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="All months" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months</SelectItem>
                      {monthlyCosts.map((month) => (
                        <SelectItem
                          key={month.monthYear}
                          value={month.monthYear}
                        >
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
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <Users className="h-5 w-5 text-foreground" />
                </div>
                Modeler Cost Summary
              </CardTitle>
              <Button
                onClick={exportCostData}
                variant="outline"
                className="gap-2 text-sm w-full sm:w-auto shadow-depth-sm hover-lift"
              >
                <Download className="h-4 w-4" />
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
        <Card className="surface-elevated shadow-depth-lg border border-border/50 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                <Package className="h-5 w-5 text-foreground" />
              </div>
              Client Cost Overview
              <Badge
                variant="outline"
                className="ml-auto text-xs sm:text-sm shadow-depth-sm px-3 py-1"
              >
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
    </div>
  );
}
