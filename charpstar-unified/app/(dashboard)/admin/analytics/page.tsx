"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/interactive";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Clock,
  Save,
  LogIn,
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Euro,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  PieChart,
  Package,
} from "lucide-react";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { notificationService } from "@/lib/notificationService";
import React from "react";
import { SceneRenderStats } from "@/components/analytics/SceneRenderStats";
import { UsageOverTimeChart } from "@/components/analytics/UsageOverTimeChart";
import { TopUsersChart } from "@/components/analytics/TopUsersChart";
import { FormatDistributionChart } from "@/components/analytics/FormatDistributionChart";
import { ConversionRateChart } from "@/components/analytics/ConversionRateChart";
import { SceneRendersTable } from "@/components/analytics/SceneRendersTable";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell,
} from "recharts";

interface AnalyticsData {
  sceneRenderSummary: {
    totalRenders: number;
    totalSaves: number;
    conversionRate: number;
    averageGenerationTime: number;
    successRate: number;
  };
  usageOverTime: Array<{
    date: string;
    renders: number;
    saves: number;
  }>;
  topUsers: Array<{
    client: string;
    email: string;
    renders: number;
    saves: number;
    conversionRate: number;
  }>;
  formatDistribution: Array<{
    format: string;
    count: number;
    percentage: number;
  }>;
  conversionRateTrend: Array<{
    date: string;
    conversionRate: number;
  }>;
  detailedRenders: Array<{
    id: string;
    date: string;
    time: string;
    client: string;
    email: string;
    objectType: string;
    format: string;
    status: string;
    saved: boolean;
    generationTime: number;
    errorMessage?: string;
  }>;
  clientActivities?: {
    summary: {
      uniqueUsers: number;
      totalLogins: number;
      totalSceneRenders: number;
      totalActivities: number;
    };
    dailyActivity: Array<{
      date: string;
      logins: number;
      sceneRenders: number;
      other: number;
    }>;
    rawData: Array<any>;
  };
  // Performance & Timing Metrics
  performanceMetrics?: {
    hourlyUsage: Array<{
      hour: number;
      renders: number;
      saves: number;
    }>;
    dayOfWeekUsage: Array<{
      day: number;
      dayName: string;
      renders: number;
      saves: number;
    }>;
    errorRateBreakdown: Array<{
      error: string;
      count: number;
      percentage: number;
    }>;
    generationTimePercentiles: {
      p50: number;
      p75: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
  };
  // Client Engagement & Retention
  engagementMetrics?: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number | null;
    newUsers: number;
    returningUsers: number;
    clientGrowthRate: number;
    growthRate: number;
    churnRiskClients: Array<{
      client: string;
      currentActivity: number;
      previousActivity: number;
      declinePercentage: number;
    }>;
  };
  // Advanced Usage Insights
  usageInsights?: {
    formatPreferencesByClient: Array<{
      client: string;
      formats: Array<{ format: string; count: number }>;
    }>;
    objectTypesByClient: Array<{
      client: string;
      types: Array<{ type: string; count: number }>;
    }>;
    frequencyDistribution: Array<{
      range: string;
      count: number;
    }>;
    featureAdoption: {
      multiAssetMode: number;
      inspirationUsed: number;
      totalRenders: number;
      multiAssetPercentage: number;
      inspirationPercentage: number;
    };
  };
  // Quality & Efficiency Metrics
  qualityMetrics?: {
    successRateByFormat: Array<{
      format: string;
      total: number;
      success: number;
      successRate: number;
    }>;
    successRateByObjectType: Array<{
      type: string;
      total: number;
      success: number;
      successRate: number;
    }>;
    avgGenerationTimeByClient: Array<{
      client: string;
      averageTime: number;
      count: number;
    }>;
    reRenderRate: number;
    reRenderPercentage: number;
  };
  // Comparative Analytics
  comparativeAnalytics?: {
    periodComparison: {
      current: {
        totalRenders: number;
        totalSaves: number;
        conversionRate: number;
        uniqueClients: number;
        averageGenerationTime: number;
      };
      previous: {
        totalRenders: number;
        totalSaves: number;
        conversionRate: number;
        uniqueClients: number;
        averageGenerationTime: number;
      };
      growth: {
        renders: number;
        saves: number;
        conversionRate: number;
        clients: number;
      };
    };
    platformAverages: {
      averageConversionRate: number;
      averageGenerationTime: number;
      averageSuccessRate: number;
    } | null;
  };
}

interface CostSummary {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  spentPercentage: number;
  warningThreshold: number;
  criticalThreshold: number;
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

interface MonthlyCost {
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

interface QAStats {
  totalReviews: number;
  totalApprovals: number;
  approvalRate: number;
  qaCount: number;
}

interface TimeSeriesData {
  date: string;
  reviews: number;
  approvals: number;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Client Analytics Data
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [clientAnalyticsTimeRange, setClientAnalyticsTimeRange] =
    useState("7d");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Cost Tracking Data
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
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
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

  // QA Statistics Data
  const [qaStats, setQaStats] = useState<QAStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);

