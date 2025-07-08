//@ts-nocheck
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
  Image,
  FileImage,
  Eye,
  Camera,
  MoreVertical,
  Trash2,
  Maximize2,
  Save,
} from "lucide-react";
import Script from "next/script";
import { toast } from "sonner";

import "./annotation-styles.css";
import { log } from "console";

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

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-muted">
        {/* Skeleton Header */}
        <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
          <div className="flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-8">
              <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-slate-200 rounded-2xl animate-pulse"></div>
                <div>
                  <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="flex items-center gap-4">
                    <div className="h-6 w-24 bg-slate-200 rounded-full animate-pulse"></div>
                    <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-8 w-20 bg-slate-200 rounded-full animate-pulse"></div>
              <div className="h-8 w-px bg-slate-300"></div>
              <div className="h-9 w-32 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Skeleton Model Viewer */}
          <div className="flex-1 relative bg-white rounded-2xl m-6 shadow-xl border border-slate-200/50">
            <div className="w-full h-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full animate-pulse mx-auto mb-4"></div>
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mx-auto"></div>
              </div>
            </div>
          </div>

          {/* Skeleton Annotations Panel */}
          <div className="w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200/50 shadow-xl overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-8 w-16 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"></div>
              </div>

              {/* Skeleton Annotations */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-6 rounded-xl border border-slate-200/50 bg-white animate-pulse"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                        <div className="h-4 w-32 bg-slate-200 rounded"></div>
                      </div>
                      <div className="w-6 h-6 bg-slate-200 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-200 rounded"></div>
                      <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                    </div>
                    <div className="mt-4 h-4 w-24 bg-slate-200 rounded-full"></div>
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
          <Button onClick={() => router.push("/review")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted">
      {/* Clean Modern Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="flex items-center justify-between px-8 py-6">
          {/* Left Section - Navigation & Product Info */}
          <div className="flex items-center gap-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/review")}
              className="hover:bg-slate-100/60 transition-all duration-200 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>

            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  {asset.product_name}
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-600 font-medium bg-slate-100 px-3 py-1 rounded-full">
                    ID: {asset.article_id}
                  </span>
                  <span className="text-sm text-slate-500">
                    {annotations.length} annotation
                    {annotations.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Status & Actions */}
          <div className="flex items-center gap-6">
            <Badge
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                asset.status in STATUS_LABELS
                  ? STATUS_LABELS[asset.status as keyof typeof STATUS_LABELS]
                      .color
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {asset.status in STATUS_LABELS
                ? STATUS_LABELS[asset.status as keyof typeof STATUS_LABELS]
                    .label
                : asset.status}
            </Badge>

            <div className="h-8 w-px bg-slate-300"></div>

            <Button
              variant={annotationMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAnnotationMode(!annotationMode);
                setSelectedAnnotation(null);
                setSelectedHotspotId(null);
              }}
              className={`font-semibold transition-all duration-200 cursor-pointer ${
                annotationMode
                  ? "bg-blue-600 hover:bg-blue-700 shadow-lg"
                  : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
              }`}
            >
              <Plus className="h-4 w-4 mr-2" />
              {annotationMode ? "Cancel Mode" : "Add Annotation"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Model Viewer */}
        <div className="flex-1 relative bg-white rounded-2xl m-6 shadow-xl border border-slate-200/50">
          <Script
            type="module"
            src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
          />

          {asset.glb_link ? (
            <div className="w-full h-full rounded-lg overflow-hidden">
              <model-viewer
                ref={modelViewerRef}
                src={asset.product_link}
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
                                ? "#2563eb"
                                : "#3b82f6",
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

                        {/* Comment label - always visible when comment exists */}
                        {hotspot.comment && (
                          <div className="hotspot-comment">
                            <div
                              className="comment-bubble"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Select this hotspot when clicking on comment
                                handleHotspotSelect(hotspot.id);
                              }}
                            >
                              <div className="comment-text">
                                {hotspot.comment}
                              </div>

                              {/* Show reference image if exists */}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                )}
              </model-viewer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No 3D model available for this asset
                </p>
                <Button onClick={() => router.push("/review")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Review
                </Button>
              </div>
            </div>
          )}

          {annotationMode && (
            <div className="absolute top-4 left-4 bg-blue-600 text-white text-sm px-4 py-2 rounded-full z-20 shadow-lg backdrop-blur-sm">
              ✨ Double-click to add hotspot
            </div>
          )}
        </div>

        {/* Clean Annotations Panel */}
        <div className="w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200/50 shadow-xl overflow-y-auto">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Annotations
                </h2>
                <Button
                  variant={deleteMode ? "destructive" : "outline"}
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
                      ? "bg-red-600 hover:bg-red-700 shadow-sm"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {deleteMode ? "Cancel" : "Delete"}
                </Button>
              </div>
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
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    Add New Annotation
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Add a comment and optional reference image to this hotspot
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Comment Section */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Comment *
                    </label>
                    <Textarea
                      placeholder="Describe what you want to highlight or comment on..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[100px] border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                      rows={4}
                    />
                  </div>

                  {/* Image Upload Section */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Reference Image (optional)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/image.jpg or upload file"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        className="flex-1 border-slate-300 focus:border-blue-400"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const url = prompt("Enter image URL:");
                          if (url) setNewImageUrl(url);
                        }}
                        className="border-slate-300 hover:bg-slate-50 cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
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
                        className="border-slate-300 hover:bg-slate-50 cursor-pointer"
                      >
                        <FileImage className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Preview Image */}
                  {newImageUrl && (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700">
                        Image Preview
                      </label>
                      <div
                        className="relative w-full h-48 border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() =>
                          handleImageClick(newImageUrl, "Image Preview")
                        }
                      >
                        <img
                          src={newImageUrl}
                          alt="Reference"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display =
                              "none";
                            (e.currentTarget
                              .nextElementSibling as HTMLElement)!.style.display =
                              "flex";
                          }}
                        />
                        <div
                          className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-600 text-sm"
                          style={{ display: "none" }}
                        >
                          <div className="text-center">
                            <div className="text-slate-400 mb-2"></div>
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

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    onClick={saveAnnotation}
                    disabled={!newComment.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 font-medium cursor-pointer"
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
                    className="border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Warning Dialog */}
            <Dialog
              open={showDeleteWarning}
              onOpenChange={setShowDeleteWarning}
            >
              <DialogContent className="sm:max-w-[425px] h-fit">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-red-600">
                    Delete Annotation
                    {selectedAnnotations.length > 0 ? "s" : ""}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Are you sure you want to delete{" "}
                    {singleDeleteId
                      ? "this annotation"
                      : `${selectedAnnotations.length} annotation(s)`}
                    ? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (singleDeleteId) {
                        handleSingleDelete();
                      } else {
                        deleteMultipleAnnotations(selectedAnnotations);
                        setShowDeleteWarning(false);
                      }
                    }}
                    className="flex-1 cursor-pointer"
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
            <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
              <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-slate-200">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {selectedImageTitle}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Reference image for annotation
                  </DialogDescription>
                </DialogHeader>
                <div className="relative w-full h-[70vh] bg-slate-100">
                  <img
                    src={selectedImage}
                    alt={selectedImageTitle}
                    className="w-full h-full object-contain bg-background"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                      (e.currentTarget
                        .nextElementSibling as HTMLElement)!.style.display =
                        "flex";
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-600"
                    style={{ display: "none" }}
                  >
                    <div className="text-center">
                      <div className="text-slate-400 mb-2 text-4xl"></div>
                      <p className="text-lg font-medium">Invalid image URL</p>
                      <p className="text-sm text-slate-500 mt-1">
                        The image could not be loaded
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200">
                  <Button
                    variant="outline"
                    onClick={() => setShowImageDialog(false)}
                    className="cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Multi-Delete Actions */}
            {deleteMode && selectedAnnotations.length > 0 && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6 mb-6">
                <div className="flex flex-col items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="font-semibold text-red-700">
                      {selectedAnnotations.length} annotation(s) selected
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteWarning(true)}
                    className="cursor-pointer shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* Existing Annotations */}
            <div className="space-y-4">
              {annotations.map(
                (annotation) => (
                  console.log(annotation),
                  (
                    <Card
                      key={annotation.id}
                      className={`p-6 transition-all duration-200 rounded-xl border border-slate-200/50 ${
                        selectedHotspotId === annotation.id
                          ? "ring-2 ring-blue-500 bg-blue-50/50 shadow-lg"
                          : deleteMode &&
                              selectedAnnotations.includes(annotation.id)
                            ? "ring-2 ring-red-500 bg-red-50/50 shadow-lg"
                            : "hover:shadow-md hover:border-slate-300/50"
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
                              className="h-4 w-4 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                            />
                          )}
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <MessageCircle className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-slate-700">
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
                              onClick={() => handleHotspotSelect(annotation.id)}
                              className="cursor-pointer"
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
                              className="cursor-pointer"
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
                                className="cursor-pointer text-red-600 hover:text-red-700"
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
                                  const url = prompt("Enter image URL:");
                                  if (url) setEditImageUrl(url);
                                }}
                                className="cursor-pointer"
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
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
                                <FileImage className="h-4 w-4" />
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
                                className="relative w-full h-32 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() =>
                                  handleImageClick(
                                    editImageUrl,
                                    "Preview Image"
                                  )
                                }
                              >
                                <img
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
                          <p className="text-sm">{annotation.comment}</p>

                          {/* Display reference image if exists */}
                          {annotation.image_url && (
                            <div className="mt-2">
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Reference Image:
                              </label>
                              <div
                                className="relative w-full h-32 border rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() =>
                                  handleImageClick(
                                    annotation.image_url!,
                                    annotation.comment
                                  )
                                }
                              >
                                <img
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

                      <div className="mt-4 text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                        Created on{" "}
                        {new Date(annotation.created_at).toLocaleDateString()}
                      </div>
                    </Card>
                  )
                )
              )}

              {annotations.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    No annotations yet
                  </h3>
                  <p className="text-sm text-slate-500">
                    Click "Add Annotation" to start reviewing this model
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
