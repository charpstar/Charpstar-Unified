"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/inputs";
import {
  Download,
  Printer,
  FileText,
  CheckCircle,
  Clock,
  Building,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { toast } from "sonner";

interface InvoiceAsset {
  id: string;
  product_name: string;
  article_id: string;
  price: number;
  bonus?: number;
  status: string;
  completed_at?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  modelerName: string;
  modelerEmail: string;
  allocationListName: string;
  allocationListNumber: number;
  client: string;
  batch: number;
  deadline: string;
  assets: InvoiceAsset[];
  subtotal: number;
  bonusPercentage: number;
  bonusAmount: number;
  total: number;
  notes: string;
  bankDetails: {
    bankName: string;
    bankAccountNr: string;
    streetAddress: string;
    cityStateZip: string;
    bicSwiftCode: string;
  };
}

interface InvoiceGeneratorProps {
  allocationListId: string;
  onClose: () => void;
}

export default function InvoiceGenerator({
  allocationListId,
  onClose,
}: InvoiceGeneratorProps) {
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  useEffect(() => {
    if (allocationListId) {
      generateInvoice();
    }
  }, [allocationListId]);

  const generateInvoice = async () => {
    try {
      setLoading(true);

      // Fetch allocation list details
      const { data: allocationList, error: listError } = await supabase
        .from("allocation_lists")
        .select(
          `
          id,
          name,
          number,
          deadline,
          bonus,
          created_at,
          approved_at,
          status
        `
        )
        .eq("id", allocationListId)
        .single();

      if (listError) throw listError;

      // Check if allocation list is approved
      if (allocationList.status !== "approved") {
        toast.error("This allocation list is not approved yet");
        onClose();
        return;
      }

      // Fetch all assets for this list
      const { data: assetAssignments, error: assetsError } = await supabase
        .from("asset_assignments")
        .select(
          `
          id,
          price,
          bonus,
          onboarding_assets!inner(
            id,
            product_name,
            article_id,
            status,
            client,
            batch
          )
        `
        )
        .eq("allocation_list_id", allocationListId)
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (assetsError) throw assetsError;

      // Check if we have any asset assignments
      if (!assetAssignments || assetAssignments.length === 0) {
        toast.error("No assets found for this allocation list");
        onClose();
        return;
      }

      // Separate completed and incomplete assets
      const completedAssets =
        assetAssignments?.filter(
          (asset: any) =>
            asset.onboarding_assets?.status === "approved" ||
            asset.onboarding_assets?.status === "approved_by_client"
        ) || [];

      const incompleteAssets =
        assetAssignments?.filter(
          (asset: any) =>
            asset.onboarding_assets?.status !== "approved" &&
            asset.onboarding_assets?.status !== "approved_by_client"
        ) || [];

      // Calculate totals - only completed assets count for bonus calculation
      const completedSubtotal =
        completedAssets?.reduce((sum, asset) => sum + (asset.price || 0), 0) ||
        0;

      const incompleteSubtotal =
        incompleteAssets?.reduce((sum, asset) => sum + (asset.price || 0), 0) ||
        0;

      const totalSubtotal = completedSubtotal + incompleteSubtotal;

      // Calculate bonus - only apply to completed assets if approved before deadline
      let bonusAmount = 0;
      if (
        allocationList.approved_at &&
        allocationList.deadline &&
        allocationList.bonus &&
        completedAssets.length > 0
      ) {
        const approvedDate = new Date(allocationList.approved_at);
        const deadlineDate = new Date(allocationList.deadline);

        // Only apply bonus if work was completed before or on the deadline
        if (approvedDate <= deadlineDate) {
          bonusAmount = completedSubtotal * (allocationList.bonus / 100);
        }
      }

      const total = totalSubtotal + bonusAmount;

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Fetch modeler profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      // Get client and batch from the first asset assignment
      const firstAsset = assetAssignments?.[0] as any;
      const client = firstAsset?.onboarding_assets?.client || "Unknown";
      const batch = firstAsset?.onboarding_assets?.batch || 0;

      const invoice: InvoiceData = {
        invoiceNumber,
        date: new Date().toLocaleDateString(),
        modelerName: profile?.name || user?.email || "Unknown",
        modelerEmail: user?.email || "",
        allocationListName: allocationList.name,
        allocationListNumber: allocationList.number,
        client: client,
        batch: batch,
        deadline: allocationList.deadline,
        assets:
          assetAssignments?.map((assignment: any) => ({
            id: assignment.onboarding_assets.id,
            product_name: assignment.onboarding_assets.product_name,
            article_id: assignment.onboarding_assets.article_id,
            price: assignment.price || 0,
            bonus: assignment.bonus || 0,
            status: assignment.onboarding_assets.status,
          })) || [],
        subtotal: totalSubtotal,
        bonusPercentage: allocationList.bonus || 0,
        bonusAmount: bonusAmount,
        total,
        notes:
          bonusAmount > 0
            ? `Bonus of ${allocationList.bonus}% applied to completed assets only (${completedAssets.length} completed, ${incompleteAssets.length} incomplete). Bonus calculated on €${completedSubtotal.toFixed(2)} of completed work. Approved: ${new Date(allocationList.approved_at).toLocaleDateString()}, deadline: ${new Date(allocationList.deadline).toLocaleDateString()}.`
            : allocationList.bonus > 0
              ? `No bonus applied - work completed after deadline (approved: ${new Date(allocationList.approved_at).toLocaleDateString()}, deadline: ${new Date(allocationList.deadline).toLocaleDateString()})`
              : "No bonus configured for this allocation list",
        bankDetails: {
          bankName: "",
          bankAccountNr: "",
          streetAddress: "",
          cityStateZip: "",
          bicSwiftCode: "",
        },
      };

      setInvoiceData(invoice);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = () => {
    if (!invoiceData) return;

    const invoiceHTML = generateInvoiceHTML(invoiceData);
    const blob = new Blob([invoiceHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${invoiceData.invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printInvoice = () => {
    if (!invoiceData) return;

    const invoiceHTML = generateInvoiceHTML(invoiceData);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const generateInvoiceHTML = (data: InvoiceData) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${data.invoiceNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
          }
          .invoice-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
            gap: 40px;
          }
          .from-section, .to-section {
            flex: 1;
            padding: 15px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .section-header {
            font-weight: 700;
            color: #1e40af;
            font-size: 1.1em;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 4px;
          }
          .section-content {
            line-height: 1.6;
          }
          .contact-name, .company-name {
            font-weight: 600;
            color: #1f2937;
            font-size: 1.05em;
            margin-bottom: 4px;
          }
          .contact-email, .company-address, .company-location {
            color: #6b7280;
            font-size: 0.95em;
          }
          .invoice-details { 
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #475569;
            min-width: 80px;
          }
          .detail-value {
            font-weight: 500;
            color: #1e293b;
            text-align: right;
            flex: 1;
            margin-left: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
          }
          .totals { 
            text-align: right; 
            margin-top: 20px;
          }
          .total-row { 
            font-weight: bold; 
            font-size: 1.1em; 
          }
          .notes { 
            margin-top: 30px;
            padding: 15px;
            border: 1px solid #e5e7eb;
            background-color: #fefefe;
            border-radius: 6px;
          }
          .notes-header {
            margin-bottom: 10px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 5px;
          }
          .notes-title {
            margin: 0;
            color: #374151;
            font-size: 1.1em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .notes-content {
            color: #4b5563;
            line-height: 1.5;
          }
          .bank-info {
            margin-top: 20px;
            padding: 20px;
            border: 2px solid #e5e7eb;
            background-color: #f8fafc;
            border-radius: 8px;
          }
          .bank-header {
            margin-bottom: 15px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 8px;
          }
          .bank-title {
            margin: 0;
            color: #1e40af;
            font-size: 1.2em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .bank-details {
            display: grid;
            gap: 8px;
          }
          .bank-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .bank-row:last-child {
            border-bottom: none;
          }
          .bank-label {
            font-weight: 600;
            color: #374151;
            min-width: 140px;
          }
          .bank-value {
            font-weight: 500;
            color: #1f2937;
            text-align: right;
            flex: 1;
            margin-left: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVOICE</h1>
          <h2>${data.invoiceNumber}</h2>
        </div>
        
        <div class="invoice-info">
          <div class="from-section">
            <div class="section-header">From:</div>
            <div class="section-content">
              <div class="contact-name">${data.modelerName}</div>
              <div class="contact-email">${data.modelerEmail}</div>
            </div>
          </div>
          <div class="to-section">
            <div class="section-header">To:</div>
            <div class="section-content">
              <div class="company-name">Charpstar</div>
              <div class="company-address">Cylindervägen 12 Cylindertornet</div>
              <div class="company-location">131 52 Stockholm</div>
            </div>
          </div>
        </div>
        
        <div class="invoice-details">
          <div class="detail-row">
            <span class="detail-label">Project:</span>
            <span class="detail-value">Allocation ${data.allocationListNumber} - ${data.allocationListName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Client:</span>
            <span class="detail-value">${data.client} - Batch ${data.batch}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${data.date}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Deadline:</span>
            <span class="detail-value">${new Date(data.deadline).toLocaleDateString()}</span>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${data.assets
              .map(
                (asset) => `
              <tr>
                <td>${asset.product_name} (${asset.article_id})</td>
                <td>1</td>
                <td>€${asset.price.toFixed(2)}</td>
                <td>€${asset.price.toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <div class="totals">
          <div>Subtotal: €${data.subtotal.toFixed(2)}</div>
          ${data.bonusAmount > 0 ? `<div>BONUS (${data.bonusPercentage}%): €${data.bonusAmount.toFixed(2)}</div>` : ""}
          <div class="total-row">Total: €${data.total.toFixed(2)}</div>
        </div>
        
        <div class="bank-info">
          <div class="bank-header">
            <h3 class="bank-title">Bank Information</h3>
          </div>
          <div class="bank-details">
            <div class="bank-row">
              <span class="bank-label">Bank name:</span>
              <span class="bank-value">${data.bankDetails.bankName || "-"}</span>
            </div>
            <div class="bank-row">
              <span class="bank-label">Bank account Nr:</span>
              <span class="bank-value">${data.bankDetails.bankAccountNr || "-"}</span>
            </div>
            <div class="bank-row">
              <span class="bank-label">BIC / SWIFT code:</span>
              <span class="bank-value">${data.bankDetails.bicSwiftCode || "-"}</span>
            </div>
            <div class="bank-row">
              <span class="bank-label">Street address:</span>
              <span class="bank-value">${data.bankDetails.streetAddress || "-"}</span>
            </div>
            <div class="bank-row">
              <span class="bank-label">City, State, Zip:</span>
              <span class="bank-value">${data.bankDetails.cityStateZip || "-"}</span>
            </div>
          </div>
        </div>
        
        ${data.notes ? `<div class="notes"><div class="notes-header"><h4 class="notes-title">Notes</h4></div><div class="notes-content">${data.notes}</div></div>` : ""}
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Generating invoice...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground">
                No assets found for this allocation list.
              </p>
              <Button onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Generator
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={printInvoice}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button onClick={downloadInvoice}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bank Details Editor */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Bank Information (Edit before downloading)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Bank Name</label>
                <Input
                  placeholder="Enter bank name"
                  value={invoiceData.bankDetails.bankName}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      bankDetails: {
                        ...invoiceData.bankDetails,
                        bankName: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  Bank Account Number
                </label>
                <Input
                  placeholder="Enter bank account number"
                  value={invoiceData.bankDetails.bankAccountNr}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      bankDetails: {
                        ...invoiceData.bankDetails,
                        bankAccountNr: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">BIC / SWIFT Code</label>
                <Input
                  placeholder="Enter BIC/SWIFT code"
                  value={invoiceData.bankDetails.bicSwiftCode}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      bankDetails: {
                        ...invoiceData.bankDetails,
                        bicSwiftCode: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Street Address</label>
                <Input
                  placeholder="Enter street address"
                  value={invoiceData.bankDetails.streetAddress}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      bankDetails: {
                        ...invoiceData.bankDetails,
                        streetAddress: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">City, State, Zip</label>
                <Input
                  placeholder="Enter city, state, and zip code"
                  value={invoiceData.bankDetails.cityStateZip}
                  onChange={(e) =>
                    setInvoiceData({
                      ...invoiceData,
                      bankDetails: {
                        ...invoiceData.bankDetails,
                        cityStateZip: e.target.value,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Invoice Content */}
          <div className="space-y-6">
            {/* Invoice Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Invoice Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Invoice #:</strong> {invoiceData.invoiceNumber}
                    </div>
                    <div>
                      <strong>Date:</strong> {invoiceData.date}
                    </div>
                    <div>
                      <strong>Project:</strong> Allocation{" "}
                      {invoiceData.allocationListNumber} -{" "}
                      {invoiceData.allocationListName}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Modeler Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Name:</strong> {invoiceData.modelerName}
                    </div>
                    <div>
                      <strong>Email:</strong> {invoiceData.modelerEmail}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Project Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Client:</strong> {invoiceData.client}
                    </div>
                    <div>
                      <strong>Batch:</strong> {invoiceData.batch}
                    </div>
                    <div>
                      <strong>Deadline:</strong>{" "}
                      {new Date(invoiceData.deadline).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Total Assets:</strong> {invoiceData.assets.length}
                    </div>
                    <div>
                      <strong>Completed Assets:</strong>{" "}
                      {
                        invoiceData.assets.filter(
                          (a) =>
                            a.status === "approved" ||
                            a.status === "approved_by_client"
                        ).length
                      }{" "}
                      (eligible for bonus)
                    </div>
                    <div>
                      <strong>Incomplete Assets:</strong>{" "}
                      {
                        invoiceData.assets.filter(
                          (a) =>
                            a.status !== "approved" &&
                            a.status !== "approved_by_client"
                        ).length
                      }{" "}
                      (base price only)
                    </div>
                    <div>
                      <strong>Base Price (All Assets):</strong> €
                      {invoiceData.assets
                        .reduce((sum, asset) => sum + asset.price, 0)
                        .toFixed(2)}
                    </div>
                    <div>
                      <strong>Subtotal (Completed Only):</strong> €
                      {invoiceData.subtotal.toFixed(2)}
                    </div>
                    <div>
                      <strong>Bonus:</strong> {invoiceData.bonusPercentage}% (€
                      {invoiceData.bonusAmount.toFixed(2)})
                    </div>
                    <div className="font-semibold text-lg">
                      <strong>Total:</strong> €{invoiceData.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assets Table */}
            <div>
              <h3 className="font-semibold mb-4">All Assets in List</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Only assets with status &quot;Approved&quot; or &quot;Approved
                by Client&quot; are eligible for bonus payments. Assets with
                other statuses receive base price only.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Product Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Article ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Base Price
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Bonus Eligible
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.assets.map((asset, index) => (
                      <tr
                        key={asset.id}
                        className={
                          index % 2 === 0 ? "bg-background" : "bg-muted/50"
                        }
                      >
                        <td className="px-4 py-3 text-sm">
                          {asset.product_name}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {asset.article_id}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          €{asset.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {asset.status === "approved" ||
                          asset.status === "approved_by_client" ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              asset.status === "approved" ||
                              asset.status === "approved_by_client"
                                ? "default"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {asset.status === "approved" ||
                            asset.status === "approved_by_client" ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approved (Bonus Eligible)
                              </>
                            ) : asset.status === "delivered_by_artist" ? (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Waiting for Approval
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                {asset.status} (Base Price Only)
                              </>
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bonus Calculation Explanation */}
            <div>
              <h3 className="font-semibold mb-2">Bonus Calculation Details</h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <div>
                  <strong>Bonus Calculation Logic:</strong>
                </div>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Only assets with status &quot;Approved&quot; or
                    &quot;Approved by Client&quot; are eligible for bonus
                    payments
                  </li>
                  <li>
                    Assets with status &quot;delivered_by_artist&quot;,
                    &quot;revisions&quot;, or other incomplete statuses receive
                    base price only
                  </li>
                  <li>Bonus percentage: {invoiceData.bonusPercentage}%</li>
                  <li>
                    Bonus amount: €{invoiceData.bonusAmount.toFixed(2)}{" "}
                    (calculated on €{invoiceData.subtotal.toFixed(2)} of
                    completed work)
                  </li>
                  <li>
                    Total invoice includes base price for all assets plus bonus
                    for completed assets only
                  </li>
                </ul>
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <Textarea
                placeholder="Add any additional notes to the invoice..."
                value={invoiceData.notes}
                onChange={(e) =>
                  setInvoiceData({ ...invoiceData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
