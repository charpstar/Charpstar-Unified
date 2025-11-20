"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Textarea } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";

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
  Download,
  Image as LucideImage,
  Camera,
  MessageSquare,
  CheckCircle,
  Loader2,
  Maximize2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  StickyNote,
  Edit,
  Trash2,
  Star,
  History,
  RotateCcw,
  Clock,
  FileText,
  Copy,
} from "lucide-react";
import Script from "next/script";
import { toast } from "sonner";
import Image from "next/image";
import { QAWorkflowModal } from "@/components/qa";

import "./annotation-styles.css";

interface Asset {
  id: string;
  product_name: string;
  article_id: string;
  delivery_date: string;
  status: string;
  product_link: string;
  glb_link: string;
  blend_link?: string | null;
  client: string;
  batch: number;
  priority: number;
  revision_count: number;
  updated_at?: string;
  measurements?: string | null;
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
  is_old_annotation?: boolean;
  revision_number?: number | null;
}

interface Hotspot {
  id: string;
  position: { x: number; y: number; z: number };
  normal: Vector3;
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
    case "auto_qa_approved":
      return "status-approved"; // Use approved styling for auto QA
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
    // "auto_qa_approved" is now handled by "approved" status with qaApproved state
    // UI will show "Auto QA Approved" when qaApproved === true && status === "approved"
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

type Vector3 = { x: number; y: number; z: number };

const DEFAULT_NORMAL: Vector3 = { x: 0, y: 1, z: 0 };

const formatVector3 = (vector: Vector3): string =>
  `${vector.x.toFixed(6)} ${vector.y.toFixed(6)} ${vector.z.toFixed(6)}`;

const parseVector3 = (value?: string | null): Vector3 => {
  if (!value) return DEFAULT_NORMAL;
  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part));

  if (parts.length === 3 && parts.every((num) => Number.isFinite(num))) {
    return { x: parts[0], y: parts[1], z: parts[2] };
  }
  return DEFAULT_NORMAL;
};

const parseMeasurements = (
  measurements?: string | null
): { h: string; w: string; d: string } | null => {
  if (!measurements) return null;
  const parts = measurements
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 3) return null;
  const [h, w, d] = parts;
  return { h, w, d };
};

const formatMeasurementValue = (value?: string): string => {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric * 100) / 100;
    return `${rounded} mm`;
  }
  return trimmed;
};

const parseReferenceValues = (raw: unknown): string[] => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        typeof item === "string" ? item.trim() : String(item ?? "").trim()
      )
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.includes("|||")) {
      return trimmed
        .split("|||")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed.startsWith("{")
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) =>
              typeof item === "string" ? item.trim() : String(item ?? "").trim()
            )
            .filter(Boolean);
        }
      } catch {
        // fall through
      }
    }

    return [trimmed];
  }

  return [];
};

const getFileExtension = (url: string): string | null => {
  const cleaned = url.split("?")[0].split("#")[0];
  const segments = cleaned.split("/");
  const fileName = segments[segments.length - 1] || "";
  if (!fileName.includes(".")) return null;
  const ext = fileName.split(".").pop();
  return ext ? ext.toLowerCase() : null;
};

const imageExtensionSet = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
  "tiff",
  "tif",
  "heic",
  "heif",
]);

const categorizeReferenceMedia = (references: string[]) => {
  const images: string[] = [];
  const files: string[] = [];

  references.forEach((ref) => {
    if (!ref) return;
    const trimmed = ref.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    if (lower.startsWith("data:image") || lower.startsWith("blob:")) {
      images.push(trimmed);
      return;
    }

    const ext = getFileExtension(lower);
    if (ext && imageExtensionSet.has(ext)) {
      images.push(trimmed);
      return;
    }

    files.push(trimmed);
  });

  return { images, files };
};

const extractFileName = (url: string): string => {
  try {
    const cleaned = decodeURIComponent(url.split("?")[0].split("#")[0]);
    const parts = cleaned.split("/");
    const fileName = parts[parts.length - 1] || cleaned;
    return fileName || url;
  } catch {
    return url;
  }
};

