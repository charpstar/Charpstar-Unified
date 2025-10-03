"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { ScrollArea } from "@/components/ui/interactive";
import { Calendar, User, Activity } from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  description: string | null;
  type: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  user_email: string | null;
  metadata: any;
  created_at: string;
}

interface ActivityLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetIds: string[];
}

const getActivityTypeColor = (type: string): string => {
  switch (type) {
    case "update":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    case "create":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    case "upload":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getActionIcon = (type: string) => {
  switch (type) {
    case "update":
      return <Activity className="h-4 w-4" />;
    case "create":
      return <Activity className="h-4 w-4" />;
    case "upload":
      return <Activity className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

export function ActivityLogsDialog({
  open,
  onOpenChange,
  assetIds,
}: ActivityLogsDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && assetIds.length > 0) {
      fetchActivityLogs();
    }
  }, [open, assetIds]);

  const fetchActivityLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .in("resource_id", assetIds)
        .eq("resource_type", "asset")
        .or("action.ilike.%client_revision%,action.ilike.%approved_by_client%")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching activity logs:", error);
        setError("Failed to fetch activity logs");
        return;
      }

      setLogs(data || []);
    } catch (err) {
      console.error("Error in fetchActivityLogs:", err);
      setError("Failed to fetch activity logs");
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (log: ActivityLog): string => {
    // Try to get user info from metadata first
    if (log.metadata?.userEmail) {
      return log.metadata.userEmail;
    }

    // Fallback to user_email from the log
    if (log.user_email) {
      return log.user_email;
    }

    // Fallback to user ID
    if (log.user_id) {
      return `User ${log.user_id.substring(0, 8)}...`;
    }

    return "Unknown User";
  };

  const getAssetName = (resourceId: string): string => {
    // This would ideally come from the asset data, but for now we'll use the ID
    return `Asset ${resourceId.substring(0, 8)}...`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Logs
            {assetIds.length > 1 && (
              <Badge variant="outline" className="ml-2">
                {assetIds.length} assets
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                Loading logs...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                No client revision or approval logs found for selected assets
              </div>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-3 p-3 rounded-lg border dark:border-border bg-card dark:bg-card/50"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="p-2 rounded-full bg-muted dark:bg-muted/50">
                        {getActionIcon(log.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-foreground">
                            {log.action}
                          </h4>
                          {log.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getActivityTypeColor(log.type)}`}
                        >
                          {log.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{getUserDisplayName(log)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                        {log.resource_id && (
                          <div className="flex items-center gap-1">
                            <span>Asset:</span>
                            <code className="text-xs bg-muted dark:bg-muted/50 px-1 py-0.5 rounded">
                              {getAssetName(log.resource_id)}
                            </code>
                          </div>
                        )}
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted dark:bg-muted/50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
