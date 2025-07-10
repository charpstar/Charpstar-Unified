"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Textarea, Input } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive/dropdown-menu";
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
  Plus,
  X,
  Edit3,
  Upload,
  Image as LucideImage,
  FileImage,
  Eye,
  Camera,
  MoreVertical,
  Trash2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
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
  not_started: { label: "Not Started", color: "bg-gray-200 text-gray-700" },
  in_production: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  revisions: { label: "Revisions", color: "bg-red-100 text-red-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  delivered_by_artist: {
    label: "Delivered by Artist",
    color: "bg-blue-100 text-blue-700",
  },
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [newComment, setNewComment] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(
    null
  );
  const [editComment, setEditComment] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null
  );
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditComment, setInlineEditComment] = useState("");
  const [viewerEditingId, setViewerEditingId] = useState<string | null>(null);
  const [viewerEditComment, setViewerEditComment] = useState("");
  const [isSwitchingEdit, setIsSwitchingEdit] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState<
    number | null
  >(0); // Always start with the first image selected
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"annotations" | "comments">(
    "annotations"
  );
  const [rightPanelTab, setRightPanelTab] = useState<"images" | "feedback">(
    "images"
  );
  const [imageZoom, setImageZoom] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZooming, setIsZooming] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dialogZoomLevel, setDialogZoomLevel] = useState(1);
  const [dialogIsZooming, setDialogIsZooming] = useState(false);
  const [dialogMousePosition, setDialogMousePosition] = useState({
    x: 0,
    y: 0,
  });

  // Comment state variables
  const [newCommentText, setNewCommentText] = useState("");
  const [inlineEditingCommentId, setInlineEditingCommentId] = useState<
    string | null
  >(null);
  const [inlineEditCommentText, setInlineEditCommentText] = useState("");

  // Reference image URL input state
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [showUrlDialog, setShowUrlDialog] = useState(false);

  // Revision workflow state
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showSecondRevisionDialog, setShowSecondRevisionDialog] =
    useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  const modelViewerRef = useRef<any>(null);

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
      if (!assetId || !user?.metadata?.client) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("id", assetId)
        .eq("client", user.metadata.client)
        .single();

      if (error) {
        console.error("Error fetching asset:", error);
        toast.error("Failed to load asset");
        return;
      }

      setAsset(data);

      // Set revision count
      setRevisionCount(data.revision_count || 0);

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
        setReferenceImages(refs.filter(Boolean));
      }

      setLoading(false);
    }

    fetchAsset();
  }, [assetId, user?.metadata?.client]);

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

  // Fetch revision history
  const fetchRevisionHistory = async () => {
    if (!assetId) return;

    try {
      const { data, error } = await supabase
        .from("revision_history")
        .select("*")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: true });

      if (!error && data) {
        setRevisionHistory(data);
      }
    } catch (error) {
      console.error("Error fetching revision history:", error);
    }
  };

  useEffect(() => {
    fetchRevisionHistory();
  }, [assetId]);

  // Handle model load
  const handleModelLoaded = () => {
    setModelLoaded(true);
    console.log("Model loaded successfully");
  };

  // Handle hotspot creation
  const handleHotspotCreate = (position: {
    x: number;
    y: number;
    z: number;
  }) => {
    console.log("Creating hotspot at position:", position);

    // Create a temporary annotation that appears instantly
    const tempAnnotation: Annotation = {
      id: `temp-${Date.now()}`, // Temporary ID
      asset_id: assetId,
      position: `${position.x} ${position.y} ${position.z}`,
      normal: "0 1 0", // Default normal
      comment: "",
      created_by: user?.id || "",
      created_at: new Date().toISOString(),
    };

    console.log("Created temp annotation:", tempAnnotation);

    // Add to annotations list immediately (will be replaced when saved)
    setAnnotations((prev) => {
      console.log("Previous annotations:", prev);
      const newAnnotations = [tempAnnotation, ...prev];
      console.log("New annotations:", newAnnotations);
      return newAnnotations;
    });
    setSelectedAnnotation(tempAnnotation);
    setNewComment("");
    setAnnotationMode(false);
    setSelectedHotspotId(tempAnnotation.id);
  };

  // Handle hotspot selection
  const handleHotspotSelect = (hotspotId: string | null) => {
    setSelectedHotspotId(hotspotId);
    if (hotspotId) {
      const annotation = annotations.find((ann) => ann.id === hotspotId);
      if (annotation) {
        setSelectedAnnotation(annotation);

        // Focus camera on the hotspot in the 3D model
        if (modelViewerRef.current && modelLoaded) {
          const position = annotation.position.split(" ").map(Number);
          const hotspotPosition = {
            x: position[0],
            y: position[1],
            z: position[2],
          };

          // Use model-viewer's built-in camera animation
          modelViewerRef.current.cameraTarget = `${hotspotPosition.x}m ${hotspotPosition.y}m ${hotspotPosition.z}m`;

          // Set camera to a good viewing angle
          const distance = 1.5; // Distance from hotspot
          modelViewerRef.current.cameraOrbit = `45deg 60deg ${distance}m`;

          // Animate the camera movement
          modelViewerRef.current.play();
        }
      }
    } else {
      setSelectedAnnotation(null);
    }
  };

  // Save annotation
  const saveAnnotation = async () => {
    if (!selectedAnnotation || !newComment.trim()) return;

    const annotationData = {
      asset_id: selectedAnnotation.asset_id,
      position: selectedAnnotation.position,
      normal: selectedAnnotation.normal,
      surface: selectedAnnotation.surface,
      comment: newComment.trim(),
      image_url: newImageUrl.trim() || null,
    };

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(annotationData),
      });

      const data = await response.json();

      if (response.ok) {
        // Replace the temporary annotation with the real one
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === selectedAnnotation?.id && ann.id.startsWith("temp-")
              ? data.annotation
              : ann
          )
        );
        setSelectedAnnotation(null);
        setNewComment("");
        setSelectedHotspotId(null);
        toast.success("Annotation saved successfully");
      } else {
        // Remove the temporary annotation if save failed
        setAnnotations((prev) =>
          prev.filter((ann) => !ann.id.startsWith("temp-"))
        );
        setSelectedAnnotation(null);
        setSelectedHotspotId(null);
        toast.error(data.error || "Failed to save annotation");
      }
    } catch (error) {
      console.error("Error saving annotation:", error);
      toast.error("Failed to save annotation");
    }
  };

  // Update annotation
  const updateAnnotation = async (annotationId: string) => {
    if (!editComment.trim()) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: annotationId,
          comment: editComment.trim(),
          image_url: editImageUrl.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === annotationId
              ? { ...ann, comment: editComment.trim() }
              : ann
          )
        );
        setEditingAnnotation(null);
        setEditComment("");
        toast.success("Annotation updated successfully");
      } else {
        toast.error(data.error || "Failed to update annotation");
      }
    } catch (error) {
      console.error("Error updating annotation:", error);
      toast.error("Failed to update annotation");
    }
  };

  // Delete annotation
  const deleteAnnotation = async (annotationId: string) => {
    try {
      const response = await fetch(`/api/annotations?id=${annotationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setAnnotations((prev) => prev.filter((ann) => ann.id !== annotationId));
        setSelectedHotspotId(null);
        toast.success("Annotation deleted successfully");
      } else {
        toast.error(data.error || "Failed to delete annotation");
      }
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete annotation");
    }
  };

  const confirmDeleteAnnotation = (annotationId: string) => {
    setSingleDeleteId(annotationId);
    setShowDeleteWarning(true);
  };

  const handleSingleDelete = async () => {
    if (singleDeleteId) {
      await deleteAnnotation(singleDeleteId);
      setSingleDeleteId(null);
      setShowDeleteWarning(false);
    }
  };

  // Delete multiple annotations
  const deleteMultipleAnnotations = async (annotationIds: string[]) => {
    try {
      const promises = annotationIds.map((id) =>
        fetch(`/api/annotations?id=${id}`, {
          method: "DELETE",
        })
      );

      const responses = await Promise.all(promises);
      const failedDeletes = responses.filter((response) => !response.ok);

      if (failedDeletes.length === 0) {
        setAnnotations((prev) =>
          prev.filter((ann) => !annotationIds.includes(ann.id))
        );
        setSelectedAnnotations([]);
        setDeleteMode(false);
        toast.success(
          `${annotationIds.length} annotation(s) deleted successfully`
        );
      } else {
        toast.error(`Failed to delete ${failedDeletes.length} annotation(s)`);
      }
    } catch (error) {
      console.error("Error deleting annotations:", error);
      toast.error("Failed to delete annotations");
    }
  };

  const handleAnnotationSelect = (annotationId: string) => {
    setSelectedAnnotations((prev) =>
      prev.includes(annotationId)
        ? prev.filter((id) => id !== annotationId)
        : [...prev, annotationId]
    );
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    setSelectedImage(imageUrl);
    setSelectedImageTitle(title);
    setShowImageDialog(true);
  };

  // Inline editing functions
  const startInlineEdit = (annotation: Annotation) => {
    // Cancel any existing viewer editing first
    if (viewerEditingId) {
      cancelViewerEdit();
    }
    setInlineEditingId(annotation.id);
    setInlineEditComment(annotation.comment);
  };

  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditComment("");
    setIsSwitchingEdit(false);
  };

  const submitInlineEdit = async (annotationId: string) => {
    if (!inlineEditComment.trim()) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: annotationId,
          comment: inlineEditComment.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === annotationId
              ? { ...ann, comment: inlineEditComment.trim() }
              : ann
          )
        );
        setInlineEditingId(null);
        setInlineEditComment("");
        setIsSwitchingEdit(false);
        toast.success("Comment updated successfully");
      } else {
        toast.error(data.error || "Failed to update comment");
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleInlineEditKeyDown = (
    e: React.KeyboardEvent,
    annotationId: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitInlineEdit(annotationId);
    } else if (e.key === "Escape") {
      cancelInlineEdit();
    }
  };

  // 3D Viewer inline editing functions
  const startViewerEdit = (annotation: Annotation) => {
    // Cancel any existing panel editing first
    if (inlineEditingId) {
      cancelInlineEdit();
    }
    setViewerEditingId(annotation.id);
    setViewerEditComment(annotation.comment);
  };

  const cancelViewerEdit = () => {
    setViewerEditingId(null);
    setViewerEditComment("");
    setIsSwitchingEdit(false);
  };

  const submitViewerEdit = async (annotationId: string) => {
    if (!viewerEditComment.trim()) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: annotationId,
          comment: viewerEditComment.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnnotations((prev) =>
          prev.map((ann) =>
            ann.id === annotationId
              ? { ...ann, comment: viewerEditComment.trim() }
              : ann
          )
        );
        setViewerEditingId(null);
        setViewerEditComment("");
        setIsSwitchingEdit(false);
        toast.success("Comment updated successfully");
      } else {
        toast.error(data.error || "Failed to update comment");
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleViewerEditKeyDown = (
    e: React.KeyboardEvent,
    annotationId: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitViewerEdit(annotationId);
    } else if (e.key === "Escape") {
      cancelViewerEdit();
    }
  };

  // Handle reference image uploads
  const handleUploadReferenceImages = async (files: FileList) => {
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          return data.url;
        } else {
          throw new Error(data.error || "Upload failed");
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Add new URLs to existing reference images
      const newReferenceImages = [...referenceImages, ...uploadedUrls];

      // Update the asset in the database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: newReferenceImages })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to save reference images");
        return;
      }

      // Update local state
      setReferenceImages(newReferenceImages);
      toast.success(
        `${uploadedUrls.length} reference image(s) uploaded successfully!`
      );
    } catch (error) {
      console.error("Error uploading reference images:", error);
      toast.error("Failed to upload reference images");
    }
  };

  // Handle adding reference image URLs
  const handleAddReferenceImageUrl = async () => {
    if (!referenceImageUrl.trim() || !assetId) return;

    try {
      // Validate URL format
      const url = new URL(referenceImageUrl.trim());
      if (!url.protocol.startsWith("http")) {
        toast.error("Please enter a valid HTTP/HTTPS URL");
        return;
      }

      // Add new URL to existing reference images
      const newReferenceImages = [...referenceImages, referenceImageUrl.trim()];

      // Update the asset in the database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: newReferenceImages })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to save reference image URL");
        return;
      }

      // Update local state
      setReferenceImages(newReferenceImages);
      setReferenceImageUrl(""); // Clear the input
      toast.success("Reference image URL added successfully!");
    } catch (error) {
      console.error("Error adding reference image URL:", error);
      toast.error("Please enter a valid image URL");
    }
  };

  const updateAssetStatus = async (newStatus: string) => {
    if (!assetId) return;

    // Handle revision workflow
    if (newStatus === "revisions") {
      const currentRevisionCount = revisionCount + 1;

      if (currentRevisionCount === 1 || currentRevisionCount === 2) {
        setShowRevisionDialog(true);
        return;
      } else if (currentRevisionCount >= 3) {
        setShowSecondRevisionDialog(true);
        return;
      }
    }

    setStatusUpdating(true);

    try {
      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          status: newStatus,
          revision_count:
            newStatus === "revisions" ? revisionCount + 1 : revisionCount,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating asset status:", error);
        toast.error("Failed to update status");
      } else {
        setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
        if (newStatus === "revisions") {
          setRevisionCount((prev) => prev + 1);
        }
        toast.success(
          `Status updated to ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS]?.label || newStatus}`
        );
      }
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle revision confirmation
  const handleRevisionConfirm = async () => {
    setShowRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: revisionCount + 1,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        console.error("Error saving revision history:", historyError);
        // Continue with status update even if history save fails
      }

      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          status: "revisions",
          revision_count: revisionCount + 1,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating asset status:", error);
        toast.error("Failed to update status");
      } else {
        setAsset((prev) => (prev ? { ...prev, status: "revisions" } : null));
        setRevisionCount((prev) => prev + 1);
        toast.success("Status updated to Revisions");
        // Refresh revision history in real-time
        await fetchRevisionHistory();
      }
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle second revision confirmation
  const handleSecondRevisionConfirm = async () => {
    setShowSecondRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: revisionCount + 1,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        console.error("Error saving revision history:", historyError);
        // Continue with status update even if history save fails
      }

      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          status: "revisions",
          revision_count: revisionCount + 1,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating asset status:", error);
        toast.error("Failed to update status");
      } else {
        setAsset((prev) => (prev ? { ...prev, status: "revisions" } : null));
        setRevisionCount((prev) => prev + 1);
        toast.success("Status updated to Revisions");
        // Refresh revision history in real-time
        await fetchRevisionHistory();
      }
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle additional revision confirmation (3rd and beyond)
  const handleAdditionalRevisionConfirm = async () => {
    setShowSecondRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: revisionCount + 1,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        console.error("Error saving revision history:", historyError);
        // Continue with status update even if history save fails
      }

      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          status: "revisions",
          revision_count: revisionCount + 1,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating asset status:", error);
        toast.error("Failed to update status");
      } else {
        setAsset((prev) => (prev ? { ...prev, status: "revisions" } : null));
        setRevisionCount((prev) => prev + 1);
        toast.success(
          `Status updated to Revisions (Revision ${revisionCount + 1})`
        );
        // Refresh revision history in real-time
        await fetchRevisionHistory();
      }
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Check if functionality should be disabled
  const isFunctionalityDisabled = () => {
    return asset?.status === "revisions" && revisionCount >= 1;
  };

  // Function to determine which revision an item was added in
  const getRevisionForItem = (createdAt: string) => {
    if (revisionHistory.length === 0) return null;

    const itemDate = new Date(createdAt);

    // Find the revision that was created after this item
    for (let i = revisionHistory.length - 1; i >= 0; i--) {
      const revisionDate = new Date(revisionHistory[i].created_at);
      if (itemDate <= revisionDate) {
        return revisionHistory[i].revision_number;
      }
    }

    // If item was created before any revision, it's from the original (revision 0)
    return 0;
  };

  // Function to get color classes for revision badges
  const getRevisionBadgeColors = (revisionNumber: number) => {
    const colors = [
      // R0 - Original (Gray)
      "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700/50",
      // R1 - Blue
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50",
      // R2 - Green
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50",
      // R3 - Purple
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/50",
      // R4 - Orange
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800/50",
      // R5 - Red
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50",
      // R6 - Indigo
      "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/50",
      // R7 - Pink
      "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800/50",
      // R8 - Teal
      "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800/50",
      // R9 - Amber
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50",
      // R10 - Cyan
      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800/50",
    ];

    return colors[revisionNumber] || colors[revisionNumber % colors.length];
  };

  // Filter annotations and comments for a specific revision
  const getRevisionItems = (revisionNumber: number) => {
    if (revisionNumber === 1) {
      // For revision 1, get items created before the first revision was requested
      const firstRevision = revisionHistory.find(
        (r) => r.revision_number === 1
      );
      if (!firstRevision) return { annotations: [], comments: [] };

      const revisionDate = new Date(firstRevision.created_at);

      const revisionAnnotations = annotations.filter(
        (annotation) => new Date(annotation.created_at) < revisionDate
      );

      const revisionComments = comments.filter(
        (comment) => new Date(comment.created_at) < revisionDate
      );

      return { annotations: revisionAnnotations, comments: revisionComments };
    } else {
      // For subsequent revisions, get items created between this revision and the previous one
      const currentRevision = revisionHistory.find(
        (r) => r.revision_number === revisionNumber
      );
      const previousRevision = revisionHistory.find(
        (r) => r.revision_number === revisionNumber - 1
      );

      if (!currentRevision || !previousRevision)
        return { annotations: [], comments: [] };

      const currentDate = new Date(currentRevision.created_at);
      const previousDate = new Date(previousRevision.created_at);

      const revisionAnnotations = annotations.filter((annotation) => {
        const annotationDate = new Date(annotation.created_at);
        return annotationDate >= previousDate && annotationDate < currentDate;
      });

      const revisionComments = comments.filter((comment) => {
        const commentDate = new Date(comment.created_at);
        return commentDate >= previousDate && commentDate < currentDate;
      });

      return { annotations: revisionAnnotations, comments: revisionComments };
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZooming) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
  };

  const handleImageMouseEnter = () => {
    setImageZoom(true);
  };

  const handleImageMouseLeave = () => {
    setImageZoom(false);
    setZoomLevel(1);
    setIsZooming(false);
  };

  const handleImageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!imageZoom) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
    setIsZooming(true);

    // Zoom in/out based on scroll direction
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoomLevel = Math.max(1, Math.min(3, zoomLevel + zoomDelta));

    setZoomLevel(newZoomLevel);
  };

  const handleDialogImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dialogIsZooming) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDialogMousePosition({ x, y });
  };

  const handleDialogImageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDialogMousePosition({ x, y });
    setDialogIsZooming(true);

    // Zoom in/out based on scroll direction
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoomLevel = Math.max(1, Math.min(5, dialogZoomLevel + zoomDelta));

    setDialogZoomLevel(newZoomLevel);
  };

  const handleDialogClose = () => {
    setShowImageDialog(false);
    setDialogZoomLevel(1);
    setDialogIsZooming(false);
  };

  // Comment functions
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

  const startCommentInlineEdit = (comment: any) => {
    setInlineEditingCommentId(comment.id);
    setInlineEditCommentText(comment.comment);
  };

  const cancelCommentInlineEdit = () => {
    setInlineEditingCommentId(null);
    setInlineEditCommentText("");
  };

  const submitCommentInlineEdit = async (commentId: string) => {
    if (!inlineEditCommentText.trim()) return;

    try {
      const { data, error } = await supabase
        .from("asset_comments")
        .update({ comment: inlineEditCommentText.trim() })
        .eq("id", commentId)
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
        console.error("Error updating comment:", error);
        toast.error("Failed to update comment");
        return;
      }

      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? data : comment))
      );
      setInlineEditingCommentId(null);
      setInlineEditCommentText("");
      toast.success("Comment updated successfully");
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleCommentInlineEditKeyDown = (
    e: React.KeyboardEvent,
    commentId: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCommentInlineEdit(commentId);
    } else if (e.key === "Escape") {
      cancelCommentInlineEdit();
    }
  };

  const handleNewCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  };

  // Removed unused updateComment function

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("asset_comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        console.error("Error deleting comment:", error);
        toast.error("Failed to delete comment");
        return;
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      toast.success("Comment deleted successfully");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Function to switch editing to a different annotation
  const switchToEditing = (
    annotation: Annotation,
    isViewer: boolean = false
  ) => {
    // If we're already editing this annotation, do nothing
    if (
      (isViewer && viewerEditingId === annotation.id) ||
      (!isViewer && inlineEditingId === annotation.id)
    ) {
      return;
    }

    // Set flag to prevent blur events during switch
    setIsSwitchingEdit(true);

    // Cancel any existing editing sessions
    if (inlineEditingId) {
      cancelInlineEdit();
    }
    if (viewerEditingId) {
      cancelViewerEdit();
    }

    // Start new editing session
    if (isViewer) {
      startViewerEdit(annotation);
    } else {
      startInlineEdit(annotation);
    }

    // Reset flag after a short delay
    setTimeout(() => {
      setIsSwitchingEdit(false);
    }, 100);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-muted">
        {/* Skeleton Header */}
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
          {/* Skeleton Model Viewer */}
          <div className="flex-1 relative bg-background rounded-2xl m-6 shadow-xl border border-border/50">
            <div className="w-full h-full bg-muted rounded-2xl animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full animate-pulse mx-auto mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          </div>

          {/* Skeleton Annotations Panel */}
          <div className="w-96 bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-xl overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
                  <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
                </div>
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse"></div>
              </div>

              {/* Skeleton Annotations */}
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
            onClick={() => router.push("/client-review")}
            className="mt-4 hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Client Review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted">
      {/* Enhanced Header */}
      <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/client-review")}
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
                      STATUS_LABELS[asset?.status as keyof typeof STATUS_LABELS]
                        ?.color
                        ? "outline"
                        : "secondary"
                    }
                    className={`text-xs font-medium ${
                      STATUS_LABELS[asset?.status as keyof typeof STATUS_LABELS]
                        ?.color || ""
                    }`}
                  >
                    {STATUS_LABELS[asset?.status as keyof typeof STATUS_LABELS]
                      ?.label ||
                      asset?.status ||
                      "Unknown"}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-medium">
                    {asset?.article_id}
                  </span>
                  {revisionCount > 0 && (
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${getRevisionBadgeColors(revisionCount)}`}
                    >
                      R{revisionCount}
                    </Badge>
                  )}
                  {asset?.delivery_date && (
                    <span className="text-xs text-muted-foreground">
                      Due: {new Date(asset.delivery_date).toLocaleDateString()}
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
                <div className="text-xs text-muted-foreground">Annotations</div>
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
              {/* @ts-expect-error cant really fix viewer errors */}
              <model-viewer
                ref={modelViewerRef}
                src={asset.glb_link}
                alt={asset.product_name}
                camera-controls={!annotationMode}
                shadow-intensity="0.5"
                environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
                exposure="1.2"
                tone-mapping="aces"
                shadow-softness="1"
                min-field-of-view="5deg"
                max-field-of-view="35deg"
                style={{ width: "100%", height: "100%" }}
                onLoad={handleModelLoaded}
                onDoubleClick={(event: any) => {
                  if (!annotationMode) return;

                  event.preventDefault();
                  event.stopPropagation();

                  const positionData =
                    modelViewerRef.current?.positionAndNormalFromPoint(
                      event.clientX,
                      event.clientY
                    );

                  if (positionData) {
                    handleHotspotCreate({
                      x: positionData.position.x,
                      y: positionData.position.y,
                      z: positionData.position.z,
                    });
                  }
                }}
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
                          <div className="hotspot-pulse"></div>
                        </div>

                        {hotspot.comment && (
                          <div className="hotspot-comment">
                            {viewerEditingId === hotspot.id ? (
                              <div className="comment-bubble editing">
                                <textarea
                                  value={viewerEditComment}
                                  onChange={(e) =>
                                    setViewerEditComment(e.target.value)
                                  }
                                  onKeyDown={(e) =>
                                    handleViewerEditKeyDown(e, hotspot.id)
                                  }
                                  onBlur={() => {
                                    if (!isSwitchingEdit) {
                                      submitViewerEdit(hotspot.id);
                                    }
                                  }}
                                  className="comment-textarea"
                                  autoFocus
                                  placeholder="Edit comment..."
                                  rows={3}
                                />
                                <div className="comment-edit-hint">
                                  Press Enter to save, Escape to cancel
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`comment-bubble group ${
                                  viewerEditingId === hotspot.id
                                    ? "editing"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  if (isFunctionalityDisabled()) return;
                                  e.stopPropagation();
                                  // Find the annotation and start inline editing
                                  const annotation = annotations.find(
                                    (ann) => ann.id === hotspot.id
                                  );
                                  if (annotation) {
                                    switchToEditing(annotation, true);
                                  }
                                }}
                                style={{
                                  cursor: isFunctionalityDisabled()
                                    ? "not-allowed"
                                    : "pointer",
                                  opacity: isFunctionalityDisabled() ? 0.5 : 1,
                                }}
                                title={
                                  isFunctionalityDisabled()
                                    ? "Editing disabled during revision"
                                    : "Click to edit comment"
                                }
                              >
                                <div className="comment-text">
                                  {hotspot.comment}
                                </div>
                                <div className="comment-edit-icon">
                                  <Edit3 className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                )}
                {/* @ts-expect-error cant really fix viewer errors */}
              </model-viewer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No 3D model available for this asset
                </p>
                <Button onClick={() => router.push("/client-review")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Client Review
                </Button>
              </div>
            </div>
          )}

          {annotationMode && (
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-full z-20 shadow-lg backdrop-blur-sm">
              Double-click to add hotspot
            </div>
          )}
        </div>

        {/* Right Panel - Switchable between Reference Images and Feedback */}
        <div className="w-[620px] max-w-full flex flex-col bg-background  shadow-lg border border-border/50 p-6 ">
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

          {/* Reference Images Tab */}
          {rightPanelTab === "images" && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h4
                  className="
                 text-muted-foreground font-semibold"
                >
                  Reference Images
                </h4>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                          await handleUploadReferenceImages(files);
                        }
                      };
                      input.click();
                    }}
                    className="h-7 px-2 text-xs cursor-pointer"
                  >
                    <span className="text-xs text-muted-foreground pr-6">
                      Upload Image
                    </span>
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUrlDialog(true)}
                    className="h-7 px-2 text-xs cursor-pointer"
                  >
                    <span className="text-xs text-muted-foreground pr-6">
                      Add URL
                    </span>
                    <FileImage className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Carousel of Thumbnails */}

              {/* Large Selected Image - Always show first image if available */}
              {referenceImages.length > 0 && (
                <div className="relative mb-4">
                  <div
                    className="aspect-video bg-muted rounded-lg overflow-hidden border border-border relative cursor-pointer"
                    onMouseMove={handleImageMouseMove}
                    onMouseEnter={handleImageMouseEnter}
                    onMouseLeave={handleImageMouseLeave}
                    onWheel={handleImageWheel}
                  >
                    <Image
                      width={640}
                      height={360}
                      unoptimized
                      src={referenceImages[0]}
                      alt="Reference 1"
                      className="w-full h-full object-cover transition-transform duration-200"
                      style={{
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: isZooming
                          ? `${mousePosition.x}% ${mousePosition.y}%`
                          : "center",
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                        (e.currentTarget
                          .nextElementSibling as HTMLElement)!.style.display =
                          "flex";
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
                      style={{ display: "none" }}
                    >
                      <div className="text-center">
                        <LucideImage className="h-8 w-8 mx-auto mb-2" />
                        Invalid image URL
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleImageClick(
                          referenceImages[0],
                          "Reference Image 1"
                        )
                      }
                      className="h-10 w-10 p-0 bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground text-center">
                    Reference 1 • Scroll to zoom (1x-3x)
                  </div>
                </div>
              )}
              {referenceImages.length > 0 && (
                <div className="relative">
                  {/* Carousel Header */}
                  <div className="flex items-center justify-between mb-4">
                    {referenceImages.length > 4 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {carouselIndex + 1} -{" "}
                          {Math.min(carouselIndex + 4, referenceImages.length)}{" "}
                          of {referenceImages.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Carousel Container */}
                  <div className="relative group">
                    {/* Navigation Buttons */}
                    {referenceImages.length > 4 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCarouselIndex(Math.max(0, carouselIndex - 1))
                          }
                          disabled={carouselIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background/90 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCarouselIndex(
                              Math.min(
                                referenceImages.length - 4,
                                carouselIndex + 1
                              )
                            )
                          }
                          disabled={carouselIndex >= referenceImages.length - 4}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background/90 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {/* Thumbnails Container */}
                    <div className="flex gap-3 overflow-x-auto p-1 scrollbar-hide">
                      {referenceImages.map((imageUrl, index) => (
                        <div
                          key={index}
                          className={`relative flex-shrink-0 cursor-pointer transition-all duration-300 ${
                            selectedReferenceIndex === index
                              ? "ring-2 ring-primary/80 ring-offset-2 rounded-lg"
                              : "hover:ring-2 hover:ring-primary/50 ring-offset-2 rounded-lg"
                          }`}
                          onClick={() => setSelectedReferenceIndex(index)}
                        >
                          <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md">
                            <Image
                              width={80}
                              height={80}
                              unoptimized
                              src={imageUrl}
                              alt={`Reference ${index + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center shadow-sm border-2 border-background">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Scroll Indicator */}
                    {referenceImages.length > 4 && (
                      <div className="flex justify-center mt-3">
                        <div className="flex gap-1">
                          {Array.from({
                            length: Math.ceil(referenceImages.length / 4),
                          }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                i === Math.floor(carouselIndex / 4)
                                  ? "bg-primary"
                                  : "bg-border"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {referenceImages.length === 0 && (
                <div className="text-center py-12">
                  <LucideImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    No reference images yet
                  </p>
                </div>
              )}

              {/* Functionality Disabled Warning */}
              {isFunctionalityDisabled() && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/20 dark:border-yellow-800/30">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-200">
                        Functionality Disabled
                      </h4>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Annotations and comments are disabled during revision
                        mode.
                        {revisionCount >= 3 &&
                          ` This is revision #${revisionCount} - additional costs may apply.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Asset Status Buttons */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
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
                      {STATUS_LABELS[
                        asset?.status as keyof typeof STATUS_LABELS
                      ]?.label || "Unknown"}
                    </Badge>
                    {revisionCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Revision {revisionCount}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => updateAssetStatus("approved")}
                    disabled={asset?.status === "approved" || statusUpdating}
                    variant={
                      asset?.status === "approved" ? "default" : "outline"
                    }
                    size="sm"
                    className="flex-1 cursor-pointer"
                  >
                    {statusUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    onClick={() => updateAssetStatus("revisions")}
                    disabled={asset?.status === "revisions" || statusUpdating}
                    variant={
                      asset?.status === "revisions" ? "outline" : "outline"
                    }
                    size="sm"
                    className={`flex-1 cursor-pointer ${
                      asset?.status === "revisions"
                        ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30"
                        : ""
                    }`}
                  >
                    {statusUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-2" />
                    )}
                    Revisions {revisionCount > 0 && `(${revisionCount})`}
                  </Button>
                </div>

                {/* Revision History Dropdown */}
                {revisionHistory.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-start mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowHistoryDropdown(!showHistoryDropdown)
                        }
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        {showHistoryDropdown ? "Hide" : "Show"} History
                      </Button>
                    </div>

                    <div
                      className={`transition-all duration-700 ease-in-out ${
                        showHistoryDropdown
                          ? "max-h-fit-content opacity-100"
                          : "max-h-0 opacity-0 overflow-hidden"
                      }`}
                      style={{
                        transitionDelay: showHistoryDropdown ? "0ms" : "200ms",
                      }}
                    >
                      <div className="space-y-3 overflow-y-auto max-h-fit-content">
                        {revisionHistory.map((revision) => (
                          <div
                            key={revision.id}
                            className="p-4 border border-border rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-semibold ${getRevisionBadgeColors(revision.revision_number)}`}
                                >
                                  R{revision.revision_number}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(
                                    revision.created_at
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {
                                  getRevisionItems(revision.revision_number)
                                    .annotations.length
                                }{" "}
                                annotations,{" "}
                                {
                                  getRevisionItems(revision.revision_number)
                                    .comments.length
                                }{" "}
                                comments
                              </span>
                            </div>

                            {/* Annotations Summary */}
                            {(() => {
                              const revisionAnnotations = getRevisionItems(
                                revision.revision_number
                              ).annotations;
                              return revisionAnnotations.length > 0 ? (
                                <div className="mb-3">
                                  <h4 className="text-xs font-medium text-foreground mb-2">
                                    Annotations ({revisionAnnotations.length})
                                  </h4>
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {revisionAnnotations
                                      .slice(0, 3)
                                      .map((annotation: any, index: number) => (
                                        <div
                                          key={annotation.id || index}
                                          className="text-xs p-2 bg-background rounded border"
                                        >
                                          <div className="font-medium text-muted-foreground mb-1">
                                            Annotation {index + 1}
                                          </div>
                                          <div className="text-foreground">
                                            {annotation.comment?.length > 100
                                              ? `${annotation.comment.substring(0, 100)}...`
                                              : annotation.comment}
                                          </div>
                                        </div>
                                      ))}
                                    {revisionAnnotations.length > 3 && (
                                      <div className="text-xs text-muted-foreground text-center py-1">
                                        +{revisionAnnotations.length - 3} more
                                        annotations
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null;
                            })()}

                            {/* Comments Summary */}
                            {(() => {
                              const revisionComments = getRevisionItems(
                                revision.revision_number
                              ).comments;
                              return revisionComments.length > 0 ? (
                                <div>
                                  <h4 className="text-xs font-medium text-foreground mb-2">
                                    Comments ({revisionComments.length})
                                  </h4>
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {revisionComments
                                      .slice(0, 3)
                                      .map((comment: any, index: number) => (
                                        <div
                                          key={comment.id || index}
                                          className="text-xs p-2 bg-background rounded border"
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-muted-foreground">
                                              {comment.profiles?.name ||
                                                comment.profiles?.email ||
                                                "Unknown"}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {comment.profiles?.title ||
                                                comment.profiles?.role ||
                                                ""}
                                            </span>
                                          </div>
                                          <div className="text-foreground">
                                            {comment.comment?.length > 100
                                              ? `${comment.comment.substring(0, 100)}...`
                                              : comment.comment}
                                          </div>
                                        </div>
                                      ))}
                                    {revisionComments.length > 3 && (
                                      <div className="text-xs text-muted-foreground text-center py-1">
                                        +{revisionComments.length - 3} more
                                        comments
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {rightPanelTab === "feedback" && (
            <div className="flex-1 overflow-y-auto">
              {/* Tab Navigation for Feedback */}
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

              {/* Annotations Tab */}

              {activeTab === "annotations" && (
                <>
                  <div className="mb-6 p-2">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <h4 className=" text-muted-foreground font-semibold">
                          Annotations
                        </h4>
                        <Button
                          variant={deleteMode ? "ghost" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setDeleteMode(!deleteMode);
                            setSelectedAnnotations([]);
                            if (deleteMode) {
                              setSelectedAnnotations([]);
                            }
                          }}
                          className={`h-8 px-3 text-xs font-medium transition-all duration-200 cursor-pointer ${
                            deleteMode
                              ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30 shadow-sm"
                              : "border-border hover:bg-accent hover:border-border"
                          }`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deleteMode ? "Cancel" : "Delete"}
                        </Button>
                      </div>
                      <Button
                        variant={annotationMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnnotationMode(!annotationMode)}
                        disabled={isFunctionalityDisabled()}
                        className={`h-8 px-3 text-xs font-medium transition-all duration-200 cursor-pointer ${
                          annotationMode
                            ? "bg-primary hover:bg-primary/90 shadow-sm"
                            : "border-border hover:bg-accent hover:border-border"
                        } ${
                          isFunctionalityDisabled()
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {annotationMode ? "Cancel" : "Add Annotation"}
                      </Button>
                    </div>

                    {/* Annotations Disabled Banner */}
                    {isFunctionalityDisabled() && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4  dark:bg-yellow-950/20 dark:border-yellow-800/30">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            Annotations disabled - Asset is in revision mode
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Multi-Delete Actions */}
                    {deleteMode && selectedAnnotations.length > 0 && (
                      <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-6 mt-6 dark:bg-red-950/10 dark:border-red-800/30">
                        <div className="flex flex-col items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/30">
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="font-semibold text-red-700 dark:text-red-400">
                              {selectedAnnotations.length} annotation(s)
                              selected
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteWarning(true)}
                            className="shadow-sm cursor-pointer bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Selected
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Existing Annotations */}
                  <div className="space-y-4 p-2">
                    {annotations.map((annotation) => (
                      <Card
                        key={annotation.id}
                        className={`p-6 transition-all duration-200 rounded-xl border border-border/50 ${
                          selectedHotspotId === annotation.id
                            ? "ring-2 ring-primary/15 ring-offset-2 bg-primary/3 shadow-lg"
                            : deleteMode &&
                                selectedAnnotations.includes(annotation.id)
                              ? "ring-2 ring-red-300 bg-red-50/50 shadow-lg dark:ring-red-700 dark:bg-red-950/10"
                              : "hover:shadow-md hover:border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {deleteMode && (
                              <input
                                type="checkbox"
                                checked={selectedAnnotations.includes(
                                  annotation.id
                                )}
                                onChange={() =>
                                  handleAnnotationSelect(annotation.id)
                                }
                                className="h-4 w-4 text-red-600 border-border rounded focus:ring-red-500 cursor-pointer dark:text-red-400 dark:focus:ring-red-400"
                              />
                            )}
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <MessageCircle className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-foreground">
                                {annotation.profiles?.email || "Unknown"}
                              </span>
                              {annotation.profiles?.title && (
                                <Badge
                                  variant={
                                    getTitleBadgeVariant(
                                      annotation.profiles.title
                                    ) as
                                      | "default"
                                      | "destructive"
                                      | "secondary"
                                      | "outline"
                                      | null
                                      | undefined
                                  }
                                  className="text-xs px-2 py-0.5 w-fit"
                                >
                                  {annotation.profiles.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 cursor-pointer"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleHotspotSelect(annotation.id)
                                }
                              >
                                <Eye className="h-3 w-3 mr-2" />
                                Focus on Hotspot
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingAnnotation(annotation.id);
                                  setEditComment(annotation.comment);
                                  setEditImageUrl(annotation.image_url || "");
                                }}
                                disabled={isFunctionalityDisabled()}
                                className={
                                  isFunctionalityDisabled()
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }
                              >
                                <Edit3 className="h-3 w-3 mr-2" />
                                Edit Annotation
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {!deleteMode && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    confirmDeleteAnnotation(annotation.id)
                                  }
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <X className="h-3 w-3 mr-2" />
                                  Delete Annotation
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {editingAnnotation === annotation.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              rows={3}
                            />

                            {/* Image Upload for Edit */}
                            <div>
                              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Reference Image (optional)
                              </label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="https://example.com/image.jpg or upload file"
                                  value={editImageUrl}
                                  onChange={(e) =>
                                    setEditImageUrl(e.target.value)
                                  }
                                  className="flex-1"
                                />

                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const input =
                                      document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/*";
                                    input.onchange = async (e) => {
                                      const file = (
                                        e.target as HTMLInputElement
                                      ).files?.[0];
                                      if (file) {
                                        try {
                                          const formData = new FormData();
                                          formData.append("file", file);

                                          const response = await fetch(
                                            "/api/upload",
                                            {
                                              method: "POST",
                                              body: formData,
                                            }
                                          );

                                          const data = await response.json();

                                          if (response.ok) {
                                            setEditImageUrl(data.url);
                                            toast.success(
                                              "Image uploaded successfully!"
                                            );
                                          } else {
                                            toast.error(
                                              data.error || "Upload failed"
                                            );
                                          }
                                        } catch (error) {
                                          console.error("Upload error:", error);
                                          toast.error("Upload failed");
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Preview Image for Edit */}
                            {editImageUrl && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                  Preview:
                                </label>
                                <div
                                  className="relative w-full h-52 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() =>
                                    handleImageClick(
                                      editImageUrl,
                                      "Preview Image"
                                    )
                                  }
                                >
                                  <Image
                                    width={320}
                                    height={28}
                                    unoptimized
                                    src={editImageUrl}
                                    alt="Reference"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.display = "none";
                                      (e.currentTarget
                                        .nextElementSibling as HTMLElement)!.style.display =
                                        "flex";
                                    }}
                                  />
                                  <div
                                    className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs"
                                    style={{ display: "none" }}
                                  >
                                    Invalid URL
                                  </div>
                                  <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full">
                                    <Maximize2 className="h-3 w-3" />
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex p-4 justify-around">
                              <Button
                                size="sm"
                                onClick={() => updateAnnotation(annotation.id)}
                                disabled={!editComment.trim()}
                                className="cursor-pointer"
                              >
                                Update
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingAnnotation(null);
                                  setEditImageUrl("");
                                }}
                                className="cursor-pointer"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {inlineEditingId === annotation.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={inlineEditComment}
                                  onChange={(e) =>
                                    setInlineEditComment(e.target.value)
                                  }
                                  onKeyDown={(e) =>
                                    handleInlineEditKeyDown(e, annotation.id)
                                  }
                                  onBlur={() => {
                                    if (!isSwitchingEdit) {
                                      submitInlineEdit(annotation.id);
                                    }
                                  }}
                                  className="min-h-[80px] border-border focus:border-primary focus:ring-primary resize-none"
                                  rows={3}
                                  autoFocus
                                  placeholder="Edit comment..."
                                />
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  <span>
                                    Press Enter to save, Escape to cancel
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`text-sm text-foreground p-2 rounded-md transition-colors -m-2 group relative ${
                                  inlineEditingId === annotation.id
                                    ? "bg-primary/10 border border-primary/20"
                                    : isFunctionalityDisabled()
                                      ? "opacity-50 cursor-not-allowed"
                                      : "cursor-pointer hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  !isFunctionalityDisabled() &&
                                  switchToEditing(annotation, false)
                                }
                                title={
                                  isFunctionalityDisabled()
                                    ? "Editing disabled during revision"
                                    : "Click to edit comment"
                                }
                              >
                                <div className="flex items-start justify-between">
                                  <span className="flex-1">
                                    {annotation.comment}
                                  </span>
                                  <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0 mt-0.5" />
                                </div>
                              </div>
                            )}

                            {/* Display reference image if exists */}
                            {annotation.image_url && (
                              <div className="mt-2">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Reference Image:
                                </label>
                                <div
                                  className="relative w-full h-52 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() =>
                                    handleImageClick(
                                      annotation.image_url!,
                                      annotation.comment
                                    )
                                  }
                                >
                                  <Image
                                    width={320}
                                    height={128}
                                    unoptimized
                                    src={annotation.image_url}
                                    alt="Reference"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (
                                        e.currentTarget as HTMLElement
                                      ).style.display = "none";
                                      (e.currentTarget
                                        .nextElementSibling as HTMLElement)!.style.display =
                                        "flex";
                                    }}
                                  />
                                  <div
                                    className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs"
                                    style={{ display: "none" }}
                                  >
                                    Invalid URL
                                  </div>
                                  <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full">
                                    <Maximize2 className="h-3 w-3" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full inline-block border border-border/50">
                            Created on{" "}
                            {new Date(
                              annotation.created_at
                            ).toLocaleDateString()}
                          </div>
                          {revisionHistory.length > 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${getRevisionBadgeColors(getRevisionForItem(annotation.created_at) || 0)}`}
                            >
                              R{getRevisionForItem(annotation.created_at) || 0}
                            </Badge>
                          )}
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
                          Click &quot;Add Annotation&quot; to start reviewing
                          this model
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Comments Tab */}
              {activeTab === "comments" && (
                <>
                  <div className="mb-6 p-2">
                    <h4 className="text-muted-foreground font-semibold mb-8">
                      Comments
                    </h4>

                    {/* Add New Comment */}
                    <div className="space-y-3 mb-6">
                      {isFunctionalityDisabled() && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950/20 dark:border-yellow-800/30">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              Comments disabled - Asset is in revision mode
                            </span>
                          </div>
                        </div>
                      )}
                      <Textarea
                        placeholder={
                          isFunctionalityDisabled()
                            ? "Comments disabled during revision"
                            : "Add a comment about this asset..."
                        }
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={handleNewCommentKeyDown}
                        disabled={isFunctionalityDisabled()}
                        className={`min-h-[100px] border-border focus:border-primary focus:ring-primary ${
                          isFunctionalityDisabled()
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        rows={4}
                      />
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>
                          {isFunctionalityDisabled()
                            ? "Comments are disabled during revision mode"
                            : "Press Enter to send, Shift+Enter for new line"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Existing Comments */}
                  <div className="space-y-4 p-2">
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
                              {comment.profiles?.title && (
                                <Badge
                                  variant={
                                    getTitleBadgeVariant(
                                      comment.profiles.title
                                    ) as
                                      | "default"
                                      | "destructive"
                                      | "secondary"
                                      | "outline"
                                      | null
                                      | undefined
                                  }
                                  className="text-xs px-2 py-0.5 w-fit"
                                >
                                  {comment.profiles.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 cursor-pointer"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => {
                                  startCommentInlineEdit(comment);
                                }}
                                disabled={isFunctionalityDisabled()}
                                className={
                                  isFunctionalityDisabled()
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }
                              >
                                <Edit3 className="h-3 w-3 mr-2" />
                                Edit Comment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteComment(comment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-3 w-3 mr-2" />
                                Delete Comment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {inlineEditingCommentId === comment.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={inlineEditCommentText}
                              onChange={(e) =>
                                setInlineEditCommentText(e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleCommentInlineEditKeyDown(e, comment.id)
                              }
                              onBlur={() => {
                                submitCommentInlineEdit(comment.id);
                              }}
                              className="min-h-[80px] border-border focus:border-primary focus:ring-primary resize-none"
                              rows={3}
                              autoFocus
                              placeholder="Edit comment..."
                            />
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>Press Enter to save, Escape to cancel</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`text-sm text-foreground p-2 rounded-md transition-colors -m-2 group relative ${
                              isFunctionalityDisabled()
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-muted/50"
                            }`}
                            onClick={() => {
                              if (!isFunctionalityDisabled()) {
                                startCommentInlineEdit(comment);
                              }
                            }}
                            title={
                              isFunctionalityDisabled()
                                ? "Editing disabled during revision"
                                : "Click to edit comment"
                            }
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 break-words w-full">
                                <pre className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                                  {comment.comment}
                                </pre>
                              </div>
                              <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0 mt-0.5" />
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full inline-block border border-border/50">
                            Created on{" "}
                            {new Date(comment.created_at).toLocaleDateString()}
                          </div>
                          {revisionHistory.length > 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${getRevisionBadgeColors(getRevisionForItem(comment.created_at) || 0)}`}
                            >
                              R{getRevisionForItem(comment.created_at) || 0}
                            </Badge>
                          )}
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
                </>
              )}
            </div>
          )}
        </div>

        {/* New Annotation Dialog */}
        <Dialog
          open={selectedAnnotation?.id.startsWith("temp-") || false}
          onOpenChange={(open) => {
            if (!open) {
              // Remove temporary annotation if canceling
              if (selectedAnnotation?.id.startsWith("temp-")) {
                setAnnotations((prev) =>
                  prev.filter((ann) => ann.id !== selectedAnnotation.id)
                );
              }
              setSelectedAnnotation(null);
              setSelectedHotspotId(null);
              setNewImageUrl("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px] h-fit overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">
                Add New Annotation
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add a comment and optional reference image to this hotspot
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Comment Section */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">
                  Comment *
                </label>
                <Textarea
                  placeholder="Describe what you want to highlight or comment on..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] border-border focus:border-primary focus:ring-primary"
                  rows={4}
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">
                  Reference Image (optional)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/image.jpg or upload file"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="flex-1 border-border focus:border-primary"
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          try {
                            const formData = new FormData();
                            formData.append("file", file);

                            const response = await fetch("/api/upload", {
                              method: "POST",
                              body: formData,
                            });

                            const data = await response.json();

                            if (response.ok) {
                              setNewImageUrl(data.url);
                              toast.success("Image uploaded successfully!");
                            } else {
                              toast.error(data.error || "Upload failed");
                            }
                          } catch (error) {
                            console.error("Upload error:", error);
                            toast.error("Upload failed");
                          }
                        }
                      };
                      input.click();
                    }}
                    className="border-border hover:bg-accent cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview Image */}
              {newImageUrl && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">
                    Image Preview
                  </label>
                  <div
                    className="relative w-full h-48 border-2 border-border rounded-lg overflow-hidden bg-muted/50 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() =>
                      handleImageClick(newImageUrl, "Image Preview")
                    }
                  >
                    <Image
                      width={480}
                      height={192}
                      unoptimized
                      src={newImageUrl}
                      alt="Reference"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                        (e.currentTarget
                          .nextElementSibling as HTMLElement)!.style.display =
                          "flex";
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm"
                      style={{ display: "none" }}
                    >
                      <div className="text-center">
                        <div className="text-muted-foreground mb-2"></div>
                        Invalid image URL
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 bg-black/50 text-white p-1.5 rounded-full">
                      <Maximize2 className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                onClick={saveAnnotation}
                disabled={!newComment.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 font-medium cursor-pointer"
              >
                Save Annotation
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Remove temporary annotation if canceling
                  if (selectedAnnotation?.id.startsWith("temp-")) {
                    setAnnotations((prev) =>
                      prev.filter((ann) => ann.id !== selectedAnnotation.id)
                    );
                  }
                  setSelectedAnnotation(null);
                  setSelectedHotspotId(null);
                  setNewImageUrl("");
                }}
                className="border-border hover:bg-accent cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Warning Dialog */}
        <Dialog open={showDeleteWarning} onOpenChange={setShowDeleteWarning}>
          <DialogContent className="sm:max-w-[425px] h-fit">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-700 dark:text-red-400">
                Delete Annotation{selectedAnnotations.length > 0 ? "s" : ""}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete{" "}
                {singleDeleteId
                  ? "this annotation"
                  : `${selectedAnnotations.length} annotation(s)`}
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (singleDeleteId) {
                    handleSingleDelete();
                  } else {
                    deleteMultipleAnnotations(selectedAnnotations);
                    setShowDeleteWarning(false);
                  }
                }}
                className="flex-1 cursor-pointer bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete{" "}
                {singleDeleteId
                  ? "Annotation"
                  : `${selectedAnnotations.length} Annotation(s)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteWarning(false);
                  setSingleDeleteId(null);
                }}
                className="flex-1 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog open={showImageDialog} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle className="text-xl font-bold text-foreground">
                {selectedImageTitle}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Reference image for annotation • Scroll to zoom (1x-5x)
              </DialogDescription>
            </DialogHeader>
            <div
              className="relative w-full h-[70vh] bg-muted cursor-pointer"
              onMouseMove={handleDialogImageMouseMove}
              onWheel={handleDialogImageWheel}
            >
              <Image
                width={1200}
                height={800}
                unoptimized
                src={selectedImage}
                alt={selectedImageTitle}
                className="w-full h-full object-contain bg-background transition-transform duration-200"
                style={{
                  transform: `scale(${dialogZoomLevel})`,
                  transformOrigin: dialogIsZooming
                    ? `${dialogMousePosition.x}% ${dialogMousePosition.y}%`
                    : "center",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                  (e.currentTarget
                    .nextElementSibling as HTMLElement)!.style.display = "flex";
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
                style={{ display: "none" }}
              >
                <div className="text-center">
                  <div className="text-muted-foreground mb-2 text-4xl"></div>
                  <p className="text-lg font-medium">Invalid image URL</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The image could not be loaded
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleDialogClose}
                className="cursor-pointer"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Image URL Dialog */}
        <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
          <DialogContent className="sm:max-w-[500px] h-fit">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">
                Add Reference Image URL
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter the URL of an image you want to add as a reference image.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Image URL *
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={referenceImageUrl}
                  onChange={(e) => setReferenceImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddReferenceImageUrl();
                      setShowUrlDialog(false);
                    }
                  }}
                  className="border-border focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                onClick={() => {
                  handleAddReferenceImageUrl();
                  setShowUrlDialog(false);
                }}
                disabled={!referenceImageUrl.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 font-medium cursor-pointer"
              >
                Add Image URL
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUrlDialog(false);
                  setReferenceImageUrl("");
                }}
                className="border-border hover:bg-accent cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* First Revision Dialog */}
        <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
          <DialogContent className="sm:max-w-[500px] h-fit">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">
                Confirm Revision Request
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Please review all annotations and comments before proceeding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950/20 dark:border-yellow-800/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Important Notice
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Make sure all annotations and comments are correct. No
                      more can be added until the 2nd revision.
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  • All annotation and comment functionality will be disabled
                </p>
                <p>• Only status updates will be allowed</p>
                <p>• This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                onClick={handleRevisionConfirm}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium cursor-pointer"
              >
                Confirm Revision Request
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRevisionDialog(false)}
                className="border-border hover:bg-accent cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Additional Revisions Dialog */}
        <Dialog
          open={showSecondRevisionDialog}
          onOpenChange={setShowSecondRevisionDialog}
        >
          <DialogContent className="sm:max-w-[500px] h-fit">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-700 dark:text-red-400">
                ⚠️ Additional Revision Warning
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This is revision #{revisionCount + 1} for this asset.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-950/20 dark:border-red-800/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-red-800 dark:text-red-200">
                      Cost Warning
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Additional revisions may incur costs if the changes are
                      client requests and not due to modeling errors.
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• This revision will be reviewed for billing purposes</p>
                <p>• Client-requested changes may be added to invoice</p>
                <p>• Modeling errors will not incur additional costs</p>
                {revisionCount >= 3 && (
                  <p className="font-medium text-red-600 dark:text-red-400">
                    • This is revision #{revisionCount + 1} - fees will likely
                    apply
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                onClick={
                  revisionCount >= 2
                    ? handleAdditionalRevisionConfirm
                    : handleSecondRevisionConfirm
                }
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
              >
                Proceed with Revision #{revisionCount + 1}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSecondRevisionDialog(false)}
                className="border-border hover:bg-accent cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
