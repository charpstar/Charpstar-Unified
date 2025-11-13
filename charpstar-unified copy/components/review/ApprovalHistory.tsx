"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import {
  Clock,
  User,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";

interface ApprovalHistoryProps {
  assetId: string;
  className?: string;
}

interface ApprovalRecord {
  id: string;
  action: string;
  user_id: string;
  user_email: string;
  created_at: string;
  metadata: {
    new_status?: string;
    prev_status?: string;
    revision_number?: number;
    user_role?: string;
    user_name?: string;
  };
  profiles?: any;
}

interface RevisionRecord {
  id: string;
  revision_number: number;
  created_by: string;
  created_at: string;
  status: string;
  comments?: string;
  profiles?: any;
}

export function ApprovalHistory({
  assetId,
  className = "",
}: ApprovalHistoryProps) {
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [revisionHistory, setRevisionHistory] = useState<RevisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    if (assetId) {
      fetchApprovalHistory();
    }
  }, [assetId]);

  const fetchApprovalHistory = async () => {
    try {
      setLoading(true);

      // Fetch status history from the new asset_status_history table
      const { data: statusHistory, error: statusError } = await supabase
        .from("asset_status_history")
        .select(
          `
          id,
          previous_status,
          new_status,
          action_type,
          changed_by,
          changed_by_email,
          changed_by_name,
          changed_by_role,
          revision_number,
          revision_reason,
          comments,
          metadata,
          created_at
        `
        )
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });

      if (statusError) {
        console.error("Error fetching status history:", statusError);
      } else {
        // Transform the data to match our interface
        const transformedHistory = (statusHistory || []).map((record: any) => ({
          id: record.id,
          action:
            record.action_type || `Status changed to ${record.new_status}`,
          user_id: record.changed_by,
          user_email: record.changed_by_email,
          created_at: record.created_at,
          metadata: {
            new_status: record.new_status,
            prev_status: record.previous_status,
            revision_number: record.revision_number,
            user_role: record.changed_by_role,
            user_name: record.changed_by_name,
            revision_reason: record.revision_reason,
            comments: record.comments,
            ...record.metadata,
          },
          profiles: {
            name: record.changed_by_name,
            email: record.changed_by_email,
            title: record.changed_by_role,
          },
        }));

        setApprovalHistory(transformedHistory as ApprovalRecord[]);
      }

      // Fetch revision history from revision_history table (for backward compatibility)
      const { data: revisions, error: revisionError } = await supabase
        .from("revision_history")
        .select(
          `
          id,
          revision_number,
          created_by,
          created_at,
          status,
          comments
        `
        )
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false });

      // If we have revisions, fetch user profiles separately

      const revisionProfiles: Record<string, any> = {};
      if (revisions && revisions.length > 0) {
        const userIds = [...new Set(revisions.map((r: any) => r.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, title, name, email")
          .in("id", userIds);

        if (profiles) {
          profiles.forEach((profile: any) => {
            revisionProfiles[profile.id] = profile;
          });
        }
      }

      if (revisionError) {
        console.error("Error fetching revision history:", revisionError);
      } else {
        // Add profiles to revision records
        const revisionsWithProfiles = (revisions || []).map(
          (revision: any) => ({
            ...revision,
            profiles: revisionProfiles[revision.created_by] || null,
          })
        );
        setRevisionHistory(revisionsWithProfiles as RevisionRecord[]);
      }
    } catch (error) {
      console.error("Error fetching approval history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string, metadata: any) => {
    const actionLower = action.toLowerCase();
    const newStatus = metadata?.new_status;

    if (
      actionLower.includes("approved") ||
      newStatus === "approved" ||
      newStatus === "approved_by_client"
    ) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (
      actionLower.includes("revision") ||
      newStatus === "revisions" ||
      newStatus === "client_revision"
    ) {
      return <RotateCcw className="h-4 w-4 text-orange-500" />;
    }
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  const getActionBadgeVariant = (
    action: string,
    metadata: any
  ): "default" | "green" | "secondary" | "destructive" | "outline" => {
    const actionLower = action.toLowerCase();
    const newStatus = metadata?.new_status;

    if (
      actionLower.includes("approved") ||
      newStatus === "approved" ||
      newStatus === "approved_by_client"
    ) {
      return "green";
    }
    if (
      actionLower.includes("revision") ||
      newStatus === "revisions" ||
      newStatus === "client_revision"
    ) {
      return "outline";
    }
    return "secondary";
  };

  const formatActionText = (action: string, metadata: any) => {
    const newStatus = metadata?.new_status;
    const prevStatus = metadata?.prev_status;
    const revisionNumber = metadata?.revision_number;
    const actionType = metadata?.action_type || action;

    // Handle specific action types from the new table
    switch (actionType) {
      case "qa_approved":
        return "Approved by QA";
      case "client_approved":
        return "Approved by Client";
      case "sent_for_revision":
        return revisionNumber
          ? `Sent for Revision #${revisionNumber}`
          : "Sent for Revision";
      case "client_revision_requested":
        return revisionNumber
          ? `Client Revision #${revisionNumber}`
          : "Client Requested Revision";
      case "delivered_by_artist":
        return "Delivered by Artist";
      case "moved_to_production":
        return "Moved to Production";
      case "work_started":
        return "Work Started";
      case "status_reset":
        return "Status Reset";
      case "status_changed":
        return `Status changed from ${prevStatus || "unknown"} to ${newStatus}`;
      default:
        // Handle legacy status-based formatting
        if (newStatus === "approved_by_client") {
          return "Approved by Client";
        }
        if (newStatus === "approved") {
          return "Approved by QA";
        }
        if (newStatus === "revisions") {
          return revisionNumber
            ? `Sent for Revision #${revisionNumber}`
            : "Sent for Revision";
        }
        if (newStatus === "client_revision") {
          return revisionNumber
            ? `Client Revision #${revisionNumber}`
            : "Client Requested Revision";
        }
        if (newStatus === "delivered_by_artist") {
          return "Delivered by Artist";
        }
        if (newStatus === "in_production") {
          return "Moved to Production";
        }

        // Fallback to action text
        return action || "Status Updated";
    }
  };

  const getUserDisplay = (record: ApprovalRecord | RevisionRecord) => {
    const profile = Array.isArray(record.profiles)
      ? record.profiles[0]
      : record.profiles;
    if (profile?.name) {
      return profile.name;
    }
    if (profile?.title) {
      return profile.title;
    }
    if ("user_email" in record && record.user_email) {
      return record.user_email;
    }
    if (profile?.email) {
      return profile.email;
    }
    return "Unknown User";
  };

  const getUserRole = (metadata: any) => {
    if (metadata?.user_role) {
      return metadata.user_role;
    }
    return null;
  };

  const combinedHistory = [
    ...approvalHistory.map((item) => ({
      ...item,
      type: "approval" as const,
      timestamp: item.created_at,
    })),
    ...revisionHistory.map((item) => ({
      ...item,
      type: "revision" as const,
      timestamp: item.created_at,
      action: `Revision #${item.revision_number}`,
      metadata: { revision_number: item.revision_number },
    })),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (combinedHistory.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            No approval or revision history available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayHistory = expanded
    ? combinedHistory
    : combinedHistory.slice(0, 3);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Approval & Revision History
            <Badge variant="secondary" className="text-xs">
              {combinedHistory.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-6 w-6 p-0"
            >
              {showDetails ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            {combinedHistory.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-6 px-2 text-xs"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {showDetails && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {displayHistory.map((record) => (
              <div
                key={`${record.type}-${record.id}`}
                className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActionIcon(record.action, record.metadata)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={getActionBadgeVariant(
                        record.action,
                        record.metadata
                      )}
                      className="text-xs"
                    >
                      {formatActionText(record.action, record.metadata)}
                    </Badge>
                    {record.type === "revision" &&
                      "revision_number" in record && (
                        <Badge variant="outline" className="text-xs">
                          Rev #{record.revision_number}
                        </Badge>
                      )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="font-medium">
                        {getUserDisplay(record)}
                      </span>
                      {getUserRole(record.metadata) && (
                        <Badge variant="outline" className="text-xs">
                          {getUserRole(record.metadata)}
                        </Badge>
                      )}
                    </div>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(record.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {record.type === "revision" &&
                    "comments" in record &&
                    record.comments && (
                      <div className="mt-2 text-xs text-muted-foreground bg-background/50 p-2 rounded border">
                        <strong>Comment:</strong> {record.comments}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>

          {!expanded && combinedHistory.length > 3 && (
            <div className="text-center mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="text-xs"
              >
                View {combinedHistory.length - 3} more entries
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default ApprovalHistory;
