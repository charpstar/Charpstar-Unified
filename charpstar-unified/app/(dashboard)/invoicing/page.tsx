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
  Textarea,
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
  Clock,
  XCircle,
  AlertCircle,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";

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
  approved_at: string;
  asset_created_at: string; // When the individual asset was created
  asset_updated_at: string; // When the individual asset was last updated/approved
  allocation_list_id: string;
  allocation_list_number: number;
  allocation_list_status: string;
  allocation_list_created_at: string;
  allocation_list_deadline: string;
  allocation_lists?: {
    bonus: number;
    approved_at: string;
    deadline: string;
    correction_amount?: number;
  };
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
  totalCorrectionEarnings: number;
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

interface FutureBonus {
  allocationListId: string;
  amount: number;
  assetCount: number;
  listCreatedDate: Date;
  bonusPercentage: number;
  estimatedCompletion: string;
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
    totalCorrectionEarnings: 0,
    totalPotential: 0,
    clients: [],
    categories: [],
    completedLists: 0,
  });

  // Invoice generation state
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<{
    invoiceNumber: string;
    date: string;
    modelerName: string;
    modelerEmail: string;
    period: string;
    periodDates: string;
    assets: ApprovedAsset[];
    subtotal: number;
    bonusEarnings: number;
    correctionEarnings: number;
    total: number;
    clients: string[];
    categories: string[];
    assetCount: number;
  } | null>(null);
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    bankAccountNr: "",
    streetAddress: "",
    cityStateZip: "",
    bicSwiftCode: "",
  });
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [retroactiveBonuses, setRetroactiveBonuses] = useState<
    RetroactiveBonus[]
  >([]);
  // const [futureBonuses, setFutureBonuses] = useState<FutureBonus[]>([]);

  // Invoice submission state
  const [submittedInvoices, setSubmittedInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [modelerNotes, setModelerNotes] = useState("");

  // Edit invoice state
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editBankDetails, setEditBankDetails] = useState({
    bankName: "",
    bankAccountNr: "",
    streetAddress: "",
    cityStateZip: "",
    bicSwiftCode: "",
  });
  const [editModelerNotes, setEditModelerNotes] = useState("");
  const [updatingInvoice, setUpdatingInvoice] = useState(false);

  useEffect(() => {
    document.title = "CharpstAR Platform - Invoicing";
    generateMonthlyPeriods();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchSubmittedInvoices();
    }
  }, [user?.id]);

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
            status,
            approved_at,
            created_at,
            deadline,
            correction_amount
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
            status,
            created_at,
            updated_at
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
          approved_at: item.allocation_lists.approved_at,
          asset_created_at: item.onboarding_assets.created_at, // When the individual asset was created
          asset_updated_at: item.onboarding_assets.updated_at, // When the individual asset was last updated/approved
          allocation_list_id: item.allocation_list_id,
          allocation_list_number: item.allocation_lists.number,
          allocation_list_status: item.allocation_lists.status,
          allocation_list_created_at: item.allocation_lists.created_at,
          allocation_list_deadline: item.allocation_lists.deadline,
          allocation_lists: item.allocation_lists,
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
      // setFutureBonuses([]);
      return;
    }

    const period = monthlyPeriods.find((p) => p.value === selectedPeriod);
    if (!period) {
      setFilteredAssets([]);
      setRetroactiveBonuses([]);
      // setFutureBonuses([]);
      return;
    }

    // Reset retroactive and future bonuses for new period calculation
    setRetroactiveBonuses([]);
    // setFutureBonuses([]);

    // Filter assets that were approved in this specific month period
    // Use individual asset's updated_at timestamp as the primary indicator
    // This represents when the individual asset was approved and ready for payment
    const assetsApprovedInPeriod = approvedAssets.filter((asset) => {
      // Use individual asset's updated_at timestamp as the primary indicator
      if (asset.asset_updated_at) {
        const assetApprovedDate = new Date(asset.asset_updated_at);
        return (
          assetApprovedDate >= period.startDate &&
          assetApprovedDate <= period.endDate
        );
      }

      // Fallback to allocation list completion date if individual asset timestamp not available
      if (asset.approved_at) {
        const listCompletedDate = new Date(asset.approved_at);
        return (
          listCompletedDate >= period.startDate &&
          listCompletedDate <= period.endDate
        );
      }

      // Final fallback to allocation list creation date
      const listCreatedDate = new Date(asset.allocation_list_created_at);
      return (
        listCreatedDate >= period.startDate && listCreatedDate <= period.endDate
      );
    });

    // Show only assets approved in this period
    setFilteredAssets(assetsApprovedInPeriod);

    // Calculate earnings:
    // 1. Base earnings: Assets approved in this period
    // 2. Bonus earnings: Only from allocation lists that were COMPLETED in this period

    // Base earnings: Assets approved in this period
    const totalBaseEarnings = assetsApprovedInPeriod.reduce(
      (sum, asset) => sum + asset.price,
      0
    );

    // Bonus earnings: Only from allocation lists that were COMPLETED in this period
    const allocationListsCompletedInPeriod = new Set<string>();
    const processedLists = new Set<string>();

    const bonusEarnings = approvedAssets.reduce((sum, asset) => {
      // Skip if we already processed this allocation list
      if (processedLists.has(asset.allocation_list_id)) {
        return sum;
      }

      // Only calculate bonus if the allocation list is approved (has approved_at) and completed before deadline
      const listApprovedAt = asset.allocation_lists?.approved_at;
      if (!listApprovedAt || !isListCompletedBeforeDeadline(asset)) {
        return sum;
      }

      const listCompletedDate = new Date(listApprovedAt);
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
          return (
            listSum +
            listAsset.price * ((listAsset.allocation_lists?.bonus || 0) / 100)
          );
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
                bonusPercentage: asset.allocation_lists?.bonus || 0,
              },
            ]);
          }
        }

        return (
          sum +
          listAssets.reduce((listSum, listAsset) => {
            return (
              listSum +
              listAsset.price * ((listAsset.allocation_lists?.bonus || 0) / 100)
            );
          }, 0)
        );
      }
      return sum;
    }, 0);

    // Calculate future bonuses from incomplete allocation lists
    const incompleteLists = new Set<string>();
    const futureBonusData: FutureBonus[] = [];

    approvedAssets.forEach((asset) => {
      // Skip if we already processed this allocation list
      if (incompleteLists.has(asset.allocation_list_id)) {
        return;
      }

      // Only consider incomplete lists (no approved_at)
      if (!asset.approved_at) {
        incompleteLists.add(asset.allocation_list_id);

        // Get all assets in this incomplete allocation list
        const listAssets = approvedAssets.filter(
          (a) => a.allocation_list_id === asset.allocation_list_id
        );

        // Calculate potential bonus for this incomplete list
        const potentialBonusAmount = listAssets.reduce((listSum, listAsset) => {
          return (
            listSum +
            listAsset.price * ((listAsset.allocation_lists?.bonus || 0) / 100)
          );
        }, 0);

        if (potentialBonusAmount > 0) {
          const listCreatedDate = new Date(asset.allocation_list_created_at);

          // Estimate completion date (3 months from creation as a reasonable estimate)
          const estimatedCompletion = new Date(listCreatedDate);
          estimatedCompletion.setMonth(estimatedCompletion.getMonth() + 3);

          futureBonusData.push({
            allocationListId: asset.allocation_list_id,
            amount: potentialBonusAmount,
            assetCount: listAssets.length,
            listCreatedDate: listCreatedDate,
            bonusPercentage: asset.allocation_lists?.bonus || 0,
            estimatedCompletion: estimatedCompletion.toLocaleDateString(
              "en-US",
              {
                month: "short",
                year: "numeric",
              }
            ),
          });
        }
      }
    });

    // Sort future bonuses by estimated completion date
    futureBonusData.sort((a, b) => {
      const dateA = new Date(a.estimatedCompletion);
      const dateB = new Date(b.estimatedCompletion);
      return dateA.getTime() - dateB.getTime();
    });

    // setFutureBonuses(futureBonusData);

    // Calculate corrections: Include corrections from allocation lists that have assets approved in this period
    const processedCorrectionLists = new Set<string>();
    const correctionEarnings = assetsApprovedInPeriod.reduce((sum, asset) => {
      // Only add correction once per allocation list to avoid double counting
      if (processedCorrectionLists.has(asset.allocation_list_id)) {
        return sum;
      }
      processedCorrectionLists.add(asset.allocation_list_id);

      const correctionAmount = asset.allocation_lists?.correction_amount || 0;
      return sum + correctionAmount;
    }, 0);

    const totalPotential =
      totalBaseEarnings + bonusEarnings + correctionEarnings;

    // Get unique clients and categories from assets approved in this period
    const clients = [
      ...new Set(assetsApprovedInPeriod.map((asset) => asset.client)),
    ];
    const categories = [
      ...new Set(assetsApprovedInPeriod.map((asset) => asset.category)),
    ];

    setMonthlyStats({
      totalAssets: assetsApprovedInPeriod.length, // Assets approved in this period
      totalBaseEarnings,
      totalBonusEarnings: bonusEarnings,
      totalCorrectionEarnings: correctionEarnings,
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

    // Generate invoice preview data
    const period = monthlyPeriods.find((p) => p.value === selectedPeriod);
    if (!period) return;

    // Generate invoice number in format: INV{number}_{Modeler_name}_{month}_{year}
    const modelerName = (
      user?.metadata?.title ||
      user?.email?.split("@")[0] ||
      "Modeler"
    )
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9_]/g, ""); // Remove special characters except underscores

    const periodDate = new Date(period.startDate);
    const month = periodDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
    const year = periodDate.getFullYear().toString().slice(-2); // Get last 2 digits of year

    // For now, we'll use a simple counter based on the period
    // In a real implementation, you might want to store this in the database
    const invoiceNumber = `INV${month}_${modelerName}_${month.toString().padStart(2, "0")}_${year}`;

    const invoicePreviewData = {
      invoiceNumber,
      date: new Date().toISOString().split("T")[0],
      modelerName:
        user?.metadata?.title || user?.email?.split("@")[0] || "Modeler",
      modelerEmail: user?.email || "",
      period: period.label,
      periodDates: `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`,
      assets: filteredAssets, // All approved assets
      subtotal: monthlyStats.totalBaseEarnings, // All approved assets base earnings
      bonusEarnings: monthlyStats.totalBonusEarnings, // Only from completed lists
      correctionEarnings: monthlyStats.totalCorrectionEarnings, // Correction amounts
      total:
        monthlyStats.totalBaseEarnings +
        monthlyStats.totalBonusEarnings +
        monthlyStats.totalCorrectionEarnings,
      clients: monthlyStats.clients,
      categories: monthlyStats.categories,
      assetCount: monthlyStats.totalAssets, // All approved assets count
    };

    setInvoicePreview(invoicePreviewData);
    setShowInvoiceDialog(true);
  };

  const fetchSubmittedInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        return;
      }

      const response = await fetch("/api/invoices/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubmittedInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSubmitInvoice = async () => {
    if (!invoicePreview) return;

    setGeneratingInvoice(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const period = monthlyPeriods.find((p) => p.value === selectedPeriod);
      if (!period) return;

      const response = await fetch("/api/invoices/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceNumber: invoicePreview.invoiceNumber,
          periodStart: period.startDate.toISOString().split("T")[0],
          periodEnd: period.endDate.toISOString().split("T")[0],
          assets: invoicePreview.assets,
          subtotal: invoicePreview.subtotal,
          bonusEarnings: invoicePreview.bonusEarnings,
          totalAmount: invoicePreview.total,
          bankDetails: bankDetails,
          modelerNotes: modelerNotes,
          clients: invoicePreview.clients,
          categories: invoicePreview.categories,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit invoice");
      }

      toast.success("Invoice submitted for review successfully!");
      setShowInvoiceDialog(false);
      setModelerNotes("");
      fetchSubmittedInvoices();
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast.error("Failed to submit invoice");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleGenerateFinalInvoice = handleSubmitInvoice;

  // Helper function to check if allocation list was completed before deadline
  const isListCompletedBeforeDeadline = (asset: ApprovedAsset) => {
    const listApprovedAt = asset.allocation_lists?.approved_at;
    const deadline = asset.allocation_list_deadline;
    const listStatus = asset.allocation_list_status;

    // If we have both list approved_at and deadline, use that
    if (listApprovedAt && deadline) {
      const listCompletedDate = new Date(listApprovedAt);
      const deadlineDate = new Date(deadline);
      return listCompletedDate <= deadlineDate;
    }

    // If no deadline, we can't determine if it was completed on time
    if (!deadline) {
      return false;
    }

    // If the allocation list status is "approved", consider it completed
    if (listStatus === "approved") {
      // Use the asset's updated_at as the completion date if no list approved_at exists
      const completionDate = asset.asset_updated_at;
      if (completionDate) {
        const completionDateTime = new Date(completionDate);
        const deadlineDate = new Date(deadline);
        return completionDateTime <= deadlineDate;
      }
      return true; // If status is approved but no date, consider it on time
    }

    return false;
  };

  const handleEditInvoice = async (invoice: any) => {
    setEditingInvoice(invoice);
    setEditBankDetails({
      bankName: invoice.bank_name || "",
      bankAccountNr: invoice.bank_account_nr || "",
      streetAddress: invoice.street_address || "",
      cityStateZip: invoice.city_state_zip || "",
      bicSwiftCode: invoice.bic_swift_code || "",
    });
    setEditModelerNotes(invoice.modeler_notes || "");
    setShowEditDialog(true);
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;

    setUpdatingInvoice(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bankDetails: editBankDetails,
          modelerNotes: editModelerNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update invoice");
      }

      toast.success("Invoice updated successfully!");
      setShowEditDialog(false);
      setEditingInvoice(null);
      fetchSubmittedInvoices();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
    } finally {
      setUpdatingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      // Create invoice data for download
      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        date: new Date(invoice.submitted_at).toISOString().split("T")[0],
        modelerName:
          user?.metadata?.title || user?.email?.split("@")[0] || "Modeler",
        modelerEmail: user?.email || "",
        period: `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`,
        periodDates: `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`,
        assets: invoice.metadata?.assets || [],
        subtotal: invoice.subtotal,
        bonusEarnings: invoice.bonus_earnings,
        correctionEarnings: invoice.correction_earnings || 0,
        total: invoice.total_amount,
        clients: invoice.metadata?.clients || [],
        categories: invoice.metadata?.categories || [],
        assetCount: invoice.metadata?.assetCount || 0,
        bankDetails: {
          bankName: invoice.bank_name || "",
          bankAccountNr: invoice.bank_account_nr || "",
          streetAddress: invoice.street_address || "",
          cityStateZip: invoice.city_state_zip || "",
          bicSwiftCode: invoice.bic_swift_code || "",
        },
      };

      // Generate HTML content
      const htmlContent = generateInvoiceHTML(invoiceData);

      // Create and download the file
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoice_number}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    }
  };

  const generateInvoiceHTML = (data: {
    invoiceNumber: string;
    date: string;
    modelerName: string;
    modelerEmail: string;
    period: string;
    periodDates: string;
    assets: ApprovedAsset[];
    subtotal: number;
    bonusEarnings: number;
    correctionEarnings?: number;
    total: number;
    clients: string[];
    categories: string[];
    assetCount: number;
    bankDetails: {
      bankName: string;
      bankAccountNr: string;
      streetAddress: string;
      cityStateZip: string;
      bicSwiftCode: string;
    };
  }) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${data.invoiceNumber}</title>
      <style>
        body { 
          font-family: "Segoe UI", Arial, sans-serif;
          margin: 40px;
          line-height: 1.6;
          color: #2b2b2b;
          background-color: #fff;
        }
        h1, h2, h3 { margin: 0; }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 20px;
        }
        .invoice-title {
          font-size: 2.2em;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.5px;
        }
        .invoice-info { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 40px;
          gap: 30px;
        }
        .from-section, .to-section {
          flex: 1;
          padding: 20px;
          background-color: #fafafa;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .section-header {
          font-weight: 600;
          color: #374151;
          font-size: 0.95em;
          margin-bottom: 12px;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 6px;
        }
        .contact-name, .company-name {
          font-weight: 600;
          font-size: 1em;
          margin-bottom: 4px;
        }
        .period-info {
          background-color: #f9fafb;
          padding: 15px 20px;
          border-radius: 6px;
          margin: 25px 0;
          border-left: 3px solid #2563eb;
        }
        .period-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .summary-card {
          background-color: #ffffff;
          padding: 18px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          text-align: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .summary-value {
          font-size: 1.4em;
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        .summary-label {
          color: #6b7280;
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .assets-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
          font-size: 0.95em;
        }
        .assets-table th, .assets-table td {
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          text-align: left;
        }
        .assets-table th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        .assets-table tr:nth-child(even) {
          background-color: #fafafa;
        }
        .assets-table tr:hover {
          background-color: #f3f4f6;
        }
        .total-section {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          border: 1px solid #e5e7eb;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .total-row:last-child {
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          margin-top: 12px;
          font-weight: 700;
          font-size: 1.05em;
        }
        .bank-details {
          background-color: #fffbea;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          border: 1px solid #fde68a;
        }
        .bank-title {
          font-weight: 600;
          color: #78350f;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .bank-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 15px;
        }
        .bank-field {
          display: flex;
          flex-direction: column;
        }
        .bank-label {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 4px;
          font-size: 0.85em;
        }
        .bank-value {
          color: #111827;
          font-family: monospace;
          font-size: 1em;
        }
         body { 
  font-family: "Segoe UI", Arial, sans-serif;
  margin: 40px auto;
  line-height: 1.6;
  color: #2b2b2b;
  background-color: #fff;
  max-width: 50%;
  min-width: 600px; /* stops it from getting too narrow on smaller screens */
}

      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="invoice-title">Invoice</h1>
        <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
        <p><strong>Date:</strong> ${data.date}</p>
      </div>
  
      <div class="invoice-info">
        <div class="from-section">
          <div class="section-header">From</div>
          <div>
            <div class="contact-name">${data.modelerName}</div>
            <div class="company-name">${data.modelerEmail}</div>
            <div>Freelance 3D Modeler</div>
          </div>
        </div>
        <div class="to-section">
          <div class="section-header">To</div>
          <div>
            <div class="company-name">CharpstAR Platform</div>
            <div>3D Modeling Services</div>
          </div>
        </div>
      </div>
  
      <div class="period-info">
        <div class="period-title">Billing Period</div>
        <div>${data.period}</div>
        <div>${data.periodDates}</div>
      </div>
  
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">${data.assetCount}</div>
          <div class="summary-label">Assets Completed</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${data.clients.length}</div>
          <div class="summary-label">Clients</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${data.categories.length}</div>
          <div class="summary-label">Categories</div>
        </div>
      </div>
  
      <table class="assets-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Client</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Base Price</th>
            <th>Bonus Status</th>
            <th>Total</th>
            <th>Approved</th>
          </tr>
        </thead>
        <tbody>
          ${data.assets
            .map(
              (asset) => `
            <tr>
              <td>
                <strong>${asset.product_name}</strong><br>
                <span style="color: #6b7280; font-size: 0.85em;">${asset.article_id}</span>
              </td>
              <td>
                ${asset.client}<br>
                <span style="color: #6b7280; font-size: 0.85em;">Batch ${asset.batch}</span>
              </td>
              <td>
                ${asset.category}
                ${asset.subcategory ? `<br><span style="color: #6b7280; font-size: 0.85em;">${asset.subcategory}</span>` : ""}
              </td>
              <td>
                <span style="
                  padding: 3px 8px;
                  border-radius: 4px;
                  font-size: 0.75em;
                  font-weight: 600;
                  ${
                    asset.priority === 1
                      ? "background-color: #fee2e2; color: #991b1b;"
                      : asset.priority === 2
                        ? "background-color: #fef3c7; color: #92400e;"
                        : "background-color: #dcfce7; color: #166534;"
                  }
                ">
                  ${asset.priority === 1 ? "High" : asset.priority === 2 ? "Medium" : "Low"}
                </span>
              </td>
              <td>€${asset.price.toFixed(2)}</td>
                              <td>
                  ${asset.allocation_list_status === "approved" ? `+${asset.allocation_lists?.bonus || 0}%` : "Pending"}
                </td>
                <td>€${(asset.allocation_list_status === "approved" ? asset.price * (1 + (asset.allocation_lists?.bonus || 0) / 100) : asset.price).toFixed(2)}</td>
                              <td>
                  ${
                    asset.allocation_list_status === "approved"
                      ? '<span style="color: #166534; font-size: 0.85em;">✓ Complete</span>'
                      : '<span style="color: #92400e; font-size: 0.85em;">List pending</span>'
                  }
                </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
  
      <div class="total-section">
        <div class="total-row">
          <span>Base Earnings:</span>
          <span>€${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Bonus Earnings:</span>
          <span>€${data.bonusEarnings.toFixed(2)}</span>
        </div>
        ${
          data.correctionEarnings && data.correctionEarnings > 0
            ? `
        <div class="total-row">
          <span>Corrections:</span>
          <span>€${data.correctionEarnings.toFixed(2)}</span>
        </div>
        `
            : ""
        }
        <div class="total-row">
          <span>Total Amount:</span>
          <span>€${data.total.toFixed(2)}</span>
        </div>
      </div>
  
      <div class="bank-details">
        <div class="bank-title">Bank Transfer Details</div>
        <div class="bank-info">
          <div class="bank-field">
            <div class="bank-label">Bank Name</div>
            <div class="bank-value">${data.bankDetails.bankName || "Not provided"}</div>
          </div>
          <div class="bank-field">
            <div class="bank-label">Account Number</div>
            <div class="bank-value">${data.bankDetails.bankAccountNr || "Not provided"}</div>
          </div>
          <div class="bank-field">
            <div class="bank-label">Street Address</div>
            <div class="bank-value">${data.bankDetails.streetAddress || "Not provided"}</div>
          </div>
          <div class="bank-field">
            <div class="bank-label">City, State, ZIP</div>
            <div class="bank-value">${data.bankDetails.cityStateZip || "Not provided"}</div>
          </div>
          <div class="bank-field">
            <div class="bank-label">BIC/SWIFT Code</div>
            <div class="bank-value">${data.bankDetails.bicSwiftCode || "Not provided"}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  if (!user) {
    return null;
  }

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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            Invoicing
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Generate invoices for your approved work by monthly periods
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs sm:text-sm w-fit">
          <FileText className="h-3 w-3" />
          <span className="hidden sm:inline">Modeler Invoicing</span>
          <span className="sm:hidden">Modeler</span>
        </Badge>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Select Invoicing Period</span>
              <span className="sm:hidden">Select Period</span>
            </CardTitle>
            {selectedPeriod && filteredAssets.length > 0 && (
              <Button
                onClick={handleGenerateInvoice}
                className="gap-2 text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Generate Invoice</span>
                <span className="sm:hidden">Generate</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-64 text-sm">
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
              <div className="text-xs sm:text-sm text-muted-foreground">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-xl">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Total Assets
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold text-foreground">
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
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-green-50 rounded-xl">
                  <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Base Earnings
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold text-foreground">
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
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-amber-50 rounded-xl">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Bonus Earnings
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold text-foreground">
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
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-orange-50 rounded-xl">
                  <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Correction Earnings
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold text-foreground">
                    €{monthlyStats.totalCorrectionEarnings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Additional compensation for corrections
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Future Bonuses
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    €
                    {futureBonuses
                      .reduce((sum, bonus) => sum + bonus.amount, 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From {futureBonuses.length} incomplete lists
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-50 rounded-xl">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Total Invoice
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold text-foreground">
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-amber-800 text-sm sm:text-base">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">
                Retroactive Bonuses Applied This Month
              </span>
              <span className="sm:hidden">Retroactive Bonuses</span>
            </CardTitle>
            <p className="text-xs sm:text-sm text-amber-700">
              Bonuses for allocation lists created in previous months but
              completed this month
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {retroactiveBonuses.map((bonus) => (
                <div
                  key={bonus.allocationListId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-white rounded-lg border border-amber-200 gap-2 sm:gap-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">
                      Allocation List #{bonus.allocationListId.slice(-8)}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {bonus.assetCount} assets • {bonus.bonusPercentage}% bonus
                      rate
                    </p>
                    <p className="text-xs text-gray-500">
                      Created: {bonus.listCreatedDate.toLocaleDateString()} •
                      Completed: {bonus.listCompletedDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-amber-700 text-sm sm:text-base">
                      +€{bonus.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">retroactive bonus</p>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <p className="font-medium text-amber-800 text-sm sm:text-base">
                    Total Retroactive Bonuses:
                  </p>
                  <p className="font-bold text-base sm:text-lg text-amber-800">
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

      {/* Future Bonus Information */}
      {/* {selectedPeriod && futureBonuses.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Calendar className="h-5 w-5" />
              Future Bonuses (Estimated)
            </CardTitle>
            <p className="text-sm text-blue-700">
              Bonuses for allocation lists that are incomplete and will be
              completed in the future.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {futureBonuses.map((bonus) => (
                <div
                  key={bonus.allocationListId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
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
                      Estimated Completion: {bonus.estimatedCompletion}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-700">
                      +€{bonus.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">future bonus</p>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-blue-800">
                    Total Future Bonuses:
                  </p>
                  <p className="font-bold text-lg text-blue-800">
                    +€
                    {futureBonuses
                      .reduce((sum, bonus) => sum + bonus.amount, 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Bonus Breakdown */}
      {selectedPeriod && monthlyStats.completedLists > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm sm:text-base">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">
                  Bonus Earnings from Completed Lists
                </span>
                <span className="sm:hidden">Bonus Earnings</span>
              </div>
              <Badge variant="outline" className="text-xs w-fit">
                {monthlyStats.completedLists} lists completed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              <strong>Bonus Calculation:</strong> Bonuses are calculated
              globally on the entire allocation list&apos;s completed subtotal
              when the list is completed before its deadline. Individual assets
              don&apos;t receive individual bonuses - they contribute to the
              list&apos;s total bonus calculation. Assets from incomplete lists
              will have their bonuses credited when the entire list is completed
              in a future month.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                <span className="font-medium text-amber-800 text-sm sm:text-base">
                  Bonus Earnings: €{monthlyStats.totalBonusEarnings.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-amber-700">
                This includes bonuses calculated on the completed subtotal of
                allocation lists that were completed this month, not individual
                asset bonuses. The bonus is applied globally to the entire
                list&apos;s completed work when the list meets deadline
                requirements.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm sm:text-base">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">
                Assets Approved in{" "}
                {selectedPeriod &&
                  monthlyPeriods.find((p) => p.value === selectedPeriod)
                    ?.label}{" "}
                Period
              </span>
              <span className="sm:hidden">
                Assets in{" "}
                {selectedPeriod &&
                  monthlyPeriods.find((p) => p.value === selectedPeriod)?.label}
              </span>
            </div>
            {selectedPeriod && (
              <Badge variant="outline" className="text-xs w-fit">
                {filteredAssets.length} assets
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">
                How Bonuses Work
              </span>
            </div>
            <p className="text-sm text-blue-700">
              <strong>Important:</strong> Bonuses are calculated globally on the
              entire allocation list when it&apos;s completed, not per
              individual asset. Individual assets show their base price until
              their allocation list is fully completed. The &quot;Total&quot;
              column shows what you&apos;ll receive for each asset (base price +
              bonus if eligible).
            </p>
          </div> */}

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
              <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                No Approved Assets
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedPeriod
                  ? "No approved assets found for the selected period."
                  : "Select a period to view approved assets."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Product
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Client
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Base Price
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Bonus Status
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Total
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm text-left">
                      Approved
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="min-w-[200px] text-left">
                        <div>
                          <div
                            className="font-medium truncate max-w-[180px] sm:max-w-[200px] cursor-help text-xs sm:text-sm"
                            title={asset.product_name}
                          >
                            {asset.product_name.length > 20
                              ? asset.product_name.substring(0, 20) + "..."
                              : asset.product_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {asset.article_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px] text-left">
                        <div>
                          <div className="font-medium text-xs sm:text-sm">
                            {asset.client}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Batch {asset.batch}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px] text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-xs sm:text-sm">
                            €{asset.price.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px] text-left">
                        <div className="text-xs sm:text-sm">
                          {isListCompletedBeforeDeadline(asset) ? (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Eligible
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {isListCompletedBeforeDeadline(asset) ? (
                              <span className="text-green-600">
                                ✓ List completed before deadline
                              </span>
                            ) : asset.allocation_lists?.approved_at ? (
                              <span className="text-red-600">
                                ✗ Completed after deadline
                              </span>
                            ) : (
                              <span>(Bonus when list completes)</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px] text-left">
                        <div className="flex items-center gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-xs sm:text-sm">
                            €
                            {(isListCompletedBeforeDeadline(asset)
                              ? asset.price *
                                (1 + (asset.allocation_lists?.bonus || 0) / 100)
                              : asset.price
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground text-center mt-1">
                          {isListCompletedBeforeDeadline(asset) ? (
                            <span>(Base + Bonus)</span>
                          ) : (
                            <span>(Base only)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px] text-left">
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {isListCompletedBeforeDeadline(asset) ? (
                            <div>
                              <div>
                                List:{" "}
                                {new Date(
                                  asset.allocation_lists?.approved_at ||
                                    asset.approved_at
                                ).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-green-600">
                                ✓ Complete
                              </div>
                            </div>
                          ) : asset.allocation_lists?.approved_at ? (
                            <div>
                              <div>
                                List:{" "}
                                {new Date(
                                  asset.allocation_lists.approved_at
                                ).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-red-600">
                                ✗ Late completion
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submitted Invoices History */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            My Submitted Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loadingInvoices ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">
                Loading invoices...
              </p>
            </div>
          ) : submittedInvoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">
                No Invoices Submitted Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Submit your first invoice using the form above
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">
                      Invoice #
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">Period</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Submitted
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Admin Comments
                    </TableHead>
                    <TableHead className="text-xs sm:text-sm">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs sm:text-sm">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(invoice.period_start).toLocaleDateString()} -{" "}
                        {new Date(invoice.period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs sm:text-sm">
                        €{invoice.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {invoice.status === "pending" && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {invoice.status === "approved" && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 text-xs"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {invoice.status === "rejected" && (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-200 text-xs"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                        {invoice.status === "changes_requested" && (
                          <Badge
                            variant="outline"
                            className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Changes Requested
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-muted-foreground">
                        {new Date(invoice.submitted_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {invoice.admin_comments ? (
                          <div
                            className="max-w-xs truncate"
                            title={invoice.admin_comments}
                          >
                            {invoice.admin_comments}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex gap-2">
                          {(invoice.status === "pending" ||
                            invoice.status === "changes_requested") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditInvoice(invoice)}
                              className="h-8 px-2 text-xs"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          {invoice.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              className="h-8 px-2 text-xs"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
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

      {/* Invoice Generation Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Invoice Preview
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review your invoice details and provide bank information before
              generating the final invoice.
            </DialogDescription>
          </DialogHeader>

          {invoicePreview && (
            <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
              {/* Invoice Preview Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Invoice Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-base sm:text-2xl font-bold text-blue-600">
                      {invoicePreview.assetCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Assets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base sm:text-2xl font-bold text-green-600">
                      €{invoicePreview.subtotal.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="hidden sm:inline">Base Earnings</span>
                      <span className="sm:hidden">Base</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-base sm:text-2xl font-bold text-amber-600">
                      €{invoicePreview.bonusEarnings.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Bonus</div>
                  </div>
                  {invoicePreview.correctionEarnings &&
                    invoicePreview.correctionEarnings > 0 && (
                      <div className="text-center">
                        <div className="text-base sm:text-2xl font-bold text-orange-600">
                          €{invoicePreview.correctionEarnings.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Corrections
                        </div>
                      </div>
                    )}
                  <div className="text-center">
                    <div className="text-base sm:text-2xl font-bold text-purple-600">
                      €{invoicePreview.total.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">
                      Period
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {invoicePreview.period}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {invoicePreview.periodDates}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">
                      Invoice Details
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground break-all">
                      Number: {invoicePreview.invoiceNumber}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Date: {invoicePreview.date}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Details Form */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Bank Transfer Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Bank Name
                    </label>
                    <Input
                      value={bankDetails.bankName}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          bankName: e.target.value,
                        }))
                      }
                      placeholder="Enter bank name"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Account Number
                    </label>
                    <Input
                      value={bankDetails.bankAccountNr}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          bankAccountNr: e.target.value,
                        }))
                      }
                      placeholder="Enter account number"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Street Address
                    </label>
                    <Input
                      value={bankDetails.streetAddress}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          streetAddress: e.target.value,
                        }))
                      }
                      placeholder="Enter street address"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      City, State, ZIP
                    </label>
                    <Input
                      value={bankDetails.cityStateZip}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          cityStateZip: e.target.value,
                        }))
                      }
                      placeholder="Enter city, state, ZIP"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs sm:text-sm font-medium">
                      BIC/SWIFT Code
                    </label>
                    <Input
                      value={bankDetails.bicSwiftCode}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          bicSwiftCode: e.target.value,
                        }))
                      }
                      placeholder="Enter BIC/SWIFT code"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Notes to Admin */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Notes to Admin (Optional)
                </h3>
                <Textarea
                  value={modelerNotes}
                  onChange={(e) => setModelerNotes(e.target.value)}
                  placeholder="Add any notes or comments for the admin reviewer..."
                  rows={4}
                  className="w-full text-sm"
                />
              </div>
            </div>
          )}

          {/* Action Buttons - Fixed at bottom */}
          {invoicePreview && (
            <div className="flex-shrink-0 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t bg-background">
              <Button
                variant="outline"
                onClick={() => setShowInvoiceDialog(false)}
                className="w-full sm:w-auto text-sm h-9 sm:h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateFinalInvoice}
                disabled={generatingInvoice}
                className="w-full sm:w-auto text-sm h-9 sm:h-10 min-w-[140px]"
              >
                {generatingInvoice ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2" />
                    <span className="hidden sm:inline">Submitting...</span>
                    <span className="sm:hidden">Submitting...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="hidden sm:inline">
                      Submit Invoice for Review
                    </span>
                    <span className="sm:hidden">Submit</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
              Edit Invoice
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update your bank details and notes for invoice{" "}
              {editingInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>

          {editingInvoice && (
            <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
              {/* Invoice Info */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Invoice Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Invoice Number
                    </div>
                    <div className="font-mono text-sm">
                      {editingInvoice.invoice_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Amount
                    </div>
                    <div className="font-semibold text-lg">
                      €{editingInvoice.total_amount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Period
                    </div>
                    <div className="text-sm">
                      {new Date(
                        editingInvoice.period_start
                      ).toLocaleDateString()}{" "}
                      -{" "}
                      {new Date(editingInvoice.period_end).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Status
                    </div>
                    <div className="text-sm">
                      {editingInvoice.status === "pending" && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {editingInvoice.status === "changes_requested" && (
                        <Badge
                          variant="outline"
                          className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Changes Requested
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Comments (Read-only) */}
              {editingInvoice.admin_comments && (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-orange-800">
                    Admin Comments
                  </h3>
                  <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm text-orange-900 whitespace-pre-wrap">
                      {editingInvoice.admin_comments}
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Details Form */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Bank Transfer Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Bank Name
                    </label>
                    <Input
                      value={editBankDetails.bankName}
                      onChange={(e) =>
                        setEditBankDetails((prev) => ({
                          ...prev,
                          bankName: e.target.value,
                        }))
                      }
                      placeholder="Enter bank name"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Account Number
                    </label>
                    <Input
                      value={editBankDetails.bankAccountNr}
                      onChange={(e) =>
                        setEditBankDetails((prev) => ({
                          ...prev,
                          bankAccountNr: e.target.value,
                        }))
                      }
                      placeholder="Enter account number"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Street Address
                    </label>
                    <Input
                      value={editBankDetails.streetAddress}
                      onChange={(e) =>
                        setEditBankDetails((prev) => ({
                          ...prev,
                          streetAddress: e.target.value,
                        }))
                      }
                      placeholder="Enter street address"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      City, State, ZIP
                    </label>
                    <Input
                      value={editBankDetails.cityStateZip}
                      onChange={(e) =>
                        setEditBankDetails((prev) => ({
                          ...prev,
                          cityStateZip: e.target.value,
                        }))
                      }
                      placeholder="Enter city, state, ZIP"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs sm:text-sm font-medium">
                      BIC/SWIFT Code
                    </label>
                    <Input
                      value={editBankDetails.bicSwiftCode}
                      onChange={(e) =>
                        setEditBankDetails((prev) => ({
                          ...prev,
                          bicSwiftCode: e.target.value,
                        }))
                      }
                      placeholder="Enter BIC/SWIFT code"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Notes to Admin */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">
                  Notes to Admin (Optional)
                </h3>
                <Textarea
                  value={editModelerNotes}
                  onChange={(e) => setEditModelerNotes(e.target.value)}
                  placeholder="Add any notes or comments for the admin reviewer..."
                  rows={4}
                  className="w-full text-sm"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {editingInvoice && (
            <div className="flex-shrink-0 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t bg-background">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="w-full sm:w-auto text-sm h-9 sm:h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateInvoice}
                disabled={updatingInvoice}
                className="w-full sm:w-auto text-sm h-9 sm:h-10 min-w-[140px]"
              >
                {updatingInvoice ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2" />
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">Updating...</span>
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="hidden sm:inline">Update Invoice</span>
                    <span className="sm:hidden">Update</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
