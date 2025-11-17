"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
import { ActivityLogger } from "@/lib/activityLogger";
import { AssetStatusLogger } from "@/lib/assetStatusLogger";
import { ApprovalHistory } from "@/components/review/ApprovalHistory";
import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Textarea, Input } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
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
  StickyNote,
  Edit3,
  Upload,
  Image as LucideImage,
  Eye,
  MoreVertical,
  Trash2,
  Maximize2,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Download,
  Star,
  FileText,
  Copy,
} from "lucide-react";
import Script from "next/script";
import { toast } from "sonner";
import Image from "next/image";

import "./annotation-styles.css";

interface Asset {
  id: string;
  product_name: string;
  article_id: string;
  article_ids?: string[];
  delivery_date: string;
  status: string;
  product_link: string;
  glb_link: string;
  pricing_comment?: string;
  measurements?: string | null;
  updated_at?: string | null;
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
    case "client_revision":
      return "status-client-revision";
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
      return "Sent for Revision";
    case "client_revision":
      return "Client Revision";
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

// Internal role (admin/qa) should see real statuses, clients see client-facing mapping above
const getStatusDisplay = (
  status?: string,
  role?: string
): { label: string; className: string } => {
  if (!status) return { label: "Unknown", className: "" };
  const isInternal = role === "admin" || role === "qa";

  if (isInternal) {
    return {
      label: getStatusLabelText(status),
      className: getStatusLabelClass(status),
    };
  } else {
    // Client-facing mapping
    switch (status) {
      case "in_production":
      case "not_started":
      case "delivered_by_artist":
        return { label: "In Production", className: "status-in-production" };
      case "revisions":
        return { label: "Feedback Given", className: "status-revisions" };
      case "client_revision":
        return {
          label: "Client Revision",
          className: "status-client-revision",
        };
      case "approved_by_client":
        return { label: "Approved", className: "status-approved-by-client" };
      case "approved":
        return { label: "New Upload", className: "status-approved" };
      default:
        return {
          label: status.replace(/_/g, " "),
          className: getStatusLabelClass(status),
        };
    }
  }
};

const normalizeArticleIds = (
  articleId: unknown,
  articleIds: unknown
): string[] => {
  const unique = new Set<string>();

  const pushValue = (value: unknown) => {
    if (value === null || value === undefined) return;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) unique.add(trimmed);
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      if (normalized) unique.add(normalized);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(pushValue);
    }
  };

  pushValue(articleId);

  if (Array.isArray(articleIds)) {
    articleIds.forEach(pushValue);
  } else if (typeof articleIds === "string" && articleIds.trim() !== "") {
    try {
      const parsed = JSON.parse(articleIds);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushValue);
      } else {
        pushValue(articleIds);
      }
    } catch {
      articleIds.split(/[\s,;|]+/).forEach(pushValue);
    }
  } else if (articleIds !== null && articleIds !== undefined) {
    pushValue(articleIds);
  }

  return Array.from(unique);
};

const getAdditionalArticleIds = (asset: {
  article_id?: string | null;
  article_ids?: string[] | null;
}): string[] => {
  if (!Array.isArray(asset?.article_ids)) return [];
  return asset.article_ids.filter(
    (id) => id && id !== (asset.article_id ?? undefined)
  );
};

const getArticleIdsTooltip = (articleIds: string[]): string | null => {
  if (articleIds.length <= 2) return null;
  const extraIds = articleIds.slice(2);
  return extraIds.join(", ");
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
  console.log("viewerType", viewerType);
};

