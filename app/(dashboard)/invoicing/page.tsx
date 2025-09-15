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
  Clock,
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
  allocation_list_id: string;
  allocation_list_number: number;
  allocation_list_created_at: string;
  allocation_lists?: {
    bonus: number;
    approved_at: string;
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
          approved_at: item.allocation_lists.approved_at,
          allocation_list_id: item.allocation_list_id,
          allocation_list_number: item.allocation_lists.number,
          allocation_list_created_at: item.allocation_lists.created_at,
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
    // We need to determine when each asset was approved
    const assetsApprovedInPeriod = approvedAssets.filter((asset) => {
      // If the asset has an allocation list that was completed in this period,
      // it means the asset was approved in this period
      if (asset.approved_at) {
        const listCompletedDate = new Date(asset.approved_at);
        return (
          listCompletedDate >= period.startDate &&
          listCompletedDate <= period.endDate
        );
      }

      // If no allocation list completion date, we need to check when the asset was individually approved
      // For now, we&apos;ll use the allocation list creation date as a proxy for when the asset was assigned
      // This is not perfect but gives us a reasonable approximation
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

    const totalPotential = totalBaseEarnings + bonusEarnings;

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
      total: monthlyStats.totalBaseEarnings + monthlyStats.totalBonusEarnings,
      clients: monthlyStats.clients,
      categories: monthlyStats.categories,
      assetCount: monthlyStats.totalAssets, // All approved assets count
    };

    setInvoicePreview(invoicePreviewData);
    setShowInvoiceDialog(true);
  };

  const handleGenerateFinalInvoice = async () => {
    if (!invoicePreview) return;

    setGeneratingInvoice(true);
    try {
      // Generate the actual invoice HTML
      const invoiceHTML = generateInvoiceHTML({
        ...invoicePreview,
        bankDetails,
      });

      // Create and download the invoice
      const blob = new Blob([invoiceHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoicePreview.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Invoice generated and downloaded successfully!");
      setShowInvoiceDialog(false);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    } finally {
      setGeneratingInvoice(false);
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
                  ${asset.approved_at ? `+${asset.allocation_lists?.bonus || 0}%` : "Pending"}
                </td>
                <td>€${(asset.approved_at ? asset.price * (1 + (asset.allocation_lists?.bonus || 0) / 100) : asset.price).toFixed(2)}</td>
                              <td>
                  ${
                    asset.approved_at
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Invoicing Period
            </CardTitle>
            {selectedPeriod && filteredAssets.length > 0 && (
              <Button onClick={handleGenerateInvoice} className="gap-2">
                <FileText className="h-4 w-4" />
                Generate Invoice
              </Button>
            )}
          </div>
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
              {retroactiveBonuses.map((bonus) => (
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
              <strong>Bonus Calculation:</strong> Bonuses are calculated
              globally on the entire allocation list&apos;s completed subtotal
              when the list is completed before its deadline. Individual assets
              don&apos;t receive individual bonuses - they contribute to the
              list&apos;s total bonus calculation. Assets from incomplete lists
              will have their bonuses credited when the entire list is completed
              in a future month.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assets Approved in{" "}
            {selectedPeriod &&
              monthlyPeriods.find((p) => p.value === selectedPeriod)
                ?.label}{" "}
            Period
            {selectedPeriod && (
              <Badge variant="outline" className="ml-auto">
                {filteredAssets.length} assets
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
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

                  <TableHead>Base Price</TableHead>
                  <TableHead>Bonus Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div>
                        <div
                          className="font-medium truncate max-w-[200px] cursor-help"
                          title={asset.product_name}
                        >
                          {asset.product_name.length > 25
                            ? asset.product_name.substring(0, 25) + "..."
                            : asset.product_name}
                        </div>
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
                      <div className="flex items-center gap-1 text-right justify-center">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €{asset.price.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {asset.approved_at ? (
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
                          {asset.approved_at ? (
                            <span className="text-green-600">
                              ✓ List completed
                            </span>
                          ) : (
                            <span>(Bonus when list completes)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-right justify-center">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          €
                          {(asset.approved_at
                            ? asset.price *
                              (1 + (asset.allocation_lists?.bonus || 0) / 100)
                            : asset.price
                          ).toFixed(2)}
                        </span>
                        <div className="text-xs text-muted-foreground ml-1">
                          {asset.approved_at ? (
                            <span>(Base + Bonus)</span>
                          ) : (
                            <span>(Base only)</span>
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

      {/* Invoice Generation Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-4xl h-fit overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Preview
            </DialogTitle>
            <DialogDescription>
              Review your invoice details and provide bank information before
              generating the final invoice.
            </DialogDescription>
          </DialogHeader>

          {invoicePreview && (
            <div className="space-y-6">
              {/* Invoice Preview Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Invoice Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {invoicePreview.assetCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Assets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      €{invoicePreview.subtotal.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Base Earnings
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      €{invoicePreview.bonusEarnings.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Bonus</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      €{invoicePreview.total.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Period</h4>
                    <p className="text-sm text-muted-foreground">
                      {invoicePreview.period}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoicePreview.periodDates}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Invoice Details</h4>
                    <p className="text-sm text-muted-foreground">
                      Number: {invoicePreview.invoiceNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Date: {invoicePreview.date}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Details Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Bank Transfer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bank Name</label>
                    <Input
                      value={bankDetails.bankName}
                      onChange={(e) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          bankName: e.target.value,
                        }))
                      }
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
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
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowInvoiceDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateFinalInvoice}
                  disabled={generatingInvoice}
                  className="min-w-[140px]"
                >
                  {generatingInvoice ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Invoice
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
