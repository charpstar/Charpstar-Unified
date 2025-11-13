"use client";

import { useState } from "react";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";

interface ShareForReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetIds: string[];
  assetCount: number;
  onSuccess?: () => void;
}

export function ShareForReviewDialog({
  open,
  onOpenChange,
  assetIds,
  assetCount,
  onSuccess,
}: ShareForReviewDialogProps) {
  const { startLoading, stopLoading } = useLoading();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    // Validate email
    if (!recipientEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }

    if (!validateEmail(recipientEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!assetIds || assetIds.length === 0) {
      toast.error("No assets selected");
      return;
    }

    setSubmitting(true);
    startLoading();

    try {
      const response = await fetch("/api/assets/share-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          assetIds: assetIds,
          message: message.trim() || undefined,
          expiresInDays: expiresInDays,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create share invitation");
      }

      toast.success(
        `Invitation sent successfully! ${recipientEmail} will receive an email with a review link.`
      );

      // Reset form
      setRecipientEmail("");
      setRecipientName("");
      setMessage("");
      setExpiresInDays(30);

      // Close dialog
      onOpenChange(false);

      // Notify parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error creating share invitation:", error);
      toast.error(
        error.message || "Failed to create share invitation. Please try again."
      );
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] dark:bg-background dark:border-border">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground dark:text-foreground">
            Share for Review
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            Share {assetCount} {assetCount === 1 ? "model" : "models"} with an
            external reviewer. They will receive an email with a secure link to
            review and approve the models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Count Info */}
          <div className="bg-muted/50 dark:bg-muted/20 rounded-lg p-3 border border-border dark:border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground dark:text-foreground">
                Models to Share:
              </span>
              <span className="text-sm font-bold text-primary">{assetCount}</span>
            </div>
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground dark:text-foreground">
              Recipient Email <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              placeholder="reviewer@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={submitting}
              className="dark:bg-background dark:border-border dark:text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) {
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Recipient Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground dark:text-foreground">
              Recipient Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="John Doe"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              disabled={submitting}
              className="dark:bg-background dark:border-border dark:text-foreground"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground dark:text-foreground">
              Message <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              placeholder="Add a personal message to the reviewer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background dark:border-border dark:text-foreground"
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground dark:text-foreground">
              Link Expires In (days)
            </label>
            <Input
              type="number"
              min="1"
              max="90"
              value={expiresInDays}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 90) {
                  setExpiresInDays(value);
                }
              }}
              disabled={submitting}
              className="dark:bg-background dark:border-border dark:text-foreground"
            />
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              The review link will expire after {expiresInDays} day
              {expiresInDays !== 1 ? "s" : ""}. Default is 30 days.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-border dark:border-border">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={submitting}
            className="cursor-pointer dark:border-border dark:hover:bg-muted/50 w-full sm:w-auto text-sm h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !recipientEmail.trim()}
            className="cursor-pointer w-full sm:w-auto text-sm h-9"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                Sending Invitation...
              </>
            ) : (
              "Send Invitation"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

