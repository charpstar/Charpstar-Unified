"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
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
  Eye,
  Camera,
  MoreVertical,
  Trash2,
  Maximize2,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
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
  parent_id?: string;
}

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  comment: string;
  image_url?: string;
  visible: boolean;
}

const STATUS_LABELS = {
  // Client-facing mapping
  in_production: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  not_started: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  revisions: { label: "Feedback Given", color: "bg-red-100 text-red-700" },
  approved_by_client: {
    label: "Approved",
    color: "bg-emerald-100 text-emerald-700",
  },
  delivered_by_artist: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  approved: { label: "New Upload", color: "bg-blue-100 text-blue-700" },
};

// Internal role (admin/qa) should see real statuses, clients see client-facing mapping above
const getStatusDisplay = (
  status?: string,
  role?: string
): { label: string; className: string } => {
  if (!status) return { label: "Unknown", className: "" };
  const isInternal = role === "admin" || role === "qa";
  if (isInternal) {
    switch (status) {
      case "not_started":
        return { label: "Not Started", className: "bg-gray-100 text-gray-800" };
      case "in_production":
        return {
          label: "In Production",
          className: "bg-yellow-100 text-yellow-800",
        };
      case "revisions":
        return { label: "Revisions", className: "bg-red-100 text-red-700" };
      case "approved_by_client":
        return {
          label: "Approved by Client",
          className: "bg-emerald-100 text-emerald-700",
        };
      case "delivered_by_artist":
        return {
          label: "Delivered by Artist",
          className: "bg-yellow-100 text-yellow-800",
        };
      case "approved":
        return { label: "Approved", className: "bg-blue-100 text-blue-700" };
      default:
        return { label: status.replace(/_/g, " "), className: "" };
    }
  } else {
    const clientMap = STATUS_LABELS[status as keyof typeof STATUS_LABELS];
    return {
      label: clientMap?.label || status,
      className: clientMap?.color || "",
    };
  }
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [isUploadingPastedImage, setIsUploadingPastedImage] = useState(false);
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
  // Make URLs in text clickable with blue styling
  const linkifyText = (text: string): any => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-words"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState<
    number | null
  >(0); // Always start with the first image selected
  const [carouselIndex] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<"images" | "feedback">(
    "feedback"
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
  const [showRevisionDetailsDialog, setShowRevisionDetailsDialog] =
    useState(false);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);

  const modelViewerRef = useRef<any>(null);

  // Reply system state
  const [replyingTo, setReplyingTo] = useState<{
    type: "annotation" | "comment";
    id: string;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Function to handle back navigation based on where user came from
  const handleBackNavigation = () => {
    const from = searchParams.get("from");
    if (from === "client-review") {
      // Preserve filter parameters when navigating back to admin-review
      const params = new URLSearchParams();
      const client = searchParams.get("client");
      const batch = searchParams.get("batch");
      const modeler = searchParams.get("modeler");
      const email = searchParams.get("email");

      if (client) params.set("client", client);
      if (batch) params.set("batch", batch);
      if (modeler) params.set("modeler", modeler);
      if (email) params.set("email", email);

      const queryString = params.toString();
      router.push(`/admin-review${queryString ? `?${queryString}` : ""}`);
    } else if (from === "qa-review") {
      router.push("/qa-review");
    } else {
      router.push("/client-review");
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
  const hotspots: Hotspot[] = annotations
    .filter((annotation: any) => !annotation.parent_id)
    .map((annotation) => ({
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

      // For admin and QA users, don't require client metadata
      if (
        !user?.metadata?.client &&
        user?.metadata?.role !== "admin" &&
        user?.metadata?.role !== "qa"
      )
        return;

      setLoading(true);

      let query = supabase
        .from("onboarding_assets")
        .select("*")
        .eq("id", assetId);

      // Only filter by client if user is not admin or QA
      if (user?.metadata?.role !== "admin" && user?.metadata?.role !== "qa") {
        query = query.eq("client", user.metadata.client);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error("Error fetching asset:", error);
        toast.error("Failed to load asset");
        return;
      }

      setAsset(data);

      // Set revision count - fallback to revision history if asset record is outdated
      let finalRevisionCount = data.revision_count || 0;

      // If revision count is 0 but there might be revision history, check the database
      if (finalRevisionCount === 0) {
        const { data: revisionHistory } = await supabase
          .from("revision_history")
          .select("revision_number")
          .eq("asset_id", assetId)
          .order("revision_number", { ascending: false })
          .limit(1);

        if (revisionHistory && revisionHistory.length > 0) {
          finalRevisionCount = revisionHistory[0].revision_number;

          // Update the asset record to fix the mismatch
          await supabase
            .from("onboarding_assets")
            .update({ revision_count: finalRevisionCount })
            .eq("id", assetId);
        }
      }

      setRevisionCount(finalRevisionCount);

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
        // Filter to only show image files in client review
        const imageExtensions = [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".bmp",
          ".webp",
          ".svg",
        ];
        const imageUrls = refs.filter((url) => {
          if (!url) return false;
          const lowerUrl = url.toLowerCase();
          return imageExtensions.some((ext) => lowerUrl.includes(ext));
        });
        setReferenceImages(imageUrls);
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
      if (!assetId || !user) return;

      try {
        let query = supabase
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
          .eq("asset_id", assetId);

        // Apply role-based filtering for comments
        if (user.metadata?.role === "client") {
          // Clients can only see their own comments
          query = query.eq("created_by", user.id);
        }
        // QA, modelers, admin, and production can see all comments (no additional filter needed)

        const { data, error } = await query.order("created_at", {
          ascending: false,
        });

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
  }, [assetId, user]);

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
  };

  // Handle hotspot creation
  const handleHotspotCreate = (position: {
    x: number;
    y: number;
    z: number;
  }) => {
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

    // Add to annotations list immediately (will be replaced when saved)
    setAnnotations((prev) => {
      const newAnnotations = [...prev, tempAnnotation];
      return newAnnotations;
    });
    setSelectedAnnotation(tempAnnotation);
    setNewComment("");
    setNewImageUrl(""); // Clear the image URL for new annotations
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
      const annotation = annotations.find((ann) => ann.id === annotationId);
      if (!isAdmin && annotation && annotation.created_by !== user?.id) {
        toast.error("You can only edit your own annotations");
        return;
      }
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
      const annotation = annotations.find((ann) => ann.id === annotationId);
      if (!isAdmin && annotation && annotation.created_by !== user?.id) {
        toast.error("You can only delete your own annotations");
        return;
      }
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
    const annotation = annotations.find((ann) => ann.id === annotationId);
    if (!isAdmin && annotation && annotation.created_by !== user?.id) {
      toast.error("You can only delete your own annotations");
      return;
    }
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
      if (!isAdmin) {
        const unauthorized = annotationIds.some((id) => {
          const ann = annotations.find((a) => a.id === id);
          return ann && ann.created_by !== user?.id;
        });
        if (unauthorized) {
          toast.error("You can only delete your own annotations");
          return;
        }
      }
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
    const annotation = annotations.find((ann) => ann.id === annotationId);
    if (!isAdmin && annotation && annotation.created_by !== user?.id) {
      return;
    }
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
      const annotation = annotations.find((ann) => ann.id === annotationId);
      if (!isAdmin && annotation && annotation.created_by !== user?.id) {
        toast.error("You can only edit your own annotations");
        return;
      }
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
      const annotation = annotations.find((ann) => ann.id === annotationId);
      if (!isAdmin && annotation && annotation.created_by !== user?.id) {
        toast.error("You can only edit your own annotations");
        return;
      }
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Handle paste image from clipboard (e.g., Win+Shift+S then Ctrl+V)
  const handlePasteImage = async (e: React.ClipboardEvent) => {
    try {
      const items = e.clipboardData?.items || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && file.type.startsWith("image/")) {
            e.preventDefault();
            setIsUploadingPastedImage(true);
            const formData = new FormData();
            formData.append("file", file);
            try {
              const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || "Upload failed");
              setNewImageUrl(data.url);
              toast.success("Image pasted and uploaded");
              return;
            } finally {
              setIsUploadingPastedImage(false);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error handling pasted image:", error);
      toast.error("Failed to paste image");
      setIsUploadingPastedImage(false);
    }
  };

  // Helper function to update modeler's end time when asset is approved
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

  // Helper function to update asset status with a specific revision count
  const updateAssetStatusWithRevision = async (
    newStatus: string,
    revisionNumber: number
  ) => {
    if (!assetId) return;

    setStatusUpdating(true);

    try {
      // Use the complete API endpoint for proper allocation list handling
      const response = await fetch("/api/assets/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          status: newStatus,
          revisionCount: revisionNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      // Update local state
      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
      setRevisionCount(revisionNumber);

      // Dispatch custom event to notify other components to refresh
      window.dispatchEvent(
        new CustomEvent("assetStatusUpdated", {
          detail: { assetId, status: newStatus },
        })
      );

      toast.success(
        `Asset ${newStatus === "approved_by_client" ? "approved by client" : newStatus === "approved" ? "approved" : "updated"} successfully`
      );

      // Handle notification sending based on status changes
      if (newStatus === "revisions") {
        // Send revision notification to modeler
        try {
          // Get modeler assignment info
          const { data: assignment, error: assignmentError } = await supabase
            .from("asset_assignments")
            .select("user_id")
            .eq("asset_id", assetId)
            .eq("role", "modeler")
            .single();

          if (!assignmentError && assignment && asset) {
            // Fetch modeler profile separately
            const { data: modelerProfile, error: profileError } = await supabase
              .from("profiles")
              .select("email, title")
              .eq("id", assignment.user_id)
              .single();

            if (!profileError && modelerProfile?.email) {
              // Determine reviewer name based on user role
              let reviewerName;
              if (user?.metadata?.role === "client") {
                reviewerName = "Client";
              } else if (user?.metadata?.role === "qa") {
                reviewerName = "QA Team";
              } else if (user?.metadata?.role === "admin") {
                reviewerName = "Admin Team";
              } else {
                reviewerName =
                  user?.user_metadata?.name || user?.email || "Reviewer";
              }

              await notificationService.sendRevisionNotification(
                assetId,
                assignment.user_id,
                modelerProfile.email,
                asset.product_name,
                (asset as any).client,
                reviewerName
              );
            } else {
              console.error(
                "❌ Failed to fetch modeler profile:",
                profileError
              );
            }
          }
        } catch (error) {
          console.error("❌ Failed to send revision notification:", error);
          // Don't throw - notifications shouldn't block status updates
        }
      }
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update asset status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const updateAssetStatus = async (newStatus: string, skipDialog = false) => {
    if (!assetId) return;

    // Handle revision workflow
    if (newStatus === "revisions" && !skipDialog) {
      const currentRevisionCount = revisionCount + 1;
      const isClient = user?.metadata?.role === "client";

      if (isClient) {
        if (currentRevisionCount === 1 || currentRevisionCount === 2) {
          setShowRevisionDialog(true);
          return;
        } else if (currentRevisionCount >= 3) {
          setShowSecondRevisionDialog(true);
          return;
        }
      }
    }

    setStatusUpdating(true);

    try {
      // Use the complete API endpoint for proper allocation list handling
      const response = await fetch("/api/assets/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          status: newStatus,
          revisionCount: newStatus === "revisions" ? revisionCount : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      const result = await response.json();

      // Handle notification sending based on status changes
      if (newStatus === "revisions") {
        // Send revision notification to modeler
        try {
          // Get modeler assignment info
          const { data: assignment, error: assignmentError } = await supabase
            .from("asset_assignments")
            .select("user_id")
            .eq("asset_id", assetId)
            .eq("role", "modeler")
            .single();

          if (!assignmentError && assignment && asset) {
            // Fetch modeler profile separately
            const { data: modelerProfile, error: profileError } = await supabase
              .from("profiles")
              .select("email, title")
              .eq("id", assignment.user_id)
              .single();

            if (!profileError && modelerProfile?.email) {
              // Determine reviewer name based on user role
              let reviewerName;
              if (user?.metadata?.role === "client") {
                reviewerName = "Client";
              } else if (user?.metadata?.role === "qa") {
                reviewerName = "QA Team";
              } else if (user?.metadata?.role === "admin") {
                reviewerName = "Admin Team";
              } else {
                reviewerName =
                  user?.user_metadata?.name || user?.email || "Reviewer";
              }

              await notificationService.sendRevisionNotification(
                assetId,
                assignment.user_id,
                modelerProfile.email,
                asset.product_name,
                (asset as any).client,
                reviewerName
              );
            } else {
              console.error(
                "❌ Failed to fetch modeler profile:",
                profileError
              );
            }
          }
        } catch (error) {
          console.error("❌ Failed to send revision notification:", error);
          // Don't throw - notifications shouldn't block status updates
        }
      }

      // If status is approved_by_client, update the modeler's end time
      if (newStatus === "approved_by_client") {
        await updateModelerEndTime(assetId);

        // Send client approval notification to modeler
        try {
          const { data: assignment, error: assignmentError } = await supabase
            .from("asset_assignments")
            .select("user_id")
            .eq("asset_id", assetId)
            .eq("role", "modeler")
            .single();

          if (!assignmentError && assignment && asset) {
            // Fetch modeler profile separately
            const { data: modelerProfile, error: profileError } = await supabase
              .from("profiles")
              .select("email, title")
              .eq("id", assignment.user_id)
              .single();

            if (!profileError && modelerProfile?.email) {
              const approverName =
                user?.user_metadata?.name || user?.email || "Client";

              await notificationService.sendAssetApprovedNotification(
                assetId,
                assignment.user_id,
                modelerProfile.email,
                asset.product_name,
                (asset as any).client,
                approverName,
                "client"
              );
            } else {
              console.error(
                "❌ Failed to fetch modeler profile for client approval:",
                profileError
              );
            }
          }
        } catch (error) {
          console.error(
            "❌ Failed to send client approval notification:",
            error
          );
        }

        // Dispatch custom event for QA metrics tracking if user is QA
        if (user?.metadata?.role === "qa") {
          // Insert record into qa_approvals table
          const { error: approvalError } = await supabase
            .from("qa_approvals")
            .insert({
              qa_id: user.id,
              asset_id: assetId,
              approved_at: new Date().toISOString(),
            });

          if (approvalError) {
            console.error("Error inserting QA approval record:", approvalError);
          }

          window.dispatchEvent(
            new CustomEvent("qaApproval", {
              detail: {
                assetId,
                approvedAt: new Date().toISOString(),
              },
            })
          );
        }
      }

      // If status is approved (QA approval), send notifications
      if (newStatus === "approved") {
        try {
          // Send QA approval notification to modeler
          const { data: assignment, error: assignmentError } = await supabase
            .from("asset_assignments")
            .select("user_id")
            .eq("asset_id", assetId)
            .eq("role", "modeler")
            .single();

          // Fetch modeler profile separately for both notifications
          let modelerProfile = null;

          if (!assignmentError && assignment && asset) {
            const { data: modelerProfileData, error: profileError } =
              await supabase
                .from("profiles")
                .select("email, title")
                .eq("id", assignment.user_id)
                .single();

            modelerProfile = modelerProfileData;

            if (!profileError && modelerProfile?.email) {
              const approverName =
                user?.user_metadata?.name || user?.email || "QA Team";

              await notificationService.sendAssetApprovedNotification(
                assetId,
                assignment.user_id,
                modelerProfile.email,
                asset.product_name,
                (asset as any).client,
                approverName,
                "qa"
              );
            } else {
              console.error(
                "❌ Failed to fetch modeler profile for QA approval:",
                profileError
              );
            }
          }

          // Send client review ready notification to client
          const { data: clientProfile, error: clientError } = await supabase
            .from("profiles")
            .select("id, email")
            .eq("role", "client")
            .eq("client", (asset as any)?.client)
            .single();

          if (!clientError && clientProfile && asset) {
            const modelerName = modelerProfile?.title || "Modeler Team";

            await notificationService.sendClientReviewReadyNotification(
              assetId,
              clientProfile.id,
              clientProfile.email,
              asset.product_name,
              (asset as any).client,
              modelerName
            );
          }
        } catch (error) {
          console.error("❌ Failed to send approval notifications:", error);
        }
      }

      // Update local state
      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (newStatus === "revisions") {
        setRevisionCount((prev) => prev + 1);
      }

      // Dispatch custom event to notify other components to refresh
      window.dispatchEvent(
        new CustomEvent("assetStatusUpdated", {
          detail: { assetId, newStatus },
        })
      );

      // Show success message and trigger earnings widget refresh
      if (result.allocationListApproved) {
        toast.success(
          "Asset approved by client and allocation list completed!"
        );
        // Trigger earnings widget refresh for approval
        window.dispatchEvent(new CustomEvent("allocationListApproved"));
      } else if (result.allocationListId) {
        // Check if this was an unapproval (status changed from approved_by_client to something else)
        const wasApprovedByClient = asset?.status === "approved_by_client";
        if (wasApprovedByClient && newStatus !== "approved_by_client") {
          toast.success("Asset unapproved and allocation list updated!");
          // Trigger earnings widget refresh for unapproval
          window.dispatchEvent(new CustomEvent("allocationListUnapproved"));
        } else {
          toast.success(
            `Status updated to ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS]?.label || newStatus}`
          );
        }
      } else {
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

  // Handle revision confirmation (client submits revision -> update status and notify)
  const handleRevisionConfirm = async () => {
    setShowRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Get the next available revision number to avoid duplicates
      const { data: existingRevisions } = await supabase
        .from("revision_history")
        .select("revision_number")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false })
        .limit(1);

      const nextRevisionNumber =
        existingRevisions && existingRevisions.length > 0
          ? existingRevisions[0].revision_number + 1
          : 1;

      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: nextRevisionNumber,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        // If it's a duplicate key error, check if this revision already exists
        if (historyError.code === "23505") {
          // This is fine, the revision was already saved
        } else {
          console.error("Error saving revision history:", historyError);
          toast.error("Failed to save revision");
          return;
        }
      }

      // Update the asset's revision_count in the database immediately
      const { error: assetUpdateError } = await supabase
        .from("onboarding_assets")
        .update({ revision_count: nextRevisionNumber })
        .eq("id", assetId);

      if (assetUpdateError) {
        console.error("Error updating asset revision count:", assetUpdateError);
      }

      // Update local state immediately
      setRevisionCount(nextRevisionNumber);
      setAsset((prev) =>
        prev
          ? { ...prev, revision_count: nextRevisionNumber, status: "revisions" }
          : null
      );

      // Send admin warning on third revision
      try {
        if (nextRevisionNumber === 3 && asset) {
          await notificationService.sendThirdRevisionWarningToAdmins(
            assetId,
            asset.product_name,
            (asset as any).client,
            nextRevisionNumber
          );
        }
      } catch (warnErr) {
        console.error("Failed to notify admins for third revision:", warnErr);
      }

      // Send admin warning on third revision
      try {
        if (nextRevisionNumber === 3 && asset) {
          await notificationService.sendThirdRevisionWarningToAdmins(
            assetId,
            asset.product_name,
            (asset as any).client,
            nextRevisionNumber
          );
        }
      } catch (warnErr) {
        console.error("Failed to notify admins for third revision:", warnErr);
      }

      // Now update the asset status to revisions with the correct revision number

      try {
        await updateAssetStatusWithRevision("revisions", nextRevisionNumber);

        toast.success("Revision submitted. Awaiting production review.");
      } catch (statusError) {
        console.error("Error updating status:", statusError);
        toast.error("Revision saved but failed to update status");
      }
      await fetchRevisionHistory();
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle second revision confirmation (no status change or notify)
  const handleSecondRevisionConfirm = async () => {
    setShowSecondRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Get the next available revision number to avoid duplicates
      const { data: existingRevisions } = await supabase
        .from("revision_history")
        .select("revision_number")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false })
        .limit(1);

      const nextRevisionNumber =
        existingRevisions && existingRevisions.length > 0
          ? existingRevisions[0].revision_number + 1
          : 1;

      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: nextRevisionNumber,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        // If it's a duplicate key error, check if this revision already exists
        if (historyError.code === "23505") {
          // This is fine, the revision was already saved
        } else {
          console.error("Error saving revision history:", historyError);
          toast.error("Failed to save revision");
          return;
        }
      }

      // Update the asset's revision_count in the database immediately
      const { error: assetUpdateError } = await supabase
        .from("onboarding_assets")
        .update({ revision_count: nextRevisionNumber })
        .eq("id", assetId);

      if (assetUpdateError) {
        console.error("Error updating asset revision count:", assetUpdateError);
      }

      // Update local state immediately
      setRevisionCount(nextRevisionNumber);
      setAsset((prev) =>
        prev
          ? { ...prev, revision_count: nextRevisionNumber, status: "revisions" }
          : null
      );

      // Now update the asset status to revisions with the correct revision number

      try {
        await updateAssetStatusWithRevision("revisions", nextRevisionNumber);

        toast.success("Revision submitted. Awaiting production review.");
      } catch (statusError) {
        console.error("Error updating status:", statusError);
        toast.error("Revision saved but failed to update status");
      }
      await fetchRevisionHistory();
    } catch (error) {
      console.error("Error updating asset status:", error);
      toast.error("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle additional revision confirmation (3rd and beyond) — no status change/notify
  const handleAdditionalRevisionConfirm = async () => {
    setShowSecondRevisionDialog(false);
    setStatusUpdating(true);

    try {
      // Get the next available revision number to avoid duplicates
      const { data: existingRevisions } = await supabase
        .from("revision_history")
        .select("revision_number")
        .eq("asset_id", assetId)
        .order("revision_number", { ascending: false })
        .limit(1);

      const nextRevisionNumber =
        existingRevisions && existingRevisions.length > 0
          ? existingRevisions[0].revision_number + 1
          : 1;

      // Save current annotations and comments to history
      const historyData = {
        asset_id: assetId,
        revision_number: nextRevisionNumber,
        annotations: annotations,
        comments: comments,
        created_at: new Date().toISOString(),
        created_by: user?.id || "unknown",
      };

      const { error: historyError } = await supabase
        .from("revision_history")
        .insert(historyData);

      if (historyError) {
        // If it's a duplicate key error, check if this revision already exists
        if (historyError.code === "23505") {
          // This is fine, the revision was already saved
        } else {
          console.error("Error saving revision history:", historyError);
          toast.error("Failed to save revision");
          return;
        }
      }

      // Update the asset's revision_count in the database immediately
      const { error: assetUpdateError } = await supabase
        .from("onboarding_assets")
        .update({ revision_count: nextRevisionNumber })
        .eq("id", assetId);

      if (assetUpdateError) {
        console.error("Error updating asset revision count:", assetUpdateError);
      }

      // Update local state immediately
      setRevisionCount(nextRevisionNumber);
      setAsset((prev) =>
        prev
          ? { ...prev, revision_count: nextRevisionNumber, status: "revisions" }
          : null
      );

      // Now update the asset status to revisions with the correct revision number

      try {
        await updateAssetStatusWithRevision("revisions", nextRevisionNumber);

        toast.success("Revision submitted. Awaiting production review.");
      } catch (statusError) {
        console.error("Error updating status:", statusError);
        toast.error("Revision saved but failed to update status");
      }
      await fetchRevisionHistory();
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
    if (revisionHistory.length === 0) return 0;

    const itemDate = new Date(createdAt);

    // Items created before the first revision are from revision 0 (original)
    const firstRevisionDate = new Date(revisionHistory[0].created_at);
    if (itemDate < firstRevisionDate) {
      return 0;
    }

    // Find which revision this item belongs to
    // An item belongs to revision N if it was created after revision N-1 and before revision N+1
    for (let i = 0; i < revisionHistory.length; i++) {
      const currentRevisionDate = new Date(revisionHistory[i].created_at);
      const nextRevisionDate =
        i < revisionHistory.length - 1
          ? new Date(revisionHistory[i + 1].created_at)
          : new Date(Date.now() + 86400000); // Far future date for latest revision

      if (itemDate >= currentRevisionDate && itemDate < nextRevisionDate) {
        return revisionHistory[i].revision_number;
      }
    }

    // If item was created after all revisions, it belongs to the latest revision
    return revisionHistory[revisionHistory.length - 1].revision_number;
  };

  // Function to open revision details dialog
  const openRevisionDetails = (revision: any) => {
    setSelectedRevision(revision);
    setShowRevisionDetailsDialog(true);
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

  // Function to get annotation number color based on index
  const getAnnotationNumberColor = (index: number) => {
    const colors = [
      "bg-amber-500", // 1 - warm yellow
      "bg-red-500", // 2 - vibrant red
      "bg-purple-500", // 3 - rich purple
      "bg-cyan-500", // 4 - bright cyan
      "bg-emerald-500", // 5 - fresh green
      "bg-orange-500", // 6 - energetic orange
      "bg-pink-500", // 7 - vibrant pink
      "bg-blue-500", // 8 - classic blue
      "bg-lime-500", // 9 - bright lime
      "bg-violet-500", // 10 - deep violet
      "bg-rose-500", // 11 - bright rose
      "bg-green-500", // 12 - vibrant green
      "bg-yellow-500", // 13 - golden yellow
      "bg-teal-500", // 14 - ocean teal
      "bg-orange-500", // 15 - sunset orange
      "bg-violet-500", // 16 - royal violet
      "bg-sky-500", // 17 - sky blue
      "bg-pink-500", // 18 - hot pink
      "bg-lime-500", // 19 - neon lime
      "bg-purple-500", // 20 - deep purple
    ];
    return colors[index % colors.length];
  };

  // Permissions: Admins can edit/delete all annotations and comments, users can edit/delete their own annotations
  const isAdmin = user?.metadata?.role === "admin";
  const canEditOrDeleteAnnotation = (annotation: Annotation) =>
    isAdmin || annotation.created_by === user?.id;
  const canEditOrDeleteComment = () => isAdmin;

  // Function to get comments for selected annotation
  // Comments should be independent of annotations - show all comments for the asset
  const getAllComments = () => {
    return comments;
  };

  // Filter annotations and comments for a specific revision
  const getRevisionItems = (revisionNumber: number) => {
    if (revisionNumber === 0) {
      // For revision 0 (original), get items created before the first revision was requested
      if (revisionHistory.length === 0) {
        // If no revisions exist, all items belong to revision 0
        return { annotations, comments };
      }

      const firstRevisionDate = new Date(revisionHistory[0].created_at);

      const revisionAnnotations = annotations.filter(
        (annotation) => new Date(annotation.created_at) < firstRevisionDate
      );

      const revisionComments = comments.filter(
        (comment) => new Date(comment.created_at) < firstRevisionDate
      );

      return { annotations: revisionAnnotations, comments: revisionComments };
    } else {
      // For revision N, get items created after revision N-1 and before revision N+1
      const currentRevision = revisionHistory.find(
        (r) => r.revision_number === revisionNumber
      );

      if (!currentRevision) return { annotations: [], comments: [] };

      const currentRevisionDate = new Date(currentRevision.created_at);

      // Find the next revision date (or use far future date for latest revision)
      const nextRevision = revisionHistory.find(
        (r) => r.revision_number === revisionNumber + 1
      );
      const nextRevisionDate = nextRevision
        ? new Date(nextRevision.created_at)
        : new Date(Date.now() + 86400000); // Far future date

      const revisionAnnotations = annotations.filter((annotation) => {
        const annotationDate = new Date(annotation.created_at);
        return (
          annotationDate >= currentRevisionDate &&
          annotationDate < nextRevisionDate
        );
      });

      const revisionComments = comments.filter((comment) => {
        const commentDate = new Date(comment.created_at);
        return (
          commentDate >= currentRevisionDate && commentDate < nextRevisionDate
        );
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
    if (!canEditOrDeleteComment()) {
      toast.error("You can only edit your own comments");
      return;
    }
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
      const target = comments.find((c) => c.id === commentId);
      if (!isAdmin && target && target.created_by !== user?.id) {
        toast.error("You can only edit your own comments");
        return;
      }
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
      const target = comments.find((c) => c.id === commentId);
      if (!isAdmin && target && target.created_by !== user?.id) {
        toast.error("You can only delete your own comments");
        return;
      }
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

  // Submit a reply for either an annotation or a comment
  const submitReply = async () => {
    if (!replyingTo || !replyText.trim() || !assetId || !user) return;
    setReplySubmitting(true);
    try {
      if (replyingTo.type === "annotation") {
        const parent = annotations.find((a) => a.id === replyingTo.id);
        if (!parent) return;
        const response = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: assetId,
            parent_id: replyingTo.id,
            comment: replyText.trim(),
            position: parent.position,
            normal: parent.normal,
            surface: parent.surface || null,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to add reply");
        // Append reply to annotations list
        setAnnotations((prev) => [data.annotation, ...prev]);
        // Notify parent author if different
        if (parent.created_by && parent.created_by !== user.id) {
          try {
            const { data: parentProfile } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("id", parent.created_by)
              .single();
            if (parentProfile?.id) {
              await notificationService.sendAnnotationReplyNotification({
                recipientId: parentProfile.id,
                recipientEmail: parentProfile.email || "",
                assetId: assetId,
                parentAnnotationId: replyingTo.id,
                replyPreview: replyText.trim(),
              });
            }
          } catch {}
        }
      } else {
        // Comment reply: insert a new comment with parent_id
        const { data, error } = await supabase
          .from("asset_comments")
          .insert({
            asset_id: assetId,
            comment: replyText.trim(),
            parent_id: replyingTo.id,
            created_by: user.id,
          })
          .select(`*, profiles:created_by (title, role, email)`)
          .single();
        if (error) throw error;
        setComments((prev) => [data, ...prev]);
        // Fetch parent comment author and notify
        try {
          const { data: parentComment } = await supabase
            .from("asset_comments")
            .select("created_by")
            .eq("id", replyingTo.id)
            .single();
          const parentAuthor = parentComment?.created_by;
          if (parentAuthor && parentAuthor !== user.id) {
            const { data: parentProfile } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("id", parentAuthor)
              .single();
            if (parentProfile?.id) {
              await notificationService.sendCommentReplyNotification({
                recipientId: parentProfile.id,
                recipientEmail: parentProfile.email || "",
                assetId: assetId,
                parentCommentId: replyingTo.id,
                replyPreview: replyText.trim(),
              });
            }
          }
        } catch {}
      }
      setReplyText("");
      setReplyingTo(null);
      toast.success("Reply posted");
    } catch (e: any) {
      console.error("Failed to post reply:", e);
      toast.error(e?.message || "Failed to post reply");
    } finally {
      setReplySubmitting(false);
    }
  };

  // Build a parent->children map for comments and annotations
  const groupByParent = <T extends { id: string; parent_id?: string | null }>(
    items: T[]
  ) => {
    const map: Record<string, T[]> = {};
    for (const item of items) {
      if (item.parent_id) {
        if (!map[item.parent_id]) map[item.parent_id] = [];
        map[item.parent_id].push(item);
      }
    }
    return map;
  };
  const annotationRepliesMap = groupByParent(annotations as any);
  const commentRepliesMap = groupByParent(comments as any);

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
                      variant="outline"
                      className={`text-xs font-medium ${
                        getStatusDisplay(asset?.status, user?.metadata?.role)
                          .className
                      }`}
                    >
                      {
                        getStatusDisplay(asset?.status, user?.metadata?.role)
                          .label
                      }
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
              src="/model-viewer.js"
              onLoad={() => {}}
              onError={(e) =>
                console.error("❌ Model-viewer script failed to load:", e)
              }
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
                            <div className="hotspot-pulse"></div>
                          </div>

                          {hotspot.comment && hotspot.comment.trim() && (
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
                                    opacity: isFunctionalityDisabled()
                                      ? 0.5
                                      : 1,
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

            {/* Dimensions Toggle Button */}
            {asset.glb_link && (
              <div className="absolute top-4 right-0 z-20 w-fit min-w-[200px] flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = asset.glb_link as string;
                    a.download = `${asset.product_name}_${asset.article_id}.glb`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="bg-background/95 backdrop-blur-sm border-border/50 shadow-md cursor-pointer"
                  title="Download GLB"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download GLB
                </Button>
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
            </div>

            {/* Asset Status Section - Always Visible */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-semibold">
                  Asset Status
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      getStatusDisplay(asset?.status, user?.metadata?.role)
                        .className
                    }`}
                  >
                    {
                      getStatusDisplay(asset?.status, user?.metadata?.role)
                        .label
                    }
                  </Badge>
                  {revisionCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Revision {revisionCount}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {user?.metadata?.role === "client" && (
                  <Button
                    onClick={() => updateAssetStatus("approved_by_client")}
                    disabled={
                      asset?.status === "approved_by_client" || statusUpdating
                    }
                    variant={
                      asset?.status === "approved_by_client"
                        ? "default"
                        : "outline"
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
                )}

                {(user?.metadata?.role === "admin" ||
                  user?.metadata?.role === "qa") && (
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
                    Approve (Internal)
                  </Button>
                )}
                {(user?.metadata?.role === "admin" ||
                  user?.metadata?.role === "qa") &&
                  asset?.status === "revisions" && (
                    <Button
                      onClick={() => updateAssetStatus("in_production")}
                      disabled={statusUpdating}
                      variant="outline"
                      size="sm"
                      className="flex-1 cursor-pointer"
                    >
                      {statusUpdating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Set In Progress
                    </Button>
                  )}
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
                  Ready for Revision {revisionCount > 0 && `(${revisionCount})`}
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
                                          <span className="break-words whitespace-pre-wrap">
                                            {annotation.comment?.length > 100
                                              ? `${annotation.comment.substring(0, 100)}...`
                                              : annotation.comment}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  {revisionAnnotations.length > 3 && (
                                    <div className="text-xs text-muted-foreground text-center py-1">
                                      +{revisionAnnotations.length - 3} more
                                      annotations
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          openRevisionDetails(revision)
                                        }
                                        className="ml-2 text-xs text-primary hover:text-primary/80 cursor-pointer"
                                      >
                                        View All
                                      </Button>
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
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          openRevisionDetails(revision)
                                        }
                                        className="ml-2 text-xs text-primary hover:text-primary/80 cursor-pointer"
                                      >
                                        View All
                                      </Button>
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
                </div>

                {/* Carousel of Thumbnails */}

                {/* Large Selected Image - Show selected image */}
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
                        src={referenceImages[selectedReferenceIndex || 0]}
                        alt={`Reference ${(selectedReferenceIndex || 0) + 1}`}
                        className="w-full h-full object-contain transition-transform duration-200"
                        style={{
                          transform: `scale(${zoomLevel})`,
                          transformOrigin: isZooming
                            ? `${mousePosition.x}% ${mousePosition.y}%`
                            : "center",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            "none";
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
                            referenceImages[selectedReferenceIndex || 0],
                            `Reference Image ${(selectedReferenceIndex || 0) + 1}`
                          )
                        }
                        className="h-10 w-10 p-0 bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground text-center">
                      Reference {(selectedReferenceIndex || 0) + 1} • Scroll to
                      zoom (1x-3x)
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
                            {Math.min(
                              carouselIndex + 4,
                              referenceImages.length
                            )}{" "}
                            of {referenceImages.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Carousel Container */}
                    <div className="relative">
                      {/* Thumbnails Container */}
                      <div className="flex gap-3 overflow-x-auto p-1 scrollbar-hide relative">
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
                                className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  (
                                    e.currentTarget as HTMLElement
                                  ).style.display = "none";
                                }}
                              />
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center shadow-sm border-2 border-background">
                              {index + 1}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();

                                try {
                                  // Remove the image from the array
                                  const newImages = referenceImages.filter(
                                    (_, i) => i !== index
                                  );

                                  // Update the asset in the database
                                  const { error } = await supabase
                                    .from("onboarding_assets")
                                    .update({ reference: newImages })
                                    .eq("id", assetId);

                                  if (error) {
                                    console.error(
                                      "Error updating reference images:",
                                      error
                                    );
                                    toast.error(
                                      "Failed to delete reference image"
                                    );
                                    return;
                                  }

                                  // Update local state
                                  setReferenceImages(newImages);

                                  // Adjust selected index if needed
                                  if (selectedReferenceIndex === index) {
                                    setSelectedReferenceIndex(
                                      newImages.length > 0 ? 0 : null
                                    );
                                  } else if (
                                    selectedReferenceIndex &&
                                    selectedReferenceIndex > index
                                  ) {
                                    setSelectedReferenceIndex(
                                      selectedReferenceIndex - 1
                                    );
                                  }

                                  toast.success(
                                    "Reference image deleted successfully"
                                  );
                                } catch (error) {
                                  console.error(
                                    "Error deleting reference image:",
                                    error
                                  );
                                  toast.error(
                                    "Failed to delete reference image"
                                  );
                                }
                              }}
                              className="absolute -top-1 -left-1 h-5 w-5 p-0 text-black/60 hover:text-black/80 hover:bg-black/5 rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Scroll Hint */}
                      {referenceImages.length > 4 && (
                        <div className="flex justify-center mt-3">
                          <p className="text-xs text-muted-foreground">
                            Shift to scroll
                          </p>
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
              </div>
            )}

            {/* Feedback Tab */}
            {rightPanelTab === "feedback" && (
              <div className="flex-1 overflow-y-auto">
                {/* Sticky Header with controls */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 pb-4">
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <h4 className="text-muted-foreground font-semibold">
                          Feedback
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

                    {isFunctionalityDisabled() && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950/20 dark:border-yellow-800/30 mb-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            Annotations and comments are disabled - Asset is in
                            revision mode
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Add New Comment */}
                    <div className="space-y-3">
                      <Textarea
                        placeholder={
                          isFunctionalityDisabled()
                            ? "Comments disabled during revision"
                            : selectedHotspotId
                              ? `Add a comment about annotation ${annotations.findIndex((a) => a.id === selectedHotspotId) + 1}...`
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

                    {/* Multi-Delete Actions */}
                    {deleteMode && selectedAnnotations.length > 0 && (
                      <div className="bg-red-50/50 border border-red-200/50 rounded-xl p-4 mt-4 dark:bg-red-950/10 dark:border-red-800/30">
                        <div className="flex items-center justify-between gap-4">
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
                </div>

                {/* Scrollable Content - Combined Feed */}
                <div className="p-2">
                  <div className="space-y-4">
                    {[
                      ...annotations
                        .filter((a: any) => !a.parent_id)
                        .map((a) => ({
                          ...a,
                          type: "annotation" as const,
                        })),
                      ...getAllComments()
                        .filter((c: any) => !c.parent_id)
                        .map((c) => ({
                          ...c,
                          type: "comment" as const,
                        })),
                    ]
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime()
                      )
                      .map((item) =>
                        item.type === "annotation" ? (
                          <Card
                            key={`annotation-${item.id}`}
                            className={`p-6 transition-all duration-200 rounded-xl border border-border/50 ${
                              selectedHotspotId === item.id
                                ? "ring-2 ring-primary/15 ring-offset-2 bg-primary/3 shadow-lg"
                                : deleteMode &&
                                    selectedAnnotations.includes(item.id)
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
                                      item.id
                                    )}
                                    onChange={() =>
                                      handleAnnotationSelect(item.id)
                                    }
                                    className="h-4 w-4 text-red-600 border-border rounded focus:ring-red-500 cursor-pointer dark:text-red-400 dark:focus:ring-red-400"
                                  />
                                )}
                                <div className="relative">
                                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <MessageCircle className="h-4 w-4 text-primary" />
                                  </div>
                                  {/* Annotation Number Badge */}
                                  <div
                                    className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAnnotationNumberColor(annotations.findIndex((a) => a.id === item.id))}`}
                                  >
                                    {annotations.findIndex(
                                      (a) => a.id === item.id
                                    ) + 1}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {item.profiles?.email || "Unknown"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs px-2 py-0.5 w-fit ${getRevisionBadgeColors(getRevisionForItem(item.created_at))}`}
                                    >
                                      R{getRevisionForItem(item.created_at)}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Annotation
                                    </Badge>
                                  </div>
                                  {item.profiles?.title && (
                                    <Badge
                                      variant={
                                        getTitleBadgeVariant(
                                          item.profiles.title
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
                                      {item.profiles.title}
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
                                <DropdownMenuContent
                                  align="end"
                                  className="w-40"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      handleHotspotSelect(item.id);
                                    }}
                                  >
                                    <Eye className="h-3 w-3 mr-2" />
                                    Focus on Hotspot
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!canEditOrDeleteAnnotation(item)) {
                                        toast.error(
                                          "You can only edit your own annotations"
                                        );
                                        return;
                                      }
                                      setEditingAnnotation(item.id);
                                      setEditComment(item.comment);
                                      setEditImageUrl(item.image_url || "");
                                    }}
                                    disabled={
                                      isFunctionalityDisabled() ||
                                      !canEditOrDeleteAnnotation(item)
                                    }
                                    className={`${isFunctionalityDisabled() || !canEditOrDeleteAnnotation(item) ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                    <Edit3 className="h-3 w-3 mr-2" />
                                    Edit Annotation
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {!deleteMode && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        canEditOrDeleteAnnotation(item)
                                          ? confirmDeleteAnnotation(item.id)
                                          : toast.error(
                                              "You can only delete your own annotations"
                                            )
                                      }
                                      disabled={
                                        !canEditOrDeleteAnnotation(item)
                                      }
                                      className={`${!canEditOrDeleteAnnotation(item) ? "opacity-50 cursor-not-allowed" : "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"}`}
                                    >
                                      <X className="h-3 w-3 mr-2" />
                                      Delete Annotation
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {editingAnnotation === item.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editComment}
                                  onChange={(e) =>
                                    setEditComment(e.target.value)
                                  }
                                  rows={3}
                                />
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
                                              const data =
                                                await response.json();
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
                                              console.error(
                                                "Upload error:",
                                                error
                                              );
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
                                        className="w-full h-full object-contain"
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
                                    onClick={() => updateAnnotation(item.id)}
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
                                {inlineEditingId === item.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={inlineEditComment}
                                      onChange={(e) =>
                                        setInlineEditComment(e.target.value)
                                      }
                                      onKeyDown={(e) =>
                                        handleInlineEditKeyDown(e, item.id)
                                      }
                                      onBlur={() => {
                                        if (!isSwitchingEdit) {
                                          submitInlineEdit(item.id);
                                        }
                                      }}
                                      className="min-h-[80px] border-border focus:border-primary focus:ring-primary resize-none"
                                      rows={3}
                                      autoFocus
                                      placeholder="Edit annotation..."
                                    />
                                    <div className="flex gap-2 text-xs text-muted-foreground">
                                      <span>
                                        Press Enter to save, Escape to cancel
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={`text-sm text-foreground p-2 rounded-md transition-colors -m-2 group relative ${isFunctionalityDisabled() ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}
                                    onClick={() => {
                                      if (!isFunctionalityDisabled()) {
                                        startInlineEdit(item as any);
                                      }
                                    }}
                                    title={
                                      isFunctionalityDisabled()
                                        ? "Editing disabled during revision"
                                        : "Click to edit annotation"
                                    }
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 break-words w-full">
                                        <div className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                                          {linkifyText((item as any).comment)}
                                        </div>
                                      </div>
                                      <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0 mt-0.5" />
                                    </div>
                                    {/* Moved image preview above replies to keep it visible */}
                                    {item.image_url && (
                                      <div className="mt-4">
                                        <div
                                          className="relative w-full h-48 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() =>
                                            handleImageClick(
                                              item.image_url!,
                                              "Annotation Image"
                                            )
                                          }
                                        >
                                          <Image
                                            width={320}
                                            height={192}
                                            unoptimized
                                            src={item.image_url}
                                            alt="Annotation reference"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                              (
                                                e.currentTarget as HTMLElement
                                              ).style.display = "none";
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
                                    {/* Reply actions */}
                                    <div className="mt-2 flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReplyingTo({
                                            type: "annotation",
                                            id: item.id,
                                          });
                                        }}
                                      >
                                        Reply
                                      </Button>
                                    </div>
                                    {replyingTo?.type === "annotation" &&
                                      replyingTo.id === item.id && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <Input
                                            placeholder="Write a reply..."
                                            value={replyText}
                                            onChange={(e) =>
                                              setReplyText(e.target.value)
                                            }
                                            className="flex-1"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <Button
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              submitReply();
                                            }}
                                            disabled={
                                              !replyText.trim() ||
                                              replySubmitting
                                            }
                                            className="cursor-pointer"
                                          >
                                            {replySubmitting
                                              ? "Sending..."
                                              : "Send"}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReplyingTo(null);
                                              setReplyText("");
                                            }}
                                            className="cursor-pointer"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      )}
                                    {/* Render replies */}
                                    {annotationRepliesMap[item.id]?.length >
                                      0 && (
                                      <div className="mt-3 pl-4 border-l border-border space-y-2">
                                        {annotationRepliesMap[item.id]
                                          .sort(
                                            (a: any, b: any) =>
                                              new Date(b.created_at).getTime() -
                                              new Date(a.created_at).getTime()
                                          )
                                          .map((reply: any) => (
                                            <div
                                              key={reply.id}
                                              className="text-sm text-foreground"
                                            >
                                              <div className="text-xs text-muted-foreground mb-1">
                                                {reply.profiles?.email ||
                                                  "Unknown"}{" "}
                                                •{" "}
                                                {new Date(
                                                  reply.created_at
                                                ).toLocaleString()}
                                              </div>
                                              <div className="whitespace-pre-wrap">
                                                {linkifyText(reply.comment)}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="mt-4 flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(
                                      item.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    •
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(
                                      item.created_at
                                    ).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  {replyingTo?.type === "comment" &&
                                    replyingTo.id === item.id && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <Input
                                          placeholder="Write a reply..."
                                          value={replyText}
                                          onChange={(e) =>
                                            setReplyText(e.target.value)
                                          }
                                          className="flex-1"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={submitReply}
                                          disabled={
                                            !replyText.trim() || replySubmitting
                                          }
                                          className="cursor-pointer"
                                        >
                                          {replySubmitting
                                            ? "Sending..."
                                            : "Send"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setReplyingTo(null);
                                            setReplyText("");
                                          }}
                                          className="cursor-pointer"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    )}
                                  {commentRepliesMap[item.id]?.length > 0 && (
                                    <div className="mt-3 pl-4 border-l border-border space-y-2">
                                      {commentRepliesMap[item.id]
                                        .sort(
                                          (a: any, b: any) =>
                                            new Date(b.created_at).getTime() -
                                            new Date(a.created_at).getTime()
                                        )
                                        .map((reply: any) => (
                                          <div
                                            key={reply.id}
                                            className="text-sm text-foreground"
                                          >
                                            <div className="text-xs text-muted-foreground mb-1">
                                              {reply.profiles?.email ||
                                                "Unknown"}{" "}
                                              •{" "}
                                              {new Date(
                                                reply.created_at
                                              ).toLocaleString()}
                                            </div>
                                            <div className="whitespace-pre-wrap">
                                              {linkifyText(reply.comment)}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Card>
                        ) : (
                          <Card
                            key={`comment-${item.id}`}
                            className="p-6 transition-all duration-200 rounded-xl border border-border/50 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {item.profiles?.email || "Unknown"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs px-2 py-0.5 w-fit ${getRevisionBadgeColors(getRevisionForItem(item.created_at))}`}
                                    >
                                      R{getRevisionForItem(item.created_at)}
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Comment
                                    </Badge>
                                  </div>
                                  {item.profiles?.title && (
                                    <Badge
                                      variant={
                                        getTitleBadgeVariant(
                                          item.profiles.title
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
                                      {item.profiles.title}
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
                                <DropdownMenuContent
                                  align="end"
                                  className="w-40"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!canEditOrDeleteComment()) {
                                        toast.error(
                                          "You can only edit your own comments"
                                        );
                                        return;
                                      }
                                      startCommentInlineEdit(item as any);
                                    }}
                                    disabled={
                                      isFunctionalityDisabled() ||
                                      !canEditOrDeleteComment()
                                    }
                                    className={`${isFunctionalityDisabled() || !canEditOrDeleteComment() ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                    <Edit3 className="h-3 w-3 mr-2" />
                                    Edit Comment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      canEditOrDeleteComment()
                                        ? deleteComment(item.id)
                                        : toast.error(
                                            "You can only delete your own comments"
                                          )
                                    }
                                    disabled={!canEditOrDeleteComment()}
                                    className={`${!canEditOrDeleteComment() ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
                                  >
                                    <X className="h-3 w-3 mr-2" />
                                    Delete Comment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {inlineEditingCommentId === item.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={inlineEditCommentText}
                                  onChange={(e) =>
                                    setInlineEditCommentText(e.target.value)
                                  }
                                  onKeyDown={(e) =>
                                    handleCommentInlineEditKeyDown(e, item.id)
                                  }
                                  onBlur={() => {
                                    submitCommentInlineEdit(item.id);
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
                                className={`text-sm text-foreground p-2 rounded-md transition-colors -m-2 group relative ${isFunctionalityDisabled() ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}
                                onClick={() => {
                                  if (
                                    !isFunctionalityDisabled() &&
                                    canEditOrDeleteComment()
                                  ) {
                                    startCommentInlineEdit(item as any);
                                  }
                                }}
                                title={
                                  isFunctionalityDisabled()
                                    ? "Editing disabled during revision"
                                    : canEditOrDeleteComment()
                                      ? "Click to edit comment"
                                      : "You can only edit your own comments"
                                }
                              >
                                <div className="flex items-start justify-between min-w-0">
                                  <div className="flex-1 break-words w-full overflow-hidden">
                                    <div className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                                      {linkifyText((item as any).comment)}
                                    </div>
                                  </div>
                                  <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0 mt-0.5" />
                                </div>
                              </div>
                            )}
                            <div className="mt-4 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                •
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            {/* Reply actions for comments */}
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs cursor-pointer"
                                onClick={() =>
                                  setReplyingTo({
                                    type: "comment",
                                    id: item.id,
                                  })
                                }
                              >
                                Reply
                              </Button>
                              {replyingTo?.type === "comment" &&
                                replyingTo.id === item.id && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Input
                                      placeholder="Write a reply..."
                                      value={replyText}
                                      onChange={(e) =>
                                        setReplyText(e.target.value)
                                      }
                                      className="flex-1"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={submitReply}
                                      disabled={
                                        !replyText.trim() || replySubmitting
                                      }
                                      className="cursor-pointer"
                                    >
                                      {replySubmitting ? "Sending..." : "Send"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyText("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              {commentRepliesMap[item.id]?.length > 0 && (
                                <div className="mt-3 pl-4 border-l border-border space-y-2">
                                  {commentRepliesMap[item.id]
                                    .sort(
                                      (a: any, b: any) =>
                                        new Date(b.created_at).getTime() -
                                        new Date(a.created_at).getTime()
                                    )
                                    .map((reply: any) => (
                                      <div
                                        key={reply.id}
                                        className="text-sm text-foreground"
                                      >
                                        <div className="text-xs text-muted-foreground mb-1">
                                          {reply.profiles?.email || "Unknown"} •{" "}
                                          {new Date(
                                            reply.created_at
                                          ).toLocaleString()}
                                        </div>
                                        <div className="whitespace-pre-wrap">
                                          {linkifyText(reply.comment)}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </Card>
                        )
                      )}

                    {annotations.length + getAllComments().length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <MessageCircle className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          No feedback yet
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Start by adding an annotation or a comment
                        </p>
                      </div>
                    )}
                  </div>
                </div>
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
                    onPaste={handlePasteImage}
                    className="min-h-[100px] border-border focus:border-primary focus:ring-primary"
                    rows={4}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Tip: Paste screenshots directly to comments (Win+Shift+S →
                    Ctrl+V)
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">
                    Reference Image (optional)
                  </label>
                  {isUploadingPastedImage && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading pasted image...
                    </div>
                  )}
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
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
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
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            "none";
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
                      .nextElementSibling as HTMLElement)!.style.display =
                      "flex";
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
                  Enter the URL of an image you want to add as a reference
                  image.
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
          <Dialog
            open={showRevisionDialog}
            onOpenChange={setShowRevisionDialog}
          >
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

          {/* Additional Ready for Revision Dialog (client-only warning) */}
          {user?.metadata?.role === "client" && (
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
                          Additional revisions may incur costs if the changes
                          are client requests and not due to modeling errors.
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
                        • This is revision #{revisionCount + 1} - fees will
                        likely apply
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
          )}

          {/* Revision Details Dialog */}
          <Dialog
            open={showRevisionDetailsDialog}
            onOpenChange={setShowRevisionDetailsDialog}
          >
            <DialogContent className="sm:max-w-[800px] h-fit min-h-[500px] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Revision {selectedRevision?.revision_number} Details
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selectedRevision &&
                    new Date(selectedRevision.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              {selectedRevision && (
                <div className="space-y-6">
                  {/* Annotations Section */}
                  {(() => {
                    const revisionAnnotations = getRevisionItems(
                      selectedRevision.revision_number
                    ).annotations;
                    return revisionAnnotations.length > 0 ? (
                      <div>
                        <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2 ">
                          <MessageCircle className="h-5 w-5" />
                          Annotations ({revisionAnnotations.length})
                        </h4>
                        <div className="space-y-3 min-h-[300px] max-h-[600px] overflow-y-auto">
                          {revisionAnnotations.map(
                            (annotation: any, index: number) => (
                              <Card
                                key={annotation.id || index}
                                className="p-4"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                      <MessageCircle className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-foreground">
                                        {annotation.profiles?.email ||
                                          "Unknown"}
                                      </div>
                                      {annotation.profiles?.title && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs mt-1"
                                        >
                                          {annotation.profiles.title}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(
                                      annotation.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="text-sm text-foreground">
                                  <span className="break-words whitespace-pre-wrap">
                                    {linkifyText(annotation.comment)}
                                  </span>
                                </div>
                                {annotation.image_url && (
                                  <div className="mt-3">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">
                                      Reference Image:
                                    </div>
                                    <div className="relative w-full h-32 border rounded overflow-hidden">
                                      <Image
                                        width={320}
                                        height={128}
                                        unoptimized
                                        src={annotation.image_url}
                                        alt="Reference"
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          (
                                            e.currentTarget as HTMLElement
                                          ).style.display = "none";
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </Card>
                            )
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Comments Section */}
                  {(() => {
                    const revisionComments = getRevisionItems(
                      selectedRevision.revision_number
                    ).comments;
                    return revisionComments.length > 0 ? (
                      <div>
                        <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          Comments ({revisionComments.length})
                        </h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {revisionComments.map(
                            (comment: any, index: number) => (
                              <Card key={comment.id || index} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-foreground">
                                        {comment.profiles?.email || "Unknown"}
                                      </div>
                                      {comment.profiles?.title && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs mt-1"
                                        >
                                          {comment.profiles.title}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(
                                      comment.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="text-sm text-foreground break-words overflow-hidden">
                                  <div className="whitespace-pre-wrap text-sm text-foreground font-normal font-sans">
                                    {linkifyText(comment.comment)}
                                  </div>
                                </div>
                              </Card>
                            )
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowRevisionDetailsDialog(false)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