  useEffect(() => {
    if (user && user.metadata?.role === "admin") {
      fetchOverviewData();
    } else if (user && user.metadata?.role) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Auto-check budget thresholds whenever spending changes (with debounce)
  useEffect(() => {
    if (!loading && costSummary.totalSpent > 0) {
      const timeoutId = setTimeout(() => {
        checkBudgetThresholds(costSummary.totalSpent);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [costSummary.totalSpent, loading]);

  useEffect(() => {
    if (user && user.metadata?.role === "admin") {
      fetchClientAnalytics();
    }
  }, [user, clientAnalyticsTimeRange, clientFilter]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      // Fetch Client Analytics Summary
      const [sceneRenderResponse, clientActivitiesResponse] = await Promise.all(
        [
          fetch("/api/analytics/scene-render?timeRange=30d"),
          fetch("/api/analytics/client-activities?timeRange=30d"),
        ]
      );

      if (sceneRenderResponse.ok) {
        const sceneData = await sceneRenderResponse.json();
        setAnalyticsData({
          sceneRenderSummary: sceneData.summary,
          usageOverTime: sceneData.usageOverTime,
          topUsers: sceneData.topUsers.slice(0, 5),
          formatDistribution: sceneData.formatDistribution || [],
          conversionRateTrend: sceneData.conversionRateTrend || [],
          detailedRenders: sceneData.detailedRenders || [],
          clientActivities: clientActivitiesResponse.ok
            ? await clientActivitiesResponse.json()
            : undefined,
          performanceMetrics: sceneData.performanceMetrics,
          engagementMetrics: sceneData.engagementMetrics,
          usageInsights: sceneData.usageInsights,
          qualityMetrics: sceneData.qualityMetrics,
          comparativeAnalytics: sceneData.comparativeAnalytics,
        });
      }

      // Fetch Cost Tracking
      await fetchCostData();

      // Fetch QA Statistics
      await fetchQAStatistics();

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientAnalytics = async () => {
    try {
      const params = new URLSearchParams({
        timeRange: clientAnalyticsTimeRange,
        ...(clientFilter &&
          clientFilter !== "all" && { clientName: clientFilter }),
      });

      const [sceneRenderResponse, clientActivitiesResponse] = await Promise.all(
        [
          fetch(`/api/analytics/scene-render?${params}`),
          fetch(`/api/analytics/client-activities?${params}`),
        ]
      );

      const sceneRenderData = sceneRenderResponse.ok
        ? await sceneRenderResponse.json()
        : null;
      const clientActivitiesData = clientActivitiesResponse.ok
        ? await clientActivitiesResponse.json()
        : null;

      if (sceneRenderData) {
        setAnalyticsData({
          sceneRenderSummary: sceneRenderData.summary,
          usageOverTime: sceneRenderData.usageOverTime,
          topUsers: sceneRenderData.topUsers,
          formatDistribution: sceneRenderData.formatDistribution,
          conversionRateTrend: sceneRenderData.conversionRateTrend,
          detailedRenders: sceneRenderData.detailedRenders,
          clientActivities: clientActivitiesData || undefined,
          performanceMetrics: sceneRenderData.performanceMetrics,
          engagementMetrics: sceneRenderData.engagementMetrics,
          usageInsights: sceneRenderData.usageInsights,
          qualityMetrics: sceneRenderData.qualityMetrics,
          comparativeAnalytics: sceneRenderData.comparativeAnalytics,
        });
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching client analytics:", error);
    }
  };

  const checkBudgetThresholds = async (totalSpent: number) => {
    try {
      const productionUserIds =
        await notificationService.getProductionAdminUsers();
      if (productionUserIds.length === 0) return;

      const BUDGET_THRESHOLDS = {
        critical: 4500,
        warning: 4000,
        alert: 3500,
      };

      if (totalSpent >= BUDGET_THRESHOLDS.critical) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.critical,
            alertLevel: "critical",
          }
        );
      } else if (totalSpent >= BUDGET_THRESHOLDS.warning) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.warning,
            alertLevel: "warning",
          }
        );
      } else if (totalSpent >= BUDGET_THRESHOLDS.alert) {
        await notificationService.sendBudgetAlertNotification(
          productionUserIds,
          {
            totalSpent,
            threshold: BUDGET_THRESHOLDS.alert,
            alertLevel: "alert",
          }
        );
      }

      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    } catch (error) {
      console.error("Error sending budget notifications:", error);
    }
  };

  const fetchCostData = async () => {
    try {
      setLoading(true);

      const { data: assignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select(`asset_id, user_id, role, status, price, allocation_list_id`)
        .eq("role", "modeler");

      if (assignmentsError) throw assignmentsError;

      const userIds = [...new Set(assignments?.map((a) => a.user_id) || [])];
      const allocationListIds = [
        ...new Set(
          assignments?.map((a) => a.allocation_list_id).filter(Boolean) || []
        ),
      ];

      const [profilesResponse, listsResponse] = await Promise.all([
        supabase.from("profiles").select("id, email").in("id", userIds),
        supabase
          .from("allocation_lists")
          .select("id, bonus")
          .in("id", allocationListIds),
      ]);

      if (profilesResponse.error) throw profilesResponse.error;
      if (listsResponse.error) throw listsResponse.error;

      const userToProfile = new Map();
      profilesResponse.data?.forEach((profile) => {
        userToProfile.set(profile.id, {
          email: profile.email,
          name: profile.email,
        });
      });

      const allocationListToBonus = new Map();
      listsResponse.data?.forEach((list) => {
        allocationListToBonus.set(list.id, list.bonus || 0);
      });

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

      const { data: assignedAssets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select(
          `id, product_name, article_id, client, batch, status, created_at`
        )
        .in("id", Array.from(assignedAssetIds));

      if (assetsError) throw assetsError;

      const processedAssets: AssetCost[] =
        assignedAssets?.map((asset) => {
          const modelerInfo = assetToModeler.get(asset.id) || {
            email: "Unknown",
            name: "Unknown",
            price: 50,
            bonus: 0,
          };

          const price = modelerInfo.price || 50;
          const bonusPercentage = modelerInfo.bonus || 0;
          const bonusAmount = price * (bonusPercentage / 100);
          const totalCost = price + bonusAmount;

          return {
            ...asset,
            price: price,
            bonus_percentage: bonusPercentage,
            bonus_amount: bonusAmount,
            total_cost: totalCost,
            modeler_email: modelerInfo.email,
            status: asset.status,
            allocation_list_completed:
              asset.status === "approved" ||
              asset.status === "approved_by_client",
          };
        }) || [];

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
          modelerCost.totalCost += asset.total_cost;
        } else {
          modelerCost.pendingAssets++;
          modelerCost.pendingCost += asset.total_cost;
        }
      });

      setModelerCosts(Array.from(modelerCostMap.values()));
      setAssetCosts(processedAssets);

      const monthlyCostsData = calculateMonthlyCosts(processedAssets);
      setMonthlyCosts(monthlyCostsData);

      const clientCostsData = calculateClientCosts(processedAssets);
      setClientCosts(clientCostsData);

      const pricingBreakdownData = await calculatePricingBreakdown();
      setPricingBreakdown(pricingBreakdownData);
    } catch (error) {
      console.error("Error fetching cost data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCosts = (assets: AssetCost[]): MonthlyCost[] => {
    const monthlyMap = new Map<string, MonthlyCost>();

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
        monthlyData.totalSpent += asset.total_cost;
      } else {
        monthlyData.pendingCost += asset.total_cost;
        monthlyData.pendingAssets++;
      }
    });

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
      }
    });

    const results = Array.from(clientMap.values());
    results.forEach((c) => {
      c.modelers.sort((a, b) => b.completedCost - a.completedCost);
    });
    results.sort((a, b) => b.completedCost - a.completedCost);
    return results;
  };

  const calculatePricingBreakdown = async () => {
    try {
      const { data: pricingAssets, error: pricingError } = await supabase
        .from("onboarding_assets")
        .select("pricing_option_id, price, status")
        .not("pricing_option_id", "is", null);

      if (pricingError) return [];

      const { data: corrections } = await supabase
        .from("allocation_lists")
        .select("correction_amount, status, approved_at")
        .not("correction_amount", "is", null)
        .gt("correction_amount", 0);

      const colors = [
        "#10b981",
        "#3b82f6",
        "#8b5cf6",
        "#f59e0b",
        "#ef4444",
        "#6b7280",
      ];
      const breakdown = new Map<string, { totalCost: number; count: number }>();

      pricingAssets?.forEach((asset) => {
        const isCompleted =
          asset.status === "approved" || asset.status === "approved_by_client";
        if (!isCompleted) return;

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

      return Array.from(breakdown.entries())
        .map(([name, { totalCost, count }], index) => ({
          name,
          totalCost: Math.round(totalCost * 100) / 100,
          count,
          color: colors[index % colors.length],
        }))
        .sort((a, b) => b.totalCost - a.totalCost);
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

  const fetchQAStatistics = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const { data: qaUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "qa");

      if (!qaUsers || qaUsers.length === 0) {
        setQaStats({
          totalReviews: 0,
          totalApprovals: 0,
          approvalRate: 0,
          qaCount: 0,
        });
        return;
      }

      const qaIds = qaUsers.map((qa) => qa.id);

      const [revisionHistory, approvalActivities] = await Promise.all([
        supabase
          .from("revision_history")
          .select("created_at, created_by")
          .in("created_by", qaIds)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("activity_log")
          .select("created_at, user_id, metadata")
          .in("user_id", qaIds)
          .eq("resource_type", "asset")
          .eq("type", "update")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
      ]);

      let totalReviews = 0;
      let totalApprovals = 0;

      revisionHistory.data?.forEach(() => {
        totalReviews++;
      });

      approvalActivities.data?.forEach((activity: any) => {
        const newStatus = activity?.metadata?.new_status;
        totalReviews++;
        if (
          newStatus === "approved" ||
          newStatus === "client_approved" ||
          newStatus === "delivered_by_artist"
        ) {
          totalApprovals++;
        }
      });

      const approvalRate =
        totalReviews > 0
          ? Math.round((totalApprovals / totalReviews) * 100)
          : 0;

      setQaStats({
        totalReviews,
        totalApprovals,
        approvalRate,
        qaCount: qaUsers.length,
      });

      const timeSeries = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const dayReviews =
          (revisionHistory.data?.filter((r) => r.created_at.startsWith(dateStr))
            .length || 0) +
          (approvalActivities.data?.filter((a) =>
            a.created_at.startsWith(dateStr)
          ).length || 0);

        const dayApprovals =
          approvalActivities.data?.filter((activity: any) => {
            if (!activity.created_at.startsWith(dateStr)) return false;
            const newStatus = activity?.metadata?.new_status;
            return (
              newStatus === "approved" ||
              newStatus === "client_approved" ||
              newStatus === "delivered_by_artist"
            );
          }).length || 0;

        timeSeries.push({
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          reviews: dayReviews,
          approvals: dayApprovals,
        });
      }

      setTimeSeriesData(timeSeries);
    } catch (error) {
      console.error("Error fetching QA statistics:", error);
    }
  };

  const timeRangeOptions = [
    { value: "real-time", label: "Real-time (24h)" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];

  if (loading && !analyticsData && !costSummary && !qaStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading analytics data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Admin Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of client analytics, cost tracking, and QA statistics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchOverviewData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4 cursor-pointer">
        <TabsList className="cursor-pointer">
          <TabsTrigger className="cursor-pointer" value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger className="cursor-pointer" value="client-analytics">
            Client Analytics
          </TabsTrigger>
          <TabsTrigger className="cursor-pointer" value="cost-tracking">
            Cost Tracking
          </TabsTrigger>
          <TabsTrigger className="cursor-pointer" value="qa-statistics">
            QA Statistics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Client Analytics Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Client Analytics
            </h2>

            {analyticsData && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <SceneRenderStats
                    title="Total Renders"
                    value={analyticsData.sceneRenderSummary.totalRenders}
                    icon={BarChart3}
                    description="Scene render attempts"
                  />
                  <SceneRenderStats
                    title="Total Saves"
                    value={analyticsData.sceneRenderSummary.totalSaves}
                    icon={Save}
                    description="Scenes saved to library"
                  />
                  <SceneRenderStats
                    title="Conversion Rate"
                    value={`${analyticsData.sceneRenderSummary.conversionRate}%`}
                    icon={TrendingUp}
                    description="Saves per render"
                  />
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Logins
                      </CardTitle>
                      <LogIn className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData.clientActivities?.summary?.totalLogins ||
                          0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        User logins
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle> Scene Render Usage Over Time</CardTitle>
                      <CardDescription>
                        Renders and saves over the last 30 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UsageOverTimeChart data={analyticsData.usageOverTime} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Users</CardTitle>
                      <CardDescription>
                        Top 5 users by render count
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TopUsersChart
                        data={analyticsData.topUsers.slice(0, 5)}
                      />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>

          {/* Cost Tracking Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Tracking
            </h2>

            {costSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cost Breakdown Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="rounded-xl p-5 border border-border/30">
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
                    <div className="rounded-xl p-5 border border-border/30">
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
                    <div className="rounded-xl p-5 border border-border/30 sm:col-span-2 lg:col-span-1">
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
            )}
          </div>

          {/* QA Statistics Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              QA Statistics
            </h2>

            {qaStats && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Reviews
                      </CardTitle>
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {qaStats.totalReviews}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last 30 days
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Approvals
                      </CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {qaStats.totalApprovals}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Assets approved
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Approval Rate
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {qaStats.approvalRate}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Approval percentage
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        QA Team Size
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {qaStats.qaCount}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Active QA reviewers
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Review & Approval Trends</CardTitle>
                    <CardDescription>
                      Daily reviews and approvals over the last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeSeriesData}>
                          <defs>
                            <linearGradient
                              id="fillReviews"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                            <linearGradient
                              id="fillApprovals"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#22c55e"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="#22c55e"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.toString()}
                          />
                          <Tooltip
                            cursor={{ stroke: "#3b82f6", strokeWidth: 1 }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="grid gap-2">
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(label).toLocaleDateString(
                                          "en-US",
                                          {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                          }
                                        )}
                                      </div>
                                      {payload.map((entry, index) => (
                                        <div
                                          key={index}
                                          className="flex items-center gap-2"
                                        >
                                          <div
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{
                                              backgroundColor: entry.color,
                                            }}
                                          />
                                          <span className="text-sm font-medium">
                                            {entry.name === "reviews"
                                              ? "Reviews"
                                              : "Approvals"}
                                            : {entry.value}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="reviews"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#fillReviews)"
                            fillOpacity={0.4}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            name="Reviews"
                          />
                          <Area
                            type="monotone"
                            dataKey="approvals"
                            stroke="#22c55e"
                            strokeWidth={2}
                            fill="url(#fillApprovals)"
                            fillOpacity={0.4}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            name="Approvals"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* Client Analytics Tab - Full Content */}
        <TabsContent value="client-analytics" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Client Analytics</h2>
              <p className="text-muted-foreground">
                Track client activity including logins, scene renders, and user
                engagement
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button
                onClick={fetchClientAnalytics}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Time Range:</label>
                  <Select
                    value={clientAnalyticsTimeRange}
                    onValueChange={setClientAnalyticsTimeRange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Client:</label>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All clients</SelectItem>
                      {analyticsData?.topUsers.map((user) => (
                        <SelectItem key={user.client} value={user.client}>
                          {user.client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {analyticsData && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SceneRenderStats
                title="Total Renders"
                value={analyticsData.sceneRenderSummary.totalRenders}
                icon={BarChart3}
                description="Scene render attempts"
              />
              <SceneRenderStats
                title="Total Saves"
                value={analyticsData.sceneRenderSummary.totalSaves}
                icon={Save}
                description="Scenes saved to library"
              />
              <SceneRenderStats
                title="Conversion Rate"
                value={`${analyticsData.sceneRenderSummary.conversionRate}%`}
                icon={TrendingUp}
                description="Saves per render"
              />
              <SceneRenderStats
                title="Avg Generation Time"
                value={`${Math.round(
                  analyticsData.sceneRenderSummary.averageGenerationTime / 1000
                )}s`}
                icon={Clock}
                description="Average processing time"
              />
              {analyticsData.clientActivities && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Logins
                    </CardTitle>
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.clientActivities.summary.totalLogins}
                    </div>
                    <p className="text-xs text-muted-foreground">User logins</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Charts and Tables */}
          {analyticsData && (
            <Tabs defaultValue="overview" className="space-y-4 cursor-pointer">
              <TabsList className="cursor-pointer">
                <TabsTrigger className="cursor-pointer" value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="activities">
                  Activities
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="users">
                  Users
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="formats">
                  Formats
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="performance">
                  Performance
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="engagement">
                  Engagement
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="usage">
                  Usage Insights
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="quality">
                  Quality
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="comparative">
                  Comparative
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="details">
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Usage Over Time</CardTitle>
                      <CardDescription>
                        Renders and saves over the selected time period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <UsageOverTimeChart data={analyticsData.usageOverTime} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Conversion Rate Trend</CardTitle>
                      <CardDescription>
                        Daily conversion rate over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ConversionRateChart
                        data={analyticsData.conversionRateTrend}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                {analyticsData.clientActivities && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Activity</CardTitle>
                      <CardDescription>
                        Logins and scene renders over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analyticsData.clientActivities.dailyActivity
                          .slice(0, 10)
                          .map((day) => (
                            <div
                              key={day.date}
                              className="flex items-center justify-between border-b pb-2"
                            >
                              <div className="text-sm font-medium">
                                {new Date(day.date).toLocaleDateString()}
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <LogIn className="h-4 w-4 text-green-500" />
                                  <span>{day.logins} logins</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-blue-500" />
                                  <span>{day.sceneRenders} renders</span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Users by Render Count</CardTitle>
                    <CardDescription>
                      Top 5 most active users in the selected time period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopUsersChart data={analyticsData.topUsers.slice(0, 5)} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="formats" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Image Format Distribution</CardTitle>
                    <CardDescription>
                      Popular image formats used for scene rendering
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormatDistributionChart
                      data={analyticsData.formatDistribution}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Performance & Timing Metrics Tab */}
              <TabsContent value="performance" className="space-y-4">
                {analyticsData.performanceMetrics && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Error Rate
                          </CardTitle>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {analyticsData.performanceMetrics.errorRate.toFixed(
                              2
                            )}
                            %
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            P50
                          </CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {Math.round(
                              analyticsData.performanceMetrics
                                .generationTimePercentiles.p50 / 1000
                            )}
                            s
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            P95
                          </CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {Math.round(
                              analyticsData.performanceMetrics
                                .generationTimePercentiles.p95 / 1000
                            )}
                            s
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            P99
                          </CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {Math.round(
                              analyticsData.performanceMetrics
                                .generationTimePercentiles.p99 / 1000
                            )}
                            s
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Hourly Usage Patterns</CardTitle>
                          <CardDescription>
                            Peak hours for renders and saves
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={
                                  analyticsData.performanceMetrics.hourlyUsage
                                }
                              >
                                <XAxis
                                  dataKey="hour"
                                  tickFormatter={(value) => `${value}:00`}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  dataKey="renders"
                                  fill="hsl(var(--chart-1))"
                                  name="Renders"
                                />
                                <Bar
                                  dataKey="saves"
                                  fill="hsl(var(--chart-2))"
                                  name="Saves"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Day of Week Patterns</CardTitle>
                          <CardDescription>
                            Activity by day of the week
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={
                                  analyticsData.performanceMetrics
                                    .dayOfWeekUsage
                                }
                              >
                                <XAxis
                                  dataKey="dayName"
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  dataKey="renders"
                                  fill="hsl(var(--chart-1))"
                                  name="Renders"
                                />
                                <Bar
                                  dataKey="saves"
                                  fill="hsl(var(--chart-2))"
                                  name="Saves"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Error Rate Breakdown</CardTitle>
                        <CardDescription>
                          Top error types and their frequency
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analyticsData.performanceMetrics.errorRateBreakdown.map(
                            (error, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 rounded-lg border"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {error.error}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {error.count} occurrences (
                                    {error.percentage.toFixed(2)}%)
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Engagement & Retention Tab */}
              <TabsContent value="engagement" className="space-y-4">
                {analyticsData.engagementMetrics && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            DAU
                          </CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {analyticsData.engagementMetrics.dailyActiveUsers}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Daily Active Users
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            WAU
                          </CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {analyticsData.engagementMetrics.weeklyActiveUsers}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Weekly Active Users
                          </p>
                        </CardContent>
                      </Card>
                      {analyticsData.engagementMetrics.monthlyActiveUsers !==
                        null && (
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                              MAU
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {
                                analyticsData.engagementMetrics
                                  .monthlyActiveUsers
                              }
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Monthly Active Users
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Growth Rate
                          </CardTitle>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div
                            className={`text-2xl font-bold ${analyticsData.engagementMetrics.growthRate >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {analyticsData.engagementMetrics.growthRate >= 0
                              ? "+"
                              : ""}
                            {analyticsData.engagementMetrics.growthRate.toFixed(
                              1
                            )}
                            %
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Period-over-period
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>User Segments</CardTitle>
                          <CardDescription>
                            New vs returning users
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
                              <div>
                                <div className="font-semibold">New Users</div>
                                <div className="text-sm text-muted-foreground">
                                  First time users
                                </div>
                              </div>
                              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {analyticsData.engagementMetrics.newUsers}
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
                              <div>
                                <div className="font-semibold">
                                  Returning Users
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Previous period users
                                </div>
                              </div>
                              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                                {analyticsData.engagementMetrics.returningUsers}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Client Growth</CardTitle>
                          <CardDescription>Client growth rate</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold mb-2">
                            {analyticsData.engagementMetrics.clientGrowthRate >=
                            0
                              ? "+"
                              : ""}
                            {analyticsData.engagementMetrics.clientGrowthRate.toFixed(
                              1
                            )}
                            %
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Client base growth compared to previous period
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {analyticsData.engagementMetrics.churnRiskClients.length >
                      0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            Churn Risk Clients
                          </CardTitle>
                          <CardDescription>
                            Clients with declining activity (50%+ decrease)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analyticsData.engagementMetrics.churnRiskClients.map(
                              (client, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {client.client}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {client.currentActivity} renders (was{" "}
                                      {client.previousActivity})
                                    </div>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                                  >
                                    -{client.declinePercentage.toFixed(1)}%
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Usage Insights Tab */}
              <TabsContent value="usage" className="space-y-4">
                {analyticsData.usageInsights && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Feature Adoption</CardTitle>
                          <CardDescription>
                            Usage of advanced features
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">
                                  Multi-Asset Mode
                                </span>
                                <span className="text-sm font-bold">
                                  {analyticsData.usageInsights.featureAdoption.multiAssetPercentage.toFixed(
                                    1
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${analyticsData.usageInsights.featureAdoption.multiAssetPercentage}%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {
                                  analyticsData.usageInsights.featureAdoption
                                    .multiAssetMode
                                }{" "}
                                of{" "}
                                {
                                  analyticsData.usageInsights.featureAdoption
                                    .totalRenders
                                }{" "}
                                renders
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">
                                  Inspiration Used
                                </span>
                                <span className="text-sm font-bold">
                                  {analyticsData.usageInsights.featureAdoption.inspirationPercentage.toFixed(
                                    1
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{
                                    width: `${analyticsData.usageInsights.featureAdoption.inspirationPercentage}%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {
                                  analyticsData.usageInsights.featureAdoption
                                    .inspirationUsed
                                }{" "}
                                of{" "}
                                {
                                  analyticsData.usageInsights.featureAdoption
                                    .totalRenders
                                }{" "}
                                renders
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Render Frequency Distribution</CardTitle>
                          <CardDescription>
                            How often clients render
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={
                                  analyticsData.usageInsights
                                    .frequencyDistribution
                                }
                              >
                                <XAxis
                                  dataKey="range"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar
                                  dataKey="count"
                                  fill="hsl(var(--chart-1))"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Format Preferences by Client</CardTitle>
                        <CardDescription>
                          Most popular formats for each client
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.usageInsights.formatPreferencesByClient
                            .slice(0, 10)
                            .map((item, index) => (
                              <div
                                key={index}
                                className="p-4 rounded-lg border"
                              >
                                <div className="font-semibold mb-2">
                                  {item.client}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.formats
                                    .slice(0, 5)
                                    .map((format, fIndex) => (
                                      <Badge key={fIndex} variant="outline">
                                        {format.format}: {format.count}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Object Types by Client</CardTitle>
                        <CardDescription>
                          Most popular object types per client
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.usageInsights.objectTypesByClient
                            .slice(0, 10)
                            .map((item, index) => (
                              <div
                                key={index}
                                className="p-4 rounded-lg border"
                              >
                                <div className="font-semibold mb-2">
                                  {item.client}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.types
                                    .slice(0, 5)
                                    .map((type, tIndex) => (
                                      <Badge key={tIndex} variant="outline">
                                        {type.type}: {type.count}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Quality & Efficiency Tab */}
              <TabsContent value="quality" className="space-y-4">
                {analyticsData.qualityMetrics && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Re-render Rate</CardTitle>
                          <CardDescription>
                            Failed renders requiring retry
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold mb-2">
                            {analyticsData.qualityMetrics.reRenderPercentage.toFixed(
                              2
                            )}
                            %
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {analyticsData.qualityMetrics.reRenderRate} failed
                            renders
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Success Rate by Format</CardTitle>
                          <CardDescription>
                            Quality metrics per image format
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analyticsData.qualityMetrics.successRateByFormat
                              .sort((a, b) => b.successRate - a.successRate)
                              .slice(0, 5)
                              .map((item, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-2 rounded border"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {item.format}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {item.success} / {item.total}
                                    </div>
                                  </div>
                                  <div className="text-lg font-bold">
                                    {item.successRate.toFixed(1)}%
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Average Generation Time by Client</CardTitle>
                        <CardDescription>
                          Performance comparison across clients
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analyticsData.qualityMetrics.avgGenerationTimeByClient
                            .slice(0, 10)
                            .map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 rounded-lg border"
                              >
                                <div>
                                  <div className="font-medium">
                                    {item.client}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.count} renders
                                  </div>
                                </div>
                                <div className="text-lg font-bold">
                                  {Math.round(item.averageTime / 1000)}s
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Success Rate by Object Type</CardTitle>
                        <CardDescription>
                          Quality metrics per object type
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analyticsData.qualityMetrics.successRateByObjectType
                            .sort((a, b) => b.successRate - a.successRate)
                            .map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 rounded border"
                              >
                                <div>
                                  <div className="font-medium">{item.type}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.success} / {item.total}
                                  </div>
                                </div>
                                <div className="text-lg font-bold">
                                  {item.successRate.toFixed(1)}%
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Comparative Analytics Tab */}
              <TabsContent value="comparative" className="space-y-4">
                {analyticsData.comparativeAnalytics && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Period Comparison</CardTitle>
                        <CardDescription>
                          Current period vs previous period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Total Renders
                            </div>
                            <div className="text-2xl font-bold">
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.current.totalRenders
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Previous:{" "}
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.previous.totalRenders
                              }
                            </div>
                            <div
                              className={`text-sm font-semibold ${analyticsData.comparativeAnalytics.periodComparison.growth.renders >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {analyticsData.comparativeAnalytics
                                .periodComparison.growth.renders >= 0
                                ? "+"
                                : ""}
                              {analyticsData.comparativeAnalytics.periodComparison.growth.renders.toFixed(
                                1
                              )}
                              %
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Total Saves
                            </div>
                            <div className="text-2xl font-bold">
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.current.totalSaves
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Previous:{" "}
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.previous.totalSaves
                              }
                            </div>
                            <div
                              className={`text-sm font-semibold ${analyticsData.comparativeAnalytics.periodComparison.growth.saves >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {analyticsData.comparativeAnalytics
                                .periodComparison.growth.saves >= 0
                                ? "+"
                                : ""}
                              {analyticsData.comparativeAnalytics.periodComparison.growth.saves.toFixed(
                                1
                              )}
                              %
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Conversion Rate
                            </div>
                            <div className="text-2xl font-bold">
                              {analyticsData.comparativeAnalytics.periodComparison.current.conversionRate.toFixed(
                                1
                              )}
                              %
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Previous:{" "}
                              {analyticsData.comparativeAnalytics.periodComparison.previous.conversionRate.toFixed(
                                1
                              )}
                              %
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Unique Clients
                            </div>
                            <div className="text-2xl font-bold">
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.current.uniqueClients
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Previous:{" "}
                              {
                                analyticsData.comparativeAnalytics
                                  .periodComparison.previous.uniqueClients
                              }
                            </div>
                            <div
                              className={`text-sm font-semibold ${analyticsData.comparativeAnalytics.periodComparison.growth.clients >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {analyticsData.comparativeAnalytics
                                .periodComparison.growth.clients >= 0
                                ? "+"
                                : ""}
                              {analyticsData.comparativeAnalytics.periodComparison.growth.clients.toFixed(
                                1
                              )}
                              %
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Avg Gen Time
                            </div>
                            <div className="text-2xl font-bold">
                              {Math.round(
                                analyticsData.comparativeAnalytics
                                  .periodComparison.current
                                  .averageGenerationTime / 1000
                              )}
                              s
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Previous:{" "}
                              {Math.round(
                                analyticsData.comparativeAnalytics
                                  .periodComparison.previous
                                  .averageGenerationTime / 1000
                              )}
                              s
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {analyticsData.comparativeAnalytics.platformAverages && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Platform Benchmarks</CardTitle>
                          <CardDescription>
                            How you compare to overall platform averages
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">
                                Conversion Rate
                              </div>
                              <div className="text-2xl font-bold">
                                {analyticsData.comparativeAnalytics.platformAverages.averageConversionRate.toFixed(
                                  1
                                )}
                                %
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Platform Average
                              </div>
                              <div
                                className={`text-sm font-semibold ${analyticsData.sceneRenderSummary.conversionRate >= analyticsData.comparativeAnalytics.platformAverages.averageConversionRate ? "text-green-600" : "text-red-600"}`}
                              >
                                {analyticsData.sceneRenderSummary
                                  .conversionRate >=
                                analyticsData.comparativeAnalytics
                                  .platformAverages.averageConversionRate
                                  ? "↑ Above"
                                  : "↓ Below"}{" "}
                                average
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">
                                Generation Time
                              </div>
                              <div className="text-2xl font-bold">
                                {Math.round(
                                  analyticsData.comparativeAnalytics
                                    .platformAverages.averageGenerationTime /
                                    1000
                                )}
                                s
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Platform Average
                              </div>
                              <div
                                className={`text-sm font-semibold ${analyticsData.sceneRenderSummary.averageGenerationTime <= analyticsData.comparativeAnalytics.platformAverages.averageGenerationTime ? "text-green-600" : "text-red-600"}`}
                              >
                                {analyticsData.sceneRenderSummary
                                  .averageGenerationTime <=
                                analyticsData.comparativeAnalytics
                                  .platformAverages.averageGenerationTime
                                  ? "↑ Faster"
                                  : "↓ Slower"}{" "}
                                than average
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">
                                Success Rate
                              </div>
                              <div className="text-2xl font-bold">
                                {analyticsData.comparativeAnalytics.platformAverages.averageSuccessRate.toFixed(
                                  1
                                )}
                                %
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Platform Average
                              </div>
                              <div
                                className={`text-sm font-semibold ${analyticsData.sceneRenderSummary.successRate >= analyticsData.comparativeAnalytics.platformAverages.averageSuccessRate ? "text-green-600" : "text-red-600"}`}
                              >
                                {analyticsData.sceneRenderSummary.successRate >=
                                analyticsData.comparativeAnalytics
                                  .platformAverages.averageSuccessRate
                                  ? "↑ Above"
                                  : "↓ Below"}{" "}
                                average
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Renders</CardTitle>
                    <CardDescription>
                      Recent render attempts with full details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SceneRendersTable data={analyticsData.detailedRenders} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {!analyticsData && !loading && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Data Available
                  </h3>
                  <p className="text-muted-foreground">
                    No analytics data found for the selected time period.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cost Tracking Tab */}
        <TabsContent value="cost-tracking" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Cost Tracking</h2>
              <p className="text-muted-foreground">
                Monitor budget spending and cost breakdowns
              </p>
            </div>
            <Button onClick={fetchCostData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Budget Status Alert */}
          <Alert
            className={`shadow-md ${
              getBudgetStatus().status === "critical"
                ? "border-2 border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
                : getBudgetStatus().status === "warning"
                  ? "border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  getBudgetStatus().status === "critical"
                    ? "bg-red-100/50 dark:bg-red-900/20"
                    : getBudgetStatus().status === "warning"
                      ? "bg-amber-100/50 dark:bg-amber-900/20"
                      : "bg-green-100/50 dark:bg-green-900/20"
                }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${
                    getBudgetStatus().status === "critical"
                      ? "text-red-600 dark:text-red-400"
                      : getBudgetStatus().status === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-green-600 dark:text-green-400"
                  }`}
                />
              </div>
              <AlertDescription
                className={`font-medium ${
                  getBudgetStatus().status === "critical"
                    ? "text-red-800 dark:text-red-300"
                    : getBudgetStatus().status === "warning"
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-green-800 dark:text-green-300"
                }`}
              >
                {getBudgetStatus().message}
              </AlertDescription>
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="rounded-xl p-5 border border-border/30">
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
                <div className="rounded-xl p-5 border border-border/30">
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
                <div className="rounded-xl p-5 border border-border/30 sm:col-span-2 lg:col-span-1">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Pricing Options & Corrections Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                              const data = payload[0]
                                .payload as PricingBreakdown;
                              return (
                                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
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
                            className="rounded-lg p-3 border border-border/30"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full"
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
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Cost Trends
                </CardTitle>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger className="w-full sm:w-40 text-sm">
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
            <CardContent>
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
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
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

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
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

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
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

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
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

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
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

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Budget Progress (Approved Costs Only)
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  <div className="h-4 sm:h-5 rounded-full overflow-hidden bg-muted/30 border border-border/50">
                    <div
                      className={`h-full transition-all duration-500 ease-out ${
                        costSummary.totalSpent >= costSummary.criticalThreshold
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : costSummary.totalSpent >=
                              costSummary.warningThreshold
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
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                    <span className="text-muted-foreground">Safe</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
                    <span className="text-muted-foreground">Warning</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600"></div>
                    <span className="text-muted-foreground">Critical</span>
                  </div>
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
                        <SelectItem value="totalAssets">
                          Total Assets
                        </SelectItem>
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
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Modeler Cost Summary
                </CardTitle>
                <Button
                  onClick={exportCostData}
                  variant="outline"
                  className="gap-2 text-sm w-full sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Client Cost Overview
                <Badge
                  variant="outline"
                  className="ml-auto text-xs sm:text-sm px-3 py-1"
                >
                  {filteredClientCosts.length} clients
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
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
        </TabsContent>

        {/* QA Statistics Tab */}
        <TabsContent value="qa-statistics" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">QA Statistics</h2>
              <p className="text-muted-foreground">
                Track QA review performance and approval rates
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/qa-statistics")}
            >
              View Full Details
            </Button>
          </div>

          {qaStats && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Reviews
                    </CardTitle>
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {qaStats.totalReviews}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last 30 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Approvals
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {qaStats.totalApprovals}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assets approved
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Approval Rate
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {qaStats.approvalRate}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Approval percentage
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      QA Team Size
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{qaStats.qaCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Active QA reviewers
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Review & Approval Trends</CardTitle>
                  <CardDescription>
                    Daily reviews and approvals over the last 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData}>
                        <defs>
                          <linearGradient
                            id="fillReviewsQA"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillApprovalsQA"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22c55e"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#22c55e"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) => value.toString()}
                        />
                        <Tooltip
                          cursor={{ stroke: "#3b82f6", strokeWidth: 1 }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="grid gap-2">
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(label).toLocaleDateString(
                                        "en-US",
                                        {
                                          month: "long",
                                          day: "numeric",
                                          year: "numeric",
                                        }
                                      )}
                                    </div>
                                    {payload.map((entry, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-2"
                                      >
                                        <div
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{
                                            backgroundColor: entry.color,
                                          }}
                                        />
                                        <span className="text-sm font-medium">
                                          {entry.name === "reviews"
                                            ? "Reviews"
                                            : "Approvals"}
                                          : {entry.value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="reviews"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#fillReviewsQA)"
                          fillOpacity={0.4}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          name="Reviews"
                        />
                        <Area
                          type="monotone"
                          dataKey="approvals"
                          stroke="#22c55e"
                          strokeWidth={2}
                          fill="url(#fillApprovalsQA)"
                          fillOpacity={0.4}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          name="Approvals"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