const getViewerLabel = (viewerType?: string | null): string => {
  switch (viewerType) {
    case "v6_aces":
      return "V6 ACES";
    case "v5_tester":
      return "V5 Tester";
    case "synsam":
      return "Synsam";
    case "v2":
      return "V2 Classic";
    default:
      return "Default Viewer";
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
        // fall through to treat as single value
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

const createCacheBustedUrl = (
  url?: string | null,
  cacheKey?: string | number | null
): string | null => {
  if (!url) return null;

  const normalizedKey =
    cacheKey !== null && cacheKey !== undefined ? String(cacheKey) : null;

  const appendParam = (target: string) => {
    const separator = target.includes("?") ? "&" : "?";
    const keyValue = encodeURIComponent(
      normalizedKey ?? Date.now().toString(36)
    );
    return `${target}${separator}cb=${keyValue}`;
  };

  const isRelative = !/^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);

  if (typeof window === "undefined" && isRelative) {
    return appendParam(url);
  }

  try {
    const base =
      isRelative && typeof window !== "undefined"
        ? window.location.origin
        : undefined;
    const urlObj = base ? new URL(url, base) : new URL(url);
    urlObj.searchParams.set(
      "cb",
      normalizedKey ?? Date.now().toString(36) // fallback for unexpected missing key
    );
    const result = urlObj.toString();
    if (isRelative && typeof window !== "undefined") {
      return result.replace(window.location.origin, "");
    }
    return result;
  } catch {
    return appendParam(url);
  }
};

export default function ReviewPage() {
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
  const [modelLoaded, setModelLoaded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
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
  const [deleteMode, setDeleteMode] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("");
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditComment, setInlineEditComment] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [internalReferenceImages, setInternalReferenceImages] = useState<
    string[]
  >([]);
  const [internalReferenceFiles, setInternalReferenceFiles] = useState<
    string[]
  >([]);

  // Notes state
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      content: string;
      created_at: string;
      created_by: string;
      profiles?: {
        title?: string;
        role?: string;
        email?: string;
      };
    }>
  >([]);
  const [newNote, setNewNote] = useState("");
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [isApprovalHistoryDialogOpen, setIsApprovalHistoryDialogOpen] =
    useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [showComments, setShowComments] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<
    string | null
  >(null);

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
  >(null);
  const [selectedInternalReferenceIndex, setSelectedInternalReferenceIndex] =
    useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<"images" | "feedback">(
    "feedback"
  );

  const handleRemoveClientImage = async (index: number) => {
    if (!assetId) return;
    try {
      const updatedImages = referenceImages.filter((_, i) => i !== index);
      const updatedReferences = [...updatedImages, ...referenceFiles];
      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          reference: updatedReferences.length > 0 ? updatedReferences : null,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to delete reference image");
        return;
      }

      setReferenceImages(updatedImages);

      if (updatedImages.length === 0) {
        setSelectedReferenceIndex(null);
      } else if (selectedReferenceIndex !== null) {
        if (selectedReferenceIndex === index) {
          setSelectedReferenceIndex(Math.min(index, updatedImages.length - 1));
        } else if (selectedReferenceIndex > index) {
          setSelectedReferenceIndex(selectedReferenceIndex - 1);
        }
      }

      toast.success("Reference image deleted successfully");
    } catch (error) {
      console.error("Error deleting reference image:", error);
      toast.error("Failed to delete reference image");
    }
  };

  const renderReferenceSection = ({
    title,
    description,
    images,
    files,
    selectedIndex,
    onSelectImage,
    onRemoveImage,
    highlight,
  }: {
    title: string;
    description?: string;
    images: string[];
    files: string[];
    selectedIndex: number | null;
    onSelectImage: (index: number) => void;
    onRemoveImage?: (index: number) => void;
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
                  onClick={() =>
                    handleImageClick(
                      selectedImage,
                      `${title} ${safeIndex !== null ? safeIndex + 1 : ""}`.trim()
                    )
                  }
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
                    {onRemoveImage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveImage(index);
                        }}
                        className="absolute -top-1 -left-1 h-4 w-4 sm:h-5 sm:w-5 p-0 text-black/60 hover:text-black/80 hover:bg-black/5 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
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
              {files.map((fileUrl) => (
                <div
                  key={fileUrl}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
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
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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
  const [activeRevision, setActiveRevision] = useState(0);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showRevisionDetailsDialog, setShowRevisionDetailsDialog] =
    useState(false);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const maxRevisionFromHistory = useMemo(
    () =>
      revisionHistory.reduce(
        (max, rev) =>
          typeof rev?.revision_number === "number"
            ? Math.max(max, rev.revision_number)
            : max,
        0
      ),
    [revisionHistory]
  );
  const latestRevision = Math.max(revisionCount, maxRevisionFromHistory);
  useEffect(() => {
    setActiveRevision((prev) =>
      typeof prev === "number" && prev === latestRevision
        ? prev
        : latestRevision
    );
  }, [latestRevision]);
  const revisionNumbers = useMemo(
    () => Array.from({ length: latestRevision + 1 }, (_, i) => i),
    [latestRevision]
  );
  const viewingCurrentRevision = activeRevision === latestRevision;
  useEffect(() => {
    setSelectedHotspotId(null);
    setSelectedAnnotation(null);
    setReplyingTo(null);
  }, [activeRevision, latestRevision]);
  useEffect(() => {
    if (annotationMode && activeRevision !== latestRevision) {
      setAnnotationMode(false);
    }
  }, [annotationMode, activeRevision, latestRevision]);
  const getAnnotationRevision = (annotation: Annotation) => {
    if (typeof annotation.revision_number === "number") {
      return annotation.revision_number;
    }
    if (annotation.is_old_annotation) {
      return Math.max(0, latestRevision - 1);
    }
    return latestRevision;
  };
  const getCommentRevision = (comment: { revision_number?: number | null }) => {
    if (typeof comment?.revision_number === "number") {
      return comment.revision_number;
    }
    return latestRevision;
  };
  const annotationsForActiveRevision = useMemo(
    () =>
      annotations.filter((annotation) => {
        if (activeRevision === latestRevision && annotation.is_old_annotation) {
          return false;
        }
        return getAnnotationRevision(annotation) === activeRevision;
      }),
    [annotations, activeRevision, latestRevision]
  );
  const commentsForActiveRevision = useMemo(
    () =>
      comments.filter(
        (comment) => getCommentRevision(comment) === activeRevision
      ),
    [comments, activeRevision, latestRevision]
  );
  const filteredAnnotations = annotationsForActiveRevision;
  const allAnnotations = annotations;
  const displayedAnnotations = filteredAnnotations;
  const displayedComments = commentsForActiveRevision;
  const clientReferenceCount = referenceImages.length + referenceFiles.length;
  const internalReferenceCount =
    internalReferenceImages.length + internalReferenceFiles.length;
  const totalReferenceCount =
    clientReferenceCount + (isClient ? 0 : internalReferenceCount);

  const modelViewerRef = useRef<any>(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fileInputRef = useRef<HTMLInputElement>(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modelViewerKey, setModelViewerKey] = useState(0);

  const measurements = parseMeasurements(asset?.measurements ?? null);

  // Reply system state
  const [replyingTo, setReplyingTo] = useState<{
    type: "annotation" | "comment";
    id: string;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  // Undo functionality state
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [annotationHistory, setAnnotationHistory] = useState<Annotation[]>([]);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [undoStack, setUndoStack] = useState<Annotation[]>([]);
  const [lastDeletedAnnotation, setLastDeletedAnnotation] =
    useState<Annotation | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Approval confirmation dialog state
  const [showApprovalConfirmDialog, setShowApprovalConfirmDialog] =
    useState(false);

  const userClientKey = useMemo(() => {
    const clientMeta = user?.metadata?.client;
    if (!clientMeta) return "";
    if (Array.isArray(clientMeta)) {
      return clientMeta.slice().sort().join("|");
    }
    if (typeof clientMeta === "string") {
      return clientMeta;
    }
    return JSON.stringify(clientMeta);
  }, [user?.metadata?.client]);

  const clientFilterValues = useMemo(() => {
    const clientMeta = user?.metadata?.client;
    if (!clientMeta) return [];
    if (Array.isArray(clientMeta)) {
      return clientMeta
        .map((value) => (value != null ? String(value) : ""))
        .filter((value) => value.length > 0);
    }
    return [String(clientMeta)];
  }, [userClientKey]);

  const userId = user?.id ?? null;
  const canBypassClientFilter =
    normalizedUserRole === "admin" || normalizedUserRole === "qa";

  const latestAssetIdRef = useRef<string | null>(null);
  useEffect(() => {
    latestAssetIdRef.current = asset?.id ?? null;
  }, [asset?.id]);

  // Function to handle back navigation based on where user came from
  const handleBackNavigation = () => {
    const from = searchParams.get("from");
    if (from === "client-review") {
      // Preserve all URL parameters when navigating back to client-review
      const params = new URLSearchParams();

      // Get all possible parameters that might be in the client-review URL
      const possibleParams = [
        "client",
        "batch",
        "modeler",
        "email",
        "status",
        "priority",
        "search",
        "sort",
        "page",
        "view",
        "filter",
      ];

      possibleParams.forEach((param) => {
        const value = searchParams.get(param);
        if (value) params.set(param, value);
      });

      const queryString = params.toString();
      router.push(`/client-review${queryString ? `?${queryString}` : ""}`);
    } else if (from === "qa-review") {
      router.push("/qa-review");
    } else if (from === "admin-review") {
      // Preserve parameters for admin-review
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

  // Fetch asset data
  useEffect(() => {
    let isCancelled = false;

    async function fetchAsset() {
      if (!assetId || !userId) return;

      if (!canBypassClientFilter && clientFilterValues.length === 0) return;

      const shouldShowLoading =
        !latestAssetIdRef.current || latestAssetIdRef.current !== assetId;

      if (shouldShowLoading) {
        setLoading(true);
      }

      try {
        let query = supabase
          .from("onboarding_assets")
          .select("*")
          .eq("id", assetId);

        if (!canBypassClientFilter && clientFilterValues.length > 0) {
          query = query.in("client", clientFilterValues);
        }

        if (normalizedUserRole === "client") {
          query = query.eq("transferred", false);
        }

        const { data, error } = await query.single();

        if (error) {
          console.error("Error fetching asset:", error);
          toast.error("Failed to load asset");
          return;
        }

        const articleIds = normalizeArticleIds(
          (data as any).article_id,
          (data as any).article_ids
        );

        if (!isCancelled) {
          setAsset({
            ...(data as any),
            article_ids: articleIds,
            article_id: articleIds[0] || (data as any).article_id,
          });
          latestAssetIdRef.current = assetId;
        }

        try {
          const clientName = (data as any)?.client ?? "";
          const clientId =
            typeof (data as any)?.client_id === "string"
              ? ((data as any)?.client_id as string)
              : null;

          const params = new URLSearchParams();
          if (clientId) {
            params.set("id", clientId);
          } else if (clientName) {
            params.set("name", clientName);
          }

          if (params.size > 0) {
            const response = await fetch(
              `/api/clients/viewer-type?${params.toString()}`,
              { cache: "no-store" }
            );

            if (response.ok) {
              const payload = await response.json();
              if (!isCancelled) {
                setClientViewerType(payload.viewerType ?? null);
              }
            } else if (!isCancelled) {
              setClientViewerType(null);
            }
          } else if (!isCancelled) {
            setClientViewerType(null);
          }
        } catch (error) {
          console.error("Error fetching client viewer type:", error);
          if (!isCancelled) {
            setClientViewerType(null);
          }
        }

        let finalRevisionCount = data.revision_count || 0;

        if (finalRevisionCount === 0) {
          const { data: revisionHistory } = await supabase
            .from("revision_history")
            .select("revision_number")
            .eq("asset_id", assetId)
            .order("revision_number", { ascending: false })
            .limit(1);

          if (revisionHistory && revisionHistory.length > 0) {
            finalRevisionCount = revisionHistory[0].revision_number;

            await supabase
              .from("onboarding_assets")
              .update({ revision_count: finalRevisionCount })
              .eq("id", assetId);
          }
        }

        if (!isCancelled) {
          setRevisionCount(finalRevisionCount);
        }

        const clientReferenceValues = parseReferenceValues(data.reference);
        const clientMedia = categorizeReferenceMedia(clientReferenceValues);
        if (!isCancelled) {
          setReferenceImages(clientMedia.images);
          setReferenceFiles(clientMedia.files);
          setSelectedReferenceIndex(clientMedia.images.length > 0 ? 0 : null);
        }

        if (!isClient && !isCancelled) {
          const internalReferenceValues = parseReferenceValues(
            (data as any).internal_reference
          );
          const internalMedia = categorizeReferenceMedia(
            internalReferenceValues
          );
          setInternalReferenceImages(internalMedia.images);
          setInternalReferenceFiles(internalMedia.files);
          setSelectedInternalReferenceIndex(
            internalMedia.images.length > 0 ? 0 : null
          );
        } else if (!isCancelled) {
          setInternalReferenceImages([]);
          setInternalReferenceFiles([]);
          setSelectedInternalReferenceIndex(null);
        }
      } finally {
        if (!isCancelled && shouldShowLoading) {
          setLoading(false);
        }
      }
    }

    fetchAsset();

    return () => {
      isCancelled = true;
    };
  }, [
    assetId,
    canBypassClientFilter,
    clientFilterValues,
    normalizedUserRole,
    userClientKey,
    userId,
  ]);

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
      if (!assetId || !userId) return;

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
          .not("comment", "like", "NOTE:%");

        if (normalizedUserRole === "client") {
          query = query.eq("created_by", userId);
        }

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
  }, [assetId, normalizedUserRole, userId]);

  // Fetch notes (using asset_comments with a special prefix)
  useEffect(() => {
    async function fetchNotes() {
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
          .like("comment", "NOTE:%")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching notes:", error);
        } else {
          // Transform the data to match our notes structure
          const notesData = (data || []).map((comment) => ({
            id: comment.id,
            content: comment.comment.replace(/^NOTE:\s*/, ""), // Remove the NOTE: prefix
            created_at: comment.created_at,
            created_by: comment.created_by,
            profiles: comment.profiles,
          }));
          setNotes(notesData);
        }
      } catch (error) {
        console.error("Error fetching notes:", error);
      }
    }

    fetchNotes();
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

  // Keyboard event listeners for Ctrl key detection and shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setIsCtrlPressed(true);
      }

      // Handle keyboard shortcuts
      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        centerModel();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        undoLastDeletion();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [lastDeletedAnnotation, modelLoaded]);

  // Clear undo state when asset changes
  useEffect(() => {
    setLastDeletedAnnotation(null);
    setIsUndoing(false);
  }, [assetId]);

  // Prevent client from leaving page if they have unconfirmed revisions
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show warning for clients who have added comments but haven't confirmed revision
      if (user?.metadata?.role === "client" && showRevisionDialog) {
        event.preventDefault();
        event.returnValue =
          "You have unconfirmed revision requests. Are you sure you want to leave?";
        return "You have unconfirmed revision requests. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user?.metadata?.role, showRevisionDialog]);

  // Handle model load
  const handleModelLoaded = () => {
    setModelLoaded(true);
    // Hide tooltip after 30 seconds
    setTimeout(() => {
      setShowTooltip(false);
    }, 5000);
  };

  // Auto-hide tooltip after 30 seconds regardless of model load state
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - runs once on mount

  // Center the 3D model
  const centerModel = () => {
    if (modelViewerRef.current && modelLoaded) {
      // Reset camera to default position
      modelViewerRef.current.cameraTarget = "0m 0m 0m";
      modelViewerRef.current.cameraOrbit = "0deg 75deg 1.5m";
      modelViewerRef.current.play();
    }
  };

  // Undo last deleted annotation
  const undoLastDeletion = async () => {
    if (lastDeletedAnnotation && !isUndoing) {
      setIsUndoing(true);
      try {
        const response = await fetch("/api/annotations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            asset_id: lastDeletedAnnotation.asset_id,
            position: lastDeletedAnnotation.position,
            normal: lastDeletedAnnotation.normal,
            surface: lastDeletedAnnotation.surface,
            comment: lastDeletedAnnotation.comment,
            image_url: lastDeletedAnnotation.image_url,
            parent_id: lastDeletedAnnotation.parent_id,
          }),
        });

        const data = await response.json();

        if (response.ok && data.annotation) {
          // Add the restored annotation back to the list
          setAnnotations((prev) => [...prev, data.annotation]);
          setLastDeletedAnnotation(null);
          toast.success("Annotation restored successfully");
        } else {
          toast.error(data.error || "Failed to restore annotation");
        }
      } catch (error) {
        console.error("Error restoring annotation:", error);
        toast.error("Failed to restore annotation");
      } finally {
        setIsUndoing(false);
      }
    }
  };

  // Handle hotspot creation
  const handleHotspotCreate = (
    position: Vector3,
    normal: Vector3 = DEFAULT_NORMAL
  ) => {
    // Create a temporary annotation that appears instantly
    const tempAnnotation: Annotation = {
      id: `temp-${Date.now()}`, // Temporary ID
      asset_id: assetId,
      position: formatVector3(position),
      normal: formatVector3(normal),
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
      const annotation = filteredAnnotations.find(
        (ann) => ann.id === hotspotId
      );
      if (annotation) {
        setSelectedAnnotation(annotation);
        setHighlightedAnnotationId(hotspotId);

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

        // Scroll to the annotation in the feedback section
        setTimeout(() => {
          const annotationElement = document.getElementById(
            `annotation-${hotspotId}`
          );
          if (annotationElement) {
            annotationElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });

            // Add a temporary highlight effect
            annotationElement.classList.add(
              "ring-2",
              "ring-primary",
              "ring-opacity-50"
            );
            setTimeout(() => {
              annotationElement.classList.remove(
                "ring-2",
                "ring-primary",
                "ring-opacity-50"
              );
              setHighlightedAnnotationId(null);
            }, 2000);
          }
        }, 100);
      }
    } else {
      setSelectedAnnotation(null);
      setHighlightedAnnotationId(null);
    }
  };

  // Save annotation
  const saveAnnotation = async () => {
    if (!selectedAnnotation) return;

    const annotationData = {
      asset_id: selectedAnnotation.asset_id,
      position: selectedAnnotation.position,
      normal: selectedAnnotation.normal,
      surface: selectedAnnotation.surface,
      comment: newComment.trim() || "",
      image_url: newImageUrl.trim() || null,
      revision_number: revisionCount,
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
        // Clear undo state when new annotation is created
        setLastDeletedAnnotation(null);
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
              ? {
                  ...ann,
                  comment: editComment.trim(),
                  image_url: editImageUrl.trim() || undefined,
                }
              : ann
          )
        );
        setEditingAnnotation(null);
        setEditComment("");
        setEditImageUrl("");
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

      // Store the annotation for undo before deleting
      if (annotation) {
        setLastDeletedAnnotation(annotation);
      }

      const response = await fetch(`/api/annotations?id=${annotationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setAnnotations((prev) => prev.filter((ann) => ann.id !== annotationId));
        setSelectedHotspotId(null);
        toast.success("Annotation deleted successfully (Ctrl+Z to undo)");
      } else {
        toast.error(data.error || "Failed to delete annotation");
        // Clear the stored annotation if deletion failed
        setLastDeletedAnnotation(null);
      }
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete annotation");
      // Clear the stored annotation if deletion failed
      setLastDeletedAnnotation(null);
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
    const annotation = filteredAnnotations.find(
      (ann) => ann.id === annotationId
    );
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
    setInlineEditingId(annotation.id);
    setInlineEditComment(annotation.comment);
  };

  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditComment("");
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

      // Add new URLs to existing references
      const newReferenceImages = [...referenceImages, ...uploadedUrls];
      const combinedReferences = [...newReferenceImages, ...referenceFiles];

      // Update the asset in the database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          reference: combinedReferences.length > 0 ? combinedReferences : null,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to save reference images");
        return;
      }

      // Update local state
      const categorized = categorizeReferenceMedia(combinedReferences);
      setReferenceImages(categorized.images);
      setReferenceFiles(categorized.files);
      setSelectedReferenceIndex(
        categorized.images.length > 0 ? categorized.images.length - 1 : null
      );
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

      const newReferenceImages = [...referenceImages, referenceImageUrl.trim()];
      const combinedReferences = [...newReferenceImages, ...referenceFiles];

      // Update the asset in the database
      const { error } = await supabase
        .from("onboarding_assets")
        .update({
          reference: combinedReferences.length > 0 ? combinedReferences : null,
        })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating reference images:", error);
        toast.error("Failed to save reference image URL");
        return;
      }

      // Update local state
      const categorized = categorizeReferenceMedia(combinedReferences);
      setReferenceImages(categorized.images);
      setReferenceFiles(categorized.files);
      setSelectedReferenceIndex(
        categorized.images.length > 0 ? categorized.images.length - 1 : null
      );
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

  // Handle paste image for edit mode
  const handleEditPasteImage = async (e: React.ClipboardEvent) => {
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
              setEditImageUrl(data.url);
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

    // Prevent revision for assets that are not started or already approved by client
    if (
      (newStatus === "revisions" || newStatus === "client_revision") &&
      (asset?.status === "not_started" ||
        asset?.status === "approved_by_client")
    ) {
      const errorMessage =
        asset?.status === "not_started"
          ? "Cannot send for revision - asset has not been started yet"
          : "Cannot send for revision - asset has already been approved by client";
      toast.error(errorMessage);
      return;
    }

    // Validate feedback before allowing revision
    if (
      (newStatus === "revisions" || newStatus === "client_revision") &&
      !hasValidFeedback()
    ) {
      const userRole = user?.metadata?.role;
      // eslint-disable-next-line
      const roleText = userRole === "client" ? "client" : "QA";
      toast.error(
        `Please add annotations or comments before requesting a revision`
      );
      return;
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
            assetId,
            status: newStatus,
            revisionCount: revisionNumber,
          }),
        });
      } else {
        // For all other status updates, use direct database update
        const updateData: any = {
          status: newStatus,
        };

        // Add revision count if provided
        if (newStatus === "revisions" || newStatus === "client_revision") {
          updateData.revision_count = revisionNumber;
        }

        const { error: updateError } = await supabase
          .from("onboarding_assets")
          .update(updateData)
          .eq("id", assetId);

        if (updateError) {
          throw new Error(`Failed to update status: ${updateError.message}`);
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

      // Update local state
      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
      setRevisionCount(revisionNumber);

      // Log the activity with proper tracking using both systems
      try {
        const assetName = asset?.product_name;

        // Log to the new asset_status_history table
        if (newStatus === "approved_by_client") {
          await AssetStatusLogger.clientApproved(
            assetId,
            asset?.status,
            revisionNumber
          );
        } else if (newStatus === "approved") {
          await AssetStatusLogger.qaApproved(
            assetId,
            asset?.status,
            revisionNumber
          );
        } else if (newStatus === "revisions") {
          await AssetStatusLogger.qaSentForRevision(
            assetId,
            asset?.status,
            revisionNumber
          );
        } else if (newStatus === "client_revision") {
          await AssetStatusLogger.clientRequestedRevision(
            assetId,
            asset?.status,
            revisionNumber
          );
        } else if (newStatus === "delivered_by_artist") {
          await AssetStatusLogger.deliveredByArtist(assetId, asset?.status);
        } else if (newStatus === "in_production") {
          await AssetStatusLogger.movedToProduction(assetId, asset?.status);
        } else if (newStatus === "in_progress") {
          await AssetStatusLogger.workStarted(assetId, asset?.status);
        } else if (asset?.status) {
          await AssetStatusLogger.statusChanged(
            assetId,
            asset.status,
            newStatus
          );
        }

        // Also keep the old activity logging for backward compatibility
        if (newStatus === "approved_by_client") {
          await ActivityLogger.assetApprovedByClient(
            assetId,
            assetName,
            revisionNumber
          );
        } else if (newStatus === "approved") {
          await ActivityLogger.assetApproved(
            assetId,
            assetName,
            user?.email,
            revisionNumber
          );
        } else if (newStatus === "revisions") {
          await ActivityLogger.assetSentForRevision(
            assetId,
            assetName,
            revisionNumber
          );
        } else if (newStatus === "client_revision") {
          await ActivityLogger.assetClientRevision(
            assetId,
            assetName,
            revisionNumber
          );
        } else if (asset?.status) {
          await ActivityLogger.assetStatusChanged(
            assetId,
            asset.status,
            newStatus,
            assetName
          );
        }
      } catch (error) {
        console.error("Error logging approval activity:", error);
        // Don't throw - activity logging shouldn't block status updates
      }

      // Refresh annotations when status changes to revisions (annotations marked as old)
      if (newStatus === "revisions") {
        try {
          const response = await fetch(`/api/annotations?asset_id=${assetId}`);
          const data = await response.json();
          if (response.ok) {
            setAnnotations(data.annotations || []);
          }
        } catch (error) {
          console.error("Error refreshing annotations:", error);
        }
      }

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

  // Helper function to check if client has provided any feedback
  const hasClientFeedback = () => {
    // Get the last revision timestamp
    const lastRevision =
      revisionHistory.length > 0
        ? revisionHistory[revisionHistory.length - 1]
        : null;

    const lastRevisionTime = lastRevision?.created_at
      ? new Date(lastRevision.created_at).getTime()
      : 0;

    // Check if there are any annotations created by the current client since the last revision
    const clientAnnotations = annotations.filter(
      (annotation) =>
        annotation.created_by === user?.id &&
        new Date(annotation.created_at).getTime() > lastRevisionTime
    );

    // Check if there are any comments created by the current client since the last revision
    const clientComments = comments.filter(
      (comment) =>
        comment.created_by === user?.id &&
        new Date(comment.created_at).getTime() > lastRevisionTime
    );

    return clientAnnotations.length > 0 || clientComments.length > 0;
  };

  // Helper function to check if QA has provided any feedback since the last revision
  const hasQAFeedback = () => {
    // Get the current revision number
    const currentRevision = revisionCount || 0;

    // Get the last revision timestamp
    const lastRevision =
      revisionHistory.length > 0
        ? revisionHistory[revisionHistory.length - 1]
        : null;

    const lastRevisionTime = lastRevision?.created_at
      ? new Date(lastRevision.created_at).getTime()
      : 0;

    // Check if there are any annotations created by the current QA user since the last revision
    const qaAnnotations = annotations.filter(
      (annotation) =>
        annotation.created_by === user?.id &&
        new Date(annotation.created_at).getTime() > lastRevisionTime
    );

    // Check if there are any comments created by the current QA user since the last revision
    const qaComments = comments.filter(
      (comment) =>
        comment.created_by === user?.id &&
        new Date(comment.created_at).getTime() > lastRevisionTime
    );

    // If this is the first revision (revision 1), any feedback is valid
    if (currentRevision === 0) {
      const hasFeedback = qaAnnotations.length > 0 || qaComments.length > 0;
      return hasFeedback;
    }

    // For subsequent revisions, check for new feedback since the last revision
    const hasFeedback = qaAnnotations.length > 0 || qaComments.length > 0;
    return hasFeedback;
  };

  // Comprehensive feedback validation for both clients and QA
  const hasValidFeedback = () => {
    const userRole = user?.metadata?.role;

    // Check for exact role matches (case-insensitive)
    const normalizedRole = userRole?.toLowerCase?.();
    if (normalizedRole === "client") {
      const hasFeedback = hasClientFeedback();
      return hasFeedback;
    } else if (normalizedRole === "qa") {
      const hasFeedback = hasQAFeedback();
      return hasFeedback;
    }

    // For other roles (admin, etc.), allow revisions without feedback validation
    return true;
  };

  const updateAssetStatus = async (newStatus: string, skipDialog = false) => {
    if (!assetId) return;

    // Prevent revision for assets that are not started or already approved by client
    if (
      (newStatus === "revisions" || newStatus === "client_revision") &&
      (asset?.status === "not_started" ||
        asset?.status === "approved_by_client")
    ) {
      const errorMessage =
        asset?.status === "not_started"
          ? "Cannot send for revision - asset has not been started yet"
          : "Cannot send for revision - asset has already been approved by client";
      toast.error(errorMessage);
      return;
    }

    // Handle revision workflow
    if (
      (newStatus === "revisions" || newStatus === "client_revision") &&
      !skipDialog
    ) {
      const currentRevisionCount = revisionCount + 1;
      const userRole = user?.metadata?.role;

      // Check if user has provided valid feedback before allowing revision

      if (!hasValidFeedback()) {
        // eslint-disable-next-line
        const roleText = userRole === "client" ? "client" : "QA";
        toast.error(
          `Please add annotations or comments before requesting a revision`
        );
        return;
      }

      // Show revision dialogs for clients
      if (userRole === "client") {
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
      // For QA/Admin approvals, use simple status update
      // For client approvals, use the complete API endpoint for proper allocation list handling
      let response;

      if (
        (newStatus === "approved" ||
          newStatus === "revisions" ||
          newStatus === "client_revision" ||
          newStatus === "in_progress" ||
          newStatus === "in_production") &&
        (user?.metadata?.role === "qa" || user?.metadata?.role === "admin")
      ) {
        // Simple status update for QA/Admin approvals and revisions
        const updateData: any = {
          status: newStatus,
          updated_at: new Date().toISOString(), // Set updated_at timestamp
        };

        // Add revision count if provided
        if (newStatus === "revisions" || newStatus === "client_revision") {
          updateData.revision_count = revisionCount;
        }

        const { error: updateError } = await supabase
          .from("onboarding_assets")
          .update(updateData)
          .eq("id", assetId);

        if (updateError) {
          throw new Error(`Failed to update status: ${updateError.message}`);
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
      } else if (newStatus === "approved_by_client") {
        // Use the complete API endpoint only for client approvals (which transfers asset to production)
        response = await fetch("/api/assets/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId,
            status: newStatus,
            revisionCount: revisionCount,
          }),
        });
      } else {
        // For all other status updates, use direct database update
        const updateData: any = {
          status: newStatus,
        };

        // Add revision count if provided
        if (newStatus === "revisions" || newStatus === "client_revision") {
          updateData.revision_count = revisionCount;
        }

        const { error: updateError } = await supabase
          .from("onboarding_assets")
          .update(updateData)
          .eq("id", assetId);

        if (updateError) {
          throw new Error(`Failed to update status: ${updateError.message}`);
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

      // Handle notification sending based on status changes
      if (newStatus === "revisions" || newStatus === "client_revision") {
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

          // Send email notification to client when QA/Admin approves
          // Find client user who has access to this asset's client name
          const { data: clientProfiles, error: clientError } = await supabase
            .from("profiles")
            .select("id, email, role, client, metadata")
            .contains("client", [(asset as any)?.client]);

          const profileHasClientRole = (profile: {
            role?: string | null;
            metadata?: any;
          }): boolean => {
            if (profile?.role === "client") return true;

            if (!profile?.metadata) return false;

            let parsed: Record<string, any> | null = null;

            try {
              parsed =
                typeof profile.metadata === "string"
                  ? JSON.parse(profile.metadata)
                  : profile.metadata;
            } catch {
              parsed = null;
            }

            const allowedRoles = parsed?.allowed_roles || parsed?.roles;

            if (Array.isArray(allowedRoles)) {
              return allowedRoles.includes("client");
            }

            return false;
          };

          const filterProfilesByClient = (
            profiles: Array<{
              id: string;
              email: string | null;
              client: string[] | string | null;
              role?: string | null;
              metadata?: any;
            }> = []
          ) => {
            const targetClient = ((asset as any)?.client || "")
              .toString()
              .trim()
              .toLowerCase();

            return profiles.filter((profile) => {
              if (!profileHasClientRole(profile)) return false;

              const profileClient = profile.client;

              if (Array.isArray(profileClient)) {
                return profileClient
                  .map((value) => value?.toString().trim().toLowerCase())
                  .includes(targetClient);
              }

              if (typeof profileClient === "string") {
                return profileClient.trim().toLowerCase() === targetClient;
              }

              return false;
            });
          };

          let resolvedClientProfiles = filterProfilesByClient(
            clientProfiles || []
          );

          if (
            (!clientProfiles || clientProfiles.length === 0) &&
            !clientError
          ) {
            console.log(
              "[QA Approval] Client profile lookup returned 0 rows. Attempting fallback fetch.",
              {
                client: (asset as any)?.client,
              }
            );

            const { data: fallbackProfiles, error: fallbackError } =
              await supabase
                .from("profiles")
                .select("id, email, role, client, metadata");

            if (fallbackError) {
              console.error(
                "❌ Fallback client profile fetch failed:",
                fallbackError
              );
            } else if (fallbackProfiles) {
              resolvedClientProfiles = filterProfilesByClient(fallbackProfiles);
            }
          }

          if (clientError) {
            console.error(
              "❌ Failed to fetch client profiles for QA approval:",
              clientError
            );
          }

          console.log("[QA Approval] Client profile lookup", {
            client: (asset as any)?.client,
            totalProfiles: resolvedClientProfiles.length,
          });

          if (resolvedClientProfiles.length > 0 && asset) {
            try {
              // Determine approver role and name
              const approverRole =
                user?.metadata?.role === "admin" ? "Admin Team" : "QA Team";
              //eslint-disable-next-line @typescript-eslint/no-unused-vars
              const approverName =
                user?.user_metadata?.name || user?.email || approverRole;

              const modelerName =
                modelerProfile?.title?.trim() ||
                (modelerProfile?.email
                  ? modelerProfile.email.split("@")[0]
                  : "Our QA Team");

              for (const clientProfile of resolvedClientProfiles) {
                if (!clientProfile.email) {
                  console.warn(
                    "[QA Approval] Client profile missing email, skipping",
                    clientProfile.id
                  );
                  continue;
                }

                console.log(
                  "[QA Approval] Sending client review notification",
                  {
                    clientProfileId: clientProfile.id,
                    clientEmail: clientProfile.email,
                    assetId,
                    assetName: asset.product_name,
                  }
                );

                try {
                  await notificationService.sendClientReviewReadyNotification(
                    assetId,
                    clientProfile.id,
                    clientProfile.email,
                    asset.product_name,
                    (asset as any).client,
                    modelerName
                  );
                  console.log(
                    "[QA Approval] Client notification created",
                    clientProfile.email
                  );
                } catch (notificationError) {
                  console.error(
                    "❌ Failed to create client review notification:",
                    notificationError
                  );
                }
              }
            } catch (notificationLoopError) {
              console.error(
                "❌ Failed during QA approval client notification loop:",
                notificationLoopError
              );
            }
          } else {
            console.warn(
              "[QA Approval] No client profiles found for notification",
              {
                client: (asset as any)?.client,
                assetId,
              }
            );
          }
        } catch (error) {
          console.error("❌ Failed to send approval notifications:", error);
        }
      }

      // Update local state
      setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (newStatus === "revisions" || newStatus === "client_revision") {
        setRevisionCount((prev) => prev + 1);

        // Refresh annotations when status changes to revisions (annotations marked as old)
        try {
          const response = await fetch(`/api/annotations?asset_id=${assetId}`);
          const data = await response.json();
          if (response.ok) {
            setAnnotations(data.annotations || []);
          }
        } catch (error) {
          console.error("Error refreshing annotations:", error);
        }
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
          toast.success(`Status updated to ${getStatusLabelText(newStatus)}`);
        }
      } else {
        toast.success(`Status updated to ${getStatusLabelText(newStatus)}`);
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
          ? {
              ...prev,
              revision_count: nextRevisionNumber,
              status:
                user?.metadata?.role === "client"
                  ? "client_revision"
                  : "revisions",
            }
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
        await updateAssetStatusWithRevision(
          user?.metadata?.role === "client" ? "client_revision" : "revisions",
          nextRevisionNumber
        );

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
          ? {
              ...prev,
              revision_count: nextRevisionNumber,
              status:
                user?.metadata?.role === "client"
                  ? "client_revision"
                  : "revisions",
            }
          : null
      );

      // Now update the asset status to revisions with the correct revision number

      try {
        await updateAssetStatusWithRevision(
          user?.metadata?.role === "client" ? "client_revision" : "revisions",
          nextRevisionNumber
        );

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
          ? {
              ...prev,
              revision_count: nextRevisionNumber,
              status:
                user?.metadata?.role === "client"
                  ? "client_revision"
                  : "revisions",
            }
          : null
      );

      // Now update the asset status to revisions with the correct revision number

      try {
        await updateAssetStatusWithRevision(
          user?.metadata?.role === "client" ? "client_revision" : "revisions",
          nextRevisionNumber
        );

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
    if (!viewingCurrentRevision) {
      return true;
    }
    return (
      (asset?.status === "revisions" || asset?.status === "client_revision") &&
      revisionCount >= 1
    );
  };

  // Function to determine which revision an item was added in

  // Function to open revision details dialog
  const openRevisionDetails = (revision: any) => {
    setSelectedRevision(revision);
    setShowRevisionDetailsDialog(true);
  };

  // Function to restore a revision (restore annotations and comments from that revision)
  const restoreRevision = async (revisionNumber: number) => {
    if (!assetId || !user) return;

    const revision = revisionHistory.find(
      (r) => r.revision_number === revisionNumber
    );

    if (!revision) {
      toast.error("Revision not found");
      return;
    }

    try {
      // Get the stored annotations and comments from the revision
      const revisionAnnotations = revision.annotations || [];
      const revisionComments = revision.comments || [];

      // First, mark all current annotations as old
      const { error: markOldError } = await supabase
        .from("asset_annotations")
        .update({ is_old_annotation: true })
        .eq("asset_id", assetId);

      if (markOldError) {
        console.error(
          "Error marking current annotations as old:",
          markOldError
        );
        toast.error("Failed to prepare for restoration");
        return;
      }

      // Delete all current comments
      const { error: deleteCommentsError } = await supabase
        .from("asset_comments")
        .delete()
        .eq("asset_id", assetId);

      if (deleteCommentsError) {
        console.error("Error deleting current comments:", deleteCommentsError);
        toast.error("Failed to clear current comments");
        return;
      }

      // Restore annotations from the revision snapshot
      for (const annotation of revisionAnnotations) {
        const { error: restoreAnnotationError } = await supabase
          .from("asset_annotations")
          .insert({
            asset_id: assetId,
            position: annotation.position,
            normal: annotation.normal,
            surface: annotation.surface,
            comment: annotation.comment,
            image_url: annotation.image_url,
            parent_id: annotation.parent_id,
            created_by: annotation.created_by,
            created_at: annotation.created_at,
            is_old_annotation: false, // Restored annotations are not old
            revision_number:
              typeof annotation.revision_number === "number"
                ? annotation.revision_number
                : revisionNumber,
          });

        if (restoreAnnotationError) {
          console.error("Error restoring annotation:", restoreAnnotationError);
        }
      }

      // Restore comments from the revision snapshot
      for (const comment of revisionComments) {
        const { error: restoreCommentError } = await supabase
          .from("asset_comments")
          .insert({
            asset_id: assetId,
            comment: comment.comment ?? comment.content,
            created_by: comment.created_by,
            created_at: comment.created_at,
            parent_id: comment.parent_id,
            priority: comment.priority,
            revision_number:
              typeof comment.revision_number === "number"
                ? comment.revision_number
                : revisionNumber,
          });

        if (restoreCommentError) {
          console.error("Error restoring comment:", restoreCommentError);
        }
      }

      // Refresh the data by refetching
      const annotationResponse = await fetch(
        `/api/annotations?asset_id=${assetId}`
      );
      const annotationData = await annotationResponse.json();
      if (annotationResponse.ok) {
        setAnnotations(annotationData.annotations || []);
      }

      const commentResponse = await fetch(`/api/comments?asset_id=${assetId}`);
      const commentData = await commentResponse.json();
      if (commentResponse.ok) {
        setComments(commentData.comments || []);
      }

      await fetchRevisionHistory();

      toast.success(`Revision ${revisionNumber} restored successfully`);
      setShowRevisionDetailsDialog(false);
    } catch (error) {
      console.error("Error restoring revision:", error);
      toast.error("Failed to restore revision");
    }
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
  const canEditOrDeleteComment = (comment?: any) =>
    isAdmin || (comment && comment.created_by === user?.id);

  // Function to get comments for selected annotation
  // Comments should be independent of annotations - show all comments for the asset
  // Filter annotations and comments for a specific revision using stored snapshots
  const getRevisionItems = (revisionNumber: number) => {
    if (revisionNumber === 0) {
      // For revision 0 (original), get items created before the first revision was requested
      if (revisionHistory.length === 0) {
        // If no revisions exist, all items belong to revision 0
        return { annotations: allAnnotations, comments };
      }

      // Use the snapshot from the first revision to get the state before any revisions
      const firstRevision = revisionHistory[0];
      const revisionAnnotations = firstRevision.annotations || [];
      const revisionComments = firstRevision.comments || [];

      return { annotations: revisionAnnotations, comments: revisionComments };
    } else {
      // For revision N, use the stored snapshot from that revision
      const currentRevision = revisionHistory.find(
        (r) => r.revision_number === revisionNumber
      );

      if (!currentRevision) return { annotations: [], comments: [] };

      // Use the stored snapshots from the revision
      const revisionAnnotations = currentRevision.annotations || [];
      const revisionComments = currentRevision.comments || [];

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
          revision_number: revisionCount,
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
    if (!canEditOrDeleteComment(comment)) {
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
      if (!canEditOrDeleteComment(target)) {
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

  // Notes functions
  const addNote = async () => {
    if (!newNote.trim() || !assetId || !user) return;

    try {
      const { data, error } = await supabase
        .from("asset_comments")
        .insert({
          asset_id: assetId,
          comment: `NOTE: ${newNote.trim()}`,
          created_by: user.id,
          revision_number: revisionCount,
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

      // Transform the data to match our notes structure
      const noteData = {
        id: data.id,
        content: data.comment.replace(/^NOTE:\s*/, ""),
        created_at: data.created_at,
        created_by: data.created_by,
        profiles: data.profiles,
      };

      setNotes((prev) => [noteData, ...prev]);
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
        .update({ comment: `NOTE: ${editNoteContent.trim()}` })
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

      // Transform the data to match our notes structure
      const noteData = {
        id: data.id,
        content: data.comment.replace(/^NOTE:\s*/, ""),
        created_at: data.created_at,
        created_by: data.created_by,
        profiles: data.profiles,
      };

      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? noteData : note))
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
    setEditNoteContent(note.content);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteContent("");
  };

  // Function to switch editing to a different annotation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const switchToEditing = (annotation: Annotation) => {
    // If we're already editing this annotation, do nothing
    if (inlineEditingId === annotation.id) {
      return;
    }

    // Cancel any existing editing sessions
    if (inlineEditingId) {
      cancelInlineEdit();
    }

    // Start new editing session
    startInlineEdit(annotation);
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
            revision_number: revisionCount,
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
        // Comment reply: check if QA is replying to a client comment
        const { data: parentComment } = await supabase
          .from("asset_comments")
          .select("created_by, profiles:created_by (role)")
          .eq("id", replyingTo.id)
          .single();

        const parentAuthorRole = parentComment?.profiles?.[0]?.role;
        const isQAReplyingToClient =
          user?.metadata?.role === "qa" && parentAuthorRole === "client";

        if (isQAReplyingToClient) {
          // QA replying to client - requires admin approval
          const response = await fetch("/api/pending-replies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: assetId,
              parentCommentId: replyingTo.id,
              replyText: replyText.trim(),
              createdBy: user.id,
              revisionNumber: revisionCount,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Failed to submit reply for approval"
            );
          }

          toast.success("Reply submitted for admin approval");
        } else {
          // Regular comment reply: insert directly
          const { data, error } = await supabase
            .from("asset_comments")
            .insert({
              asset_id: assetId,
              comment: replyText.trim(),
              parent_id: replyingTo.id,
              created_by: user.id,
              revision_number: revisionCount,
            })
            .select(`*, profiles:created_by (title, role, email)`)
            .single();
          if (error) throw error;
          setComments((prev) => [data, ...prev]);

          // Fetch parent comment author and notify
          try {
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

          toast.success("Reply posted");
        }
      }
      setReplyText("");
      setReplyingTo(null);
    } catch (e: any) {
      console.error("Failed to post reply:", e);
      toast.error(e?.message || "Failed to post reply");
    } finally {
      setReplySubmitting(false);
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
  const annotationRepliesMap = groupByParent(filteredAnnotations as any);
  const commentRepliesMap = groupByParent(commentsForActiveRevision as any);

  const cacheBustedGlbLink = useMemo(() => {
    if (!asset?.glb_link) return null;

    const key =
      asset.updated_at ??
      (asset as any)?.glb_updated_at ??
      (revisionCount > 0 ? `revision-${revisionCount}` : null);

    return createCacheBustedUrl(asset.glb_link, key) ?? asset.glb_link;
  }, [asset?.glb_link, asset?.updated_at, revisionCount]);

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
          <div className="flex-1 relative bg-background ">
            <div className="w-full h-full bg-muted   flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full animate-pulse mx-auto mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          </div>

          {/* Skeleton Annotations Panel */}
          <div className="w-143 bg-background/95 backdrop-blur-xl border-l border-border/20 shadow-xl overflow-y-auto">
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
                    className="p-6 rounded-xl border border-border/20 bg-background animate-pulse"
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
          {/* Warning Banner for Unconfirmed Revisions */}
          {user?.metadata?.role === "client" && showRevisionDialog && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    You have unconfirmed revision requests
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Please confirm your revision request before leaving this
                    page.
                  </p>
                </div>
                <Button
                  onClick={() => setShowRevisionDialog(true)}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Review & Confirm
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3 sm:gap-0">
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
                    {user?.metadata?.role !== "client" && (
                      <Button
                        variant="outline"
                        size="xxs"
                        onClick={() => setIsNotesDialogOpen(true)}
                        className="cursor-pointer bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 hover:text-yellow-700 text-x"
                      >
                        <StickyNote className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">
                          Notes ({notes.length})
                        </span>
                        <span className="sm:hidden">{notes.length}</span>
                      </Button>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xxs"
                        onClick={() => setIsApprovalHistoryDialogOpen(true)}
                        className="cursor-pointer bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 hover:text-blue-700 text-x"
                      >
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Status History</span>
                        <span className="sm:hidden">History</span>
                      </Button>
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] sm:text-xs"
                      >
                        Viewer:{" "}
                        <span className="font-medium ml-1">
                          {getViewerLabel(clientViewerType)}
                        </span>
                      </Badge>
                      {asset?.product_link && (
                        <Button
                          variant="outline"
                          size="xxs"
                          onClick={() =>
                            window.open(
                              asset.product_link,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="cursor-pointer bg-green-500/15 text-green-700 hover:bg-green-500/25 hover:text-green-800 text-x"
                        >
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Product Link</span>
                          <span className="sm:hidden">Product</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
                      {asset?.article_id && (
                        <div className="flex items-center flex-wrap gap-1">
                          <span
                            className="text-xs sm:text-sm text-muted-foreground font-medium"
                            title={
                              getArticleIdsTooltip(asset.article_ids || []) ||
                              undefined
                            }
                          >
                            {asset.article_id}
                          </span>
                          {getAdditionalArticleIds(asset).map((id) => (
                            <Badge
                              key={`${asset.id}-${id}`}
                              variant="outline"
                              className="px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted-foreground border-border/60"
                              title={id}
                            >
                              {id}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {asset?.pricing_comment && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-muted"
                            >
                              <FileText className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit p-3">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">
                                Asset Note
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap min-w-[200px]">
                                {asset.pricing_comment}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      {latestRevision > 0 && (
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${getRevisionBadgeColors(latestRevision)}`}
                        >
                          R{latestRevision}
                        </Badge>
                      )}
                    </div>
                    {asset?.delivery_date && (
                      <span className="text-xs text-muted-foreground">
                        Due:{" "}
                        {new Date(asset.delivery_date).toLocaleDateString()}
                      </span>
                    )}
                    {measurements && (
                      <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                        <span className="uppercase text-[10px] font-semibold tracking-wide text-muted-foreground/80">
                          Reference Measurements
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

            {/* Feedback Notice */}
            {["client", "qa"].includes(
              user?.metadata?.role?.toLowerCase?.() || ""
            ) &&
              asset?.status !== "revisions" &&
              asset?.status !== "client_revision" &&
              hasValidFeedback() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-2">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-yellow-600" />
                    <p className="text-xs text-yellow-800">
                      Remember to click &quot;Revision&quot; button when ready
                    </p>
                  </div>
                </div>
              )}
            {!viewingCurrentRevision && (
              <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 mt-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-blue-600" />
                  <p className="text-xs text-blue-800">
                    Viewing revision {activeRevision}. Feedback tools are
                    disabled. Switch to revision {latestRevision} to add new
                    comments or annotations.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-foreground">
                    {displayedAnnotations.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Annotations
                  </div>
                </div>
                <div className="w-px h-6 sm:h-8 bg-border"></div>
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-foreground">
                    {displayedComments.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Comments</div>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {user?.metadata?.role === "client" && (
                  <Button
                    onClick={() => setShowApprovalConfirmDialog(true)}
                    disabled={
                      asset?.status === "approved_by_client" || statusUpdating
                    }
                    variant={
                      asset?.status === "approved_by_client"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                  >
                    {statusUpdating ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
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
                    className="h-8 px-3 text-xs cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                  >
                    {statusUpdating ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    Approve
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
                      className="h-7 sm:h-8 px-2 sm:px-3 text-xs cursor-pointer"
                    >
                      {statusUpdating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      <span className="hidden sm:inline">In Progress</span>
                      <span className="sm:hidden">Progress</span>
                    </Button>
                  )}

                <Button
                  onClick={() => {
                    const userRole = user?.metadata?.role?.toLowerCase?.();
                    const newStatus =
                      userRole === "client" ? "client_revision" : "revisions";
                    updateAssetStatus(newStatus);
                  }}
                  disabled={
                    asset?.status === "revisions" ||
                    asset?.status === "client_revision" ||
                    asset?.status === "not_started" ||
                    asset?.status === "approved_by_client" ||
                    statusUpdating
                  }
                  variant={
                    asset?.status === "revisions" ||
                    asset?.status === "client_revision"
                      ? "outline"
                      : "outline"
                  }
                  size="sm"
                  className={`h-7 sm:h-8 px-2 sm:px-3 text-xs cursor-pointer ${
                    asset?.status === "revisions" ||
                    asset?.status === "client_revision"
                      ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30"
                      : ["client", "qa"].includes(
                            user?.metadata?.role?.toLowerCase?.() || ""
                          ) && !hasValidFeedback()
                        ? "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-800/50 dark:text-yellow-400 dark:hover:bg-yellow-950/30"
                        : ""
                  }`}
                  title={
                    asset?.status === "not_started"
                      ? "Cannot send for revision - asset has not been started yet"
                      : asset?.status === "approved_by_client"
                        ? "Cannot send for revision - asset has already been approved by client"
                        : ["client", "qa"].includes(
                              user?.metadata?.role?.toLowerCase?.() || ""
                            ) && !hasValidFeedback()
                          ? "Add annotations or comments before requesting a revision"
                          : undefined
                  }
                >
                  {statusUpdating ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  <span className="hidden sm:inline">
                    Revision {latestRevision > 0 && `(${latestRevision})`}
                  </span>
                  <span className="sm:hidden">
                    Rev {latestRevision > 0 && latestRevision}
                  </span>
                </Button>

                {/* Revision History Button */}
                {revisionHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs text-muted-foreground cursor-pointer"
                  >
                    <span className="hidden sm:inline">
                      {showHistoryDropdown ? "Hide" : "Show"} History
                    </span>
                    <span className="sm:hidden">
                      {showHistoryDropdown ? "Hide" : "Show"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Revision History Dropdown - In Header Area */}
        {revisionHistory.length > 0 && showHistoryDropdown && (
          <div className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
            <div className="p-4">
              <div className="space-y-3 overflow-y-auto max-h-96">
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
                          {new Date(revision.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {
                          getRevisionItems(revision.revision_number).annotations
                            .length
                        }{" "}
                        annotations,{" "}
                        {
                          getRevisionItems(revision.revision_number).comments
                            .length
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
                                  <div className="font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                    Annotation {index + 1}
                                    {annotation.is_old_annotation && (
                                      <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50">
                                        Old
                                      </span>
                                    )}
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
                                  onClick={() => openRevisionDetails(revision)}
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
                                      {comment.profiles?.email || "Unknown"}
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
                                +{revisionComments.length - 3} more comments
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRevisionDetails(revision)}
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

        <div className="flex flex-col xl:flex-row flex-1 overflow-y-auto xl:overflow-hidden ">
          {/* Main Content (3D Viewer) */}
          <div className="flex-1 relative  h-[65vh] xl:h-auto">
            {/* Ctrl Key Visual Indicator */}
            {showTooltip && (
              <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-background/90 text-foreground px-1 sm:px-3 py-1 sm:py-2 rounded-sm text-xs sm:text-xs  shadow-sm ">
                <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <span className="hidden sm:inline">
                    Hold Ctrl + Click to add annotation
                  </span>
                  <span className="hidden sm:inline">
                    Click outside the model to reset view
                  </span>
                  <span className="sm:hidden">Ctrl + Click</span>
                </div>
              </div>
            )}

            <Script
              type="module"
              src="/model-viewer.js"
              onLoad={() => {}}
              onError={(e) =>
                console.error("❌ Model-viewer script failed to load:", e)
              }
            />

            {asset.glb_link ? (
              <div className="w-full h-full overflow-hidden">
                {/* @ts-expect-error cant really fix viewer errors */}
                <model-viewer
                  key={cacheBustedGlbLink ?? asset.glb_link}
                  ref={modelViewerRef}
                  src={cacheBustedGlbLink ?? asset.glb_link}
                  alt={asset.product_name}
                  camera-controls={!annotationMode}
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
                  onLoad={handleModelLoaded}
                  onClick={(event: any) => {
                    // Check if Ctrl key is held down for hotkey shortcut
                    const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey for Mac

                    // Allow normal click in annotation mode OR Ctrl+click hotkey
                    if (!annotationMode && !isCtrlPressed) return;
                    if (annotationMode && isCtrlPressed) return; // Don't double-trigger

                    event.preventDefault();
                    event.stopPropagation();

                    // If using hotkey, enable annotation mode first
                    if (!annotationMode && isCtrlPressed) {
                      setAnnotationMode(true);
                    }

                    const positionData =
                      modelViewerRef.current?.positionAndNormalFromPoint(
                        event.clientX,
                        event.clientY
                      );

                    if (positionData?.position) {
                      const positionVector: Vector3 = {
                        x: Number(positionData.position.x ?? 0),
                        y: Number(positionData.position.y ?? 0),
                        z: Number(positionData.position.z ?? 0),
                      };

                      const hasValidNormal =
                        positionData.normal &&
                        ["x", "y", "z"].every((axis) =>
                          Number.isFinite(
                            Number(
                              (positionData.normal as Record<string, unknown>)[
                                axis
                              ]
                            )
                          )
                        );

                      const normalVector: Vector3 = hasValidNormal
                        ? {
                            x: Number(positionData.normal.x),
                            y: Number(positionData.normal.y),
                            z: Number(positionData.normal.z),
                          }
                        : DEFAULT_NORMAL;

                      handleHotspotCreate(positionVector, normalVector);
                    }
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
                            <div className="hotspot-dot"></div>

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
                </div>
              </div>
            )}

            {/* Dimensions Toggle Button */}
            {asset.glb_link && user?.metadata?.role !== "client" && (
              <div className="absolute top-2 right-2 sm:top-4 sm:right-0 z-20 w-fit min-w-[120px] sm:min-w-[200px] flex gap-2">
                {/* Undo button */}
                {lastDeletedAnnotation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undoLastDeletion}
                    disabled={isUndoing}
                    className="bg-background/95 backdrop-blur-sm border-border/50 shadow-md cursor-pointer h-7 sm:h-8 px-2 sm:px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo last deletion (Ctrl+Z)"
                  >
                    {isUndoing ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    )}
                    <span className="hidden sm:inline">
                      {isUndoing ? "Restoring..." : "Undo"}
                    </span>
                    <span className="sm:hidden">
                      {isUndoing ? "..." : "Undo"}
                    </span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = asset.glb_link as string;
                    a.download = `${asset.article_id}.glb`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="bg-background/95  border-border/50 shadow-sm cursor-pointer h-7 sm:h-8 px-2 sm:px-3 text-xs"
                  title="Download GLB"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Download GLB</span>
                  <span className="sm:hidden">Download</span>
                </Button>
              </div>
            )}

            {/* Center model shortcut indicator */}
            {modelLoaded && (
              <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-muted/90 text-muted-foreground text-xs px-2 sm:px-3 py-1 rounded-md z-20 shadow-lg backdrop-blur-sm">
                <span className="hidden sm:inline">TAB to center model</span>
                <span className="sm:hidden">TAB center</span>
              </div>
            )}
          </div>

          {/* Right Panel - Switchable between Reference Images and Feedback */}
          <div className="w-full xl:w-[510px] max-w-full flex flex-col bg-background border border-border/20 p-3 sm:p-6 h-[50vh] min-h-[500px] xl:h-auto xl:min-h-0 overflow-y-auto">
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
                    References ({totalReferenceCount})
                  </span>
                  <span className="sm:hidden">
                    Refs ({totalReferenceCount})
                  </span>
                </div>
              </button>
            </div>

            {/* Reference Tab */}
            {rightPanelTab === "images" && (
              <div className="flex-1 overflow-y-auto space-y-6">
                {renderReferenceSection({
                  title: "Client References",
                  description:
                    clientReferenceCount > 0
                      ? "Images and files visible to the client."
                      : undefined,
                  images: referenceImages,
                  files: referenceFiles,
                  selectedIndex: selectedReferenceIndex,
                  onSelectImage: setSelectedReferenceIndex,
                  onRemoveImage: handleRemoveClientImage,
                })}
                {!isClient &&
                  renderReferenceSection({
                    title: "Internal References",
                    description:
                      internalReferenceCount > 0
                        ? "Only Charpstar staff can access these references."
                        : undefined,
                    images: internalReferenceImages,
                    files: internalReferenceFiles,
                    selectedIndex: selectedInternalReferenceIndex,
                    onSelectImage: setSelectedInternalReferenceIndex,
                    highlight: true,
                  })}
                {clientReferenceCount === 0 &&
                  (isClient || internalReferenceCount === 0) && (
                    <div className="text-center py-12">
                      <LucideImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">
                        No references added yet
                      </p>
                    </div>
                  )}
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
                          {latestRevision >= 3 &&
                            ` This is revision #${latestRevision} - additional costs may apply.`}
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
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 pb-3 sm:pb-4">
                  <div className="p-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <h4 className="text-sm sm:text-base text-muted-foreground font-semibold">
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
                          className={`h-7 sm:h-8 px-2 sm:px-3 text-xs font-medium transition-all duration-200 cursor-pointer ${
                            deleteMode
                              ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/30 shadow-sm"
                              : "border-border hover:bg-accent hover:border-border"
                          }`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deleteMode ? "Cancel" : "Delete"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={annotationMode ? "default" : "outline"}
                          size="xxs"
                          onClick={() => setAnnotationMode(!annotationMode)}
                          disabled={isFunctionalityDisabled()}
                          className={`p-1 transition-all duration-200 cursor-pointer ${
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
                          <span className="hidden sm:inline">
                            {annotationMode ? "Cancel" : "Add Annotation"}
                          </span>
                          <span className="sm:hidden">
                            {annotationMode ? "Cancel" : "Add"}
                          </span>
                          {!annotationMode && (
                            <span className="ml-1 text-xs opacity-60"></span>
                          )}
                        </Button>
                        <Button
                          variant={showComments ? "default" : "outline"}
                          size="xxs"
                          onClick={() => setShowComments(!showComments)}
                          disabled={isFunctionalityDisabled()}
                          className={`p-1 transition-all duration-200 cursor-pointer ${
                            showComments
                              ? "bg-primary hover:bg-primary/90 shadow-sm"
                              : "border-border hover:bg-accent hover:border-border"
                          } ${
                            isFunctionalityDisabled()
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">
                            {showComments ? "Hide Comments" : "Add Comment"}
                          </span>
                          <span className="sm:hidden">
                            {showComments ? "Hide" : "Comment"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {revisionNumbers.length > 1 && (
                      <div className="mb-3 sm:mb-4 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Viewing Revision
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Switch between historical rounds of feedback.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!viewingCurrentRevision && (
                              <Badge variant="secondary" className="text-xs">
                                Latest: R{latestRevision}
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
                                    {rev === latestRevision
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
                      </div>
                    )}

                    {isFunctionalityDisabled() && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 dark:bg-yellow-950/20 dark:border-yellow-800/30 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            <span className="hidden sm:inline">
                              Annotations and comments are disabled - Asset is
                              in revision mode
                            </span>
                            <span className="sm:hidden">
                              Comments disabled - in revision mode
                            </span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Add New Comment - Collapsible */}
                    {showComments && (
                      <div className="space-y-2 sm:space-y-3">
                        <Textarea
                          placeholder={
                            isFunctionalityDisabled()
                              ? "Comments disabled during revision"
                              : selectedHotspotId
                                ? `Add a comment about annotation ${
                                    displayedAnnotations.findIndex(
                                      (a) => a.id === selectedHotspotId
                                    ) + 1
                                  }...`
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
                    )}

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
                            onClick={async () => {
                              await deleteMultipleAnnotations(
                                selectedAnnotations
                              );
                              setSelectedAnnotations([]);
                              setDeleteMode(false);
                            }}
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
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime()
                      )
                      .map((item) =>
                        item.type === "annotation" ? (
                          <Card
                            key={`annotation-${item.id}`}
                            id={`annotation-${item.id}`}
                            className={`p-3 sm:p-6 transition-all duration-200 rounded-xl border border-border/20 ${
                              selectedHotspotId === item.id
                                ? "ring-2 ring-primary/15 ring-offset-2 bg-primary/3 shadow-lg"
                                : highlightedAnnotationId === item.id
                                  ? "ring-2 ring-primary ring-opacity-50 bg-primary/5 shadow-lg"
                                  : deleteMode &&
                                      selectedAnnotations.includes(item.id)
                                    ? "ring-2 ring-red-300 bg-red-50/50 shadow-lg dark:ring-red-700 dark:bg-red-950/10"
                                    : "hover:shadow-md hover:border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3 sm:mb-4">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                {deleteMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedAnnotations.includes(
                                      item.id
                                    )}
                                    onChange={() =>
                                      handleAnnotationSelect(item.id)
                                    }
                                    className="h-4 w-4 text-red-600 border-border rounded focus:ring-red-500 cursor-pointer dark:text-red-400 dark:focus:ring-red-400 flex-shrink-0"
                                  />
                                )}
                                <div className="relative flex-shrink-0">
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                                  </div>
                                  {/* Annotation Number Badge */}
                                  <div
                                    className={`absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAnnotationNumberColor(
                                      displayedAnnotations.findIndex(
                                        (a) => a.id === item.id
                                      )
                                    )}`}
                                  >
                                    {displayedAnnotations.findIndex(
                                      (a) => a.id === item.id
                                    ) + 1}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                                      {item.profiles?.email || "Unknown"}
                                    </span>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      {(() => {
                                        const annotationRevision =
                                          getAnnotationRevision(item);
                                        const displayRevision =
                                          item.is_old_annotation
                                            ? Math.min(
                                                annotationRevision,
                                                Math.max(0, latestRevision - 1)
                                              )
                                            : annotationRevision;
                                        return (
                                          <Badge
                                            variant="outline"
                                            className={`text-xs px-1.5 sm:px-2 py-0.5 w-fit ${getRevisionBadgeColors(
                                              displayRevision
                                            )}`}
                                          >
                                            R{displayRevision}
                                          </Badge>
                                        );
                                      })()}
                                      <Badge
                                        variant="outline"
                                        className="text-xs px-1.5 sm:px-2 py-0.5"
                                      >
                                        <span className="hidden sm:inline">
                                          Annotation
                                        </span>
                                        <span className="sm:hidden">Ann</span>
                                      </Badge>
                                      {item.is_old_annotation && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs px-1.5 sm:px-2 py-0.5 bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50"
                                        >
                                          Old
                                        </Badge>
                                      )}
                                    </div>
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
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      if (!canEditOrDeleteAnnotation(item)) {
                                        toast.error(
                                          "You can only delete your own annotations"
                                        );
                                        return;
                                      }
                                      await deleteAnnotation(item.id);
                                    }}
                                    disabled={
                                      isFunctionalityDisabled() ||
                                      !canEditOrDeleteAnnotation(item)
                                    }
                                    className={`${isFunctionalityDisabled() || !canEditOrDeleteAnnotation(item) ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete Annotation
                                  </DropdownMenuItem>
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
                                  onPaste={handleEditPasteImage}
                                  rows={3}
                                />
                                <div className="text-[11px] text-muted-foreground">
                                  Tip: Paste screenshots directly here (Ctrl+V)
                                </div>
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
                                        submitInlineEdit(item.id);
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
                            className="p-6 transition-all duration-200 rounded-xl border border-border/20 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                                      {item.profiles?.email || "Unknown"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs px-2 py-0.5 w-fit ${getRevisionBadgeColors(
                                        getCommentRevision(item)
                                      )}`}
                                    >
                                      R{getCommentRevision(item)}
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
                                      if (!canEditOrDeleteComment(item)) {
                                        toast.error(
                                          "You can only edit your own comments"
                                        );
                                        return;
                                      }
                                      startCommentInlineEdit(item as any);
                                    }}
                                    disabled={
                                      isFunctionalityDisabled() ||
                                      !canEditOrDeleteComment(item)
                                    }
                                    className={`${isFunctionalityDisabled() || !canEditOrDeleteComment(item) ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                    <Edit3 className="h-3 w-3 mr-2" />
                                    Edit Comment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      canEditOrDeleteComment(item)
                                        ? deleteComment(item.id)
                                        : toast.error(
                                            "You can only delete your own comments"
                                          )
                                    }
                                    disabled={!canEditOrDeleteComment(item)}
                                    className={`${!canEditOrDeleteComment(item) ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
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
                                    canEditOrDeleteComment(item)
                                  ) {
                                    startCommentInlineEdit(item as any);
                                  }
                                }}
                                title={
                                  isFunctionalityDisabled()
                                    ? "Editing disabled during revision"
                                    : canEditOrDeleteComment(item)
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
                            <div className="mt-3 sm:mt-4 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                <span className="hidden sm:inline">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                                <span className="sm:hidden">
                                  {new Date(
                                    item.created_at
                                  ).toLocaleDateString()}
                                </span>
                              </span>
                            </div>
                            {/* Reply actions for comments */}
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 sm:h-7 px-2 text-xs cursor-pointer"
                                onClick={() =>
                                  setReplyingTo({
                                    type: "comment",
                                    id: item.id,
                                  })
                                }
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Reply</span>
                                <span className="sm:hidden">R</span>
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

                    {displayedAnnotations.length + displayedComments.length ===
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
            )}
          </div>

          {/* New Annotation Dialog */}
          <Dialog
            open={selectedAnnotation?.id.startsWith("temp-") || false}
            modal={true}
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
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] h-fit overflow-y-auto">
              <DialogHeader className="pb-3 sm:pb-4">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Add New Annotation
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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

          {/* Image Preview Dialog */}
          <Dialog
            open={showImageDialog}
            onOpenChange={handleDialogClose}
            modal={true}
          >
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
              <DialogHeader className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  {selectedImageTitle}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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
          <Dialog
            open={showUrlDialog}
            onOpenChange={setShowUrlDialog}
            modal={true}
          >
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] h-fit">
              <DialogHeader className="pb-3 sm:pb-4">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Add Reference Image URL
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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
            modal={true}
          >
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] h-fit">
              <DialogHeader className="pb-3 sm:pb-4">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Confirm Revision Request
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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
              modal={true}
            >
              <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] h-fit">
                <DialogHeader className="pb-3 sm:pb-4">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-400">
                    Additional Revision Warning
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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
            modal={true}
          >
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[800px] h-fit min-h-[400px] sm:min-h-[500px] overflow-y-auto">
              <DialogHeader className="pb-3 sm:pb-4">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Revision {selectedRevision?.revision_number} Details
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
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
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {annotation.profiles?.title && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {annotation.profiles.title}
                                          </Badge>
                                        )}
                                        {annotation.is_old_annotation && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50"
                                          >
                                            Old
                                          </Badge>
                                        )}
                                      </div>
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
                              <Card
                                key={comment.id || index}
                                className="p-3 sm:p-4"
                              >
                                <div className="flex items-start justify-between mb-2 sm:mb-3">
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                                      <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs sm:text-sm font-medium text-foreground truncate">
                                        {comment.profiles?.email || "Unknown"}
                                      </div>
                                      {comment.profiles?.title && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs mt-1 px-1.5 sm:px-2 py-0.5 w-fit"
                                        >
                                          {comment.profiles.title}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                    <span className="hidden sm:inline">
                                      {new Date(
                                        comment.created_at
                                      ).toLocaleString()}
                                    </span>
                                    <span className="sm:hidden">
                                      {new Date(
                                        comment.created_at
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs sm:text-sm text-foreground break-words overflow-hidden">
                                  <div className="whitespace-pre-wrap text-xs sm:text-sm text-foreground font-normal font-sans">
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

              <div className="flex justify-between pt-4 border-t border-border">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedRevision) {
                      restoreRevision(selectedRevision.revision_number);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Restore This Revision
                </Button>
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

      {/* Notes Dialog */}
      <Dialog
        open={isNotesDialogOpen}
        onOpenChange={setIsNotesDialogOpen}
        modal={true}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <StickyNote className="h-4 w-4 sm:h-5 sm:w-5" />
              Notes for {asset?.product_name}
            </DialogTitle>
            <DialogDescription>
              Add and manage notes for this asset. Notes are visible to all team
              members.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Add new note */}
            <div className="space-y-3">
              <Textarea
                placeholder="Add a new note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex justify-end">
                <Button onClick={addNote} disabled={!newNote.trim()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </div>

            {/* Notes list */}
            <div className="space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notes yet. Add the first note above.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <Card key={note.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <StickyNote className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {note.profiles?.email || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(note.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingNote(note)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNote(note.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          className="min-h-[80px] resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditingNote}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateNote(note.id)}
                            disabled={!editNoteContent.trim()}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-foreground whitespace-pre-wrap">
                        {note.content}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsNotesDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval History Dialog */}
      <Dialog
        open={isApprovalHistoryDialogOpen}
        onOpenChange={setIsApprovalHistoryDialogOpen}
        modal={true}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              Status History for {asset?.product_name}
            </DialogTitle>
            <DialogDescription>
              Complete timeline of approvals, revisions, and status changes for
              this asset.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {assetId && (
              <ApprovalHistory
                assetId={assetId}
                className="border-0 shadow-none"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Confirmation Dialog */}
      <Dialog
        open={showApprovalConfirmDialog}
        onOpenChange={setShowApprovalConfirmDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Confirm Approval
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="space-y-3 mt-3">
                <p>Are you sure you want to approve this asset?</p>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This will remove the asset from your
                    review list and transfer it to the asset library.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowApprovalConfirmDialog(false)}
              disabled={statusUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowApprovalConfirmDialog(false);
                updateAssetStatus("approved_by_client");
              }}
              disabled={statusUpdating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {statusUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Approval
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
