"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/inputs";
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
  CheckCircle,
  XCircle,
  AlertCircle,
  Euro,
  Package,
  Building,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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

interface InvoiceReviewDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onApprove: (comments: string) => Promise<void>;
  onReject: (comments: string) => Promise<void>;
  onRequestChanges: (comments: string) => Promise<void>;
  isAdmin?: boolean;
}

export function InvoiceReviewDialog({
  invoice,
  open,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
  isAdmin = false,
}: InvoiceReviewDialogProps) {
  const [adminComments, setAdminComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [bankDetailsExpanded, setBankDetailsExpanded] = useState(false);
  const [adminCommentsExpanded, setAdminCommentsExpanded] = useState(false);

  if (!invoice) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      case "changes_requested":
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200"
          >
            Changes Requested
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAction = async (
    action: "approve" | "reject" | "request_changes"
  ) => {
    setProcessing(true);
    try {
      if (action === "approve") {
        await onApprove(adminComments);
      } else if (action === "reject") {
        await onReject(adminComments);
      } else {
        await onRequestChanges(adminComments);
      }
      setAdminComments("");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="min-w-7xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Review
            </DialogTitle>
            {getStatusBadge(invoice.status)}
          </div>
          <DialogDescription>
            Review invoice details and approve, reject, or request changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Invoice Number
              </div>
              <div className="font-semibold">{invoice.invoice_number}</div>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Modeler</div>
              <div className="font-semibold">
                {invoice.modeler?.title || invoice.modeler?.email}
              </div>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Period</div>
              <div className="font-semibold text-sm">
                {new Date(invoice.period_start).toLocaleDateString()} -{" "}
                {new Date(invoice.period_end).toLocaleDateString()}
              </div>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Submitted
              </div>
              <div className="font-semibold text-sm">
                {new Date(invoice.submitted_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-600" />
                <div className="text-sm text-blue-700">Assets</div>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {invoice.metadata.assetCount}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="h-4 w-4 text-green-600" />
                <div className="text-sm text-green-700">Base Earnings</div>
              </div>
              <div className="text-2xl font-bold text-green-900">
                €{invoice.subtotal.toFixed(2)}
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-amber-600" />
                <div className="text-sm text-amber-700">Bonus</div>
              </div>
              <div className="text-2xl font-bold text-amber-900">
                €{invoice.bonus_earnings.toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <div className="text-sm text-purple-700">Total</div>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                €{invoice.total_amount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Clients and Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium">Clients</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {invoice.metadata.clients.map((client, idx) => (
                  <Badge key={idx} variant="outline">
                    {client}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium">Categories</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {invoice.metadata.categories.map((category, idx) => (
                  <Badge key={idx} variant="outline">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Bank Details - Collapsible */}
          {(invoice.bank_name || invoice.bank_account_nr) && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <button
                onClick={() => setBankDetailsExpanded(!bankDetailsExpanded)}
                className="flex items-center gap-2 font-semibold text-yellow-800 hover:text-yellow-900 transition-colors"
              >
                {bankDetailsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Bank Transfer Details
              </button>
              {bankDetailsExpanded && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {invoice.bank_name && (
                    <div>
                      <div className="text-yellow-700 font-medium">
                        Bank Name
                      </div>
                      <div className="text-yellow-900">{invoice.bank_name}</div>
                    </div>
                  )}
                  {invoice.bank_account_nr && (
                    <div>
                      <div className="text-yellow-700 font-medium">
                        Account Number
                      </div>
                      <div className="text-yellow-900 font-mono">
                        {invoice.bank_account_nr}
                      </div>
                    </div>
                  )}
                  {invoice.street_address && (
                    <div>
                      <div className="text-yellow-700 font-medium">
                        Street Address
                      </div>
                      <div className="text-yellow-900">
                        {invoice.street_address}
                      </div>
                    </div>
                  )}
                  {invoice.city_state_zip && (
                    <div>
                      <div className="text-yellow-700 font-medium">
                        City, State, ZIP
                      </div>
                      <div className="text-yellow-900">
                        {invoice.city_state_zip}
                      </div>
                    </div>
                  )}
                  {invoice.bic_swift_code && (
                    <div>
                      <div className="text-yellow-700 font-medium">
                        BIC/SWIFT Code
                      </div>
                      <div className="text-yellow-900 font-mono">
                        {invoice.bic_swift_code}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modeler Notes */}
          {invoice.modeler_notes && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="font-semibold mb-2 text-blue-800">
                Notes from Modeler
              </div>
              <div className="text-sm text-blue-900 whitespace-pre-wrap">
                {invoice.modeler_notes}
              </div>
            </div>
          )}

          {/* Admin Comments (if previously reviewed) - Collapsible */}
          {invoice.admin_comments && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <button
                onClick={() => setAdminCommentsExpanded(!adminCommentsExpanded)}
                className="flex items-center gap-2 font-semibold text-orange-800 hover:text-orange-900 transition-colors"
              >
                {adminCommentsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Admin Comments
              </button>
              {adminCommentsExpanded && (
                <div className="mt-3">
                  <div className="text-sm text-orange-900 whitespace-pre-wrap">
                    {invoice.admin_comments}
                  </div>
                  {invoice.reviewed_at && invoice.reviewer && (
                    <div className="text-xs text-orange-700 mt-2">
                      Reviewed by {invoice.reviewer.email} on{" "}
                      {new Date(invoice.reviewed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assets Table */}
          <div className=" overflow-y-auto max-h-[20vh]">
            <h3 className="font-semibold mb-3">Asset Details</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left pl-4">Product</TableHead>
                    <TableHead className="text-left  pl-4">Client</TableHead>
                    <TableHead className="text-left  pl-4">Category</TableHead>
                    <TableHead className="text-left  pl-4">Priority</TableHead>
                    <TableHead className="text-left  pl-4">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.metadata.assets.map((asset: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium text-left text-left pl-2 ">
                          {asset.product_name}
                        </div>
                        <div className="text-xs text-left text-muted-foreground pl-2">
                          {asset.article_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-left ">{asset.client}</div>
                        <div className="text-xs text-left text-muted-foreground ">
                          Batch {asset.batch}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-left ">{asset.category}</div>
                        {asset.subcategory && (
                          <div className="text-xs text-left text-muted-foreground">
                            {asset.subcategory}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <Badge
                          variant="outline"
                          className={
                            asset.priority === 1
                              ? "bg-red-50 text-red-700 border-red-200 text-left"
                              : asset.priority === 2
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-left"
                                : "bg-green-50 text-green-700 border-green-200 text-left  "
                          }
                        >
                          {asset.priority === 1
                            ? "High"
                            : asset.priority === 2
                              ? "Medium"
                              : "Low"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left font-medium text-left">
                        €{asset.price.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Admin Action Section */}
          {(isAdmin && invoice.status === "pending") ||
          invoice.status === "changes_requested" ? (
            <div className="border-t pt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Admin Comments
                </label>
                <Textarea
                  value={adminComments}
                  onChange={(e) => setAdminComments(e.target.value)}
                  placeholder="Add comments for the modeler (optional)"
                  rows={4}
                  className="w-full"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAction("approve")}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Invoice
                </Button>
                <Button
                  onClick={() => handleAction("request_changes")}
                  disabled={processing}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request Changes
                </Button>
                <Button
                  onClick={() => handleAction("reject")}
                  disabled={processing}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Invoice
                </Button>
              </div>
            </div>
          ) : null}

          {/* Close Button for Non-Admin or Already Reviewed */}
          {!isAdmin ||
          (invoice.status !== "pending" &&
            invoice.status !== "changes_requested") ? (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
