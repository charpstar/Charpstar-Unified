"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Textarea } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";
import {
  ArrowLeft,
  MessageCircle,
  Upload,
  Image as LucideImage,
  Eye,
  Camera,
  MessageSquare,
  CheckCircle,
  Loader2,
  Download,
} from "lucide-react";
import Script from "next/script";
import { toast } from "sonner";
import Image from "next/image";

import "./annotation-styles.css";

interface Asset {
  id: string;
  product_name: string;
  article_id: string;
  delivery_date: string;
  status: string;
  product_link: string;
  glb_link: string;
  client: string;
  batch: number;
  priority: number;
  revision_count: number;
}

interface Annotation {
  id: string;
  asset_id: string;
  position: string;
  normal: string;
  surface?: string;
  comment: string;
  image_url?: string;
  created_by: string;
  created_at: string;
  profiles?: {
    title?: string;
    role?: string;
    name?: string;
    email?: string;
  };
}

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  comment: string;
  image_url?: string;
  visible: boolean;
}

const STATUS_LABELS = {
  in_production: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  revisions: { label: "Ready for Revision", color: "bg-red-100 text-red-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  delivered_by_artist: {
    label: "Delivered by Artist",
    color: "bg-blue-100 text-blue-700",
  },
};

export default function ModelerReviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null
  );
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"annotations" | "comments">(
    "annotations"
  );
  const [rightPanelTab, setRightPanelTab] = useState<"images" | "feedback">(
    "images"
  );
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Comment state variables
  const [newCommentText, setNewCommentText] = useState("");

  // GLB Upload state
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [glbHistory, setGlbHistory] = useState<any[]>([]);
  const [isDialogDragOver, setIsDialogDragOver] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);

  const modelViewerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackNavigation = () => {
    const from = searchParams.get("from");
    const client = searchParams.get("client");
    const batch = searchParams.get("batch");

    if (from === "my-assignments" && client && batch) {
      router.push(`/my-assignments/${decodeURIComponent(client)}/${batch}`);
    } else {
      router.push("/modeler-review");
    }
  };

  // Function to get a title-specific badge color
  const getTitleBadgeVariant = (title: string) => {
    switch (title?.toLowerCase()) {
      case "admin":
        return "default";
      case "client":
        return "blue";
      case "QA":
        return "green";
      default:
        return "secondary";
    }
  };

  // Convert annotations to hotspots format
  const hotspots: Hotspot[] = annotations.map((annotation) => ({
    id: annotation.id,
    position: {
      x: parseFloat(annotation.position.split(" ")[0]),
      y: parseFloat(annotation.position.split(" ")[1]),
      z: parseFloat(annotation.position.split(" ")[2]),
    },
    comment: annotation.comment,
    image_url: annotation.image_url,
    visible: true,
  }));

  // Fetch asset data
  useEffect(() => {
    async function fetchAsset() {
      if (!assetId) return;

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", assetId)
          .single();

        if (error) {
          console.error("Error fetching asset:", error);
          toast.error("Failed to load asset");
          return;
        }

        setAsset(data);

        // Parse reference images
        if (data.reference) {
          let refs: string[] = [];
          if (Array.isArray(data.reference)) {
            refs = data.reference;
          } else if (
            typeof data.reference === "string" &&
            data.reference.startsWith("[")
          ) {
            try {
              refs = JSON.parse(data.reference);
            } catch {
              refs = [data.reference];
            }
          } else if (data.reference) {
            refs = [data.reference];
          }
          setReferenceImages(refs);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching asset:", error);
        toast.error("Failed to load asset");
        setLoading(false);
      }
    }

    fetchAsset();
  }, [assetId]);

  // Fetch annotations
  useEffect(() => {
    async function fetchAnnotations() {
      if (!assetId) return;

      try {
        const response = await fetch(`/api/annotations?asset_id=${assetId}`);
        const data = await response.json();

        if (response.ok) {
          setAnnotations(data.annotations || []);
        } else {
          console.error("Error fetching annotations:", data.error);
        }
      } catch (error) {
        console.error("Error fetching annotations:", error);
      }
    }

    fetchAnnotations();
  }, [assetId]);

  // Fetch comments
  useEffect(() => {
    async function fetchComments() {
      if (!assetId) return;

      try {
        const { data, error } = await supabase
          .from("asset_comments")
          .select(
            `
            *,
            profiles:created_by (
              title,
              role,
              email
            )
          `
          )
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching comments:", error);
        } else {
          setComments(data || []);
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    }

    fetchComments();
  }, [assetId]);

  // Fetch GLB upload history
  useEffect(() => {
    async function fetchGlbHistory() {
      if (!assetId) return;

      try {
        const { data, error } = await supabase
          .from("glb_upload_history")
          .select("*")
          .eq("asset_id", assetId)
          .order("uploaded_at", { ascending: false });

        if (error) {
          console.error("Error fetching GLB history:", error);
          if (error.code === "42P01") {
            setGlbHistory([]);
            return;
          }
          return;
        }

        setGlbHistory(data || []);
      } catch (error) {
        console.error("Error fetching GLB history:", error);
        setGlbHistory([]);
      }
    }

    fetchGlbHistory();
  }, [assetId]);

  // Handle hotspot selection
  const handleHotspotSelect = (hotspotId: string | null) => {
    setSelectedHotspotId(hotspotId);
  };

  // Handle file selection for GLB upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Validate and set file for upload
  const validateAndSetFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
      toast.error("Please select a GLB or GLTF file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }

    setSelectedFile(file);
    setShowUploadDialog(true);
  };

  // Handle drag and drop for dialog
  const handleDialogDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogDragOver(true);
  };

  const handleDialogDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogDragOver(false);
  };

  const handleDialogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      validateAndSetFile(file);
    }
  };

  // Restore GLB version
  const restoreGlbVersion = async (historyItem: any) => {
    if (!asset) return;

    setRestoringVersion(true);
    try {
      // Update asset with restored GLB
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: historyItem.glb_url,
          status: "in_production",
        })
        .eq("id", asset.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setAsset((prev) =>
        prev
          ? {
              ...prev,
              glb_link: historyItem.glb_url,
              status: "in_production",
            }
          : null
      );

      toast.success("GLB version restored successfully!");
      setShowHistoryDialog(false);
    } catch (error) {
      console.error("Error restoring GLB version:", error);
      toast.error("Failed to restore GLB version");
    } finally {
      setRestoringVersion(false);
    }
  };

  // Handle GLB upload
  const handleUpload = async () => {
    if (!selectedFile || !asset) return;

    setUploading(true);

    try {
      // Save current GLB to history if it exists
      if (asset.glb_link) {
        const { error: originalHistoryError } = await supabase
          .from("glb_upload_history")
          .insert({
            asset_id: asset.id,
            glb_url: asset.glb_link,
            file_name: `Current_${asset.article_id}_${Date.now()}.glb`,
            file_size: 0,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString(),
          });

        if (originalHistoryError) {
          console.error(
            "Error recording original GLB to history:",
            originalHistoryError
          );
        }
      }

      // Upload to Supabase Storage
      const fileName = `${asset.article_id}_${Date.now()}.glb`;
      const filePath = `models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(filePath);

      // Update the asset with the new GLB link
      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: urlData.publicUrl,
          status: "in_production",
        })
        .eq("id", asset.id);

      if (updateError) {
        throw updateError;
      }

      // Record GLB upload history
      const { error: historyError } = await supabase
        .from("glb_upload_history")
        .insert({
          asset_id: asset.id,
          glb_url: urlData.publicUrl,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        });

      if (historyError) {
        console.error("Error recording GLB history:", historyError);
      }

      // Update local state
      setAsset((prev) =>
        prev
          ? {
              ...prev,
              glb_link: urlData.publicUrl,
              status: "in_production",
            }
          : null
      );

      toast.success("GLB file uploaded successfully!");
      setShowUploadDialog(false);
      setSelectedFile(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload GLB file");
    } finally {
      setUploading(false);
    }
  };

  // Update asset status
  // Helper function to update modeler's end time when asset is completed
  const updateModelerEndTime = async (assetId: string) => {
    try {
      const { error: assignmentError } = await supabase
        .from("asset_assignments")
        .update({
          end_time: new Date().toISOString(),
        })
        .eq("asset_id", assetId)
        .eq("role", "modeler");

      if (assignmentError) {
        console.error("Error updating modeler end time:", assignmentError);
        return false;
      } else {
        return true;
      }
    } catch (assignmentError) {
      console.error("Error updating modeler end time:", assignmentError);
      return false;
    }
  };

  const updateAssetStatus = async (newStatus: string) => {
    if (!asset) return;

    setStatusUpdating(true);
    try {
      // Use the complete API endpoint for proper allocation list handling
      const response = await fetch("/api/assets/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: asset.id,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      const result = await response.json();

      // If status is delivered_by_artist (completed), update the modeler's end time
      if (newStatus === "delivered_by_artist") {
        await updateModelerEndTime(asset.id);
      }

      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));

      // Show success message and trigger earnings widget refresh
      if (result.allocationListApproved) {
        toast.success("Asset approved and allocation list completed!");
        // Trigger earnings widget refresh for approval
        window.dispatchEvent(new CustomEvent("allocationListApproved"));
      } else if (result.allocationListId) {
        // Check if this was an unapproval (status changed from approved to something else)
        const wasApproved = asset?.status === "approved";
        if (wasApproved && newStatus !== "approved") {
          toast.success("Asset unapproved and allocation list updated!");
          // Trigger earnings widget refresh for unapproval
          window.dispatchEvent(new CustomEvent("allocationListUnapproved"));
        } else {
          toast.success("Status updated successfully!");
        }
      } else {
        toast.success("Status updated successfully!");
      }

      // Dispatch event to notify earnings widget to refresh
      window.dispatchEvent(new CustomEvent("assetStatusChanged"));
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Add comment
  const addComment = async () => {
    if (!newCommentText.trim() || !assetId) return;

    try {
      const { data, error } = await supabase
        .from("asset_comments")
        .insert({
          asset_id: assetId,
          comment: newCommentText.trim(),
          created_by: user?.id,
        })
        .select(
          `
          *,
          profiles:created_by (
            title,
            role,
            email
          )
        `
        )
        .single();

      if (error) {
        console.error("Error adding comment:", error);
        toast.error("Failed to add comment");
        return;
      }

      setComments((prev) => [data, ...prev]);
      setNewCommentText("");
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleNewCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  };

  if (!user) {
    return null;
  }

  if (user.metadata?.role !== "modeler") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for modelers.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-muted">
        <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-8">
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse"></div>
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-muted rounded-2xl animate-pulse"></div>
                <div>
                  <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2"></div>
                  <div className="flex items-center gap-4">
                    <div className="h-6 w-24 bg-muted rounded-full animate-pulse"></div>
                    <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-8 w-20 bg-muted rounded-full animate-pulse"></div>
              <div className="h-8 w-px bg-border"></div>
              <div className="h-9 w-32 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative bg-background rounded-2xl m-6 shadow-xl border border-border/50">
            <div className="w-full h-full bg-muted rounded-2xl animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full animate-pulse mx-auto mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          </div>

          <div className="w-96 bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-xl overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
                  <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
                </div>
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse"></div>
              </div>

              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-6 rounded-xl border border-border/50 bg-background animate-pulse"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full"></div>
                        <div className="h-4 w-32 bg-muted rounded"></div>
                      </div>
                      <div className="w-6 h-6 bg-muted rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-muted rounded"></div>
                      <div className="h-4 w-3/4 bg-muted rounded"></div>
                    </div>
                    <div className="mt-4 h-4 w-24 bg-muted rounded-full"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Asset not found</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackNavigation}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-muted">
        {/* Enhanced Header */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackNavigation}
                className="w-10 h-10 rounded-xl hover:bg-primary/8 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {asset?.product_name || "Review Asset"}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge
                      variant={
                        STATUS_LABELS[
                          asset?.status as keyof typeof STATUS_LABELS
                        ]?.color
                          ? "outline"
                          : "secondary"
                      }
                      className={`text-xs font-medium ${
                        STATUS_LABELS[
                          asset?.status as keyof typeof STATUS_LABELS
                        ]?.color || ""
                      }`}
                    >
                      {STATUS_LABELS[
                        asset?.status as keyof typeof STATUS_LABELS
                      ]?.label ||
                        asset?.status ||
                        "Unknown"}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-medium">
                      {asset?.article_id}
                    </span>
                    {asset?.revision_count > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold"
                      >
                        R{asset.revision_count}
                      </Badge>
                    )}
                    {asset?.delivery_date && (
                      <span className="text-xs text-muted-foreground">
                        Due:{" "}
                        {new Date(asset.delivery_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">
                    {annotations.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Annotations
                  </div>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">
                    {comments.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Comments</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden bg-background">
          {/* Main Content (3D Viewer) */}
          <div className="flex-1 relative bg-background m-6 rounded-lg shadow-lg border border-border/50">
            <Script
              type="module"
              src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
            />

            {asset.glb_link ? (
              <div className="w-full h-full rounded-lg overflow-hidden">
                {/* @ts-expect-error -- model-viewer is a custom element */}
                <model-viewer
                  ref={modelViewerRef}
                  src={asset.glb_link}
                  alt={asset.product_name}
                  camera-controls={true}
                  shadow-intensity="0.5"
                  environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
                  exposure="1.2"
                  tone-mapping="aces"
                  shadow-softness="1"
                  min-field-of-view="5deg"
                  max-field-of-view="35deg"
                  style={{ width: "100%", height: "100%" }}
                >
                  {hotspots.map(
                    (hotspot) =>
                      hotspot.visible && (
                        <div
                          key={hotspot.id}
                          slot={`hotspot-${hotspot.id}`}
                          data-position={`${hotspot.position.x} ${hotspot.position.y} ${hotspot.position.z}`}
                          data-normal="0 1 0"
                          className={`hotspot-annotation ${
                            selectedHotspotId === hotspot.id ? "selected" : ""
                          }`}
                          style={
                            {
                              "--hotspot-color":
                                selectedHotspotId === hotspot.id
                                  ? "hsl(220, 100%, 60%)"
                                  : "hsl(220, 100%, 50%)",
                            } as React.CSSProperties
                          }
                        >
                          <div
                            className={`hotspot-marker ${
                              selectedHotspotId === hotspot.id ? "selected" : ""
                            }`}
                            data-annotation={
                              annotations
                                .sort(
                                  (a, b) =>
                                    new Date(a.created_at).getTime() -
                                    new Date(b.created_at).getTime()
                                )
                                .findIndex((a) => a.id === hotspot.id) + 1
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHotspotSelect(
                                selectedHotspotId === hotspot.id
                                  ? null
                                  : hotspot.id
                              );
                            }}
                          >
                            {hotspot.image_url ? (
                              <div className="hotspot-icon">
                                <Camera className="h-4 w-4 text-white" />
                              </div>
                            ) : (
                              <div className="hotspot-dot"></div>
                            )}
                            <div className="hotspot-number">
                              {annotations
                                .sort(
                                  (a, b) =>
                                    new Date(a.created_at).getTime() -
                                    new Date(b.created_at).getTime()
                                )
                                .findIndex((a) => a.id === hotspot.id) + 1}
                            </div>
                          </div>

                          {hotspot.comment && hotspot.comment.trim() && (
                            <div className="hotspot-comment">
                              <div className="comment-bubble">
                                <div className="comment-text">
                                  {hotspot.comment}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                  )}
                  {/* @ts-expect-error -- model-viewer is a custom element */}
                </model-viewer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    No 3D model available for this asset
                  </p>
                  <Button onClick={handleBackNavigation}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </div>
            )}

            {/* GLB Upload Button */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              {glbHistory.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowHistoryDialog(true)}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  History ({glbHistory.length})
                </Button>
              )}
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-2" />
                {asset.glb_link ? "Update GLB" : "Upload GLB"}
              </Button>
            </div>
          </div>

          {/* Right Panel - Switchable between Reference Images and Feedback */}
          <div className="w-[620px] max-w-full flex flex-col bg-background shadow-lg border border-border/50 p-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setRightPanelTab("images")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  rightPanelTab === "images"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <LucideImage className="h-4 w-4" />
                  Reference Images ({referenceImages.length})
                </div>
              </button>
              <button
                onClick={() => setRightPanelTab("feedback")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  rightPanelTab === "feedback"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Feedback ({annotations.length + comments.length})
                </div>
              </button>
            </div>

            {/* Asset Status Section */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-semibold">
                  Asset Status
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      asset?.status === "approved" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {STATUS_LABELS[asset?.status as keyof typeof STATUS_LABELS]
                      ?.label || "Unknown"}
                  </Badge>
                  {asset?.revision_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Revision {asset.revision_count}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => updateAssetStatus("delivered_by_artist")}
                  disabled={
                    asset?.status === "delivered_by_artist" || statusUpdating
                  }
                  variant={
                    asset?.status === "delivered_by_artist"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  {statusUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Mark as Delivered
                </Button>
              </div>
            </div>

            {/* Reference Images Tab */}
            {rightPanelTab === "images" && (
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const imageFiles = referenceImages.filter((url) => {
                    const fileName = url.split("/").pop() || "";

                    const lowerFileName = fileName.toLowerCase();
                    return (
                      !lowerFileName.endsWith(".glb") &&
                      !lowerFileName.endsWith(".pdf") &&
                      !lowerFileName.endsWith(".doc") &&
                      !lowerFileName.endsWith(".docx")
                    );
                  });

                  const glbFiles = referenceImages.filter((url) => {
                    const fileName = url.split("/").pop() || "";
                    return fileName.toLowerCase().endsWith(".glb");
                  });

                  const documentFiles = referenceImages.filter((url) => {
                    const fileName = url.split("/").pop() || "";
                    const lowerFileName = fileName.toLowerCase();
                    return (
                      lowerFileName.endsWith(".pdf") ||
                      lowerFileName.endsWith(".doc") ||
                      lowerFileName.endsWith(".docx")
                    );
                  });

                  return (
                    <div className="space-y-6">
                      {/* Reference Images Section */}
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-muted-foreground font-semibold">
                            Reference Images
                          </h4>
                        </div>

                        {imageFiles.length > 0 ? (
                          <div className="space-y-4">
                            {imageFiles.map((imageUrl, index) => {
                              // Test if image is accessible
                              fetch(imageUrl, { method: "HEAD" })
                                .then(() => {})
                                .catch((error) => {
                                  console.error(
                                    `Image ${imageUrl.split("/").pop()} fetch error:`,
                                    error
                                  );
                                });

                              return (
                                <div key={index} className="relative group">
                                  {imageUrl.startsWith("file://") ? (
                                    <div className="w-full h-20 bg-muted rounded border flex items-center justify-center">
                                      <div className="text-center">
                                        <LucideImage className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                                        <p className="text-xs text-muted-foreground">
                                          Local file:{" "}
                                          {imageUrl.split("/").pop()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          (Cannot display in browser)
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative flex items-center justify-center w-full ">
                                      <div className="relative">
                                        <Image
                                          height={228}
                                          width={228}
                                          src={imageUrl}
                                          alt={`Reference ${index + 1}`}
                                          className="w-full  rounded border cursor-pointer hover:opacity-80 transition-opacity object-cover"
                                          style={{ backgroundColor: "white" }}
                                          onClick={() =>
                                            window.open(imageUrl, "_blank")
                                          }
                                          onLoad={() => {}}
                                          onError={() => {
                                            console.error(
                                              "Failed to load image:",
                                              imageUrl
                                            );
                                            // Don't hide the image, just log the error for now
                                            // e.currentTarget.style.display = "none";
                                            // const errorPlaceholder =
                                            //   e.currentTarget.parentElement?.querySelector(
                                            //     ".image-error-placeholder"
                                            //   ) as HTMLElement;
                                            // if (errorPlaceholder) {
                                            //   errorPlaceholder.style.display =
                                            //     "flex";
                                            // }
                                          }}
                                        />
                                        {/* Debug overlay to show if image is actually there */}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <LucideImage className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No reference images yet
                            </p>
                          </div>
                        )}
                      </div>

                      {/* GLB Files Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-muted-foreground font-semibold">
                            3D Model Files
                          </h4>
                        </div>

                        {glbFiles.length > 0 ? (
                          <div className="space-y-3">
                            {glbFiles.map((glbUrl, index) => {
                              const fileName = glbUrl.split("/").pop() || "";
                              return (
                                <div
                                  key={index}
                                  className="w-full h-16 bg-muted rounded border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = glbUrl;
                                    link.download = fileName;
                                    link.target = "_blank";
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center">
                                      <svg
                                        className="w-6 h-6 text-muted-foreground"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                      </svg>
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-medium text-foreground">
                                        {fileName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Click to download
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-muted-foreground"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                              </svg>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              No 3D model files yet
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Documents Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-muted-foreground font-semibold">
                            Documents
                          </h4>
                        </div>

                        {documentFiles.length > 0 ? (
                          <div className="space-y-3">
                            {documentFiles.map((docUrl, index) => {
                              const fileName = docUrl.split("/").pop() || "";
                              const fileExtension =
                                fileName.split(".").pop()?.toLowerCase() || "";

                              // Get appropriate icon based on file type
                              const getFileIcon = () => {
                                switch (fileExtension) {
                                  case "pdf":
                                    return (
                                      <svg
                                        className="w-6 h-6 text-red-500"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                        <path d="M14 2v6h6" />
                                        <path d="M16 13H8" />
                                        <path d="M16 17H8" />
                                        <path d="M10 9H8" />
                                      </svg>
                                    );
                                  case "doc":
                                  case "docx":
                                    return (
                                      <svg
                                        className="w-6 h-6 text-blue-500"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                        <path d="M14 2v6h6" />
                                        <path d="M16 13H8" />
                                        <path d="M16 17H8" />
                                        <path d="M10 9H8" />
                                      </svg>
                                    );
                                  default:
                                    return (
                                      <svg
                                        className="w-6 h-6 text-muted-foreground"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                        <path d="M14 2v6h6" />
                                      </svg>
                                    );
                                }
                              };

                              return (
                                <div
                                  key={index}
                                  className="w-full h-16 bg-muted rounded border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = docUrl;
                                    link.download = fileName;
                                    link.target = "_blank";
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center">
                                      {getFileIcon()}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-medium text-foreground">
                                        {fileName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Click to download
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-muted-foreground"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                                <path d="M14 2v6h6" />
                              </svg>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              No documents yet
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Feedback Tab */}
            {rightPanelTab === "feedback" && (
              <div className="flex-1 overflow-y-auto">
                {/* Sticky Tab Navigation */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 pb-4">
                  <div className="flex items-center gap-1 mb-6 bg-muted/50 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab("annotations")}
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                        activeTab === "annotations"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Annotations ({annotations.length})
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab("comments")}
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                        activeTab === "comments"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comments ({comments.length})
                      </div>
                    </button>
                  </div>

                  {/* Sticky Annotations Header */}
                  {activeTab === "annotations" && (
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <h4 className="text-muted-foreground font-semibold">
                            Annotations
                          </h4>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sticky Comments Header */}
                  {activeTab === "comments" && (
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-muted-foreground font-semibold">
                          Comments
                        </h4>
                      </div>

                      {/* Add New Comment */}
                      <div className="space-y-3 mb-6">
                        <Textarea
                          placeholder="Add a comment about this asset..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={handleNewCommentKeyDown}
                          className="min-h-[100px] border-border focus:border-primary focus:ring-primary"
                          rows={4}
                        />
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>
                            Press Enter to send, Shift+Enter for new line
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scrollable Content */}
                <div className="p-2">
                  {/* Annotations Tab Content */}
                  {activeTab === "annotations" && (
                    <div className="space-y-4">
                      {annotations.map((annotation, index) => (
                        <Card
                          key={annotation.id}
                          className={`p-6 transition-all duration-200 rounded-xl border border-border/50 ${
                            selectedHotspotId === annotation.id
                              ? "ring-2 ring-primary/15 ring-offset-2 bg-primary/3 shadow-lg"
                              : "hover:shadow-md hover:border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                  <MessageCircle className="h-4 w-4 text-primary" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold bg-amber-500">
                                  {index + 1}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-foreground">
                                  {annotation.profiles?.email || "Unknown"}
                                </span>
                                <div className="flex items-center gap-2">
                                  {annotation.profiles?.title && (
                                    <Badge
                                      variant={
                                        getTitleBadgeVariant(
                                          annotation.profiles.title
                                        ) as any
                                      }
                                      className="text-xs px-2 py-0.5 w-fit"
                                    >
                                      {annotation.profiles.title}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm text-foreground p-2 rounded-md">
                              <pre className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                                {annotation.comment}
                              </pre>
                            </div>

                            {annotation.image_url && (
                              <div className="mt-4">
                                <div className="relative w-full h-48 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                                  {(() => {
                                    const fileName =
                                      annotation.image_url?.split("/").pop() ||
                                      "";
                                    const isGlbFile = fileName
                                      .toLowerCase()
                                      .endsWith(".glb");

                                    if (
                                      annotation.image_url.startsWith("file://")
                                    ) {
                                      return (
                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                          <div className="text-center">
                                            <LucideImage className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                              Local file: {fileName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              (Cannot display in browser)
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    } else if (isGlbFile) {
                                      return (
                                        <div
                                          className="w-full h-full bg-muted flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => {
                                            if (!annotation.image_url) return;
                                            const link =
                                              document.createElement("a");
                                            link.href = annotation.image_url;
                                            link.download = fileName;
                                            link.target = "_blank";
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                        >
                                          <div className="text-center">
                                            <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                                              <svg
                                                className="w-8 h-8 text-muted-foreground"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                              </svg>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              3D Model: {fileName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Click to download
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <Image
                                          width={320}
                                          height={192}
                                          unoptimized
                                          src={annotation.image_url}
                                          alt="Annotation reference"
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            console.error(
                                              "Failed to load annotation image:",
                                              annotation.image_url
                                            );
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  annotation.created_at
                                ).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                •
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  annotation.created_at
                                ).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}

                      {annotations.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageCircle className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            No annotations yet
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            No annotations have been added to this model yet
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments Tab Content */}
                  {activeTab === "comments" && (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <Card
                          key={comment.id}
                          className="p-6 transition-all duration-200 rounded-xl border border-border/50 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-foreground">
                                  {comment.profiles?.email || "Unknown"}
                                </span>
                                <div className="flex items-center gap-2">
                                  {comment.profiles?.title && (
                                    <Badge
                                      variant={
                                        getTitleBadgeVariant(
                                          comment.profiles.title
                                        ) as any
                                      }
                                      className="text-xs px-2 py-0.5 w-fit"
                                    >
                                      {comment.profiles.title}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-sm text-foreground p-2 rounded-md">
                            <pre className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                              {comment.comment}
                            </pre>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                comment.created_at
                              ).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                comment.created_at
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        </Card>
                      ))}

                      {comments.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            No comments yet
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Be the first to add a comment!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GLB Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-2xl w-full h-fit">
            <DialogHeader>
              <DialogTitle>
                {asset.glb_link ? "Update GLB File" : "Upload GLB File"}
              </DialogTitle>
              <DialogDescription>
                Select a GLB file to upload for this asset. Maximum file size:
                100MB.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  isDialogDragOver
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDialogDragOver}
                onDragLeave={handleDialogDragLeave}
                onDrop={handleDialogDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to select a GLB or GLTF file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or drag and drop a GLB or GLTF file here
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex-1"
                >
                  Select File
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* GLB Version History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-4xl w-full h-fit max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>GLB Version History</DialogTitle>
              <DialogDescription>
                View and restore previous versions of this asset&apos;s GLB
                file.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {glbHistory.length > 0 ? (
                <div className="space-y-3">
                  {glbHistory.map((historyItem, index) => (
                    <div
                      key={historyItem.id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        asset?.glb_link === historyItem.glb_url
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <Download className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">
                                {historyItem.file_name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(
                                  historyItem.uploaded_at
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {historyItem.file_size > 0 && (
                              <span>
                                Size:{" "}
                                {(historyItem.file_size / 1024 / 1024).toFixed(
                                  2
                                )}{" "}
                                MB
                              </span>
                            )}
                            <span>Version: {glbHistory.length - index}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {asset?.glb_link === historyItem.glb_url && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(historyItem.glb_url, "_blank")
                            }
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          {asset?.glb_link !== historyItem.glb_url && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => restoreGlbVersion(historyItem)}
                              disabled={restoringVersion}
                              className="text-xs"
                            >
                              {restoringVersion ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Download className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No version history yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your first GLB file to start building version
                    history.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
