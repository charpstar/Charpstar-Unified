"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  MessageSquare,
  Star,
  Clock,
  ExternalLink,
  AlertCircle,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface PriorityComment {
  id: string;
  comment: string;
  created_at: string;
  asset_id: string;
  created_by: string;
  profiles: {
    title?: string;
    email: string;
    role: string;
  } | null;
  onboarding_assets: {
    product_name: string;
    article_id: string;
    status: string;
    client: string;
  };
}

export default function QACommentsWidget() {
  const user = useUser();
  const router = useRouter();
  const [priorityComments, setPriorityComments] = useState<PriorityComment[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [unpinningComment, setUnpinningComment] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchPriorityComments();
    }
  }, [user?.id]);

  const fetchPriorityComments = async () => {
    try {
      setLoading(true);

      // Get assets assigned to this modeler
      const { data: assignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("user_id", user?.id)
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (assignmentError) {
        console.error("Error fetching assignments:", assignmentError);
        return;
      }

      if (!assignments || assignments.length === 0) {
        setPriorityComments([]);
        return;
      }

      const assetIds = assignments.map((a) => a.asset_id);

      // Fetch priority comments for assigned assets
      const { data: comments, error: commentsError } = await supabase
        .from("asset_comments")
        .select(
          `
          id,
          comment,
          created_at,
          asset_id,
          created_by,
          profiles!created_by (
            title,
            email,
            role
          ),
          onboarding_assets!inner (
            product_name,
            article_id,
            status,
            client
          )
        `
        )
        .in("asset_id", assetIds)
        .eq("is_priority", true)
        .not("comment", "like", "NOTE:%") // Exclude notes
        .order("created_at", { ascending: false })
        .limit(10);

      if (commentsError) {
        console.error("Error fetching priority comments:", commentsError);
        return;
      }

      // Transform the data to match our interface
      const transformedComments = (comments || []).map((comment) => ({
        ...comment,
        profiles: Array.isArray(comment.profiles)
          ? comment.profiles[0]
          : comment.profiles,
        onboarding_assets: Array.isArray(comment.onboarding_assets)
          ? comment.onboarding_assets[0]
          : comment.onboarding_assets,
      }));

      setPriorityComments(transformedComments);
    } catch (error) {
      console.error("Error fetching priority comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentClick = (assetId: string) => {
    // Navigate to the modeler review page for this asset
    router.push(`/modeler-review/${assetId}`);
  };

  const handleUnpinComment = async (
    commentId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent navigation when clicking unpin button

    try {
      setUnpinningComment(commentId);

      const { error } = await supabase
        .from("asset_comments")
        .update({ is_priority: false })
        .eq("id", commentId);

      if (error) {
        console.error("Error unpinning comment:", error);
        toast.error("Failed to unpin comment");
        return;
      }

      // Remove comment from local state
      setPriorityComments((prev) =>
        prev.filter((comment) => comment.id !== commentId)
      );

      toast.success("Comment unpinned from dashboard");
    } catch (error) {
      console.error("Error unpinning comment:", error);
      toast.error("Failed to unpin comment");
    } finally {
      setUnpinningComment(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "delivered_by_artist":
        return "bg-green-100 text-green-800 border-green-200";
      case "revision_requested":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getUrgencyLevel = (comment: string) => {
    const urgentKeywords = [
      "urgent",
      "asap",
      "today",
      "immediately",
      "deadline",
    ];
    const highKeywords = ["important", "priority", "fix", "correct", "must"];

    const lowerComment = comment.toLowerCase();

    if (urgentKeywords.some((keyword) => lowerComment.includes(keyword))) {
      return { level: "urgent", color: "text-red-600", icon: AlertCircle };
    }
    if (highKeywords.some((keyword) => lowerComment.includes(keyword))) {
      return { level: "high", color: "text-orange-600", icon: Clock };
    }
    return { level: "normal", color: "text-blue-600", icon: MessageSquare };
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Priority QA Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Priority QA Comments
          {priorityComments.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {priorityComments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {priorityComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm">No priority comments yet</p>
            <p className="text-xs text-muted-foreground/70">
              QAs can star important comments for you to see here
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {priorityComments.map((comment) => {
              const urgency = getUrgencyLevel(comment.comment);
              const UrgencyIcon = urgency.icon;

              return (
                <div
                  key={comment.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => handleCommentClick(comment.asset_id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <UrgencyIcon
                        className={`h-4 w-4 ${urgency.color} flex-shrink-0`}
                      />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {comment.profiles?.title ||
                          comment.profiles?.email ||
                          "Unknown User"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(comment.onboarding_assets.status)}`}
                      >
                        {comment.onboarding_assets.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleUnpinComment(comment.id, e)}
                        disabled={unpinningComment === comment.id}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Unpin from dashboard"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div className="mb-2">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {comment.onboarding_assets.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {comment.onboarding_assets.article_id}
                    </p>
                  </div>

                  <p className="text-sm text-foreground line-clamp-3 mb-2">
                    {comment.comment}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="font-medium">
                      {comment.onboarding_assets.client}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {priorityComments.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => router.push("/my-assignments")}
            >
              View All Assignments
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
