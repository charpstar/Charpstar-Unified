"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
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
  Camera,
  MessageSquare,
  CheckCircle,
  Loader2,
  Download,
  Maximize2,
  AlertTriangle,
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
  parent_id?: string;
}

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  comment: string;
  image_url?: string;
  visible: boolean;
}

// Helper function to get status label CSS class
const getStatusLabelClass = (status: string): string => {
  switch (status) {
    case "in_production":
      return "status-in-production";
    case "revisions":
      return "status-revisions";
    case "approved":
      return "status-approved";
    case "approved_by_client":
      return "status-approved-by-client";
    case "delivered_by_artist":
      return "status-delivered-by-artist";
    case "not_started":
      return "status-not-started";
    case "in_progress":
      return "status-in-progress";
    case "waiting_for_approval":
      return "status-waiting-for-approval";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

// Helper function to get status label text
const getStatusLabelText = (status: string): string => {
  switch (status) {
    case "in_production":
      return "In Production";
    case "revisions":
      return "Ready for Revision";
    case "approved":
      return "Approved";
    case "approved_by_client":
      return "Approved by Client";
    case "delivered_by_artist":
      return "Delivered by Artist";
    case "not_started":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "waiting_for_approval":
      return "Delivered by Artist";
    default:
      return status;
  }
};

// Helper function to get viewer parameters based on client viewer type
const getViewerParameters = (viewerType?: string | null) => {
  switch (viewerType) {
    case "v6_aces":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
    case "v5_tester":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/warm.hdr",
        exposure: "1.3",
        toneMapping: "commerce",
      };
    case "synsam":
      return {
        environmentImage: "https://charpstar.se/3DTester/SynsamNewHDRI.jpg",
        exposure: "1",
        toneMapping: "aces",
      };
    case "v2":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
    default:
      // Default to V6 ACES Tester
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
  }
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
  const [clientViewerType, setClientViewerType] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<"feedback" | "images">(
    "feedback"
  );
  const [statusUpdating, setStatusUpdating] = useState(false);
  // Make URLs in text clickable with blue styling
  const linkifyText = (text: string): React.ReactNode => {
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

  // Comment state variables
  const [newCommentText, setNewCommentText] = useState("");
  // Reply system state (modelers can reply but not post new comments/annotations)
  const [replyingTo, setReplyingTo] = useState<{
    type: "annotation" | "comment";
    id: string;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // GLB Upload state
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [glbHistory, setGlbHistory] = useState<any[]>([]);
  const [latestGlbTime, setLatestGlbTime] = useState<number | null>(null);
  const [latestExternalFeedbackTime, setLatestExternalFeedbackTime] = useState<
    number | null
  >(null);
  const [showStaleGlbDialog, setShowStaleGlbDialog] = useState(false);
  const [isDialogDragOver, setIsDialogDragOver] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [existingGlbNameMismatch, setExistingGlbNameMismatch] = useState<
    string | null
  >(null);
  const [selectedFileNameMismatch, setSelectedFileNameMismatch] = useState<
    string | null
  >(null);
  const [selectedFileSizeWarning, setSelectedFileSizeWarning] =
    useState<boolean>(false);
  const [showDeliverBlockDialog, setShowDeliverBlockDialog] = useState(false);
  // Components panel state
  const [dependencies, setDependencies] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const modelViewerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference image selection and zoom state
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState<
    number | null
  >(0);
  const [imageZoom, setImageZoom] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZooming, setIsZooming] = useState(false);

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

  // Image zoom handlers
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
    // Only allow zooming when Shift key is held down
    if (!e.shiftKey) return;

    e.preventDefault();
    e.stopPropagation();

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

        // Fetch client's viewer type
        try {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("viewer_type")
            .eq("name", data.client)
            .single();

          if (!clientError && clientData) {
            setClientViewerType(clientData.viewer_type);
            console.log("🎯 Client viewer type:", clientData.viewer_type);
            console.log(
              "🎯 Viewer parameters:",
              getViewerParameters(clientData.viewer_type)
            );
          } else {
            // If no client found, default to null (will use default viewer)
            setClientViewerType(null);
            console.log(
              "🎯 No client viewer type found, using default parameters"
            );
            console.log(
              "🎯 Default viewer parameters:",
              getViewerParameters(null)
            );
          }
        } catch (error) {
          console.error("Error fetching client viewer type:", error);
          setClientViewerType(null);
          console.log(
            "🎯 Error fetching viewer type, using default parameters"
          );
          console.log(
            "🎯 Default viewer parameters:",
            getViewerParameters(null)
          );
        }

        // Validate existing GLB filename against article id and set warning
        try {
          const fileName = decodeURIComponent(
            (data.glb_link || "").split("/").pop() || ""
          );
          if (fileName && data.article_id) {
            const baseName = fileName.replace(/\.(glb|gltf)$/i, "");
            const matches = baseName
              .toLowerCase()
              .startsWith(`${String(data.article_id).toLowerCase()}_`);
            setExistingGlbNameMismatch(matches ? null : fileName);
          } else {
            setExistingGlbNameMismatch(null);
          }
        } catch {
          setExistingGlbNameMismatch(null);
        }

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

  // Fetch GLB upload history
  const fetchGlbHistory = async () => {
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
      const newest = (data || [])[0]?.uploaded_at
        ? new Date((data || [])[0].uploaded_at).getTime()
        : null;
      setLatestGlbTime(newest);

      // Debug logging to help understand the data
      if (data && data.length > 0) {
      }
    } catch (error) {
      console.error("Error fetching GLB history:", error);
      setGlbHistory([]);
    }
  };

  // Clean up problematic GLB history entries
  // This function removes entries with the old naming convention (Current_ prefix)
  // and handles duplicate URLs by keeping only the most recent entry for each unique URL.
  // It's called when the component mounts to ensure a clean state.
  const cleanupGlbHistory = async () => {
    if (!assetId) return;

    try {
      // First, remove entries with the old naming convention (Current_ prefix)
      const { error: cleanupError } = await supabase
        .from("glb_upload_history")
        .delete()
        .eq("asset_id", assetId)
        .like("file_name", "Current_%");

      if (cleanupError) {
        console.error("Error cleaning up GLB history:", cleanupError);
      } else {
      }

      // Now handle potential duplicate URLs - keep only the most recent entry for each unique URL
      const { data: currentHistory, error: fetchError } = await supabase
        .from("glb_upload_history")
        .select("*")
        .eq("asset_id", assetId)
        .order("uploaded_at", { ascending: false });

      if (fetchError) {
        console.error(
          "Error fetching current history for cleanup:",
          fetchError
        );
        return;
      }

      if (currentHistory && currentHistory.length > 1) {
        // Group by glb_url and find duplicates
        const urlGroups = currentHistory.reduce(
          (groups, item) => {
            if (!groups[item.glb_url]) {
              groups[item.glb_url] = [];
            }
            groups[item.glb_url].push(item);
            return groups;
          },
          {} as Record<string, typeof currentHistory>
        );

        // For each group with duplicates, keep only the most recent
        for (const [, items] of Object.entries(urlGroups)) {
          if ((items as any[]).length > 1) {
            // Sort by uploaded_at descending and keep only the first (most recent)
            const itemsToDelete = (items as any[]).slice(1);
            const idsToDelete = itemsToDelete.map((item: any) => item.id);

            if (idsToDelete.length > 0) {
              const { error: deleteError } = await supabase
                .from("glb_upload_history")
                .delete()
                .in("id", idsToDelete);

              if (deleteError) {
                console.error(
                  "Error deleting duplicate GLB history entries:",
                  deleteError
                );
              } else {
              }
            }
          }
        }
      }

      // Refresh the history after cleanup
      await fetchGlbHistory();
    } catch (error) {
      console.error("Error during GLB history cleanup:", error);
    }
  };

  useEffect(() => {
    fetchGlbHistory();
    // Clean up any problematic entries when component mounts
    cleanupGlbHistory();
  }, [assetId]);

  // Fetch attached components (dependencies)
  const fetchDependencies = async () => {
    if (!assetId) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/dependencies`);
      const json = await res.json();
      const deps = json.dependencies || [];
      setDependencies(deps);
    } catch (e) {
      console.error("Failed to fetch dependencies", e);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, [assetId]);

  // Compute latest external feedback time (annotations/comments not by modeler)
  useEffect(() => {
    const modelerId = user?.id;
    const externalAnnotationTimes = annotations
      .filter((a: any) => a.created_by && a.created_by !== modelerId)
      .map((a) => new Date(a.created_at).getTime());
    const externalCommentTimes = comments
      .filter((c: any) => c.created_by && c.created_by !== modelerId)
      .map((c) => new Date(c.created_at).getTime());
    const latestExternal = Math.max(
      0,
      ...(externalAnnotationTimes.length ? externalAnnotationTimes : [0]),
      ...(externalCommentTimes.length ? externalCommentTimes : [0])
    );
    setLatestExternalFeedbackTime(latestExternal > 0 ? latestExternal : null);
  }, [annotations, comments, user]);

  // Check if newer versions exist for each dependency
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const updated = await Promise.all(
        dependencies.map(async (dep) => {
          const compId = dep.component_versions?.component?.id;
          const attachedCreatedAt = new Date(
            dep.component_versions?.created_at
          ).getTime();
          if (!compId) return { ...dep, updateAvailable: false };
          try {
            const res = await fetch(`/api/components/${compId}/versions`);
            const json = await res.json();
            const latest = (json.versions || [])[0];
            const latestCreatedAt = latest
              ? new Date(latest.created_at).getTime()
              : attachedCreatedAt;
            return {
              ...dep,
              latestVersion: latest,
              updateAvailable: latestCreatedAt > attachedCreatedAt,
            };
          } catch {
            return { ...dep, updateAvailable: false };
          }
        })
      );
      setDependencies(updated);
    } finally {
      setCheckingUpdates(false);
    }
  };

  // Handle hotspot selection
  const handleHotspotSelect = (hotspotId: string | null) => {
    setSelectedHotspotId(hotspotId);
    if (!hotspotId) return;

    const annotation = annotations.find((ann) => ann.id === hotspotId);
    if (!annotation) return;
    setSelectedAnnotation(annotation);

    // Move/zoom camera to the hotspot
    const mv = modelViewerRef.current as any;
    if (!mv) return;
    try {
      const [x, y, z] = annotation.position.split(" ").map(Number);
      const distance = 1.5;
      mv.cameraControls = true;
      mv.cameraTarget = `${x}m ${y}m ${z}m`;
      mv.cameraOrbit = `45deg 60deg ${distance}m`;
      mv.play?.();
    } catch (err) {
      console.warn("Failed to move camera to hotspot:", err);
    }
  };

  // Handle file selection for GLB upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Handle upload dialog close
  const handleUploadDialogClose = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      // Reset all upload-related states when dialog is closed
      setSelectedFile(null);
      setSelectedFileSizeWarning(false);
      setSelectedFileNameMismatch(null);
    }
  };

  // Validate and set file for upload
  const validateAndSetFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".glb")) {
      toast.error("File must be a .glb");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }

    // Reset previous warnings
    setSelectedFileSizeWarning(false);
    setSelectedFileNameMismatch(null);

    // Check for 25MB warning
    const isLargeFile = file.size > 25 * 1024 * 1024;
    setSelectedFileSizeWarning(isLargeFile);

    setSelectedFile(file);
    setShowUploadDialog(true);

    // Validate exact filename match: <articleId>.glb
    try {
      if (asset?.article_id) {
        const expected = `${String(asset.article_id).toLowerCase()}.glb`;
        const matches = file.name.toLowerCase() === expected;
        setSelectedFileNameMismatch(matches ? null : file.name);
      } else {
        setSelectedFileNameMismatch(null);
      }
    } catch {
      setSelectedFileNameMismatch(null);
    }
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
  // Note: We no longer save the previous GLB to history to avoid confusion.
  // Only the new GLB is saved to history, and the current version is determined
  // by matching the asset's glb_link with the history item's glb_url.
  const handleUpload = async () => {
    if (!selectedFile || !asset) return;

    setUploading(true);

    try {
      // Upload to Supabase Storage with clean filename
      const fileName = `${asset.article_id}.glb`;
      const filePath = `models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true, // Allow overwrites for same article_id
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

      // Record GLB upload history for the new file
      const { error: historyError } = await supabase
        .from("glb_upload_history")
        .insert({
          asset_id: asset.id,
          glb_url: urlData.publicUrl,
          file_name: `${asset.article_id}.glb`,
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

      // Refresh GLB history to show the new version
      await fetchGlbHistory();

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

    // Warn and block if trying to deliver without correct GLB naming
    if (newStatus === "delivered_by_artist") {
      // Block if GLB is older than latest external feedback
      try {
        if (
          latestExternalFeedbackTime &&
          latestGlbTime &&
          latestGlbTime < latestExternalFeedbackTime
        ) {
          setShowStaleGlbDialog(true);
          return;
        }
      } catch {}
      if (!asset.glb_link) {
        setShowDeliverBlockDialog(true);
        return;
      }
      try {
        const fileName = decodeURIComponent(
          (asset.glb_link || "").split("/").pop() || ""
        );
        const baseName = fileName.replace(/\.(glb|gltf)$/i, "");
        const expectedPrefix = `${String(asset.article_id).toLowerCase()}_`;
        const matches = baseName.toLowerCase().startsWith(expectedPrefix);
        if (!matches) {
          setShowDeliverBlockDialog(true);
          return;
        }
      } catch {
        setShowDeliverBlockDialog(true);
        return;
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

        // Send notification to QA users about the delivered asset
        try {
          const modelerName =
            user?.user_metadata?.name || user?.email || "Unknown Modeler";
          await notificationService.sendQAReviewNotification(
            asset.id,
            asset.product_name,
            modelerName,
            asset.client
          );
        } catch (error) {
          console.error("❌ Failed to send QA notification:", error);
          // Don't throw error to avoid blocking status update
        }
      }

      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));

      // Show success message and trigger earnings widget refresh
      if (result.allocationListApproved) {
        toast.success("Asset approved and allocation list completed!");
        // Trigger earnings widget refresh for approval
        window.dispatchEvent(new CustomEvent("allocationListApproved"));
      } else if (result.allocationListId) {
        // Check if this was an unapproval (status changed from approved to something else)
        const wasApproved =
          asset?.status === "approved" ||
          asset?.status === "approved_by_client";
        if (
          wasApproved &&
          newStatus !== "approved" &&
          newStatus !== "approved_by_client"
        ) {
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

      // Cross-tab update: BroadcastChannel + storage fallback
      try {
        const payload = {
          type: "assetStatusChanged",
          assetId: asset.id,
          status: newStatus,
          client: asset.client,
          batch: asset.batch,
          ts: Date.now(),
        };
        // BroadcastChannel (preferred)
        try {
          const bc = new BroadcastChannel("charpstar-asset-status");
          bc.postMessage(payload);
          bc.close();
        } catch {}
        // Storage fallback (fires 'storage' in other tabs)
        try {
          localStorage.setItem(
            "charpstar-asset-status-event",
            JSON.stringify(payload)
          );
        } catch {}
      } catch {}

      // Also try notifying opener if available (noopener may prevent this)
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "assetStatusChanged",
              assetId: asset.id,
              status: newStatus,
              client: asset.client,
              batch: asset.batch,
            },
            window.location.origin
          );
        }
      } catch {}

      // Close this tab when marking as delivered
      if (newStatus === "delivered_by_artist") {
      }
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

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied only after user context has loaded and user doesn't have access
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

  // Submit a reply for either an annotation or a comment (modelers can reply)
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
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to add reply");
        setAnnotations((prev) => [data.annotation, ...prev]);
        // Notify parent author if different
        try {
          if (
            (parent as any)?.created_by &&
            (parent as any).created_by !== user.id
          ) {
            const { data: parentProfile } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("id", (parent as any).created_by)
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
          }
        } catch {}
      } else {
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
        // Notify parent comment author if different
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
                      className={`text-xs font-medium ${getStatusLabelClass(asset?.status || "")}`}
                    >
                      {getStatusLabelText(asset?.status || "")}
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
              src="/model-viewer.js"
              onLoad={() => {}}
              onError={() => {
                console.error("❌ Failed to load model-viewer script");
              }}
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
                  environment-image={
                    getViewerParameters(clientViewerType).environmentImage
                  }
                  exposure={getViewerParameters(clientViewerType).exposure}
                  tone-mapping={
                    getViewerParameters(clientViewerType).toneMapping
                  }
                  shadow-softness="1"
                  min-field-of-view="5deg"
                  max-field-of-view="35deg"
                  style={{ width: "100%", height: "100%" }}
                  onLoad={() => {}}
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
                  {/* Dimension elements removed; handled by integrated viewer */}
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
                    {getStatusLabelText(asset?.status || "")}
                  </Badge>
                  {asset?.revision_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Revision {asset.revision_count}
                    </Badge>
                  )}
                </div>
              </div>
              {/* Freshness indicator */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  {latestExternalFeedbackTime &&
                  latestGlbTime &&
                  latestGlbTime < latestExternalFeedbackTime ? (
                    <Badge variant="destructive" className="text-[10px]">
                      GLB older than feedback, please upload a new GLB to change
                      status
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-emerald-600 border-emerald-300"
                    >
                      Up-to-date
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => updateAssetStatus("in_production")}
                  disabled={asset?.status === "in_production" || statusUpdating}
                  variant={
                    asset?.status === "in_production" ? "default" : "outline"
                  }
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  {statusUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Mark as In Progress
                </Button>
                <Button
                  onClick={() => updateAssetStatus("delivered_by_artist")}
                  disabled={
                    asset?.status === "delivered_by_artist" ||
                    asset?.status === "approved" ||
                    asset?.status === "approved_by_client" ||
                    statusUpdating
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

                    // Check if it's actually an image file
                    const imageExtensions = [
                      ".jpg",
                      ".jpeg",
                      ".png",
                      ".gif",
                      ".bmp",
                      ".webp",
                      ".svg",
                      ".tiff",
                      ".tif",
                    ];
                    const isImageFile = imageExtensions.some((ext) =>
                      lowerFileName.endsWith(ext)
                    );

                    // Also check if it's not a directory/path-only URL
                    const hasFileExtension = lowerFileName.includes(".");

                    return isImageFile && hasFileExtension;
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

                  const linkFiles = referenceImages.filter((url) => {
                    const fileName = url.split("/").pop() || "";
                    const lowerFileName = fileName.toLowerCase();

                    // Check if it's actually an image file
                    const imageExtensions = [
                      ".jpg",
                      ".jpeg",
                      ".png",
                      ".gif",
                      ".bmp",
                      ".webp",
                      ".svg",
                      ".tiff",
                      ".tif",
                    ];
                    const isImageFile = imageExtensions.some((ext) =>
                      lowerFileName.endsWith(ext)
                    );

                    // Check if it's a GLB file
                    const isGlbFile = lowerFileName.endsWith(".glb");

                    // Check if it's a document file
                    const isDocumentFile =
                      lowerFileName.endsWith(".pdf") ||
                      lowerFileName.endsWith(".doc") ||
                      lowerFileName.endsWith(".docx");

                    // Check if it starts with http/https (likely a link)
                    const isHttpLink =
                      url.toLowerCase().startsWith("http://") ||
                      url.toLowerCase().startsWith("https://");

                    // Check if it's not a file extension but looks like a URL/path
                    const hasNoFileExtension =
                      !lowerFileName.includes(".") ||
                      lowerFileName.endsWith("/");

                    // It's a link if it's not an image, GLB, or document, and either has no extension or is an HTTP link
                    return (
                      !isImageFile &&
                      !isGlbFile &&
                      !isDocumentFile &&
                      (hasNoFileExtension || isHttpLink)
                    );
                  });

                  return (
                    <div className="space-y-6">
                      {/* Reference Images Section */}
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-muted-foreground font-semibold">
                            References
                          </h4>
                        </div>

                        {imageFiles.length > 0 ? (
                          <div className="space-y-4">
                            {/* Large Selected Image - Show selected image */}
                            <div className="relative">
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
                                  src={imageFiles[selectedReferenceIndex || 0]}
                                  alt={`Reference ${(selectedReferenceIndex || 0) + 1}`}
                                  className="w-full h-full object-contain transition-transform duration-200"
                                  style={{
                                    transform: `scale(${zoomLevel})`,
                                    transformOrigin: isZooming
                                      ? `${mousePosition.x}% ${mousePosition.y}%`
                                      : "center",
                                  }}
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
                                  className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
                                  style={{ display: "none" }}
                                >
                                  <div className="text-center">
                                    <LucideImage className="h-8 w-8 mx-auto mb-2" />
                                    Invalid image URL
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(
                                        imageFiles[selectedReferenceIndex || 0],
                                        "_blank"
                                      )
                                    }
                                    className="h-10 w-10 p-0 bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                                  >
                                    <Maximize2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground text-center">
                                Reference {(selectedReferenceIndex || 0) + 1} •
                                Hold Shift + Scroll to zoom (1x-3x)
                              </div>
                            </div>

                            {/* Thumbnails Grid */}
                            <div className="relative">
                              <div className="flex gap-3 overflow-x-auto p-1 scrollbar-hide relative">
                                {imageFiles.map((imageUrl, index) => (
                                  <div
                                    key={index}
                                    className={`relative flex-shrink-0 cursor-pointer transition-all duration-300 ${
                                      selectedReferenceIndex === index
                                        ? "ring-2 ring-primary/80 ring-offset-2 rounded-lg"
                                        : "hover:ring-2 hover:ring-primary/50 ring-offset-2 rounded-lg"
                                    }`}
                                    onClick={() =>
                                      setSelectedReferenceIndex(index)
                                    }
                                  >
                                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md">
                                      {imageUrl.startsWith("file://") ? (
                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                          <LucideImage className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      ) : (
                                        <Image
                                          width={80}
                                          height={80}
                                          unoptimized
                                          src={imageUrl}
                                          alt={`Reference ${index + 1}`}
                                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                          onError={(e) => {
                                            (
                                              e.currentTarget as HTMLElement
                                            ).style.display = "none";
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center shadow-sm border-2 border-background">
                                      {index + 1}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Scroll Hint */}
                              {imageFiles.length > 4 && (
                                <div className="flex justify-center mt-3">
                                  <p className="text-xs text-muted-foreground">
                                    Scroll to see more images
                                  </p>
                                </div>
                              )}
                            </div>
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
                              const cleanFileName = `${asset?.article_id || "model"}.glb`;
                              return (
                                <div
                                  key={index}
                                  className="w-full h-16 bg-muted rounded border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = glbUrl;
                                    link.download = cleanFileName;
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
                                        {cleanFileName}
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

                      {/* Links Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-muted-foreground font-semibold">
                            Reference Links
                          </h4>
                        </div>

                        {linkFiles.length > 0 ? (
                          <div className="space-y-3">
                            {linkFiles.map((linkUrl, index) => {
                              // Extract a display name from the URL
                              const getDisplayName = (url: string) => {
                                try {
                                  const urlObj = new URL(url);
                                  return (
                                    urlObj.hostname +
                                    (urlObj.pathname !== "/"
                                      ? urlObj.pathname
                                      : "")
                                  );
                                } catch {
                                  // If URL parsing fails, use the last part of the path
                                  const parts = url
                                    .split("/")
                                    .filter((part) => part.length > 0);
                                  return parts[parts.length - 1] || url;
                                }
                              };

                              return (
                                <div
                                  key={index}
                                  className="w-full h-16 bg-muted rounded border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    window.open(
                                      linkUrl,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center">
                                      <svg
                                        className="w-6 h-6 text-blue-500"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                      </svg>
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-medium text-foreground">
                                        {getDisplayName(linkUrl)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Click to open link
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
                                <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                              </svg>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              No reference links yet
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
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 pb-4">
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-muted-foreground font-semibold">
                        Feedback
                      </h4>
                    </div>

                    {/* Composer: hidden for modelers */}
                    {user.metadata?.role !== "modeler" && (
                      <div className="space-y-3">
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
                      ...comments
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
                                    {annotations
                                      .sort(
                                        (a, b) =>
                                          new Date(a.created_at).getTime() -
                                          new Date(b.created_at).getTime()
                                      )
                                      .findIndex((a) => a.id === item.id) + 1}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {item.profiles?.email || "Unknown"}
                                    </span>
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
                                        ) as any
                                      }
                                      className="text-xs px-2 py-0.5 w-fit"
                                    >
                                      {item.profiles.title}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm text-foreground p-2 rounded-md break-words overflow-hidden whitespace-pre-wrap font-sans">
                                {linkifyText(item.comment)}
                              </div>
                              {item.image_url && (
                                <div className="mt-4">
                                  <div className="relative w-full h-48 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                                    {(() => {
                                      const fileName =
                                        item.image_url?.split("/").pop() || "";
                                      const isGlbFile = fileName
                                        .toLowerCase()
                                        .endsWith(".glb");
                                      if (
                                        item.image_url.startsWith("file://")
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
                                              if (!item.image_url) return;
                                              const link =
                                                document.createElement("a");
                                              link.href = item.image_url;
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
                                            src={item.image_url}
                                            alt="Annotation reference"
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                              console.error(
                                                "Failed to load annotation image:",
                                                item.image_url
                                              );
                                              (
                                                e.currentTarget as HTMLElement
                                              ).style.display = "none";
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
                              {/* Reply actions */}
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs cursor-pointer"
                                  onClick={() =>
                                    setReplyingTo({
                                      type: "annotation",
                                      id: item.id,
                                    })
                                  }
                                >
                                  Reply
                                </Button>
                                {replyingTo?.type === "annotation" &&
                                  replyingTo.id === item.id && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <Textarea
                                        placeholder="Write a reply..."
                                        value={replyText}
                                        onChange={(e) =>
                                          setReplyText(e.target.value)
                                        }
                                        className="flex-1"
                                        rows={2}
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
                                {annotationRepliesMap[item.id]?.length > 0 && (
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
                                            {reply.profiles?.email || "Unknown"}{" "}
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
                                        ) as any
                                      }
                                      className="text-xs px-2 py-0.5 w-fit"
                                    >
                                      {item.profiles.title}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-foreground p-2 rounded-md break-words overflow-hidden whitespace-pre-wrap font-sans">
                              {linkifyText(item.comment)}
                            </div>
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
                            {/* Reply actions */}
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
                                    <Textarea
                                      placeholder="Write a reply..."
                                      value={replyText}
                                      onChange={(e) =>
                                        setReplyText(e.target.value)
                                      }
                                      className="flex-1"
                                      rows={2}
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

                    {annotations.length + comments.length === 0 && (
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
        </div>

        {/* GLB Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={handleUploadDialogClose}>
          <DialogContent className="max-w-2xl w-full h-fit">
            <DialogHeader>
              <DialogTitle>
                {asset.glb_link ? "Update GLB File" : "Upload GLB File"}
              </DialogTitle>
              <DialogDescription>
                Select a GLB file to upload for this asset. Maximum file size:
                15MB.
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
                    {selectedFileNameMismatch && asset?.article_id && (
                      <div className="mt-2 text-xs text-amber-600 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>
                          File name should start with &apos;
                          {String(asset.article_id)}&apos; to match the asset
                          id.
                        </span>
                      </div>
                    )}
                    {selectedFileSizeWarning && (
                      <div className="mt-2 text-xs text-amber-600 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>
                          Warning: This file is larger than 25MB. Please keep it
                          under 25MB. Large files may take longer to upload and
                          process.
                        </span>
                      </div>
                    )}
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
                    {asset?.article_id && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Suggested format: {String(asset.article_id)}
                        .glb
                      </p>
                    )}
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
                  disabled={
                    !selectedFile ||
                    uploading ||
                    Boolean(selectedFileNameMismatch) ||
                    selectedFileSizeWarning
                  }
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
          <DialogContent className="max-w-4xl w-full max-h-[50vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                GLB Version History
              </DialogTitle>
              <DialogDescription>
                View and restore previous versions of this asset&apos;s GLB
                file.
                {glbHistory.length > 0 && (
                  <span className="block mt-1 text-sm font-medium text-foreground">
                    {glbHistory.length} version
                    {glbHistory.length !== 1 ? "s" : ""} available
                  </span>
                )}
                {/* Note: Only the current asset's GLB link is considered "current" */}
                <span className="block mt-1 text-xs text-muted-foreground">
                  Current version is determined by the asset&apos;s active GLB
                  link
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {glbHistory.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    // Sort history: current version first, then others by upload date (newest first)
                    // The current version is the one whose glb_url matches the asset's current glb_link
                    const sortedHistory = [...glbHistory].sort((a, b) => {
                      const aIsCurrent = asset?.glb_link === a.glb_url;
                      const bIsCurrent = asset?.glb_link === b.glb_url;

                      if (aIsCurrent && !bIsCurrent) return -1; // a is current, b is not
                      if (!aIsCurrent && bIsCurrent) return 1; // b is current, a is not

                      // Both are either current or not current, sort by upload date (newest first)
                      return (
                        new Date(b.uploaded_at).getTime() -
                        new Date(a.uploaded_at).getTime()
                      );
                    });

                    // Debug logging to help identify any issues

                    return sortedHistory.map((historyItem, index) => {
                      const isCurrentVersion =
                        asset?.glb_link === historyItem.glb_url;
                      const versionNumber = sortedHistory.length - index;
                      const uploadDate = new Date(historyItem.uploaded_at);
                      const isToday =
                        uploadDate.toDateString() === new Date().toDateString();
                      const isYesterday =
                        uploadDate.toDateString() ===
                        new Date(Date.now() - 86400000).toDateString();

                      let dateDisplay = "";
                      if (isToday) {
                        dateDisplay = `Today at ${uploadDate.toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}`;
                      } else if (isYesterday) {
                        dateDisplay = `Yesterday at ${uploadDate.toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}`;
                      } else {
                        dateDisplay = uploadDate.toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      }

                      return (
                        <div
                          key={historyItem.id}
                          className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-sm ${
                            isCurrentVersion
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/30 hover:bg-primary/2"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3 mb-3">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isCurrentVersion
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <Download className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-foreground truncate">
                                      {historyItem.file_name}
                                    </h4>
                                    {isCurrentVersion && (
                                      <Badge
                                        variant="default"
                                        className="text-xs px-2 py-1"
                                      >
                                        Current Version
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {dateDisplay}
                                  </p>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {historyItem.file_size > 0 && (
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                                        {(
                                          historyItem.file_size /
                                          1024 /
                                          1024
                                        ).toFixed(2)}{" "}
                                        MB
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                                      Version {versionNumber}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(historyItem.glb_url, "_blank")
                                }
                                className="text-xs h-8 px-3"
                                title="Download this version"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              {!isCurrentVersion && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => restoreGlbVersion(historyItem)}
                                  disabled={restoringVersion}
                                  className="text-xs h-8 px-3"
                                  title="Restore this version as current"
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
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No version history yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Upload your first GLB file to start building version
                    history. Each upload will create a new version that you can
                    restore later.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={cleanupGlbHistory}
                className="text-xs"
              >
                Clean Up History
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Block Delivery Dialog */}
        <Dialog
          open={showDeliverBlockDialog}
          onOpenChange={setShowDeliverBlockDialog}
        >
          <DialogContent className="max-w-md w-full h-fit">
            <DialogHeader>
              <DialogTitle>Fix GLB before delivering</DialogTitle>
              <DialogDescription>
                The GLB must exist and its filename should start with the
                article ID
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {!asset?.glb_link ? (
                <div className="text-red-600">No GLB is uploaded yet.</div>
              ) : (
                <div>
                  <div className="text-amber-700">
                    Filename mismatch detected.
                  </div>
                  <div>
                    Expected prefix:{" "}
                    <span className="font-mono">
                      {String(asset?.article_id).toLowerCase()}_
                    </span>
                  </div>
                  <div>
                    Current file:{" "}
                    <span className="font-mono">
                      {decodeURIComponent(
                        (asset?.glb_link || "").split("/").pop() || ""
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeliverBlockDialog(false)}
              >
                Close
              </Button>
              {asset && (
                <Button
                  onClick={() => {
                    setShowDeliverBlockDialog(false);
                    setShowUploadDialog(true);
                  }}
                >
                  Upload Correct GLB
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Stale GLB Dialog */}
        <Dialog open={showStaleGlbDialog} onOpenChange={setShowStaleGlbDialog}>
          <DialogContent className="max-w-md w-full h-fit">
            <DialogHeader>
              <DialogTitle>Update GLB before delivering</DialogTitle>
              <DialogDescription className="text-sm max-w-sm">
                New feedback exists after your current GLB upload. Please upload
                a new GLB that addresses the latest feedback before marking as
                delivered.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowStaleGlbDialog(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowStaleGlbDialog(false);
                  setShowUploadDialog(true);
                }}
              >
                Upload New GLB
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
