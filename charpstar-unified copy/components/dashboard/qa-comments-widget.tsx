"use client";

import React, { useState, useEffect } from "react";
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
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Star className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Priority QA Comments
            </h3>
            <p className="text-sm text-muted-foreground">
              Important notes from your QA team
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-3 bg-primary rounded-2xl shadow-[0_4px_16px_hsl(var(--primary),0.1)] dark:shadow-[0_4px_16px_hsl(var(--primary),0.2)]">
              <Star className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-sm -z-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Priority QA Comments
            </h3>
            <p className="text-sm text-muted-foreground">
              Important notes from your QA team
            </p>
          </div>
        </div>
        {priorityComments.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {priorityComments.length}
          </Badge>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {priorityComments.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
              <Star className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-foreground font-medium mb-2">
              No priority comments yet
            </h4>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              QAs can star important comments for you to see here
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {priorityComments.map((comment) => {
              const urgency = getUrgencyLevel(comment.comment);
              const UrgencyIcon = urgency.icon;

              return (
                <div
                  key={comment.id}
                  className="group relative rounded-xl p-4 transition-all duration-300 cursor-pointer
                    bg-gradient-to-br from-card/80 to-card/60
                    shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
                    hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)]
                    hover:translate-y-[-2px]
                    dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_0_12px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.3)]
                    dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_0_16px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.4)]
                    border border-border/50"
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
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => router.push("/my-assignments")}
            >
              View All Assignments
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
