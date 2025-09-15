"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Eye,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PendingReply {
  id: string;
  asset_id: string;
  parent_comment_id: string;
  reply_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  profiles: {
    title?: string;
    role?: string;
    email?: string;
    name?: string;
  };
  parent_comment: {
    id: string;
    comment: string;
    created_by: string;
    profiles: {
      title?: string;
      role?: string;
      email?: string;
      name?: string;
    };
  };
  assets: {
    id: string;
    product_name: string;
    article_id: string;
  };
}

export default function PendingRepliesPage() {
  const user = useUser();
  const router = useRouter();
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPendingReplies = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pending-replies?status=pending");
      if (!response.ok) {
        throw new Error("Failed to fetch pending replies");
      }
      const data = await response.json();
      setPendingReplies(data.pendingReplies || []);
    } catch (error) {
      console.error("Error fetching pending replies:", error);
      toast.error("Failed to load pending replies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReplies();
  }, []);

  // Check if user is admin
  useEffect(() => {
    if (user && user.metadata?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleApprove = async (pendingReplyId: string) => {
    try {
      setActionLoading(pendingReplyId);
      const response = await fetch(`/api/pending-replies/${pendingReplyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          approvedBy: user?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve reply");
      }

      toast.success("Reply approved and posted");
      fetchPendingReplies(); // Refresh the list
    } catch (error: any) {
      console.error("Error approving reply:", error);
      toast.error(error.message || "Failed to approve reply");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (pendingReplyId: string) => {
    try {
      setActionLoading(pendingReplyId);
      const response = await fetch(`/api/pending-replies/${pendingReplyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          approvedBy: user?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reject reply");
      }

      toast.success("Reply rejected");
      fetchPendingReplies(); // Refresh the list
    } catch (error: any) {
      console.error("Error rejecting reply:", error);
      toast.error(error.message || "Failed to reject reply");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Show loading while user is being fetched or data is loading
  if (!user || loading) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // Check if user is admin after user is loaded
  if (user.metadata?.role !== "admin") {
    return null; // This will trigger the redirect in useEffect
  }

  return (
    <div className="container mx-auto p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            <span className="hidden sm:inline">Pending QA Replies</span>
            <span className="sm:hidden">Pending Replies</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
            Review and approve QA replies to client comments
          </p>
        </div>
        <Badge variant="outline" className="text-xs sm:text-sm w-fit">
          {pendingReplies.length} pending
        </Badge>
      </div>

      {pendingReplies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
            <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500 mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center">
              No pending replies
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center text-sm sm:text-base">
              All QA replies have been processed. Check back later for new
              submissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {pendingReplies.map((reply) => (
            <Card key={reply.id} className="border-l-4 border-l-yellow-500">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex-shrink-0">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg">
                        <span className="hidden sm:inline">
                          QA Reply Pending Approval
                        </span>
                        <span className="sm:hidden">Pending Reply</span>
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">
                            {reply.profiles?.name ||
                              reply.profiles?.email ||
                              "QA User"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">
                            {reply.assets?.product_name} (
                            {reply.assets?.article_id})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">
                            {formatDate(reply.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 text-xs sm:text-sm w-fit"
                  >
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                {/* Parent Comment */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-blue-100 dark:bg-blue-900/20 rounded flex-shrink-0">
                        <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client Comment:
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      by{" "}
                      {reply.parent_comment.profiles?.name ||
                        reply.parent_comment.profiles?.email ||
                        "Client"}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm leading-relaxed">
                    {reply.parent_comment.comment}
                  </p>
                </div>

                {/* QA Reply */}
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 sm:p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 bg-yellow-100 dark:bg-yellow-900/20 rounded flex-shrink-0">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      <span className="hidden sm:inline">
                        QA Reply (Pending):
                      </span>
                      <span className="sm:hidden">QA Reply:</span>
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm leading-relaxed">
                    {reply.reply_text}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={() => handleApprove(reply.id)}
                    disabled={actionLoading === reply.id}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
                  >
                    {actionLoading === reply.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                    ) : (
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">Approve & Post</span>
                    <span className="sm:hidden">Approve</span>
                  </Button>
                  <Button
                    onClick={() => handleReject(reply.id)}
                    disabled={actionLoading === reply.id}
                    variant="destructive"
                    className="text-sm sm:text-base"
                  >
                    {actionLoading === reply.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                    ) : (
                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    )}
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/client-review/${reply.asset_id}`)
                    }
                    className="text-sm sm:text-base"
                  >
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">View Asset</span>
                    <span className="sm:hidden">View</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
