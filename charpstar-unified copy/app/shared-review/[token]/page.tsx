"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  ExternalLink,
  Download,
  FileText,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface SharedAsset {
  id: string;
  productName: string;
  articleId: string;
  status: string;
  glbLink?: string | null;
  reference?: string[];
  previewImage?: string | null;
  productLink?: string | null;
}

interface Invitation {
  id: string;
  recipientName: string | null;
  recipientEmail: string;
  message?: string | null;
  expiresAt: string;
  status: string;
  requiresPin?: boolean;
  createdBy: {
    name: string;
    email: string;
  };
}

interface AssetResponse {
  assetId: string;
  action: "approve" | "revision";
  comment?: string | null;
}

export default function SharedReviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [existingResponses, setExistingResponses] = useState<
    Map<string, AssetResponse>
  >(new Map());
  const [responses, setResponses] = useState<Map<string, AssetResponse>>(
    new Map()
  );
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [pinValidated, setPinValidated] = useState(false);
  const [validatingPin, setValidatingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Fetch shared assets
  useEffect(() => {
    if (!token) {
      console.error("[SharedReviewPage] No token found in params:", params);
      setError("Invalid review link - token is missing");
      setLoading(false);
      return;
    }

    const fetchSharedAssets = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("[SharedReviewPage] Fetching assets for token:", token);
        const response = await fetch(`/api/shared-reviews/${token}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to load shared assets (${response.status})`
          );
        }

        const data = await response.json();
        console.log("[SharedReviewPage] Received data:", {
          hasInvitation: !!data.invitation,
          assetCount: data.assets?.length || 0,
        });

        setInvitation(data.invitation);
        setAssets(data.assets || []);

        // Check if PIN is already validated (stored in sessionStorage)
        const pinValidationKey = `pin_validated_${token}`;
        const isPinValidated =
          sessionStorage.getItem(pinValidationKey) === "true";

        // If PIN is required and not validated, don't show assets yet
        if (data.invitation.requiresPin && !isPinValidated) {
          setPinValidated(false);
        } else {
          setPinValidated(true);
        }

        // Map existing responses
        if (data.responses && Array.isArray(data.responses)) {
          const responseMap = new Map<string, AssetResponse>();
          data.responses.forEach((r: AssetResponse) => {
            responseMap.set(r.assetId, r);
          });
          setExistingResponses(responseMap);
          setResponses(responseMap); // Pre-fill existing responses
        }
      } catch (err: any) {
        console.error("[SharedReviewPage] Error fetching shared assets:", err);
        setError(err.message || "Failed to load shared assets");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedAssets();
  }, [token, params]);

  const handlePinValidation = async () => {
    if (!pinCode || pinCode.length !== 4) {
      setPinError("Please enter a 4-digit PIN code");
      return;
    }

    setValidatingPin(true);
    setPinError(null);

    try {
      const response = await fetch(
        `/api/shared-reviews/${token}/validate-pin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pinCode }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid PIN code");
      }

      if (data.valid) {
        // Store validation in sessionStorage
        const pinValidationKey = `pin_validated_${token}`;
        sessionStorage.setItem(pinValidationKey, "true");
        setPinValidated(true);
        setPinError(null);
      } else {
        throw new Error("Invalid PIN code");
      }
    } catch (err: any) {
      console.error("Error validating PIN:", err);
      setPinError(err.message || "Invalid PIN code. Please try again.");
    } finally {
      setValidatingPin(false);
    }
  };

  const handleSubmit = async () => {
    if (responses.size === 0) {
      toast.error("Please review at least one model before submitting");
      return;
    }

    setSubmitting(true);

    try {
      const responsesArray = Array.from(responses.values());

      const response = await fetch(`/api/shared-reviews/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ responses: responsesArray }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      toast.success(
        `Review submitted successfully! ${data.message || "Thank you for your feedback."}`
      );
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting review:", err);
      toast.error(err.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className=" bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 border-border/50 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Loading Review
              </h2>
              <p className="text-sm text-muted-foreground">
                Please wait while we load your review request...
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show PIN validation form if PIN is required and not validated
  if (invitation?.requiresPin && !pinValidated) {
    return (
      <div className=" bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full p-8 border-border/50 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                PIN Code Required
              </h2>
              <p className="text-sm text-muted-foreground">
                Please enter the 4-digit PIN code that was sent to you via email
                to access this review.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setPinCode(value);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePinValidation();
                    }
                  }}
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0000"
                  autoFocus
                />
                {pinError && (
                  <p className="text-sm text-destructive mt-2">{pinError}</p>
                )}
              </div>

              <Button
                onClick={handlePinValidation}
                disabled={validatingPin || pinCode.length !== 4}
                size="lg"
                className="w-full"
              >
                {validatingPin ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Verify PIN Code"
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className=" bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 border-destructive/50 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Unable to Load Review
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground pt-2">
                The link may be invalid, expired, or cancelled.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className=" bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 border-green-200/50 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 shadow-xl">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-foreground">
                Review Submitted Successfully
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Thank you for your review! The models have been reviewed and
                feedback has been sent to{" "}
                <span className="font-semibold text-foreground">
                  {invitation?.createdBy.name || "the team"}
                </span>
                .
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!invitation || assets.length === 0) {
    return (
      <div className=" bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 border-border/50 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                No Assets Found
              </h2>
              <p className="text-sm text-muted-foreground">
                This review invitation contains no assets to review.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const pendingCount = assets.filter(
    (a) => !existingResponses.has(a.id)
  ).length;
  const respondedCount = assets.filter((a) =>
    existingResponses.has(a.id)
  ).length;

  return (
    <div className=" bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 py-4 space-y-6">
        {/* Header Section */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
              Review Request
            </h1>
            <p className="text-muted-foreground text-lg">
              {invitation.createdBy.name}{" "}
              <span className="text-muted-foreground/70">
                ({invitation.createdBy.email})
              </span>{" "}
              has requested your review of{" "}
              <span className="font-semibold text-foreground">
                {assets.length} {assets.length === 1 ? "3D model" : "3D models"}
              </span>
              .
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Models
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {assets.length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Pending Review
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {pendingCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Reviewed
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {respondedCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Message Card */}
          {invitation.message && (
            <Card className="p-5 border-border/50 bg-gradient-to-br from-muted/50 to-muted/30">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Message from {invitation.createdBy.name}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {invitation.message}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Expiry Info */}
          <Card className="p-4 border-amber-200/50 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Review expires on{" "}
                  <span className="font-semibold">
                    {new Date(invitation.expiresAt).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </span>
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Assets Table */}
        <Card className="p-0 overflow-hidden border-border/50 shadow-lg">
          <div className="p-6 border-b border-border/50 bg-muted/30">
            <h2 className="text-xl font-semibold text-foreground">
              Models to Review
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review each model and provide your feedback
            </p>
          </div>
          <div className="overflow-auto p-4">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10 border-b border-border/50">
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead className="text-left font-semibold text-foreground px-6 py-4">
                    Model Name
                  </TableHead>
                  <TableHead className="text-left font-semibold text-foreground px-6 py-4">
                    Article ID
                  </TableHead>
                  <TableHead className="text-center font-semibold text-foreground px-6 py-4">
                    Status
                  </TableHead>
                  <TableHead className="text-center font-semibold text-foreground px-6 py-4">
                    Links
                  </TableHead>
                  <TableHead className="text-center font-semibold text-foreground px-6 py-4">
                    Refs
                  </TableHead>
                  <TableHead className="text-center font-semibold text-foreground px-6 py-4">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-12 px-6"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                        <p>No assets found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map((asset) => {
                    const existingResponse = existingResponses.get(asset.id);
                    const isResponded = !!existingResponse;

                    return (
                      <TableRow
                        key={asset.id}
                        className="hover:bg-muted/30 transition-colors border-b border-border/50"
                      >
                        <TableCell className="text-left px-6 py-5">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span
                              className="font-semibold text-foreground truncate"
                              title={asset.productName}
                            >
                              {asset.productName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left px-6 py-5">
                          <span
                            className="text-xs font-mono text-muted-foreground truncate block px-3 py-1.5 bg-muted/50 rounded-md"
                            title={asset.articleId}
                          >
                            {asset.articleId}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-6 py-5">
                          {isResponded ? (
                            <div className="flex items-center justify-center">
                              {existingResponse.action === "approve" ? (
                                <Badge className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-sm">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Revision
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-muted-foreground/30"
                            >
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center px-6 py-5">
                          <div className="flex items-center justify-center gap-2">
                            {asset.productLink && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  window.open(asset.productLink!, "_blank")
                                }
                                className="h-9 w-9 hover:bg-muted"
                                title="Product Link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {asset.glbLink && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  window.open(asset.glbLink!, "_blank")
                                }
                                className="h-9 w-9 hover:bg-muted"
                                title="Download GLB"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-6 py-5">
                          {asset.reference && asset.reference.length > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 border-border/50 hover:bg-muted px-3"
                              onClick={() => {
                                if (
                                  !asset.reference ||
                                  asset.reference.length === 0
                                )
                                  return;
                                const refs = asset.reference
                                  .map(
                                    (ref: string) =>
                                      `<img src="${ref}" style="max-width: 300px; margin: 10px;" />`
                                  )
                                  .join("");
                                const newWindow = window.open();
                                if (newWindow) {
                                  newWindow.document.write(
                                    `<html><body style="text-align: center; padding: 20px;">${refs}</body></html>`
                                  );
                                }
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              {asset.reference.length}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center px-6 py-5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              router.push(
                                `/shared-review/${token}/${asset.id}`
                              );
                            }}
                            className="h-9 px-4 text-sm gap-2 border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                            View Model
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Submit Button */}
        {responses.size > 0 && (
          <Card className="p-6 sticky bottom-4 z-10 border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-base font-semibold text-foreground">
                    {responses.size} {responses.size === 1 ? "model" : "models"}{" "}
                    ready to submit
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Review your selections and submit your feedback
                </p>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || responses.size === 0}
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Submit Review
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
