"use client";

import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/inputs";

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
  Search,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { InvoiceReviewDialog } from "@/components/invoice/InvoiceReviewDialog";

interface Invoice {
  id: string;
  invoice_number: string;
  modeler_id: string;
  period_start: string;
  period_end: string;
  asset_ids: string[];
  subtotal: number;
  bonus_earnings: number;
  total_amount: number;
  bank_name?: string;
  bank_account_nr?: string;
  street_address?: string;
  city_state_zip?: string;
  bic_swift_code?: string;
  modeler_notes?: string;
  admin_comments?: string;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  metadata: {
    assets: any[];
    clients: string[];
    categories: string[];
    assetCount: number;
  };
  modeler?: {
    email: string;
    title?: string;
  };
  reviewer?: {
    email: string;
    title?: string;
  };
}

export default function InvoiceReviewPage() {
  const user = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  useEffect(() => {
    document.title = "CharpstAR Platform - Invoice Review";
    if (user?.id) {
      fetchInvoices();
    }
  }, [user?.id]);

  useEffect(() => {
    filterInvoices();
  }, [invoices, selectedStatus, searchQuery]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch("/api/invoices/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((inv) => inv.status === selectedStatus);
    }

    // Filter by search query (invoice number or modeler email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(query) ||
          inv.modeler?.email?.toLowerCase().includes(query) ||
          inv.modeler?.title?.toLowerCase().includes(query)
      );
    }

    setFilteredInvoices(filtered);
  };

  const handleReviewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowReviewDialog(true);
  };

  const handleApprove = async (comments: string) => {
    if (!selectedInvoice) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "approve",
          adminComments: comments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve invoice");
      }

      toast.success("Invoice approved successfully");
      setShowReviewDialog(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error approving invoice:", error);
      toast.error("Failed to approve invoice");
    }
  };

  const handleReject = async (comments: string) => {
    if (!selectedInvoice) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reject",
          adminComments: comments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject invoice");
      }

      toast.success("Invoice rejected");
      setShowReviewDialog(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error rejecting invoice:", error);
      toast.error("Failed to reject invoice");
    }
  };

  const handleRequestChanges = async (comments: string) => {
    if (!selectedInvoice) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "request_changes",
          adminComments: comments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to request changes");
      }

      toast.success("Changes requested");
      setShowReviewDialog(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error requesting changes:", error);
      toast.error("Failed to request changes");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "changes_requested":
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Changes Requested
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusCounts = () => {
    return {
      all: invoices.length,
      pending: invoices.filter((inv) => inv.status === "pending").length,
      approved: invoices.filter((inv) => inv.status === "approved").length,
      rejected: invoices.filter((inv) => inv.status === "rejected").length,
      changes_requested: invoices.filter(
        (inv) => inv.status === "changes_requested"
      ).length,
    };
  };

  // Access control
  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user.metadata?.role !== "admin") {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for administrators.
          </p>
        </div>
      </div>
    );
  }

  const statusCounts = getStatusCounts();

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            Invoice Review
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Review and approve modeler invoices
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-xs sm:text-sm w-fit">
          <FileText className="h-3 w-3" />
          Admin Panel
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setSelectedStatus("all")}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.all}</div>
            <div className="text-sm text-muted-foreground">All Invoices</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === "pending" ? "ring-2 ring-yellow-500" : ""}`}
          onClick={() => setSelectedStatus("pending")}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts.pending}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === "approved" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setSelectedStatus("approved")}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {statusCounts.approved}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === "changes_requested" ? "ring-2 ring-orange-500" : ""}`}
          onClick={() => setSelectedStatus("changes_requested")}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {statusCounts.changes_requested}
            </div>
            <div className="text-sm text-muted-foreground text-xs">
              Changes Requested
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${selectedStatus === "rejected" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setSelectedStatus("rejected")}
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {statusCounts.rejected}
            </div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number or modeler..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search criteria"
                  : "No invoices have been submitted yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Modeler</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleReviewInvoice(invoice)}
                    >
                      <TableCell className="font-mono font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {invoice.modeler?.title || invoice.modeler?.email}
                        </div>
                        {invoice.modeler?.title && (
                          <div className="text-xs text-muted-foreground">
                            {invoice.modeler?.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(invoice.period_start).toLocaleDateString()} -{" "}
                        {new Date(invoice.period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{invoice.metadata.assetCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        €{invoice.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(invoice.submitted_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewInvoice(invoice);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <InvoiceReviewDialog
        invoice={selectedInvoice}
        open={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestChanges={handleRequestChanges}
        isAdmin={true}
      />
    </div>
  );
}
