"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
import {
  FileText,
  Calendar,
  Euro,
  Package,
  CheckCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface ApprovedAsset {
  id: string;
  product_name: string;
  article_id: string;
  client: string;
  batch: number;
  category: string;
  subcategory: string;
  priority: number;
  price: number;
  bonus: number;
  approved_at: string;
  allocation_list_id: string;
  allocation_list_number: number;
  allocation_list_created_at: string;
}

interface MonthlyPeriod {
  value: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface MonthlyStats {
  totalAssets: number;
  totalBaseEarnings: number;
  totalBonusEarnings: number;
  totalPotential: number;
  clients: string[];
  categories: string[];
  completedLists: number;
}

interface RetroactiveBonus {
  allocationListId: string;
  amount: number;
  assetCount: number;
  listCompletedDate: Date;
  listCreatedDate: Date;
  bonusPercentage: number;
}

export default function InvoicingPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const [approvedAssets, setApprovedAssets] = useState<ApprovedAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<ApprovedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [monthlyPeriods, setMonthlyPeriods] = useState<MonthlyPeriod[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalAssets: 0,
    totalBaseEarnings: 0,
    totalBonusEarnings: 0,
    totalPotential: 0,
    clients: [],
    categories: [],
    completedLists: 0,
  });
  const [retroactiveBonuses, setRetroactiveBonuses] = useState<
    RetroactiveBonus[]
  >([]);

  useEffect(() => {
    document.title = "CharpstAR Platform - Invoicing";
    generateMonthlyPeriods();
  }, []);

  useEffect(() => {
    if (user?.id && monthlyPeriods.length > 0) {
      // Set current month as default
      const currentPeriod = monthlyPeriods.find((period) => {
        const now = new Date();
        return now >= period.startDate && now <= period.endDate;
      });
      if (currentPeriod) {
        setSelectedPeriod(currentPeriod.value);
      } else if (monthlyPeriods.length > 0) {
        setSelectedPeriod(monthlyPeriods[0].value);
      }
    }
  }, [user?.id, monthlyPeriods]);

  useEffect(() => {
    if (user?.id && selectedPeriod) {
      fetchApprovedAssets();
    }
  }, [user?.id, selectedPeriod]);

  useEffect(() => {
    filterAssetsByPeriod();
  }, [approvedAssets, selectedPeriod]);

  const generateMonthlyPeriods = () => {
    const periods: MonthlyPeriod[] = [];
    const now = new Date();

    // Generate periods for the last 12 months and next 3 months
    for (let i = -12; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();

      // Last day of previous month (start of period)
      const startDate = new Date(year, month, 0);
      // Last day of current month (end of period)
      const endDate = new Date(year, month + 1, 0);

      const monthName = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      periods.push({
        value: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: monthName,
        startDate,
        endDate,
      });
    }

    // Sort by date descending (most recent first)
    periods.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    setMonthlyPeriods(periods);
  };

  const fetchApprovedAssets = async () => {
    try {
      setLoading(true);
      startLoading();

      const { data, error } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          price,
          allocation_list_id,
          allocation_lists!inner(
            number,
            bonus,
            approved_at,
            created_at
          ),
          onboarding_assets!inner(
            id,
            product_name,
            article_id,
            client,
            batch,
            category,
            subcategory,
            priority,
            status
          )
        `
        )
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .in("onboarding_assets.status", ["approved_by_client", "approved"]);

      if (error) {
        console.error("Error fetching approved assets:", error);
        toast.error("Failed to fetch approved assets");
        return;
      }

      const processedAssets: ApprovedAsset[] = (data || []).map(
        (item: any) => ({
          id: item.onboarding_assets.id,
          product_name: item.onboarding_assets.product_name,
          article_id: item.onboarding_assets.article_id,
          client: item.onboarding_assets.client,
          batch: item.onboarding_assets.batch,
          category: item.onboarding_assets.category,
          subcategory: item.onboarding_assets.subcategory,
          priority: item.onboarding_assets.priority,
          price: item.price || 0,
          bonus: item.allocation_lists.bonus || 0,
          approved_at: item.allocation_lists.approved_at,
          allocation_list_id: item.allocation_list_id,
          allocation_list_number: item.allocation_lists.number,
          allocation_list_created_at: item.allocation_lists.created_at,
        })
      );

      setApprovedAssets(processedAssets);
    } catch (error) {
      console.error("Error fetching approved assets:", error);
      toast.error("Failed to fetch approved assets");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const filterAssetsByPeriod = () => {
    if (!selectedPeriod || !monthlyPeriods.length) {
      setFilteredAssets([]);
      setRetroactiveBonuses([]);
      return;
    }

    const period = monthlyPeriods.find((p) => p.value === selectedPeriod);
    if (!period) {
      setFilteredAssets([]);
      setRetroactiveBonuses([]);
      return;
    }

    // Reset retroactive bonuses for new period calculation
    setRetroactiveBonuses([]);

    // Show all approved assets in the table (not filtered by period)
    setFilteredAssets(approvedAssets);

    // For earnings calculation, only count assets from lists completed in this period
    // Since we don't have individual asset approval dates, we use list completion as proxy
    const assetsFromListsCompletedInPeriod = approvedAssets.filter((asset) => {
      if (!asset.approved_at) return false; // Only count assets from completed lists
      const listCompletedDate = new Date(asset.approved_at);
      return (
        listCompletedDate >= period.startDate &&
        listCompletedDate <= period.endDate
      );
    });

    // Calculate monthly earnings:
    // 1. Base earnings: All assets from lists completed in this period
    // 2. Bonus earnings: Only from allocation lists that were COMPLETED in this period

    // Base earnings from assets whose lists were completed in this period
    const totalBaseEarnings = assetsFromListsCompletedInPeriod.reduce(
      (sum, asset) => sum + asset.price,
      0
    );

    // Bonus earnings: Only from allocation lists that were COMPLETED in this period
    // The asset.approved_at is the allocation list completion date, not individual asset approval
    const allocationListsCompletedInPeriod = new Set<string>();
    const processedLists = new Set<string>();

    const bonusEarnings = approvedAssets.reduce((sum, asset) => {
      // Skip if we already processed this allocation list
      if (processedLists.has(asset.allocation_list_id)) {
        return sum;
      }

      // Only calculate bonus if the allocation list is approved (has approved_at)
      if (!asset.approved_at) {
        return sum;
      }

      const listCompletedDate = new Date(asset.approved_at);
      const isListCompletedInPeriod =
        listCompletedDate >= period.startDate &&
        listCompletedDate <= period.endDate;

      if (isListCompletedInPeriod) {
        processedLists.add(asset.allocation_list_id);
        allocationListsCompletedInPeriod.add(asset.allocation_list_id);

        // Add bonus for ALL assets in this allocation list (regardless of when individually approved)
        const listAssets = approvedAssets.filter(
          (a) => a.allocation_list_id === asset.allocation_list_id
        );

        // Calculate total bonus for this allocation list
        const totalListBonusAmount = listAssets.reduce((listSum, listAsset) => {
          return listSum + listAsset.price * (listAsset.bonus / 100);
        }, 0);

        // Store retroactive bonus info for UI display ONLY when the allocation list
        // was created in a PREVIOUS period but completed in the CURRENT period
        // This indicates that assets from earlier periods are now getting bonuses
        if (totalListBonusAmount > 0 && listAssets.length > 0) {
          // Get the allocation list creation date from the asset data
          const listCreatedDate = new Date(asset.allocation_list_created_at);

          // Check if the list was created in a previous month/period
          const listCreatedMonth = listCreatedDate.getMonth();
          const listCreatedYear = listCreatedDate.getFullYear();
          const currentPeriodMonth = period.startDate.getMonth();
          const currentPeriodYear = period.startDate.getFullYear();

          // Only show as retroactive if list was created in a different month
          const isRetroactive =
            listCreatedYear < currentPeriodYear ||
            (listCreatedYear === currentPeriodYear &&
              listCreatedMonth < currentPeriodMonth);

          if (isRetroactive) {
            setRetroactiveBonuses((prev) => [
              ...prev,
              {
                allocationListId: asset.allocation_list_id,
                amount: totalListBonusAmount,
                assetCount: listAssets.length,
                listCompletedDate: listCompletedDate,
                listCreatedDate: listCreatedDate,
                bonusPercentage: asset.bonus,
              },
            ]);
          }
        }

        return (
          sum +
          listAssets.reduce((listSum, listAsset) => {
            return listSum + listAsset.price * (listAsset.bonus / 100);
          }, 0)
        );
      }
      return sum;
    }, 0);

    const totalPotential = totalBaseEarnings + bonusEarnings;
    const clients = [
      ...new Set(assetsFromListsCompletedInPeriod.map((asset) => asset.client)),
    ];
    const categories = [
      ...new Set(
        assetsFromListsCompletedInPeriod.map((asset) => asset.category)
      ),
    ];

    setMonthlyStats({
      totalAssets: assetsFromListsCompletedInPeriod.length,
      totalBaseEarnings,
      totalBonusEarnings: bonusEarnings,
      totalPotential,
      clients,
      categories,
      completedLists: allocationListsCompletedInPeriod.size,
    });
  };

  const handleGenerateInvoice = () => {
    if (filteredAssets.length === 0) {
      toast.error("No approved assets in selected period");
      return;
    }

    // Here you would integrate with your existing invoice generation logic
    toast.success("Invoice generation will be implemented");
  };

  const getPriorityClass = (priority: number): string => {
    if (priority === 1) return "bg-red-100 text-red-700 border-red-200";
    if (priority === 2) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const getPriorityLabel = (priority: number): string => {
    if (priority === 1) return "High";
    if (priority === 2) return "Medium";
    return "Low";
  };

  if (!user) {
    return null;
  }

  if (user.metadata?.role !== "modeler") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for modelers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Invoicing</h1>
          <p className="text-muted-foreground mt-2">
            Generate invoices for your approved work by monthly periods
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          Modeler Invoicing
        </Badge>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Invoicing Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select month period" />
              </SelectTrigger>
              <SelectContent>
                {monthlyPeriods.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPeriod && (
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const period = monthlyPeriods.find(
                    (p) => p.value === selectedPeriod
                  );
                  return period
                    ? `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`
                    : "";
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Statistics */}
      {selectedPeriod && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Assets
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {monthlyStats.totalAssets}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthlyStats.clients.length} clients
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl">
                  <Euro className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Base Earnings
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    €{monthlyStats.totalBaseEarnings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assets approved this month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Bonus Earnings
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    €{monthlyStats.totalBonusEarnings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From {monthlyStats.completedLists} completed lists
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Invoice
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    €{monthlyStats.totalPotential.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Including bonuses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Retroactive Bonus Information */}
      {selectedPeriod && retroactiveBonuses.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <CheckCircle className="h-5 w-5" />
              Retroactive Bonuses Applied This Month
            </CardTitle>
            <p className="text-sm text-amber-700">
              Bonuses for allocation lists created in previous months but
              completed this month
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {retroactiveBonuses.map((bonus, index) => (
                <div
                  key={bonus.allocationListId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Allocation List #{bonus.allocationListId.slice(-8)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {bonus.assetCount} assets • {bonus.bonusPercentage}% bonus
                      rate
                    </p>
                    <p className="text-xs text-gray-500">
                      Created: {bonus.listCreatedDate.toLocaleDateString()} •
                      Completed: {bonus.listCompletedDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-700">
                      +€{bonus.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">retroactive bonus</p>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-amber-800">
                    Total Retroactive Bonuses:
                  </p>
                  <p className="font-bold text-lg text-amber-800">
                    +€
                    {retroactiveBonuses
                      .reduce((sum, bonus) => sum + bonus.amount, 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Generation */}
      {selectedPeriod && filteredAssets.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generate Invoice</CardTitle>
              <Button onClick={handleGenerateInvoice} className="gap-2">
                <FileText className="h-4 w-4" />
                Generate Invoice
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Bonus Breakdown */}
      {selectedPeriod && monthlyStats.completedLists > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Bonus Earnings from Completed Lists
              <Badge variant="outline" className="ml-auto">
                {monthlyStats.completedLists} lists completed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Bonuses are calculated based on allocation list completion dates.
              Even if individual assets were approved in previous months,
              bonuses are credited when the entire list is completed.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Bonus Earnings: €{monthlyStats.totalBonusEarnings.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-amber-700">
                This includes bonuses for ALL assets in allocation lists that
                were completed this month, regardless of when individual assets
                were approved by clients.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            All Approved Assets (Ready for Invoice)
            {selectedPeriod && (
              <Badge variant="outline" className="ml-auto">
                {filteredAssets.length} assets
              </Badge>
            )}
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
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Approved Assets</h3>
              <p className="text-muted-foreground">
                {selectedPeriod
                  ? "No approved assets found for the selected period."
                  : "Select a period to view approved assets."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Bonus Rate</TableHead>
                  <TableHead>This Month</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
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
                      <div>
                        <div className="text-sm">{asset.category}</div>
                        {asset.subcategory && (
                          <div className="text-xs text-muted-foreground">
                            {asset.subcategory}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getPriorityClass(asset.priority)}
                      >
                        {getPriorityLabel(asset.priority)}
                      </Badge>
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
                        <span>+{asset.bonus}%</span>
                        <div className="text-xs">
                          {asset.approved_at ? (
                            <span className="text-green-600">
                              ✓ List completed
                            </span>
                          ) : (
                            <span>(Credited when list completes)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €
                          {(asset.approved_at
                            ? asset.price * (1 + asset.bonus / 100)
                            : asset.price
                          ).toFixed(2)}
                        </span>
                        <div className="text-xs text-muted-foreground ml-1">
                          {asset.approved_at ? (
                            <span>(Base + Bonus)</span>
                          ) : (
                            <span>(Base only - pending bonus)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {asset.approved_at ? (
                          <div>
                            <div>
                              List:{" "}
                              {new Date(asset.approved_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-green-600">
                              ✓ Complete
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div>Asset: Approved</div>
                            <div className="text-xs text-amber-600">
                              List pending
                            </div>
                          </div>
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