const getReferenceFileLabel = (url: string): string => {
  const ext = getFileExtension(url);
  if (!ext) {
    return url.startsWith("http") ? "Link" : "File";
  }

  if (ext === "glb" || ext === "gltf") return "GLB";
  if (ext === "zip") return "ZIP";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (imageExtensionSet.has(ext)) return "Image";
  return ext.toUpperCase();
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
        environmentImage: "https://demosetc.b-cdn.net/HDR/HDRI-Default.hdr",
        exposure: "1.3",
        toneMapping: "linear",
      };
    case "v4":
      return {
        environmentImage: "https://demosetc.b-cdn.net/HDR/HDRI-Default.hdr",
        exposure: "1.3",
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

const getViewerDisplayName = (viewerType?: string | null) => {
  switch (viewerType) {
    case "v6_aces":
      return "V6 ACES Tester";
    case "v5_tester":
      return "V5 Default";
    case "synsam":
      return "Synsam Default";
    case "v2":
      return "V2 Default";
    case "v4":
      return "V4";
    default:
      return "Default (V6 ACES Tester)";
  }
};

export default function ModelerReviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const assetId = params.id as string;
  const normalizedUserRole = (
    (user?.metadata?.role ?? user?.role) as string | undefined
  )
    ?.toString()
    .toLowerCase();
  const isClient = normalizedUserRole === "client";

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
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [internalReferenceImages, setInternalReferenceImages] = useState<
    string[]
  >([]);
  const [internalReferenceFiles, setInternalReferenceFiles] = useState<
    string[]
  >([]);
  const [comments, setComments] = useState<any[]>([]);
  const [activeRevision, setActiveRevision] = useState(0);
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
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  // GLB Upload state
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Blender Upload state
  const [selectedBlendFile, setSelectedBlendFile] = useState<File | null>(null);
  const [uploadingBlend, setUploadingBlend] = useState(false);

  // File validation errors
  const [glbFileError, setGlbFileError] = useState<string | null>(null);
  const [blendFileError, setBlendFileError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_latestExternalFeedbackTime, setLatestExternalFeedbackTime] = useState<
    number | null
  >(null);

  // QA state
  const [showQADialog, setShowQADialog] = useState(false);
  const [qaApproved, setQaApproved] = useState<boolean | null>(null);
  const [uploadedGlbUrl, setUploadedGlbUrl] = useState<string | null>(null);
  const [showStaleGlbDialog, setShowStaleGlbDialog] = useState(false);
  const [showQAReminderDialog, setShowQAReminderDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isDialogDragOver, setIsDialogDragOver] = useState(false);
  const currentGlbUrlRef = useRef<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [autoQATriggered, setAutoQATriggered] = useState(false);
  useEffect(() => {
    if (typeof asset?.revision_count === "number") {
      setActiveRevision(asset.revision_count);
    }
  }, [asset?.revision_count]);

  // Update the ref whenever asset.glb_link changes
  useEffect(() => {
    if (asset?.glb_link) {
      // Only update if it's a new URL (not just a cache-busting parameter change)
      const baseUrl = asset.glb_link.split("?")[0].split("#")[0];
      const currentBaseUrl = currentGlbUrlRef.current
        ?.split("?")[0]
        .split("#")[0];

      // Check if this is a different base URL (not just cache-busting params)
      if (baseUrl !== currentBaseUrl && baseUrl) {
        // If ref has upload/restore params, keep them but update base URL
        const refUrl = currentGlbUrlRef.current;
        if (
          refUrl &&
          (refUrl.includes("upload=") || refUrl.includes("restore="))
        ) {
          // Keep cache-busting params but update base URL
          const params = refUrl.split("?")[1];
          currentGlbUrlRef.current = params ? `${baseUrl}?${params}` : baseUrl;
        } else {
          // Fresh URL, store without cache-busting (will be added by src calculation)
          currentGlbUrlRef.current = asset.glb_link;
        }

        // Reset model loaded state when GLB URL changes
        setModelLoaded(false);
        // Force model viewer re-render
        setModelViewerKey((prev) => prev + 1);

        // Only reset auto-trigger and QA approval state if this is a new upload (status not already delivered)
        if (asset?.status !== "delivered_by_artist") {
          setAutoQATriggered(false);
          setQaApproved(null); // Reset QA approval state for new model
        }
      }
    }
  }, [asset?.glb_link, asset?.status]);

  // Auto-trigger QA when model loads (after upload)
  useEffect(() => {
    console.log("🔍 Auto QA trigger check:", {
      modelLoaded,
      autoQATriggered,
      hasGlbLink: !!asset?.glb_link,
      referenceImagesCount: referenceImages.length,
      qaApproved,
      showQADialog,
      assetStatus: asset?.status,
      uploadedGlbUrl: !!uploadedGlbUrl,
    });

    // Trigger auto QA if:
    // 1. Model is loaded
    // 2. Haven't triggered yet
    // 3. Has GLB link
    // 4. QA not already approved/rejected
    // 5. Dialog not already open
    // 6. Status is not already delivered_by_artist (meaning it's a new upload)
    // 7. We have an uploaded GLB URL (from recent upload) or reference images exist
    // Note: Reference images are optional - user can upload them in the QA modal
    const hasUploadedGlb = uploadedGlbUrl && uploadedGlbUrl === asset?.glb_link;
    const shouldTrigger =
      modelLoaded &&
      !autoQATriggered &&
      asset?.glb_link &&
      qaApproved === null &&
      !showQADialog &&
      asset?.status !== "delivered_by_artist" &&
      (hasUploadedGlb || referenceImages.length > 0);

    if (shouldTrigger) {
      console.log("✅ All conditions met, triggering auto QA...");
      // Small delay to ensure model is fully rendered
      const timer = setTimeout(() => {
        console.log("🚀 Opening QA dialog and setting auto-triggered");
        if (!uploadedGlbUrl) {
          setUploadedGlbUrl(asset.glb_link);
        }
        setShowQADialog(true);
        setAutoQATriggered(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (
      modelLoaded &&
      asset?.glb_link &&
      referenceImages.length === 0 &&
      !uploadedGlbUrl
    ) {
      console.log("⏳ Waiting for reference images to load or upload...");
    }
  }, [
    modelLoaded,
    autoQATriggered,
    asset?.glb_link,
    asset?.status,
    referenceImages.length,
    qaApproved,
    showQADialog,
    uploadedGlbUrl,
  ]);

  // Also listen to model-viewer load event via ref (when model-viewer element exists)
  useEffect(() => {
    if (!asset?.glb_link) return;

    let cleanup: (() => void) | null = null;

    // Try to set up listeners immediately, then retry if model-viewer isn't ready
    const setupListeners = () => {
      const modelViewer = modelViewerRef.current;
      if (!modelViewer) {
        return false;
      }

      console.log("🎯 Setting up model-viewer event listeners");

      const handleLoad = () => {
        console.log("📦 Model-viewer load event fired via addEventListener");
        setModelLoaded(true);
      };

      // Listen to model-viewer specific events
      modelViewer.addEventListener("load", handleLoad);
      modelViewer.addEventListener("model-loaded", handleLoad);
      modelViewer.addEventListener("loaded", handleLoad);

      // Also check if already loaded
      if ((modelViewer as any).loaded) {
        console.log("📦 Model already loaded, setting modelLoaded");
        setModelLoaded(true);
      }

      cleanup = () => {
        modelViewer.removeEventListener("load", handleLoad);
        modelViewer.removeEventListener("model-loaded", handleLoad);
        modelViewer.removeEventListener("loaded", handleLoad);
      };

      return true;
    };

    // Try immediately
    if (!setupListeners()) {
      // If not ready, wait a bit and try again
      const timer = setTimeout(() => {
        if (!setupListeners()) {
          console.log("⚠️ Model-viewer ref not available after timeout");
        }
      }, 1000);

      return () => {
        clearTimeout(timer);
        if (cleanup) cleanup();
      };
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [asset?.glb_link]);

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [existingGlbNameMismatch, setExistingGlbNameMismatch] = useState<
    string | null
  >(null);
  // State variables for file validation (setters are used, values may be used in future UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedFileNameMismatch, setSelectedFileNameMismatch] = useState<
    string | null
  >(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedFileSizeWarning, setSelectedFileSizeWarning] =
    useState<boolean>(false);
  const [showDeliverBlockDialog, setShowDeliverBlockDialog] = useState(false);
  // Components panel state
  const [dependencies, setDependencies] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  // Version history state
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] =
    useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [deletingAllVersions, setDeletingAllVersions] = useState(false);
  const [modelViewerKey, setModelViewerKey] = useState(0);

  const modelViewerRef = useRef<any>(null);

  // Reference image selection and zoom state
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState<
    number | null
  >(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedInternalReferenceIndex, setSelectedInternalReferenceIndex] =
    useState<number | null>(null);
  const [imageZoom, setImageZoom] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZooming, setIsZooming] = useState(false);

  const measurements = parseMeasurements(asset?.measurements ?? null);
  const clientReferenceCount = referenceImages.length + referenceFiles.length;
  const internalReferenceCount =
    internalReferenceImages.length + internalReferenceFiles.length;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalReferenceCount =
    clientReferenceCount + (isClient ? 0 : internalReferenceCount);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderReferenceSection = ({
    title,
    description,
    images,
    files,
    selectedIndex,
    onSelectImage,
    highlight,
  }: {
    title: string;
    description?: string;
    images: string[];
    files: string[];
    selectedIndex: number | null;
    onSelectImage: (index: number) => void;
    highlight?: boolean;
  }) => {
    if (images.length === 0 && files.length === 0) {
      return null;
    }

    const safeIndex =
      images.length > 0
        ? Math.min(selectedIndex ?? 0, images.length - 1)
        : null;
    const selectedImage = safeIndex !== null ? images[safeIndex] : undefined;

    return (
      <div
        className={`space-y-4 rounded-xl border border-border/40 bg-muted/20 px-4 py-5 sm:px-5 ${
          highlight
            ? "border-dashed border-orange-300/70 bg-orange-50/60 dark:border-orange-500/40 dark:bg-orange-500/5"
            : "dark:border-border/40 dark:bg-muted/10"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h4 className="text-sm sm:text-base font-semibold text-foreground">
              {title}
            </h4>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {images.length + files.length} file
            {images.length + files.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {selectedImage && (
          <div className="relative">
            <div
              className="aspect-video bg-muted rounded-lg overflow-hidden border border-border relative cursor-pointer"
              onMouseMove={handleImageMouseMove}
              onMouseEnter={handleImageMouseEnter}
              onMouseLeave={handleImageMouseLeave}
              onWheel={handleImageWheel}
              onClick={() =>
                window.open(selectedImage, "_blank", "noopener,noreferrer")
              }
            >
              <Image
                width={640}
                height={360}
                unoptimized
                src={selectedImage}
                alt={`${title} preview`}
                className="w-full h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: isZooming
                    ? `${mousePosition.x}% ${mousePosition.y}%`
                    : "center",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                  (
                    e.currentTarget.nextElementSibling as HTMLElement
                  ).style.display = "flex";
                }}
              />
              <div
                className="absolute inset-0 hidden items-center justify-center bg-muted text-muted-foreground"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(selectedImage, "_blank", "noopener,noreferrer");
                  }}
                  className="h-10 w-10 p-0 bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Image {safeIndex !== null ? safeIndex + 1 : 0} of {images.length}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs uppercase tracking-wide text-muted-foreground">
              Images ({images.length})
            </h5>
            <div className="flex gap-2 sm:gap-3 overflow-x-auto p-1 scrollbar-hide">
              {images.map((url, index) => {
                const isActive = safeIndex === index;
                return (
                  <div
                    key={`${url}-${index}`}
                    className={`relative flex-shrink-0 ${
                      isActive
                        ? "ring-2 ring-primary/70 ring-offset-2 rounded-lg"
                        : "hover:ring-2 hover:ring-primary/50 ring-offset-2 rounded-lg"
                    }`}
                    onClick={() => onSelectImage(index)}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md">
                      <Image
                        width={80}
                        height={80}
                        unoptimized
                        src={url}
                        alt={`${title} ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display =
                            "none";
                        }}
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center shadow-sm border-2 border-background">
                      {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs uppercase tracking-wide text-muted-foreground">
              Files ({files.length})
            </h5>
            <div className="space-y-2">
              {files.map((fileUrl) => {
                const label = getReferenceFileLabel(fileUrl);
                return (
                  <div
                    key={fileUrl}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {extractFileName(fileUrl)}
                        </p>
                        <p className="text-xs text-muted-foreground break-all">
                          {fileUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 cursor-pointer"
                        onClick={() =>
                          window.open(fileUrl, "_blank", "noopener,noreferrer")
                        }
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 cursor-pointer"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(fileUrl);
                            toast.success("Reference link copied");
                          } catch (error) {
                            console.error(
                              "Failed to copy reference link:",
                              error
                            );
                            toast.error("Failed to copy link");
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getAnnotationRevisionNumber = (annotation: Annotation) => {
    if (typeof annotation.revision_number === "number") {
      return annotation.revision_number;
    }
    if (annotation.is_old_annotation) {
      return Math.max(0, (asset?.revision_count ?? 1) - 1);
    }
    return asset?.revision_count ?? 0;
  };

  const getCommentRevisionNumber = (comment: {
    revision_number?: number | null;
  }) => {
    if (typeof comment?.revision_number === "number") {
      return comment.revision_number;
    }
    return asset?.revision_count ?? 0;
  };

  const annotationsForActiveRevision = useMemo(
    () =>
      annotations.filter((annotation: Annotation) => {
        if (
          activeRevision === (asset?.revision_count ?? 0) &&
          annotation.is_old_annotation
        ) {
          return false;
        }
        return getAnnotationRevisionNumber(annotation) === activeRevision;
      }),
    [annotations, activeRevision, asset?.revision_count]
  );
  const commentsForActiveRevision = useMemo(
    () =>
      comments.filter(
        (comment: any) => getCommentRevisionNumber(comment) === activeRevision
      ),
    [comments, activeRevision]
  );
  const filteredAnnotations = annotationsForActiveRevision;

  const displayedAnnotations = filteredAnnotations;
  const displayedComments = commentsForActiveRevision;

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
  const annotationRepliesMap = groupByParent(
    annotationsForActiveRevision as any
  );
  const commentRepliesMap = groupByParent(commentsForActiveRevision as any);

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

  const revisionNumbers = useMemo(() => {
    const set = new Set<number>();
    const currentRevision = asset?.revision_count ?? 0;
    set.add(0);
    set.add(currentRevision);
    annotations.forEach((annotation) => {
      const rev = getAnnotationRevisionNumber(annotation);
      if (typeof rev === "number") set.add(rev);
    });
    comments.forEach((comment) => {
      const rev = getCommentRevisionNumber(comment);
      if (typeof rev === "number") set.add(rev);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [annotations, comments, asset?.revision_count]);
  const viewingCurrentRevision =
    activeRevision === (asset?.revision_count ?? 0);
  const feedbackLocked = !viewingCurrentRevision;

  // Convert annotations to hotspots format (exclude old annotations from model viewer)
  const hotspots: Hotspot[] = filteredAnnotations
    .filter((annotation: any) => !annotation.parent_id)
    .map((annotation) => ({
      id: annotation.id,
      position: {
        x: parseFloat(annotation.position.split(" ")[0]),
        y: parseFloat(annotation.position.split(" ")[1]),
        z: parseFloat(annotation.position.split(" ")[2]),
      },
      normal: parseVector3(annotation.normal),
      comment: annotation.comment,
      image_url: annotation.image_url,
      visible: true,
    }));

  // Track when we last updated the GLB link to prevent stale fetches
  const lastGlbUpdateRef = useRef<{ url: string; timestamp: number } | null>(
    null
  );

  // Fetch asset data
  useEffect(() => {
    async function fetchAsset() {
      if (!assetId) return;

      setLoading(true);

      try {
        console.log("📥 Fetching asset from database:", assetId);
        // Use a fresh query to ensure we get the latest data
        const { data, error } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", assetId)
          .single();

        if (error) {
          console.error("❌ Error fetching asset:", error);
          toast.error("Failed to load asset");
          return;
        }

        console.log("✅ Asset fetched from database:", {
          assetId: data.id,
          glb_link: data.glb_link,
          updated_at: data.updated_at,
          lastUpdate: lastGlbUpdateRef.current,
        });

        // Ensure updated_at is set if it's missing (for older records)
        if (!data.updated_at) {
          data.updated_at = new Date().toISOString();
        }

        // If we recently updated the GLB link, verify the fetched data matches
        if (lastGlbUpdateRef.current) {
          const timeSinceUpdate =
            Date.now() - lastGlbUpdateRef.current.timestamp;
          // If update was less than 10 seconds ago and GLB link doesn't match, log warning
          if (
            timeSinceUpdate < 10000 &&
            data.glb_link !== lastGlbUpdateRef.current.url
          ) {
            console.error("⚠️ GLB link mismatch after recent update:", {
              expected: lastGlbUpdateRef.current.url,
              actual: data.glb_link,
              timeSinceUpdate: `${timeSinceUpdate}ms`,
            });
            // Force update if we're within 5 seconds of the update
            if (timeSinceUpdate < 5000) {
              console.log("🔄 Forcing GLB link update due to mismatch...");
              const { error: forceError } = await supabase
                .from("onboarding_assets")
                .update({
                  glb_link: lastGlbUpdateRef.current.url,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", assetId);

              if (!forceError) {
                // Refetch after forced update
                const { data: forcedData } = await supabase
                  .from("onboarding_assets")
                  .select("*")
                  .eq("id", assetId)
                  .single();
                if (forcedData) {
                  setAsset(forcedData);
                  setLoading(false);
                  return;
                }
              }
            }
          }
          // Clear the ref after 10 seconds
          if (timeSinceUpdate > 10000) {
            lastGlbUpdateRef.current = null;
          }
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
          } else {
            // If no client found, default to null (will use default viewer)
            setClientViewerType(null);
          }
        } catch (error) {
          console.error("Error fetching client viewer type:", error);
          setClientViewerType(null);
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

        // Parse reference media
        const clientReferenceValues = parseReferenceValues(data.reference);
        const clientMedia = categorizeReferenceMedia(clientReferenceValues);
        setReferenceImages(clientMedia.images);
        setReferenceFiles(clientMedia.files);
        setSelectedReferenceIndex(clientMedia.images.length > 0 ? 0 : null);

        const internalReferenceValues = parseReferenceValues(
          (data as any).internal_reference
        );
        const internalMedia = categorizeReferenceMedia(internalReferenceValues);
        setInternalReferenceImages(internalMedia.images);
        setInternalReferenceFiles(internalMedia.files);
        setSelectedInternalReferenceIndex(
          internalMedia.images.length > 0 ? 0 : null
        );

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
          .eq("asset_id", assetId)
          .not("comment", "like", "NOTE:%"); // Exclude notes

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

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      if (!assetId || !user) return;

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
          .like("comment", "NOTE:%")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching notes:", error);
        } else {
          // Transform the data to remove the "NOTE:" prefix for display
          const transformedNotes = (data || []).map((note) => ({
            ...note,
            comment: note.comment.replace(/^NOTE:\s*/, ""),
          }));
          setNotes(transformedNotes);
        }
      } catch (error) {
        console.error("Error fetching notes:", error);
      }
    }

    fetchNotes();
  }, [assetId, user]);

  // Fetch reference images for QA
  const fetchReferenceImages = async () => {
    if (!assetId) return [];

    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, internal_reference")
        .eq("id", assetId)
        .single();

      if (error) {
        console.error("Error fetching reference media:", error);
        return [];
      }

      const clientRefs = parseReferenceValues(data?.reference);
      const internalRefs = parseReferenceValues(data?.internal_reference);

      const clientMedia = categorizeReferenceMedia(clientRefs);
      const internalMedia = categorizeReferenceMedia(internalRefs);

      setReferenceImages(clientMedia.images);
      setReferenceFiles(clientMedia.files);
      setInternalReferenceImages(internalMedia.images);
      setInternalReferenceFiles(internalMedia.files);

      setSelectedReferenceIndex((prev) =>
        clientMedia.images.length === 0
          ? null
          : Math.min(prev ?? 0, clientMedia.images.length - 1)
      );
      setSelectedInternalReferenceIndex((prev) =>
        internalMedia.images.length === 0
          ? null
          : Math.min(prev ?? 0, internalMedia.images.length - 1)
      );

      return clientMedia.images;
    } catch (error) {
      console.error("Error fetching reference media:", error);
      return [];
    }
  };

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

  // Fetch version history function - memoized with useCallback
  const fetchVersionHistory = useCallback(async () => {
    if (!assetId) return;
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/backups`);
      const data = await response.json();
      if (response.ok) {
        console.log("📋 Version history received:", data.versions);
        console.log("Total versions:", data.versions?.length);
        console.log(
          "Blend files:",
          data.versions?.filter((v: any) => v.fileType === "blend").length
        );
        console.log(
          "GLB files:",
          data.versions?.filter((v: any) => v.fileType === "glb").length
        );

        // Group GLB and Blend files by timestamp/version
        const groupedVersions: any[] = [];
        const processedTimestamps = new Set();

        // Process all versions
        data.versions?.forEach((version: any) => {
          const timestamp = version.timestamp;
          const isCurrent = version.isCurrent;

          // Create unique key: group current files together, backups by timestamp
          const key = isCurrent ? "current" : `backup-${timestamp}`;

          if (processedTimestamps.has(key)) {
            // This timestamp/key already processed, add file to existing group
            const existingGroup = groupedVersions.find(
              (g: any) => g.id === key
            );
            if (existingGroup) {
              if (version.fileType === "glb") {
                existingGroup.glbFile = version;
              } else {
                existingGroup.blendFile = version;
              }
            }
          } else {
            // New timestamp/key, create new group
            processedTimestamps.add(key);
            const group: any = {
              id: key,
              timestamp,
              isCurrent,
              isBackup: version.isBackup,
              lastModified: version.lastModified,
            };

            if (version.fileType === "glb") {
              group.glbFile = version;
            } else {
              group.blendFile = version;
            }

            groupedVersions.push(group);
          }
        });

        // Sort groups: current versions first, then by timestamp (newest first)
        groupedVersions.sort((a: any, b: any) => {
          if (a.isCurrent && !b.isCurrent) return -1;
          if (!a.isCurrent && b.isCurrent) return 1;
          return b.timestamp - a.timestamp;
        });

        // Filter out backup groups that only have GLB (no Blend file)
        // Keep current versions and backups that have a Blend file
        const filteredVersions = groupedVersions.filter((group: any) => {
          // Always keep current versions
          if (group.isCurrent) return true;

          // For backups, only keep if there's a Blend file
          // This removes "GLB-only" backups from the history
          return group.blendFile !== undefined;
        });

        console.log("📦 Grouped versions:", groupedVersions);
        console.log("📦 Filtered versions (with Blend):", filteredVersions);
        setVersionHistory(filteredVersions);
      } else {
        console.error("Error fetching version history:", data.error);
        toast.error("Failed to load version history");
      }
    } catch (error) {
      console.error("Error fetching version history:", error);
      toast.error("Failed to load version history");
    } finally {
      setLoadingVersions(false);
    }
  }, [assetId]);

  // Fetch version history on mount to show count in button
  useEffect(() => {
    fetchVersionHistory();
  }, [fetchVersionHistory]);

  // Sync qaApproved state with asset status on load
  // For "approved" status, we need to check if it was from Auto QA or manual approval
  // We'll assume if status is "approved" and there's a GLB link, it might be from Auto QA
  // But we'll be conservative and only set qaApproved=true for delivered_by_artist
  useEffect(() => {
    if (asset?.status) {
      if (
        ["delivered_by_artist", "approved_by_client"].includes(asset.status)
      ) {
        setQaApproved(true);
      } else if (asset.status === "approved") {
        // For "approved" status, keep qaApproved as is (don't auto-set to true)
        // This allows the Auto QA flow to set it when it approves
      } else {
        // If status is anything else, it implies QA hasn't been passed for delivery yet.
        // We can reset it to null, but let's be careful not to override an active failed state.
        if (qaApproved !== false) {
          setQaApproved(null);
        }
      }
    }
  }, [asset?.status]);

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

    const annotation = filteredAnnotations.find((ann) => ann.id === hotspotId);
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

  // Handle upload dialog close
  const handleUploadDialogClose = (open: boolean) => {
    setShowUploadDialog(open);
    if (!open) {
      // Reset all upload-related states when dialog is closed
      setSelectedFile(null);
      setSelectedBlendFile(null);
      setSelectedFileSizeWarning(false);
      setSelectedFileNameMismatch(null);
      setGlbFileError(null);
      setBlendFileError(null);
    }
  };

  // Validate GLB file
  const validateGlbFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();

    // Check file extension
    if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
      return "File must be a .glb or .gltf file";
    }

    // Check file size
    if (file.size > 100 * 1024 * 1024) {
      return "File size must be less than 100MB";
    }

    // Check filename matches article ID
    if (asset?.article_id) {
      // Normalize both: replace spaces with underscores for comparison
      const fileBaseName = file.name
        .replace(/\.(glb|gltf)$/i, "")
        .toLowerCase()
        .replace(/\s+/g, "_"); // Normalize spaces to underscores
      const expectedName = asset.article_id.toLowerCase().replace(/\s+/g, "_"); // Normalize spaces to underscores

      if (fileBaseName !== expectedName) {
        return `Filename must match Article ID. Expected: "${asset.article_id}.glb" but got: "${file.name}"`;
      }
    }

    return null;
  };

  // Validate Blender file
  const validateBlendFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();

    // Check file extension
    if (!fileName.endsWith(".blend")) {
      return "File must be a .blend file";
    }

    // Check file size
    if (file.size > 500 * 1024 * 1024) {
      return "File size must be less than 500MB";
    }

    // Check filename matches article ID
    if (asset?.article_id) {
      const fileBaseName = file.name.replace(/\.blend$/i, "").toLowerCase();
      const expectedName = asset.article_id.toLowerCase();

      if (fileBaseName !== expectedName) {
        return `Filename must match Article ID. Expected: "${asset.article_id}.blend" but got: "${file.name}"`;
      }
    }

    return null;
  };

  // Validate and set file for upload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Handle GLB upload (replaced by handleUploadBothFiles)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleUpload = async () => {
    if (!selectedFile || !asset) return;

    // Prevent multiple simultaneous uploads
    if (uploading) {
      console.warn("⚠️ Upload already in progress, ignoring duplicate call");
      return;
    }

    setUploading(true);

    try {
      // Backup current GLB and Blender files before uploading new ones (if they exist)
      // Fetch fresh asset data to ensure we have the correct links
      // Remove any cache-busting parameters from the URL before backing up

      // Backup GLB file
      if (asset.glb_link) {
        try {
          // Remove cache-busting parameters to get the clean URL
          const cleanGlbUrl = asset.glb_link.split("?")[0];
          console.log("📦 Creating backup of current GLB:", cleanGlbUrl);
          const backupResponse = await fetch("/api/assets/backup-glb", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset.id,
              glbUrl: cleanGlbUrl, // Use clean URL without cache-busting params
            }),
          });

          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            if (backupData.skipped) {
              console.log(
                "ℹ️ GLB Backup skipped (already exists):",
                backupData.backupUrl
              );
            } else {
              console.log("✅ GLB Backup created:", backupData.backupUrl);
            }
          } else {
            console.warn(
              "⚠️ GLB Backup creation failed, continuing with upload"
            );
            // Don't fail the upload if backup fails
          }
        } catch (backupError) {
          console.error("Error creating GLB backup:", backupError);
          // Don't fail the upload if backup fails
        }
      }

      // Backup Blender file
      if (asset.blend_link) {
        try {
          const cleanBlendUrl = asset.blend_link.split("?")[0];
          console.log(
            "📦 Creating backup of current Blender file:",
            cleanBlendUrl
          );
          const backupResponse = await fetch("/api/assets/backup-blend", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset.id,
              blendUrl: cleanBlendUrl,
            }),
          });

          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            if (backupData.skipped) {
              console.log(
                "ℹ️ Blender Backup skipped (already exists):",
                backupData.backupUrl
              );
            } else {
              console.log("✅ Blender Backup created:", backupData.backupUrl);
            }
          } else {
            console.warn(
              "⚠️ Blender Backup creation failed, continuing with upload"
            );
          }
        } catch (backupError) {
          console.error("Error creating Blender backup:", backupError);
        }
      }

      // Check if file is too large for regular upload
      const isLargeFile = selectedFile.size > 3.5 * 1024 * 1024; // 3.5MB safety threshold (Vercel limit is ~4MB)
      let uploadResult: any;

      if (isLargeFile) {
        // Use direct upload (bypasses Vercel's 4.5MB limit)
        const { DirectFileUploader, formatFileSize } = await import(
          "@/lib/directUpload"
        );

        const uploader = new DirectFileUploader((progress) => {
          // Only log every 10% to reduce console spam
          if (
            progress.progress % 10 === 0 ||
            progress.status === "complete" ||
            progress.status === "error"
          ) {
          }
        });

        const result = await uploader.uploadFile(
          selectedFile,
          asset.id,
          "glb",
          asset.client
        );

        if (!result.success) {
          throw new Error(result.error || "Direct GLB upload failed");
        }

        uploadResult = { url: result.cdnUrl };
        toast.success(
          `Large GLB file uploaded successfully! (${formatFileSize(selectedFile.size)})`
        );
      } else {
        // Use regular upload for smaller files
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("asset_id", asset.id);
        formData.append("file_type", "glb");
        formData.append("client_name", asset.client);

        const uploadResponse = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        uploadResult = await uploadResponse.json();
      }

      // Update the asset with the new GLB link and change status to delivered_by_artist
      // Remove any cache-busting parameters from the URL before saving to database
      const cleanUrl = uploadResult.url.split("?")[0];

      console.log("🔄 Updating asset GLB link:", {
        assetId: asset.id,
        oldGlbLink: asset.glb_link,
        newGlbLink: cleanUrl,
      });

      // Update the asset in the database
      // Use .select() to get the updated row back and verify immediately
      const { data: updateResult, error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          glb_link: cleanUrl,
          status: "in_production",
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Error updating asset GLB link:", updateError);
        throw updateError;
      }

      if (!updateResult || updateResult.glb_link !== cleanUrl) {
        console.error("❌ Update result mismatch:", {
          expected: cleanUrl,
          actual: updateResult?.glb_link,
        });
        throw new Error("Database update returned incorrect value");
      }

      console.log("✅ Asset update completed, verifying...", {
        returnedGlbLink: updateResult.glb_link,
        expectedGlbLink: cleanUrl,
      });

      // Track this update to prevent stale fetches
      lastGlbUpdateRef.current = {
        url: cleanUrl,
        timestamp: Date.now(),
      };

      // Wait a brief moment to ensure the update is committed to all replicas
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refetch the asset from database to verify the update persisted
      let refreshedAsset;
      let refreshError;

      // Try up to 5 times with increasing delays to account for replication lag
      // Use longer delays to ensure the update propagates to all replicas
      for (let attempt = 1; attempt <= 5; attempt++) {
        const delay = attempt * 300; // 300ms, 600ms, 900ms, 1200ms, 1500ms
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Use a fresh query each time to avoid caching
        const result = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", asset.id)
          .single();

        refreshError = result.error;
        refreshedAsset = result.data;

        if (
          !refreshError &&
          refreshedAsset &&
          refreshedAsset.glb_link === cleanUrl
        ) {
          console.log(
            `✅ GLB link verified in database (attempt ${attempt}):`,
            refreshedAsset.glb_link
          );
          break;
        } else if (attempt < 5) {
          console.log(
            `⏳ Verification attempt ${attempt} failed, retrying...`,
            {
              expected: cleanUrl,
              actual: refreshedAsset?.glb_link,
              attempt,
            }
          );
        } else {
          // Last attempt failed - log detailed error
          console.error("❌ All verification attempts failed:", {
            expected: cleanUrl,
            actual: refreshedAsset?.glb_link,
            assetId: asset.id,
            error: refreshError,
          });
        }
      }

      if (refreshError) {
        console.error("❌ Error refetching asset after update:", refreshError);
        throw new Error(`Failed to verify update: ${refreshError.message}`);
      }

      if (!refreshedAsset) {
        console.error("❌ No asset returned after refetch");
        throw new Error("Failed to refetch asset after update");
      }

      // Verify the GLB link was saved correctly
      if (refreshedAsset.glb_link !== cleanUrl) {
        console.error("❌ GLB link mismatch after all retries:", {
          expected: cleanUrl,
          actual: refreshedAsset.glb_link,
          assetId: asset.id,
        });
        // Try one more update to force it
        const { error: retryError } = await supabase
          .from("onboarding_assets")
          .update({
            glb_link: cleanUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", asset.id);

        if (retryError) {
          console.error("❌ Retry update also failed:", retryError);
          throw new Error(`GLB link update failed: ${retryError.message}`);
        }

        // Wait and refetch again after retry
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { data: retryRefreshedAsset } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", asset.id)
          .single();

        if (retryRefreshedAsset && retryRefreshedAsset.glb_link !== cleanUrl) {
          throw new Error(
            `GLB link still incorrect after retry. Expected: ${cleanUrl}, Got: ${retryRefreshedAsset.glb_link}`
          );
        }

        setAsset(retryRefreshedAsset || refreshedAsset);
      } else {
        // Update local state with the fresh data from database
        setAsset(refreshedAsset);

        // Final verification: Force one more fetch after a longer delay to ensure persistence
        console.log("🔄 Performing final persistence check...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { data: finalCheck, error: finalCheckError } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", asset.id)
          .single();

        if (!finalCheckError && finalCheck) {
          if (finalCheck.glb_link !== cleanUrl) {
            console.error("❌ Final check failed - GLB link reverted:", {
              expected: cleanUrl,
              actual: finalCheck.glb_link,
            });
            // Force update one more time
            await supabase
              .from("onboarding_assets")
              .update({
                glb_link: cleanUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", asset.id);

            // Refetch one more time
            const { data: forcedRefresh } = await supabase
              .from("onboarding_assets")
              .select("*")
              .eq("id", asset.id)
              .single();

            if (forcedRefresh) {
              setAsset(forcedRefresh);
            }
          } else {
            console.log(
              "✅ Final persistence check passed:",
              finalCheck.glb_link
            );
            setAsset(finalCheck);
          }
        }
      }

      // Record new GLB upload to history
      try {
        const { error: historyError } = await supabase
          .from("glb_upload_history")
          .insert({
            asset_id: asset.id,
            glb_url: cleanUrl,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error("Error recording GLB upload to history:", historyError);
          // Don't fail the upload if history recording fails
        } else {
          console.log("✅ GLB upload recorded to history");
        }
      } catch (historyErr) {
        console.error("Error recording GLB upload to history:", historyErr);
        // Don't fail the upload if history recording fails
      }

      // Mark all existing annotations as "old" when uploading new GLB
      const { error: markOldError } = await supabase
        .from("asset_annotations")
        .update({ is_old_annotation: true })
        .eq("asset_id", asset.id);

      if (markOldError) {
        console.error("Error marking old annotations:", markOldError);
      } else {
        // Refresh annotations to reflect the updated is_old_annotation status
        try {
          const response = await fetch(`/api/annotations?asset_id=${asset.id}`);
          const data = await response.json();
          if (response.ok) {
            setAnnotations(data.annotations || []);
          }
        } catch (error) {
          console.error("Error refreshing annotations:", error);
        }
      }

      // Note: Asset state is updated by the refetch above
      // Update the ref with cache-busting URL for immediate viewer refresh
      const cacheBustUrl = `${cleanUrl}?t=${Date.now()}`;
      currentGlbUrlRef.current = cacheBustUrl;

      // Fetch reference images and trigger QA
      const refImages = await fetchReferenceImages();

      if (refImages.length > 0) {
        setUploadedGlbUrl(uploadResult.url);
        setShowQADialog(true);
        // Only show success toast if not already shown for large files
        if (!isLargeFile) {
          toast.success(
            "GLB file uploaded successfully! Starting automated QA..."
          );
        }
      } else {
        // Only show success toast if not already shown for large files
        if (!isLargeFile) {
          toast.success("GLB file uploaded successfully!");
        }
      }

      // Refresh version history to update count in button
      await fetchVersionHistory();

      setShowUploadDialog(false);
      setSelectedFile(null);

      // Force model viewer refresh with cache-busting URL
      setTimeout(() => {
        const mv = modelViewerRef.current as any;
        if (mv) {
          // Use cache-busting URL to force reload even if URL path is the same
          mv.src = cacheBustUrl;
          // Also trigger a reload if the model viewer has a reload method
          if (mv.reload) {
            mv.reload();
          }
        }
      }, 100);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload GLB file");
    } finally {
      setUploading(false);
    }
  };

  // Handle uploading both GLB and Blender files together
  const handleUploadBothFiles = async () => {
    if (!asset) return;
    if (!selectedFile && !selectedBlendFile) {
      toast.error("Please select at least one file to upload");
      return;
    }

    // Prevent multiple simultaneous uploads
    if (uploading || uploadingBlend) {
      console.warn("⚠️ Upload already in progress, ignoring duplicate call");
      return;
    }

    setUploading(true);
    setUploadingBlend(true);

    let glbSuccess = false;
    let blendSuccess = false;

    try {
      // === BACKUP PHASE ===
      // Backup existing files before uploading new ones
      // Use the same timestamp for both backups so they group together in version history
      const sharedTimestamp = Date.now();

      if (selectedFile && asset.glb_link) {
        try {
          const cleanGlbUrl = asset.glb_link.split("?")[0];
          console.log("📦 Creating backup of current GLB:", cleanGlbUrl);
          const backupResponse = await fetch("/api/assets/backup-glb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: asset.id,
              glbUrl: cleanGlbUrl,
              timestamp: sharedTimestamp, // Use shared timestamp
            }),
          });
          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            console.log(
              backupData.skipped
                ? "ℹ️ GLB Backup skipped"
                : "✅ GLB Backup created"
            );
          }
        } catch (backupError) {
          console.error("Error creating GLB backup:", backupError);
        }
      }

      if (selectedBlendFile && asset.blend_link) {
        try {
          const cleanBlendUrl = asset.blend_link.split("?")[0];
          console.log(
            "📦 Creating backup of current Blender file:",
            cleanBlendUrl
          );
          const backupResponse = await fetch("/api/assets/backup-blend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: asset.id,
              blendUrl: cleanBlendUrl,
              timestamp: sharedTimestamp, // Use shared timestamp
            }),
          });
          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            console.log(
              backupData.skipped
                ? "ℹ️ Blender Backup skipped"
                : "✅ Blender Backup created"
            );
          }
        } catch (backupError) {
          console.error("Error creating Blender backup:", backupError);
        }
      }

      // === UPLOAD PHASE ===
      // Upload files in parallel for speed
      const uploadPromises = [];

      // GLB Upload
      if (selectedFile) {
        const glbUploadPromise = (async () => {
          try {
            // Validate file name
            const fileName = selectedFile.name.toLowerCase();
            if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
              throw new Error("Please select a GLB or GLTF file");
            }

            // Normalize both: replace spaces with underscores for comparison
            const fileBaseName = selectedFile.name
              .replace(/\.(glb|gltf)$/i, "")
              .toLowerCase()
              .replace(/\s+/g, "_"); // Normalize spaces to underscores
            const articleId = asset.article_id
              .toLowerCase()
              .replace(/\s+/g, "_"); // Normalize spaces to underscores

            if (fileBaseName !== articleId) {
              throw new Error(
                `GLB file name must match the Article ID. Expected: ${asset.article_id}, got: ${selectedFile.name.replace(/\.(glb|gltf)$/i, "")}`
              );
            }

            const isLargeFile = selectedFile.size > 3.5 * 1024 * 1024;
            let uploadResult: any;

            if (isLargeFile) {
              const { DirectFileUploader, formatFileSize } = await import(
                "@/lib/directUpload"
              );
              const uploader = new DirectFileUploader();
              const result = await uploader.uploadFile(
                selectedFile,
                asset.id,
                "glb",
                asset.client
              );
              if (!result.success)
                throw new Error(result.error || "Direct GLB upload failed");
              uploadResult = { url: result.cdnUrl };
              console.log(
                `✅ Large GLB uploaded: ${formatFileSize(selectedFile.size)}`
              );
            } else {
              const formData = new FormData();
              formData.append("file", selectedFile);
              formData.append("asset_id", asset.id);
              formData.append("file_type", "glb");
              formData.append("client_name", asset.client);

              const uploadResponse = await fetch("/api/assets/upload-file", {
                method: "POST",
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || "Upload failed");
              }

              uploadResult = await uploadResponse.json();
            }

            // Update GLB link in database
            const cleanUrl = uploadResult.url.split("?")[0];
            const { error: updateError } = await supabase
              .from("onboarding_assets")
              .update({
                glb_link: cleanUrl,
                status: "in_production",
                updated_at: new Date().toISOString(),
              })
              .eq("id", asset.id);

            if (updateError) throw updateError;

            glbSuccess = true;
            return { type: "glb", url: cleanUrl };
          } catch (error) {
            console.error("Error uploading GLB:", error);
            throw error;
          }
        })();
        uploadPromises.push(glbUploadPromise);
      }

      // Blender Upload
      if (selectedBlendFile) {
        const blendUploadPromise = (async () => {
          try {
            // Validate file
            const fileName = selectedBlendFile.name.toLowerCase();
            if (!fileName.endsWith(".blend")) {
              throw new Error("Please select a Blender (.blend) file");
            }

            if (selectedBlendFile.size > 500 * 1024 * 1024) {
              throw new Error("File size must be less than 500MB");
            }

            const fileBaseName = selectedBlendFile.name
              .replace(/\.blend$/i, "")
              .toLowerCase();
            const articleId = asset.article_id.toLowerCase();

            if (fileBaseName !== articleId) {
              throw new Error(
                `Blender file name must match the Article ID. Expected: ${asset.article_id}, got: ${selectedBlendFile.name.replace(/\.blend$/i, "")}`
              );
            }

            const isLargeFile = selectedBlendFile.size > 3.5 * 1024 * 1024;
            let uploadResult: any;

            if (isLargeFile) {
              const { DirectFileUploader, formatFileSize } = await import(
                "@/lib/directUpload"
              );
              const uploader = new DirectFileUploader();
              const result = await uploader.uploadFile(
                selectedBlendFile,
                asset.id,
                "blend",
                asset.client
              );
              if (!result.success)
                throw new Error(
                  result.error || "Direct Blender file upload failed"
                );
              uploadResult = { url: result.cdnUrl };
              console.log(
                `✅ Large Blender file uploaded: ${formatFileSize(selectedBlendFile.size)}`
              );
            } else {
              const formData = new FormData();
              formData.append("file", selectedBlendFile);
              formData.append("asset_id", asset.id);
              formData.append("file_type", "blend");
              formData.append("client_name", asset.client);

              const uploadResponse = await fetch("/api/assets/upload-file", {
                method: "POST",
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || "Upload failed");
              }

              uploadResult = await uploadResponse.json();
            }

            // Update Blender link in database
            const cleanUrl = uploadResult.url.split("?")[0];
            const { error: updateError } = await supabase
              .from("onboarding_assets")
              .update({
                blend_link: cleanUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", asset.id);

            if (updateError) throw updateError;

            blendSuccess = true;
            return { type: "blend", url: cleanUrl };
          } catch (error) {
            console.error("Error uploading Blender file:", error);
            throw error;
          }
        })();
        uploadPromises.push(blendUploadPromise);
      }

      // Wait for all uploads to complete
      const results = await Promise.allSettled(uploadPromises);

      // Check results
      const glbResult = results.find(
        (r: any) => r.status === "fulfilled" && r.value?.type === "glb"
      );
      const glbError = results.find(
        (r: any) => r.status === "rejected" && selectedFile
      );
      const blendError = results.find(
        (r: any) => r.status === "rejected" && selectedBlendFile
      );

      // Refresh asset data
      const { data: refreshedAsset } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("id", asset.id)
        .single();

      if (refreshedAsset) {
        // Update model viewer if GLB was uploaded
        if (glbResult && glbSuccess) {
          const uniqueTimestamp = Date.now();
          const cleanUrl = (glbResult as any).value.url;
          const cacheBustUrl = `${cleanUrl}?upload=${uniqueTimestamp}`;

          // Update ref immediately with cache-busted URL
          currentGlbUrlRef.current = cacheBustUrl;

          // Update asset with the clean URL from database
          setAsset(refreshedAsset);

          // Force model viewer re-render by updating the key
          setModelViewerKey((prev) => prev + 1);

          // Reset model loaded state to allow auto QA to trigger
          setModelLoaded(false);
          setAutoQATriggered(false);

          // Force model viewer update with multiple approaches
          setTimeout(() => {
            const mv = modelViewerRef.current as any;
            if (mv) {
              // Clear src first to force reload
              mv.src = "";

              // Small delay to ensure src is cleared
              setTimeout(() => {
                if (mv) {
                  // Set new cache-busted URL
                  mv.src = cacheBustUrl;

                  // Force reload if available
                  if (mv.reload) {
                    mv.reload();
                  }

                  // Trigger load event
                  try {
                    mv.dispatchEvent(new Event("load"));
                  } catch (e) {
                    console.warn("Could not dispatch load event:", e);
                  }
                }
              }, 50);
            }
          }, 200);

          // Store refreshedAsset for later use in QA reminder check
          const assetForQA = refreshedAsset;

          // Show QA reminder dialog if QA hasn't been approved yet
          // Wait a bit to ensure asset state is updated
          setTimeout(() => {
            // Check if QA hasn't been approved and model isn't already delivered
            const needsQA =
              qaApproved !== true &&
              assetForQA?.status !== "delivered_by_artist" &&
              assetForQA?.status !== "approved_by_client";

            if (needsQA) {
              setShowQAReminderDialog(true);
            }
          }, 1500);
        } else {
          // If no GLB upload, just update asset normally
          setAsset(refreshedAsset);
        }
      }

      // Refresh version history
      await fetchVersionHistory();

      // Show success/error messages
      if (glbSuccess && blendSuccess) {
        toast.success("Both files uploaded successfully!");
      } else if (glbSuccess) {
        toast.success("GLB file uploaded successfully!");
        if (blendError) toast.error("Blender file upload failed");
      } else if (blendSuccess) {
        toast.success("Blender file uploaded successfully!");
        if (glbError) toast.error("GLB file upload failed");
      } else {
        toast.error("File upload failed");
      }

      // Close dialog and clear selections
      setShowUploadDialog(false);
      setSelectedFile(null);
      setSelectedBlendFile(null);

      // Trigger Auto QA if GLB was uploaded
      // Note: QA reminder dialog is shown in the asset update block above
      if (glbSuccess) {
        const cleanUrl = (glbResult as any).value.url;
        // Set uploaded GLB URL for QA (use clean URL, QA will handle it)
        setUploadedGlbUrl(cleanUrl);

        // Fetch reference images after a brief delay to ensure asset is updated
        // Note: Reference images are fetched but not used here - auto-trigger effect handles QA
        setTimeout(async () => {
          await fetchReferenceImages();

          // If reference images exist, trigger QA after model loads
          // Otherwise, wait for model to load and auto-trigger will handle it
          // Don't trigger immediately - wait for model to load first
          // The auto-trigger effect will handle it when modelLoaded becomes true
        }, 500);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
      setUploadingBlend(false);
    }
  };

  // Handle Blend upload (replaced by handleUploadBothFiles)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleUploadBlend = async () => {
    if (!selectedBlendFile || !asset) return;

    if (uploadingBlend) {
      console.warn(
        "⚠️ Blender upload already in progress, ignoring duplicate call"
      );
      return;
    }

    setUploadingBlend(true);

    try {
      // Validate file
      const fileName = selectedBlendFile.name.toLowerCase();
      if (!fileName.endsWith(".blend")) {
        toast.error("Please select a Blender (.blend) file");
        return;
      }

      if (selectedBlendFile.size > 500 * 1024 * 1024) {
        toast.error("File size must be less than 500MB");
        return;
      }

      // Validate file name matches article ID
      const fileBaseName = selectedBlendFile.name
        .replace(/\.blend$/i, "")
        .toLowerCase();
      const articleId = asset.article_id.toLowerCase();

      if (fileBaseName !== articleId) {
        toast.error(
          `File name must match the Article ID. Expected: ${asset.article_id}, got: ${selectedBlendFile.name.replace(/\.blend$/i, "")}`
        );
        return;
      }

      // Backup current Blender file before uploading new one (if it exists)
      if (asset.blend_link) {
        try {
          const cleanBlendUrl = asset.blend_link.split("?")[0];
          console.log(
            "📦 Creating backup of current Blender file:",
            cleanBlendUrl
          );
          const backupResponse = await fetch("/api/assets/backup-blend", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset.id,
              blendUrl: cleanBlendUrl,
            }),
          });

          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            if (backupData.skipped) {
              console.log(
                "ℹ️ Blender Backup skipped (already exists):",
                backupData.backupUrl
              );
            } else {
              console.log("✅ Blender Backup created:", backupData.backupUrl);
            }
          } else {
            console.warn(
              "⚠️ Blender Backup creation failed, continuing with upload"
            );
          }
        } catch (backupError) {
          console.error("Error creating Blender backup:", backupError);
          // Don't fail the upload if backup fails
        }
      }

      // Check if file is too large for regular upload
      const isLargeFile = selectedBlendFile.size > 3.5 * 1024 * 1024;
      let uploadResult: any;

      if (isLargeFile) {
        const { DirectFileUploader, formatFileSize } = await import(
          "@/lib/directUpload"
        );

        const uploader = new DirectFileUploader((progress) => {
          if (
            progress.progress % 10 === 0 ||
            progress.status === "complete" ||
            progress.status === "error"
          ) {
          }
        });

        const result = await uploader.uploadFile(
          selectedBlendFile,
          asset.id,
          "blend",
          asset.client
        );

        if (!result.success) {
          throw new Error(result.error || "Direct Blender file upload failed");
        }

        uploadResult = { url: result.cdnUrl };
        toast.success(
          `Large Blender file uploaded successfully! (${formatFileSize(selectedBlendFile.size)})`
        );
      } else {
        const formData = new FormData();
        formData.append("file", selectedBlendFile);
        formData.append("asset_id", asset.id);
        formData.append("file_type", "blend");
        formData.append("client_name", asset.client);

        const uploadResponse = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        uploadResult = await uploadResponse.json();
      }

      // Update the asset with the new Blender link
      const cleanUrl = uploadResult.url.split("?")[0];

      const { error: updateError } = await supabase
        .from("onboarding_assets")
        .update({
          blend_link: cleanUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);

      if (updateError) {
        console.error("Error updating asset Blender link:", updateError);
        throw updateError;
      }

      // Update local state
      setAsset((prev) => (prev ? { ...prev, blend_link: cleanUrl } : prev));

      // Refresh version history to update count in button
      await fetchVersionHistory();

      toast.success("Blender file uploaded successfully!");
      setShowUploadDialog(false);
      setSelectedBlendFile(null);
    } catch (error) {
      console.error("Error uploading Blender file:", error);
      toast.error("Failed to upload Blender file");
    } finally {
      setUploadingBlend(false);
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

  const updateAssetStatus = async (
    newStatus: string,
    options?: { qaStatus?: boolean | null }
  ) => {
    if (!asset) return;

    // Warn and block if trying to deliver without correct GLB naming
    if (newStatus === "delivered_by_artist") {
      // Check qaStatus from options first (for Auto QA), then fall back to state
      const isQAApproved =
        options?.qaStatus !== undefined ? options.qaStatus : qaApproved;

      // Block delivery if QA is not approved
      if (isQAApproved === false) {
        toast.error(
          "Cannot deliver: Model not approved by QA. Please run QA analysis and address any issues."
        );
        return;
      }

      if (isQAApproved === null || isQAApproved === undefined) {
        toast.error(
          "Cannot deliver: Please run QA analysis first to ensure model quality."
        );
        return;
      }
      // Block if GLB is older than latest external feedback
      // Note: This check is disabled since we removed version history tracking
      if (!asset.glb_link) {
        setShowDeliverBlockDialog(true);
        return;
      }
      try {
        const fileName = decodeURIComponent(
          (asset.glb_link || "").split("/").pop() || ""
        );
        const baseName = fileName.replace(/\.(glb|gltf)$/i, "");
        const expectedPrefix = `${String(asset.article_id).toLowerCase()}`;
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
      let response;

      if (newStatus === "approved_by_client") {
        // Use the complete API endpoint only for client approvals (which transfers asset to production)
        response = await fetch("/api/assets/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId: asset.id,
            status: newStatus,
          }),
        });
      } else {
        // For all other status updates, use direct database update
        const updateData: any = {
          status: newStatus,
          updated_at: new Date().toISOString(), // Set updated_at timestamp
        };

        const { error: updateError, data: updateDataResult } = await supabase
          .from("onboarding_assets")
          .update(updateData)
          .eq("id", asset.id)
          .select();

        if (updateError) {
          console.error("Supabase update error:", updateError);
          throw new Error(
            `Failed to update status: ${updateError.message || updateError.code || "Unknown error"}`
          );
        }

        // Log success for debugging
        if (updateDataResult && updateDataResult.length > 0) {
          console.log(
            "Status updated successfully:",
            updateDataResult[0].status
          );
        }

        // Create a mock response object for consistency
        response = {
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Status updated successfully",
            }),
        };
      }

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
          if (user?.id) {
            await notificationService.sendQAReviewNotification(
              asset.id,
              asset.product_name,
              modelerName,
              asset.client,
              user.id
            );
          }
        } catch (error) {
          console.error("❌ Failed to send QA notification:", error);
          // Don't throw error to avoid blocking status update
        }
      }

      // Update local asset state immediately
      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));

      // Also refetch from database to ensure consistency
      try {
        const { data: refreshedAsset, error: refreshError } = await supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", asset.id)
          .single();

        if (!refreshError && refreshedAsset) {
          setAsset(refreshedAsset);
        }
      } catch (refreshErr) {
        console.error(
          "Error refreshing asset after status update:",
          refreshErr
        );
        // Continue anyway - local state is already updated
      }

      // Refresh annotations if status changed to revisions (annotations marked as old)
      if (newStatus === "revisions") {
        try {
          const response = await fetch(`/api/annotations?asset_id=${asset.id}`);
          const data = await response.json();
          if (response.ok) {
            setAnnotations(data.annotations || []);
          }
        } catch (error) {
          console.error("Error refreshing annotations:", error);
        }
      }

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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update status";
      toast.error(errorMessage);
      setStatusUpdating(false);
      // Re-throw error so calling code can handle it
      throw error;
    } finally {
      setStatusUpdating(false);
    }

    // If status is delivered_by_artist, also update qaApproved state
    if (newStatus === "delivered_by_artist") {
      setQaApproved(true);
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
          revision_number: asset?.revision_count ?? 0,
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

  // Notes CRUD functions
  const addNote = async () => {
    if (!newNote.trim() || !assetId || !user) return;

    try {
      const { data, error } = await supabase
        .from("asset_comments")
        .insert({
          asset_id: assetId,
          comment: `NOTE: ${newNote.trim()}`,
          created_by: user.id,
          revision_number: asset?.revision_count ?? 0,
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
        console.error("Error adding note:", error);
        toast.error("Failed to add note");
        return;
      }

      // Transform the data to remove the "NOTE:" prefix for display
      const transformedNote = {
        ...data,
        comment: data.comment.replace(/^NOTE:\s*/, ""),
      };

      setNotes((prev) => [transformedNote, ...prev]);
      setNewNote("");
      toast.success("Note added successfully");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editNoteContent.trim()) return;

    try {
      const { data, error } = await supabase
        .from("asset_comments")
        .update({
          comment: `NOTE: ${editNoteContent.trim()}`,
        })
        .eq("id", noteId)
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
        console.error("Error updating note:", error);
        toast.error("Failed to update note");
        return;
      }

      // Transform the data to remove the "NOTE:" prefix for display
      const transformedNote = {
        ...data,
        comment: data.comment.replace(/^NOTE:\s*/, ""),
      };

      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? transformedNote : note))
      );
      setEditingNoteId(null);
      setEditNoteContent("");
      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("asset_comments")
        .delete()
        .eq("id", noteId);

      if (error) {
        console.error("Error deleting note:", error);
        toast.error("Failed to delete note");
        return;
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  const startEditingNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.comment);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteContent("");
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
  if (user.metadata?.role !== "modeler" && user.metadata?.role !== "qa") {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for modelers and QA team members.
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
            revision_number: asset?.revision_count ?? 0,
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

  // Restore a version
  const restoreVersion = async (
    backupUrl: string,
    fileType: "glb" | "blend" = "glb"
  ) => {
    if (!assetId || !backupUrl) return;
    setRestoringVersion(backupUrl);
    try {
      // Determine which API endpoint to use based on file type
      const apiEndpoint =
        fileType === "blend"
          ? "/api/assets/restore-blend"
          : "/api/assets/restore-glb";

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          backupUrl,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`${fileType.toUpperCase()} file restored successfully!`);
        // Update the asset with the restored file link
        const updateData =
          fileType === "blend"
            ? {
                blend_link: data.blendUrl,
                updated_at: new Date().toISOString(),
              }
            : { glb_link: data.glbUrl, updated_at: new Date().toISOString() };

        const { error: updateError } = await supabase
          .from("onboarding_assets")
          .update(updateData)
          .eq("id", assetId);

        if (updateError) {
          console.error("Error updating asset after restore:", updateError);
          toast.error("Failed to update asset");
        } else {
          // Wait a moment for the database update to propagate
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Refetch asset to get updated file link with fresh data
          const { data: refreshedAsset } = await supabase
            .from("onboarding_assets")
            .select("*")
            .eq("id", assetId)
            .single();

          if (refreshedAsset) {
            setAsset(refreshedAsset);
            // Update the ref to force viewer refresh (only for GLB files)
            if (fileType === "glb" && refreshedAsset.glb_link) {
              const uniqueTimestamp = Date.now();
              const cacheBustUrl = `${refreshedAsset.glb_link}?restore=${uniqueTimestamp}`;
              currentGlbUrlRef.current = cacheBustUrl;
            }
          }

          // Refresh version history
          await fetchVersionHistory();

          // Force model viewer refresh with aggressive cache-busting (only for GLB files)
          // Wait a bit longer to ensure CDN has the new file and database is updated
          if (fileType === "glb") {
            setTimeout(() => {
              const mv = modelViewerRef.current as any;
              if (mv && data.glbUrl) {
                // Use the restore timestamp from the API response, or generate a new one
                const uniqueTimestamp = data.restoreTimestamp || Date.now();
                const cacheBustUrl = `${data.glbUrl}?restore=${uniqueTimestamp}&t=${uniqueTimestamp}&v=${uniqueTimestamp}`;

                console.log(
                  "🔄 Forcing model viewer refresh with cache-bust URL:",
                  cacheBustUrl
                );

                // Clear any existing cache by removing and re-adding the src
                mv.src = "";

                // Small delay to ensure src is cleared
                setTimeout(() => {
                  // Update the ref with the cache-busting URL
                  currentGlbUrlRef.current = cacheBustUrl;

                  // Force a complete re-render by updating the key
                  setModelViewerKey((prev) => prev + 1);

                  // Set the new src
                  mv.src = cacheBustUrl;

                  // Force reload if available
                  if (mv.reload) {
                    mv.reload();
                  }

                  // Also try to trigger a model load event
                  try {
                    mv.dispatchEvent(new Event("load"));
                  } catch {
                    // Ignore if event dispatch fails
                  }

                  // Verify the model loaded correctly after a delay
                  setTimeout(() => {
                    if (mv.src !== cacheBustUrl) {
                      console.warn(
                        "⚠️ Model viewer src was changed, forcing update"
                      );
                      mv.src = cacheBustUrl;
                    }
                  }, 500);
                }, 200);
              }
            }, 1500);
          }
        }
      } else {
        console.error("Error restoring version:", data.error);
        toast.error(
          data.error || `Failed to restore ${fileType.toUpperCase()} file`
        );
      }
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error(`Failed to restore ${fileType.toUpperCase()} file`);
    } finally {
      setRestoringVersion(null);
    }
  };

  // Delete a version
  const deleteVersion = async (backupUrl: string) => {
    if (!assetId || !backupUrl) return;

    // Prevent deletion of current version
    if (backupUrl === asset?.glb_link) {
      toast.error("Cannot delete the current GLB file");
      return;
    }

    // Confirm deletion
    if (
      !confirm(
        "Are you sure you want to delete this version? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingVersion(backupUrl);
    try {
      const response = await fetch("/api/assets/delete-backup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          backupUrl,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Version deleted successfully!");
        // Refresh version history
        await fetchVersionHistory();
      } else {
        console.error("Error deleting version:", data.error);
        toast.error(data.error || "Failed to delete version");
      }
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error("Failed to delete version");
    } finally {
      setDeletingVersion(null);
    }
  };

  // Delete all backup versions
  const deleteAllVersions = async () => {
    if (!assetId) return;

    // Filter out current versions and collect all backup file URLs
    const backupGroups = versionHistory.filter(
      (group: any) => !group.isCurrent
    );

    if (backupGroups.length === 0) {
      toast.info("No backup versions to delete");
      return;
    }

    // Count total files to delete (GLB + Blend)
    let totalFiles = 0;
    const filesToDelete: string[] = [];
    backupGroups.forEach((group: any) => {
      if (group.glbFile?.fileUrl || group.glbFile?.glbUrl) {
        filesToDelete.push(group.glbFile.fileUrl || group.glbFile.glbUrl);
        totalFiles++;
      }
      if (group.blendFile?.fileUrl || group.blendFile?.glbUrl) {
        filesToDelete.push(group.blendFile.fileUrl || group.blendFile.glbUrl);
        totalFiles++;
      }
    });

    if (filesToDelete.length === 0) {
      toast.info("No backup files to delete");
      return;
    }

    // Confirm deletion
    if (
      !confirm(
        `Are you sure you want to delete all ${backupGroups.length} backup version(s) (${totalFiles} files)? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingAllVersions(true);
    try {
      // Delete all files in parallel
      const deletePromises = filesToDelete.map(async (fileUrl: string) => {
        try {
          const response = await fetch("/api/assets/delete-backup", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId,
              backupUrl: fileUrl,
            }),
          });
          const data = await response.json();
          return { success: response.ok, error: data.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });

      const results = await Promise.all(deletePromises);
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (successful > 0) {
        toast.success(
          `Successfully deleted ${successful} file(s)${
            failed > 0 ? ` (${failed} failed)` : ""
          }`
        );
        // Refresh version history
        await fetchVersionHistory();
      } else {
        toast.error("Failed to delete versions");
      }
    } catch (error) {
      console.error("Error deleting all versions:", error);
      toast.error("Failed to delete versions");
    } finally {
      setDeletingAllVersions(false);
    }
  };

  // Toggle comment priority (only QAs can do this)
  const toggleCommentPriority = async (
    commentId: string,
    currentPriority: boolean
  ) => {
    if (!user || user.metadata?.role !== "qa") {
      toast.error("Only QAs can prioritize comments");
      return;
    }

    try {
      setUpdatingPriority(commentId);

      const { error } = await supabase
        .from("asset_comments")
        .update({ is_priority: !currentPriority })
        .eq("id", commentId);

      if (error) {
        console.error("Error updating comment priority:", error);
        toast.error("Failed to update comment priority");
        return;
      }

      // Update local state
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, is_priority: !currentPriority }
            : comment
        )
      );

      toast.success(
        currentPriority
          ? "Comment unpinned from modeler dashboard"
          : "Comment pinned to modeler dashboard"
      );
    } catch (error) {
      console.error("Error toggling comment priority:", error);
      toast.error("Failed to update comment priority");
    } finally {
      setUpdatingPriority(null);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-muted">
        {/* Enhanced Header */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3 sm:gap-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackNavigation}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl hover:bg-primary/8 transition-colors cursor-pointer flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {asset?.product_name || "Review Asset"}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsNotesDialogOpen(true)}
                        className="gap-1 sm:gap-2 cursor-pointer bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 hover:text-yellow-700 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3 flex-shrink-0"
                      >
                        <StickyNote className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">
                          Notes ({notes.length})
                        </span>
                        <span className="sm:hidden">{notes.length}</span>
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${getStatusLabelClass(asset?.status || "")}`}
                      >
                        {getStatusLabelText(asset?.status || "")}
                      </Badge>
                      <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                        {asset?.article_id}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Viewer: {getViewerDisplayName(clientViewerType)}
                      </Badge>
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
                      {measurements && (
                        <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                          <span className="uppercase text-[10px] font-semibold tracking-wide text-muted-foreground/80">
                            Measurements
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            H: {formatMeasurementValue(measurements.h)}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            W: {formatMeasurementValue(measurements.w)}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            D: {formatMeasurementValue(measurements.d)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                {!viewingCurrentRevision && (
                  <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-800 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      Viewing revision {activeRevision}. Switch to revision{" "}
                      {asset?.revision_count ?? 0} to add or edit feedback.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-center">
                    <div className="text-sm sm:text-lg font-bold text-foreground">
                      {displayedAnnotations.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="hidden sm:inline">Annotations</span>
                      <span className="sm:hidden">Ann.</span>
                    </div>
                  </div>
                  <div className="w-px h-6 sm:h-8 bg-border"></div>
                  <div className="text-center">
                    <div className="text-sm sm:text-lg font-bold text-foreground">
                      {displayedComments.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="hidden sm:inline">Comments</span>
                      <span className="sm:hidden">Comm.</span>
                    </div>
                  </div>
                </div>

                {/* Compact Asset Status Section */}
                <div className="flex items-center gap-2">
                  <div className="w-px h-6 sm:h-8 bg-border"></div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      onClick={() => updateAssetStatus("in_production")}
                      disabled={
                        asset?.status === "in_production" || statusUpdating
                      }
                      variant={
                        asset?.status === "in_production"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-6 sm:h-7 px-2 text-xs cursor-pointer"
                    >
                      {statusUpdating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline ml-1">In Progress</span>
                    </Button>
                    <Button
                      onClick={async () => {
                        if (qaApproved === null) {
                          // Run QA analysis
                          try {
                            // Always open the QA dialog - it has upload functionality built in
                            // Set GLB URL if available
                            if (uploadedGlbUrl || asset?.glb_link) {
                              setUploadedGlbUrl(
                                uploadedGlbUrl || asset?.glb_link || ""
                              );
                            }
                            // Open dialog - user can upload reference images if needed
                            setShowQADialog(true);
                          } catch (error) {
                            console.error("Error starting QA:", error);
                            toast.error("Failed to start QA analysis");
                          }
                        }
                        // Note: If Auto QA approves, status is automatically set to delivered_by_artist
                        // So this button should only show "Run Auto QA" or be disabled if already delivered
                      }}
                      disabled={
                        asset?.status === "delivered_by_artist" ||
                        asset?.status === "approved" ||
                        asset?.status === "approved_by_client" ||
                        statusUpdating ||
                        qaApproved === false // Block if QA failed
                      }
                      variant={
                        asset?.status === "delivered_by_artist"
                          ? "default"
                          : qaApproved === true
                            ? "default"
                            : "outline"
                      }
                      size="sm"
                      className={`h-6 sm:h-7 px-2 text-xs ${
                        qaApproved === false
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      }`}
                      title={
                        qaApproved === false
                          ? "Cannot deliver: Model not approved by QA"
                          : qaApproved === null
                            ? "Run automated QA analysis to test model quality"
                            : qaApproved === true
                              ? "Model approved by QA - ready to deliver"
                              : undefined
                      }
                    >
                      {statusUpdating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : qaApproved === null ? (
                        <Camera className="h-3 w-3" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline ml-1">
                        {qaApproved === null
                          ? "Run Auto QA"
                          : asset?.status === "delivered_by_artist"
                            ? "Delivered"
                            : "Delivered"}
                      </span>
                    </Button>

                    {/* QA Status Indicator */}
                    <div className="flex items-center gap-1 text-xs">
                      {qaApproved === null ? (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-800 border-yellow-200"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Run QA
                        </Badge>
                      ) : qaApproved ? (
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800 border-green-200"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="bg-red-100 text-red-800 border-red-200"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          QA Not Approved
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row flex-1 overflow-y-auto xl:overflow-hidden bg-background">
          {/* Main Content (3D Viewer) */}
          <div className="flex-1 relative bg-background m-3 sm:m-6 rounded-lg shadow-lg border border-border/50 h-[65vh] xl:h-auto">
            <Script
              type="module"
              src="/model-viewer.js"
              onLoad={() => {}}
              onError={() => {
                console.error("❌ Failed to load model-viewer script");
              }}
            />

            {(() => {
              // Always prioritize database value, fallback to ref only during upload/restore
              const dbGlbLink = asset?.glb_link;
              const refGlbLink = currentGlbUrlRef.current;
              // Use ref if it exists and has cache-busting params (upload, restore, or t=)
              const currentUrl =
                dbGlbLink ||
                (refGlbLink &&
                (refGlbLink.includes("?t=") ||
                  refGlbLink.includes("restore=") ||
                  refGlbLink.includes("upload="))
                  ? refGlbLink
                  : null);

              return currentUrl && currentUrl !== "undefined";
            })() ? (
              <div className="w-full h-full  overflow-hidden">
                {/* @ts-expect-error -- model-viewer is a custom element */}
                <model-viewer
                  key={`${asset?.glb_link || ""}-${asset?.updated_at || ""}-${modelViewerKey}-${currentGlbUrlRef.current?.includes("restore=") ? currentGlbUrlRef.current.split("restore=")[1]?.split("&")[0] : currentGlbUrlRef.current?.includes("upload=") ? currentGlbUrlRef.current.split("upload=")[1]?.split("&")[0] : currentGlbUrlRef.current?.includes("?t=") ? currentGlbUrlRef.current.split("?t=")[1]?.split("&")[0] : ""}`} // Force re-render when GLB changes
                  ref={modelViewerRef}
                  src={(() => {
                    // Priority 1: Use ref if it has cache-busting params (upload, restore, or t=)
                    const refUrl = currentGlbUrlRef.current;
                    if (
                      refUrl &&
                      (refUrl.includes("upload=") ||
                        refUrl.includes("restore=") ||
                        refUrl.includes("?t="))
                    ) {
                      return refUrl;
                    }

                    // Priority 2: Use database value with cache-busting
                    const dbUrl = asset?.glb_link;
                    if (!dbUrl) {
                      return "";
                    }

                    // Add cache-busting parameter based on updated_at timestamp to ensure fresh load
                    const separator = dbUrl.includes("?") ? "&" : "?";
                    const cacheBuster = asset?.updated_at
                      ? `t=${new Date(asset.updated_at).getTime()}`
                      : `t=${Date.now()}`;
                    return `${dbUrl}${separator}${cacheBuster}`;
                  })()}
                  alt={asset.product_name}
                  camera-controls={true}
                  interaction-prompt="none"
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
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#fafafa",
                  }}
                  onLoad={() => {
                    console.log("📦 Model-viewer onLoad prop fired");
                    setModelLoaded(true);
                  }}
                >
                  {hotspots.map(
                    (hotspot) =>
                      hotspot.visible && (
                        <div
                          key={hotspot.id}
                          slot={`hotspot-${hotspot.id}`}
                          data-position={formatVector3(hotspot.position)}
                          data-normal={formatVector3(hotspot.normal)}
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
                              filteredAnnotations
                                .sort(
                                  (a: Annotation, b: Annotation) =>
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
                              {filteredAnnotations
                                .sort(
                                  (a: Annotation, b: Annotation) =>
                                    new Date(a.created_at).getTime() -
                                    new Date(b.created_at).getTime()
                                )
                                .findIndex((a) => a.id === hotspot.id) + 1}
                            </div>
                          </div>
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

            {/* GLB Upload Button and Version History */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              {/* File Requirements Banner */}
              {!asset.glb_link || !asset.blend_link ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs max-w-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-900">
                        Required Files:
                      </p>
                      <div className="space-y-0.5 text-amber-800">
                        <div className="flex items-center gap-1.5">
                          {asset.glb_link ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-amber-600" />
                          )}
                          <span>GLB File</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {asset.blend_link ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-amber-600" />
                          )}
                          <span>Blender File (.blend)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowVersionHistoryDialog(true);
                    fetchVersionHistory();
                  }}
                  variant="outline"
                  className="cursor-pointer"
                >
                  <History className="h-4 w-4 mr-2" />
                  Version History
                  {versionHistory.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full">
                      {versionHistory.length}
                    </span>
                  )}
                </Button>
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {asset.glb_link && asset.blend_link
                    ? "Update GLB + Blend"
                    : asset.glb_link || asset.blend_link
                      ? "Upload Files"
                      : "Upload Files"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Panel - Switchable between Reference Images and Feedback */}
          <div className="w-full xl:w-[620px] max-w-full flex flex-col bg-background shadow-lg border border-border/50 p-3 sm:p-6 h-[60vh] min-h-[600px] xl:h-auto xl:min-h-0 overflow-y-auto">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-4 sm:mb-6 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setRightPanelTab("feedback")}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  rightPanelTab === "feedback"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-2">
                  <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">
                    Feedback (
                    {displayedAnnotations.length + displayedComments.length})
                  </span>
                  <span className="sm:hidden">
                    Feedback (
                    {displayedAnnotations.length + displayedComments.length})
                  </span>
                </div>
              </button>
              <button
                onClick={() => setRightPanelTab("images")}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  rightPanelTab === "images"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-2">
                  <LucideImage className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">
                    Reference Images ({referenceImages.length})
                  </span>
                  <span className="sm:hidden">
                    Images ({referenceImages.length})
                  </span>
                </div>
              </button>
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
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                  <h4 className="text-sm sm:text-base font-semibold text-muted-foreground">
                    Feedback
                  </h4>
                </div>
                {revisionNumbers.length > 1 && (
                  <div className="mb-4 sm:mb-6 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Viewing Revision
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Switch between revision rounds to see associated
                          feedback.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeRevision !== (asset?.revision_count ?? 0) && (
                          <Badge variant="secondary" className="text-xs">
                            Latest: R{asset?.revision_count ?? 0}
                          </Badge>
                        )}
                        <Select
                          value={String(activeRevision)}
                          onValueChange={(value) =>
                            setActiveRevision(Number(value))
                          }
                        >
                          <SelectTrigger className="h-9 w-full sm:w-[220px] text-sm">
                            <SelectValue
                              placeholder={`Revision ${activeRevision}`}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {revisionNumbers.map((rev) => (
                              <SelectItem key={rev} value={String(rev)}>
                                {rev === (asset?.revision_count ?? 0)
                                  ? `Revision ${rev} (Current)`
                                  : rev === 0
                                    ? "Revision 0 (Original)"
                                    : `Revision ${rev}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {!viewingCurrentRevision && (
                      <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-800 flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          Viewing revision {activeRevision}. Switch to revision{" "}
                          {asset?.revision_count ?? 0} to reply to feedback.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Comment Section with Min Height */}
                <div className="min-h-[300px] sm:min-h-[400px] flex flex-col">
                  {/* Composer: hidden for modelers */}
                  {user.metadata?.role !== "modeler" && (
                    <div className="space-y-3 mb-4 sm:mb-6">
                      <Textarea
                        placeholder="Add a comment about this asset..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={handleNewCommentKeyDown}
                        disabled={feedbackLocked}
                        className={`min-h-[80px] sm:min-h-[100px] border-border focus:border-primary focus:ring-primary text-xs sm:text-sm ${
                          feedbackLocked ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        rows={3}
                      />
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>
                          {feedbackLocked
                            ? `Switch to revision ${
                                asset?.revision_count ?? 0
                              } to add new comments.`
                            : "Press Enter to send, Shift+Enter for new line"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Content - Combined Feed */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-3 sm:space-y-4">
                      {[
                        ...displayedAnnotations
                          .filter((a: any) => !a.parent_id)
                          .map((a) => ({
                            ...a,
                            type: "annotation" as const,
                          })),
                        ...displayedComments
                          .filter((c: any) => !c.parent_id)
                          .map((c) => ({
                            ...c,
                            type: "comment" as const,
                          })),
                      ]
                        .sort(
                          (a: any, b: any) =>
                            new Date(a.created_at).getTime() -
                            new Date(b.created_at).getTime()
                        )
                        .map((item) =>
                          item.type === "annotation" ? (
                            <Card
                              key={`annotation-${item.id}`}
                              className={`p-3 sm:p-6 transition-all duration-200 rounded-xl border border-border/50 ${
                                selectedHotspotId === item.id
                                  ? "ring-2 ring-primary/15 ring-offset-2 bg-primary/3 shadow-lg"
                                  : item.is_old_annotation
                                    ? "opacity-60 bg-muted/30 border-muted-foreground/20"
                                    : "hover:shadow-md hover:border-border"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3 sm:mb-4">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                  <div className="relative flex-shrink-0">
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                      <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white text-xs font-bold bg-amber-500">
                                      {displayedAnnotations
                                        .sort(
                                          (a: any, b: any) =>
                                            new Date(a.created_at).getTime() -
                                            new Date(b.created_at).getTime()
                                        )
                                        .findIndex((a) => a.id === item.id) + 1}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                                        {item.profiles?.email || "Unknown"}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs flex-shrink-0 ${
                                          item.is_old_annotation
                                            ? "bg-muted text-muted-foreground border-muted-foreground/30"
                                            : ""
                                        }`}
                                      >
                                        {item.is_old_annotation
                                          ? "Old Annotation"
                                          : "Annotation"}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] leading-tight flex-shrink-0"
                                      >
                                        {(() => {
                                          const annotationRevision =
                                            getAnnotationRevisionNumber(item);
                                          const displayRevision =
                                            item.is_old_annotation
                                              ? Math.min(
                                                  annotationRevision,
                                                  Math.max(
                                                    0,
                                                    (asset?.revision_count ??
                                                      0) - 1
                                                  )
                                                )
                                              : annotationRevision;
                                          return <>R{displayRevision}</>;
                                        })()}
                                      </Badge>
                                      {item.is_old_annotation && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs bg-orange-100 text-orange-700 border-orange-200"
                                        >
                                          Old
                                        </Badge>
                                      )}
                                    </div>
                                    {item.profiles?.title && (
                                      <Badge
                                        variant={
                                          getTitleBadgeVariant(
                                            item.profiles.title
                                          ) as any
                                        }
                                        className="text-xs px-1 sm:px-2 py-0.5 w-fit"
                                      >
                                        {item.profiles.title}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs sm:text-sm text-foreground p-2 rounded-md break-words overflow-hidden whitespace-pre-wrap font-sans">
                                  {linkifyText(item.comment)}
                                </div>
                                {item.image_url && (
                                  <div className="mt-3 sm:mt-4">
                                    <div className="relative w-full h-32 sm:h-48 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                                      {(() => {
                                        const fileName =
                                          item.image_url?.split("/").pop() ||
                                          "";
                                        const isGlbFile = fileName
                                          .toLowerCase()
                                          .endsWith(".glb");
                                        if (
                                          item.image_url.startsWith("file://")
                                        ) {
                                          return (
                                            <div className="w-full h-full bg-muted flex items-center justify-center">
                                              <div className="text-center">
                                                <LucideImage className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mx-auto mb-2" />
                                                <p className="text-xs sm:text-sm text-muted-foreground">
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
                                                <div className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 flex items-center justify-center">
                                                  <svg
                                                    className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                  </svg>
                                                </div>
                                                <p className="text-xs sm:text-sm text-muted-foreground">
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
                                <div className="mt-3 sm:mt-4 flex items-center gap-2">
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
                                    className="h-6 sm:h-7 px-2 text-xs cursor-pointer"
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
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] leading-tight"
                                      >
                                        R{getCommentRevisionNumber(item)}
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
                              {/* Star button for QAs */}
                              {user?.metadata?.role === "qa" && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      toggleCommentPriority(
                                        item.id,
                                        item.is_priority || false
                                      )
                                    }
                                    disabled={updatingPriority === item.id}
                                    className={`h-8 w-8 p-0 ${
                                      item.is_priority
                                        ? "text-yellow-500 hover:text-yellow-600"
                                        : "text-muted-foreground hover:text-yellow-500"
                                    }`}
                                    title={
                                      item.is_priority
                                        ? "Unpin from modeler dashboard"
                                        : "Pin to modeler dashboard"
                                    }
                                  >
                                    <Star className="h-4 w-4 fill-current" />
                                  </Button>
                                </div>
                              )}
                              <div className="text-sm text-foreground p-2 rounded-md break-words overflow-hidden whitespace-pre-wrap font-sans">
                                {linkifyText(item.comment)}
                              </div>
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
                                      type: "comment",
                                      id: item.id,
                                    })
                                  }
                                >
                                  Reply
                                </Button>
                                {replyingTo?.type === "comment" &&
                                  replyingTo.id === item.id && (
                                    <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                      <Textarea
                                        placeholder="Write a reply..."
                                        value={replyText}
                                        onChange={(e) =>
                                          setReplyText(e.target.value)
                                        }
                                        className="flex-1 text-xs sm:text-sm"
                                        rows={2}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={submitReply}
                                          disabled={
                                            !replyText.trim() || replySubmitting
                                          }
                                          className="cursor-pointer text-xs h-7 sm:h-8 flex-1 sm:flex-none"
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
                                          className="cursor-pointer text-xs h-7 sm:h-8 flex-1 sm:flex-none"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
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
                            </Card>
                          )
                        )}

                      {displayedAnnotations.length +
                        displayedComments.length ===
                        0 && (
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
              </div>
            )}
          </div>
        </div>

        {/* Unified Upload Dialog - Upload Both GLB and Blender Files */}
        <Dialog open={showUploadDialog} onOpenChange={handleUploadDialogClose}>
          <DialogContent className="max-w-2xl w-full h-fit max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Model Files
              </DialogTitle>
              <DialogDescription>
                Both GLB and Blender files are required for{" "}
                {asset?.product_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Asset Info */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Asset:</span>
                    <p className="font-medium">{asset?.product_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Article ID:</span>
                    <p className="font-mono font-medium">{asset?.article_id}</p>
                  </div>
                </div>
              </div>

              {/* File Status Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-lg border-2 p-3 ${
                    selectedFile
                      ? "border-amber-300 bg-amber-50"
                      : asset?.glb_link
                        ? "border-blue-200 bg-blue-50"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">GLB File</span>
                    {selectedFile ? (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        WILL REPLACE
                      </span>
                    ) : asset?.glb_link ? (
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    ) : null}
                  </div>
                  {selectedFile ? (
                    <div>
                      <p
                        className="text-xs font-medium text-amber-900 mb-1"
                        title={selectedFile.name}
                      >
                        New:{" "}
                        {selectedFile.name.length > 25
                          ? `${selectedFile.name.substring(0, 25)}...`
                          : selectedFile.name}
                      </p>
                      {asset?.glb_link && (
                        <p className="text-xs text-muted-foreground">
                          Current file will be backed up
                        </p>
                      )}
                    </div>
                  ) : asset?.glb_link ? (
                    <div>
                      <p className="text-xs text-blue-700 font-medium mb-1">
                        Current file exists
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Select new file to replace
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not uploaded yet
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-lg border-2 p-3 ${
                    selectedBlendFile
                      ? "border-amber-300 bg-amber-50"
                      : asset?.blend_link
                        ? "border-purple-200 bg-purple-50"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Blender File</span>
                    {selectedBlendFile ? (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        WILL REPLACE
                      </span>
                    ) : asset?.blend_link ? (
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                    ) : null}
                  </div>
                  {selectedBlendFile ? (
                    <div>
                      <p
                        className="text-xs font-medium text-amber-900 mb-1"
                        title={selectedBlendFile.name}
                      >
                        New:{" "}
                        {selectedBlendFile.name.length > 25
                          ? `${selectedBlendFile.name.substring(0, 25)}...`
                          : selectedBlendFile.name}
                      </p>
                      {asset?.blend_link && (
                        <p className="text-xs text-muted-foreground">
                          Current file will be backed up
                        </p>
                      )}
                    </div>
                  ) : asset?.blend_link ? (
                    <div>
                      <p className="text-xs text-purple-700 font-medium mb-1">
                        Current file exists
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Select new file to replace
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not uploaded yet
                    </p>
                  )}
                </div>
              </div>

              {/* GLB File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  GLB File (.glb or .gltf)
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    glbFileError
                      ? "border-red-300 bg-red-50/50"
                      : "border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                  }`}
                >
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const error = validateGlbFile(file);
                        setGlbFileError(error);
                        setSelectedFile(file);
                      }
                    }}
                    className="hidden"
                    id="glb-file-input"
                  />
                  <label htmlFor="glb-file-input" className="cursor-pointer">
                    <Upload
                      className={`h-8 w-8 mx-auto mb-2 ${
                        glbFileError ? "text-red-600" : "text-blue-600"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        glbFileError ? "text-red-900" : "text-blue-900"
                      }`}
                    >
                      {selectedFile
                        ? selectedFile.name
                        : "Click to select GLB file"}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Must match:{" "}
                      <span className="font-mono bg-blue-100 px-1 py-0.5 rounded">
                        {asset?.article_id}.glb
                      </span>
                    </p>
                  </label>
                  {selectedFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setGlbFileError(null);
                      }}
                      className="mt-2 text-xs"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {glbFileError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-900">
                      <p className="font-semibold mb-1">GLB File Error:</p>
                      <p>{glbFileError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Blender File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  Blender File (.blend)
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    blendFileError
                      ? "border-red-300 bg-red-50/50"
                      : "border-purple-200 bg-purple-50/50 hover:bg-purple-50"
                  }`}
                >
                  <input
                    type="file"
                    accept=".blend"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const error = validateBlendFile(file);
                        setBlendFileError(error);
                        setSelectedBlendFile(file);
                      }
                    }}
                    className="hidden"
                    id="blend-file-input"
                  />
                  <label htmlFor="blend-file-input" className="cursor-pointer">
                    <Upload
                      className={`h-8 w-8 mx-auto mb-2 ${
                        blendFileError ? "text-red-600" : "text-purple-600"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        blendFileError ? "text-red-900" : "text-purple-900"
                      }`}
                    >
                      {selectedBlendFile
                        ? selectedBlendFile.name
                        : "Click to select Blender file"}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Must match:{" "}
                      <span className="font-mono bg-purple-100 px-1 py-0.5 rounded">
                        {asset?.article_id}.blend
                      </span>
                    </p>
                  </label>
                  {selectedBlendFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBlendFile(null);
                        setBlendFileError(null);
                      }}
                      className="mt-2 text-xs"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {blendFileError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-900">
                      <p className="font-semibold mb-1">Blender File Error:</p>
                      <p>{blendFileError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleUploadDialogClose(false)}
                  disabled={uploading || uploadingBlend}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <Button
                          onClick={handleUploadBothFiles}
                          disabled={
                            uploading ||
                            uploadingBlend ||
                            !selectedFile ||
                            !selectedBlendFile ||
                            !!glbFileError ||
                            !!blendFileError
                          }
                          className="w-full"
                          variant={
                            (selectedFile && asset?.glb_link) ||
                            (selectedBlendFile && asset?.blend_link)
                              ? "default"
                              : "default"
                          }
                        >
                          {uploading || uploadingBlend ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {asset?.glb_link || asset?.blend_link
                                ? "Replace & Upload Both"
                                : "Upload Both Files"}
                            </>
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {(!selectedFile ||
                      !selectedBlendFile ||
                      glbFileError ||
                      blendFileError) &&
                      !uploading &&
                      !uploadingBlend && (
                        <TooltipContent>
                          <p className="text-sm">
                            {glbFileError || blendFileError
                              ? "Please fix file errors before uploading"
                              : !selectedFile && !selectedBlendFile
                                ? "Please select both GLB and Blender files"
                                : !selectedFile
                                  ? "Please select a GLB file"
                                  : "Please select a Blender file"}
                          </p>
                        </TooltipContent>
                      )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Warning message when replacing files */}
              {((selectedFile && asset?.glb_link) ||
                (selectedBlendFile && asset?.blend_link)) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-900">
                    <p className="font-medium mb-1">
                      You are about to replace existing files
                    </p>
                    <p className="text-amber-700">
                      Current {selectedFile && asset?.glb_link ? "GLB" : ""}
                      {selectedFile &&
                      asset?.glb_link &&
                      selectedBlendFile &&
                      asset?.blend_link
                        ? " and "
                        : ""}
                      {selectedBlendFile && asset?.blend_link ? "Blender" : ""}{" "}
                      file(s) will be backed up and can be restored from version
                      history.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Automated QA Modal */}
        <QAWorkflowModal
          isOpen={showQADialog}
          onClose={() => {
            setShowQADialog(false);
            // Reset QA approval state when modal closes without delivering
            // This allows new QA to run when a new model is uploaded
            if (asset?.status !== "delivered_by_artist") {
              setQaApproved(null);
            }
          }}
          glbUrl={uploadedGlbUrl || asset?.glb_link || ""}
          assetId={assetId}
          referenceImages={referenceImages}
          modelViewerRef={modelViewerRef}
          autoStart={autoQATriggered && referenceImages.length > 0}
          clientName={asset?.client}
          onReferenceImagesUpdate={async (newImages) => {
            // Update local state
            setReferenceImages(newImages);
            // Refresh reference images from database
            await fetchReferenceImages();
          }}
          onComplete={async (results) => {
            const isApproved = results?.status === "Approved";
            setQaApproved(isApproved);
            setShowQADialog(false);
            toast.info(`QA Analysis Complete: ${results?.status}`);

            // If approved, check for both GLB and Blender files before delivering
            if (isApproved) {
              // Check if Blender file is uploaded
              if (!asset?.blend_link) {
                toast.error(
                  "Blender file is required! Please upload the .blend file before delivering.",
                  { duration: 5000 }
                );
                setAutoQATriggered(false);
                return;
              }

              try {
                // Auto QA approved and both files present - set status directly to delivered_by_artist
                await updateAssetStatus("delivered_by_artist", {
                  qaStatus: true,
                });
                // Reset auto-trigger flag to prevent re-triggering
                setAutoQATriggered(true);
                toast.success("Model approved by Auto QA and delivered!");
              } catch (error) {
                console.error(
                  "Error updating status to delivered_by_artist:",
                  error
                );
                toast.error(
                  "QA approved but failed to update status. Please try again."
                );
              }
            } else {
              // If not approved, reset auto-trigger so user can try again
              setAutoQATriggered(false);
            }
          }}
        />

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
                      {String(asset?.article_id).toLowerCase()}
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

        {/* QA Reminder Dialog - Shown after upload */}
        <Dialog
          open={showQAReminderDialog}
          onOpenChange={setShowQAReminderDialog}
        >
          <DialogContent className="max-w-md w-full h-fit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Run Auto QA Required
              </DialogTitle>
              <DialogDescription className="text-sm">
                You need to run Auto QA before you can deliver the model.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium mb-1">
                    Auto QA is required before delivery
                  </p>
                  <p className="text-amber-700">
                    Please run Auto QA analysis on your uploaded model to ensure
                    quality standards are met. The model cannot be delivered
                    until Auto QA has been completed and approved.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setShowQAReminderDialog(false)}
              >
                I&apos;ll do it later
              </Button>
              <Button
                onClick={async () => {
                  setShowQAReminderDialog(false);
                  // Set uploaded GLB URL for QA
                  if (!uploadedGlbUrl && asset?.glb_link) {
                    setUploadedGlbUrl(asset.glb_link);
                  }
                  // Always open QA dialog - it has upload functionality built in
                  setShowQADialog(true);
                }}
              >
                Run Auto QA Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Version History Dialog */}
        <Dialog
          open={showVersionHistoryDialog}
          onOpenChange={setShowVersionHistoryDialog}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    File Version History
                  </DialogTitle>
                  <DialogDescription>
                    View and restore previous versions of GLB and Blend files.
                    The current version will be backed up before restoration.
                  </DialogDescription>
                </div>
                {versionHistory.length > 0 &&
                  versionHistory.some((v: any) => !v.isCurrent) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deleteAllVersions}
                      disabled={
                        deletingAllVersions ||
                        restoringVersion !== null ||
                        deletingVersion !== null
                      }
                      className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deletingAllVersions ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete All
                        </>
                      )}
                    </Button>
                  )}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading version history...
                  </span>
                </div>
              ) : versionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No version history
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upload GLB or Blend files to start version history
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {versionHistory.map((group: any) => (
                    <Card
                      key={group.id}
                      className={`p-4 transition-all duration-200 ${
                        group.isCurrent
                          ? "ring-2 ring-primary/20 bg-primary/5"
                          : "hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {group.isCurrent && (
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800 border-green-200"
                              >
                                Current
                              </Badge>
                            )}
                            {group.isBackup && (
                              <Badge variant="outline">Backup</Badge>
                            )}
                            <span
                              className="text-sm font-medium text-foreground truncate max-w-[400px]"
                              title={
                                group.glbFile?.fileName ||
                                group.blendFile?.fileName ||
                                "Version"
                              }
                            >
                              {(() => {
                                const fileName =
                                  group.glbFile?.fileName ||
                                  group.blendFile?.fileName ||
                                  "Version";
                                // For backup files, show a shorter version: filename...extension
                                if (
                                  group.isBackup &&
                                  fileName.includes("_backup_")
                                ) {
                                  const parts = fileName.split("_backup_");
                                  const baseName = parts[0];
                                  const timestampAndExt = parts[1];
                                  // Show first 20 chars of base name + ... + last part
                                  if (baseName.length > 20) {
                                    return `${baseName.substring(0, 20)}...backup_${timestampAndExt}`;
                                  }
                                }
                                return fileName;
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(group.lastModified).toLocaleString()}
                            </div>
                          </div>

                          {/* File Download Links */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {group.glbFile && (
                              <a
                                href={`${group.glbFile.fileUrl || group.glbFile.glbUrl}?v=${Date.now()}`}
                                download
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                              >
                                <Download className="h-3 w-3" />
                                GLB
                                {group.glbFile.fileSize > 0
                                  ? ` (${(group.glbFile.fileSize / 1024 / 1024).toFixed(2)} MB)`
                                  : group.isCurrent
                                    ? " "
                                    : ""}
                              </a>
                            )}
                            {group.blendFile && (
                              <a
                                href={`${group.blendFile.fileUrl || group.blendFile.glbUrl}?v=${Date.now()}`}
                                download
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              >
                                <Download className="h-3 w-3" />
                                Blend
                                {group.blendFile.fileSize > 0
                                  ? ` (${(group.blendFile.fileSize / 1024 / 1024).toFixed(2)} MB)`
                                  : group.isCurrent
                                    ? " "
                                    : ""}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {!group.isCurrent && group.glbFile && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  restoreVersion(
                                    group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl,
                                    "glb"
                                  )
                                }
                                disabled={
                                  restoringVersion ===
                                    (group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl) ||
                                  deletingVersion ===
                                    (group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl)
                                }
                                className="cursor-pointer"
                              >
                                {restoringVersion ===
                                (group.glbFile.fileUrl ||
                                  group.glbFile.glbUrl) ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                    Restoring...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-2" />
                                    Restore GLB
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  deleteVersion(
                                    group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl
                                  )
                                }
                                disabled={
                                  restoringVersion ===
                                    (group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl) ||
                                  deletingVersion ===
                                    (group.glbFile.fileUrl ||
                                      group.glbFile.glbUrl)
                                }
                                className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {deletingVersion ===
                                (group.glbFile.fileUrl ||
                                  group.glbFile.glbUrl) ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3 " />
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-primary" />
                Notes ({notes.length})
              </DialogTitle>
              <DialogDescription>
                Add and manage notes for this asset. Notes are visible to all
                users.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Add new note */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a new note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[100px]"
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="cursor-pointer"
                  >
                    Add Note
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setNewNote("")}
                    className="cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {notes.length > 0 ? (
                  notes.map((note) => (
                    <Card key={note.id} className="p-4">
                      <div className="space-y-3">
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editNoteContent}
                              onChange={(e) =>
                                setEditNoteContent(e.target.value)
                              }
                              className="min-h-[80px]"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateNote(note.id)}
                                disabled={!editNoteContent.trim()}
                                className="cursor-pointer"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditingNote}
                                className="cursor-pointer"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm text-foreground whitespace-pre-wrap">
                              {note.comment}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span>{note.profiles?.email || "Unknown"}</span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    note.created_at
                                  ).toLocaleDateString()}
                                </span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    note.created_at
                                  ).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingNote(note)}
                                  className="h-6 w-6 p-0 cursor-pointer"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteNote(note.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No notes yet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add your first note to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
