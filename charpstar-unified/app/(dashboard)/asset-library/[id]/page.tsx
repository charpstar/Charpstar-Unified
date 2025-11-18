"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { ArrowLeft, Download, ImageIcon, Pencil, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/inputs";
import Script from "next/script";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/contexts/useUser";

import { ModelViewer } from "@/components/asset-library/viewers/model-viewer";
import RelatedScenesSection from "@/components/asset-library/RelatedScenesSection";
import { ARButton } from "@/components/asset-library/ARButton";
import SavedPackshotsSection from "@/components/product-render/SavedPackshotsSection";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-expect-error -- model-viewer is a custom element
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "interaction-prompt"?: string;
          "environment-image"?: string;
          exposure?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface Asset {
  id: string;
  product_name: string;
  category: string;
  subcategory?: string;
  description?: string;
  client?: string | null;
  materials?: string[];
  colors?: string[];
  tags?: string[];
  preview_image?: string;
  product_link?: string;
  glb_link?: string;
  zip_link?: string;
  created_at?: string;
  article_id?: string;
  article_ids?: string[];
  modelUrl?: string;
  dimensions?: string;
}

// Helper function to get viewer parameters based on client viewer type
const getViewerParameters = (viewerType?: string | null) => {
  console.log("viewerType", viewerType);
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

const sanitizeClientName = (client?: string | null): string | null => {
  if (!client) return null;
  return client.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const getArticleIdsTooltip = (articleIds: string[] | undefined | null) => {
  if (!articleIds || articleIds.length <= 1) return null;
  return articleIds.join(", ");
};

const buildGlbLinks = (
  asset: Asset
): { articleId: string; url: string | null }[] => {
  const ids =
    Array.isArray(asset.article_ids) && asset.article_ids.length > 0
      ? asset.article_ids
      : asset.article_id
        ? [asset.article_id]
        : [];

  if (ids.length === 0) return [];

  let basePath: string | null = null;

  if (asset.glb_link) {
    try {
      const url = new URL(asset.glb_link);
      const parts = url.pathname.split("/");
      parts.pop();
      basePath = `${url.origin}${parts.join("/")}`;
    } catch {
      basePath = null;
    }
  }

  if (!basePath && asset.client) {
    const sanitizedClient = sanitizeClientName(asset.client);
    if (sanitizedClient) {
      basePath = `https://maincdn.b-cdn.net/${sanitizedClient}/Android`;
    }
  }

  return ids.map((id, index) => {
    let url: string | null = null;
    if (basePath) {
      url = `${basePath}/${id}.glb`;
    } else if (asset.glb_link && index === 0) {
      url = asset.glb_link;
    }
    return { articleId: id, url };
  });
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newTag, setNewTag] = useState("");

  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const user = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canDownloadGLB, setCanDownloadGLB] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [relatedAssets, setRelatedAssets] = useState<Asset[]>([]);
  const [clientViewerType, setClientViewerType] = useState<string | null>(null);

  const glbLinks = asset ? buildGlbLinks(asset) : [];
  const [showGlbDownloads, setShowGlbDownloads] = useState(false);
  const downloadsRef = useRef<HTMLDivElement | null>(null);

  // Helper function to build back URL with current filters
  const buildBackUrl = () => {
    const currentParams = new URLSearchParams(searchParams.toString());
    return `/asset-library${currentParams.toString() ? `?${currentParams.toString()}` : ""}`;
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setCanDownloadGLB(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("role, client")
        .eq("id", user.id)
        .single();

      if (data?.role) setUserRole(data.role);

      // Admins can always download
      if (data?.role === "admin") {
        setCanDownloadGLB(true);
        return;
      }

      // Check enterprise contract
      if (data?.client) {
        const clientNames = Array.isArray(data.client)
          ? data.client
          : [data.client];

        const { data: clients } = await supabase
          .from("clients")
          .select("contract_type")
          .in("name", clientNames);

        const hasEnterprise = clients?.some(
          (c) => c.contract_type === "enterprise"
        );
        setCanDownloadGLB(hasEnterprise || false);
      } else {
        setCanDownloadGLB(false);
      }
    };
    fetchUserRole();
  }, [user]);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const response = await fetch(`/api/assets/${params.id}`);
        if (!response.ok) throw new Error("Failed to fetch asset");
        const data = await response.json();

        // Validate GLB link
        if (data.glb_link) {
          try {
            new URL(data.glb_link);
          } catch {
            console.warn("Invalid GLB link:", data.glb_link);
            data.glb_link = null; // Set to null if not a valid URL
          }
        }

        const articleIds = normalizeArticleIds(
          data.article_id,
          data.article_ids
        );
        const normalizedAsset: Asset = {
          ...data,
          article_ids: articleIds,
          article_id: articleIds[0] || data.article_id,
        };

        setAsset(normalizedAsset);
        setEditedAsset(normalizedAsset);

        // Fetch client's viewer type
        if (data.client) {
          try {
            const supabase = createClient();
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
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            setClientViewerType(null);
          }
        }
      } catch {
        console.error("Error fetching asset");
        setError("Failed to load asset details");
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [params.id]);

  useEffect(() => {
    setShowGlbDownloads(false);
  }, [asset?.id]);

  useEffect(() => {
    if (!showGlbDownloads) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        downloadsRef.current &&
        !downloadsRef.current.contains(event.target as Node)
      ) {
        setShowGlbDownloads(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showGlbDownloads]);

  useEffect(() => {
    const getZipUrl = async () => {
      if (!asset?.article_id) return;

      const supabase = createClient();
      try {
        // List files in the models directory
        const { data: files, error } = await supabase.storage
          .from("assets")
          .list("models");

        if (error) {
          console.error("Error listing files:", error);
          return;
        }

        // Find the ZIP file for this article_id
        const zipFile = files.find(
          (file) =>
            asset.article_id &&
            file.name.startsWith(asset.article_id) &&
            file.name.endsWith(".zip")
        );

        if (zipFile) {
          const { data } = supabase.storage
            .from("assets")
            .getPublicUrl(`models/${zipFile.name}`);

          setZipUrl(data.publicUrl);
        } else {
        }
      } catch (error) {
        console.error("Error getting ZIP URL:", error);
      }
    };

    getZipUrl();
  }, [asset?.article_id]);

  const handleEdit = async () => {
    try {
      const response = await fetch(`/api/assets/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedAsset),
      });

      if (!response.ok) throw new Error("Failed to update asset");

      const updatedAsset = await response.json();
      setAsset(updatedAsset);
      setIsEditing(false);
      toast.success("Asset updated successfully");
    } catch (err) {
      console.error("Error updating asset:", err);
      toast.error("Failed to update asset");
    }
  };

  const addMaterial = () => {
    if (newMaterial.trim() && editedAsset) {
      const currentMaterials = Array.isArray(editedAsset.materials)
        ? editedAsset.materials
        : [];
      setEditedAsset({
        ...editedAsset,
        materials: [...currentMaterials, newMaterial.trim()],
      });
      setNewMaterial("");
    }
  };

  const removeMaterial = (index: number) => {
    if (editedAsset) {
      const currentMaterials = Array.isArray(editedAsset.materials)
        ? editedAsset.materials
        : [];
      setEditedAsset({
        ...editedAsset,
        materials: currentMaterials.filter((_, i) => i !== index),
      });
    }
  };

  const addColor = () => {
    if (newColor.trim() && editedAsset) {
      const currentColors = Array.isArray(editedAsset.colors)
        ? editedAsset.colors
        : [];
      setEditedAsset({
        ...editedAsset,
        colors: [...currentColors, newColor.trim()],
      });
      setNewColor("");
    }
  };

  const removeColor = (index: number) => {
    if (editedAsset) {
      const currentColors = Array.isArray(editedAsset.colors)
        ? editedAsset.colors
        : [];
      setEditedAsset({
        ...editedAsset,
        colors: currentColors.filter((_, i) => i !== index),
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && editedAsset) {
      const currentTags = Array.isArray(editedAsset.tags)
        ? editedAsset.tags
        : [];
      setEditedAsset({
        ...editedAsset,
        tags: [...currentTags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const removeTag = (index: number) => {
    if (editedAsset) {
      const currentTags = Array.isArray(editedAsset.tags)
        ? editedAsset.tags
        : [];
      setEditedAsset({
        ...editedAsset,
        tags: currentTags.filter((_, i) => i !== index),
      });
    }
  };

  if (loading) {
    return (
      <div className=" p-2 sm:p-4 md:p-6">
        <div className="h-full">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 w-24 bg-muted rounded animate-pulse" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 p-2 sm:p-4 md:p-6">
            {/* Left Side - Model Viewer skeleton */}
            <div className="flex flex-col gap-4 h-full w-full lg:w-2/3">
              <div className="w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[1000px] bg-muted rounded-lg animate-pulse" />
            </div>

            {/* Right Side - Details skeleton */}
            <div className="flex flex-col gap-4 sm:gap-6 w-full lg:w-1/3">
              <div className="space-y-4">
                {/* Product title and download buttons */}
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>

                {/* Description skeleton */}
                <div className="space-y-2">
                  <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>

                {/* Specifications skeleton */}
                <div className="space-y-2">
                  <div className="h-5 w-28 bg-muted rounded animate-pulse" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 w-14 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-18 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Tags skeleton */}
                <div className="space-y-2">
                  <div className="h-5 w-12 bg-muted rounded animate-pulse" />
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    <div className="h-6 w-14 bg-muted rounded-full animate-pulse" />
                    <div className="h-6 w-18 bg-muted rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(buildBackUrl())}
            className="gap-2 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Asset Library
          </Button>
          <div className="flex justify-center items-center h-64 ">
            <p className="text-destructive">{error || "Asset not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <Script type="module" src="/model-viewer.js" />
      <div className=" bg-gradient-to-br from-background via-background to-muted/10 p-6">
        <div className="max-w-[1920px] mx-auto">
          {/* Enhanced Header */}
          <div className="flex justify-between items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(buildBackUrl())}
              className="gap-2 hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Asset Library
            </Button>
            {userRole === "admin" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (isEditing) {
                    setEditedAsset(asset);
                  }
                  setIsEditing(!isEditing);
                }}
                className="shadow-sm hover:shadow-md transition-all"
              >
                {isEditing ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Cancel Edit
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Product
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - 3D Viewer (full left side) */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden h-[600px] lg:h-[calc(100vh-200px)] relative">
                <div className="w-full h-full bg-gradient-to-br from-muted/20 via-background to-muted/10">
                  {asset.glb_link ? (
                    <ModelViewer
                      modelUrl={asset.glb_link}
                      alt={`3D model of ${asset.product_name}`}
                      environmentImage={
                        getViewerParameters(clientViewerType).environmentImage
                      }
                      exposure={getViewerParameters(clientViewerType).exposure}
                      toneMapping={
                        getViewerParameters(clientViewerType).toneMapping
                      }
                    />
                  ) : asset.preview_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.preview_image}
                      alt={asset.product_name}
                      className="w-full h-full object-contain p-8"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-muted/30 via-muted/20 to-muted/10 rounded-3xl flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]">
                          <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No 3D model available
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {/* AR Button Overlay - Enhanced */}
                {asset.glb_link && (
                  <div className="absolute top-6 right-6 z-10">
                    <ARButton
                      assetId={asset.id}
                      glbUrl={asset.glb_link}
                      productName={asset.product_name}
                      variant="default"
                      size="default"
                      className="shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-all bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Split into Specifications and Saved Packshots */}
            <div className="lg:col-span-1 flex flex-col gap-6 h-[calc(100vh-200px)] min-h-0">
              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="product_name">Product Name</Label>
                      <Input
                        id="product_name"
                        value={editedAsset?.product_name || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, product_name: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="article_id">Article ID</Label>
                      <Input
                        id="article_id"
                        value={editedAsset?.article_id || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, article_id: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client">Client</Label>
                      <Input
                        id="client"
                        value={editedAsset?.client || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, client: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={editedAsset?.category || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, category: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="subcategory">Subcategory</Label>
                      <Input
                        id="subcategory"
                        value={editedAsset?.subcategory || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, subcategory: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dimensions">Dimensions</Label>
                      <Input
                        id="dimensions"
                        value={editedAsset?.dimensions || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, dimensions: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editedAsset?.description || ""}
                      onChange={(e) =>
                        setEditedAsset(
                          editedAsset
                            ? { ...editedAsset, description: e.target.value }
                            : null
                        )
                      }
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="product_link">Product Link</Label>
                      <Input
                        id="product_link"
                        value={editedAsset?.product_link || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, product_link: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="glb_link">GLB Link</Label>
                      <Input
                        id="glb_link"
                        value={editedAsset?.glb_link || ""}
                        onChange={(e) =>
                          setEditedAsset(
                            editedAsset
                              ? { ...editedAsset, glb_link: e.target.value }
                              : null
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Materials */}
                    <div className="grid gap-2">
                      <Label>Materials</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newMaterial}
                          onChange={(e) => setNewMaterial(e.target.value)}
                          placeholder="Add new material"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMaterial();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="cursor-pointer"
                          onClick={addMaterial}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Array.isArray(editedAsset?.materials) &&
                          editedAsset.materials.map((material, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {material}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMaterial(index)}
                                className="ml-1 h-auto p-0 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                      </div>
                    </div>

                    {/* Colors */}
                    <div className="grid gap-2">
                      <Label>Colors</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          placeholder="Add new color"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addColor();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="cursor-pointer"
                          onClick={addColor}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Array.isArray(editedAsset?.colors) &&
                          editedAsset.colors.map((color, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {color}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeColor(index)}
                                className="ml-1 h-auto p-0 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="grid gap-2">
                    <Label>Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add new tag"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        onClick={addTag}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Array.isArray(editedAsset?.tags)
                        ? editedAsset.tags.map((tag: string, index: number) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {tag}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTag(index)}
                                className="ml-1 h-auto p-0 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        : editedAsset?.tags &&
                            typeof editedAsset.tags === "string"
                          ? [
                              <Badge
                                key="single-tag"
                                variant="secondary"
                                className="text-sm font-normal border border-border bg-background/50"
                              >
                                {editedAsset.tags}
                              </Badge>,
                            ]
                          : null}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setEditedAsset(asset);
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEdit} className="cursor-pointer">
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 h-full min-h-0">
                  {/* Specifications Section - Top */}
                  <div className="flex-shrink-0 max-h-[30vh] overflow-y-auto space-y-4">
                    {/* Product Header Card */}
                    <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">
                            {asset.product_name}
                          </h1>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-muted-foreground">
                              {asset.category}
                            </span>
                            {asset.subcategory && (
                              <>
                                <span className="text-muted-foreground/50">
                                  ›
                                </span>
                                <span className="text-sm font-medium text-muted-foreground">
                                  {asset.subcategory}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 relative flex-shrink-0"
                          ref={downloadsRef}
                        >
                          {canDownloadGLB && glbLinks.length > 0 && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="cursor-pointer shadow-sm hover:shadow-md transition-all"
                                onClick={() =>
                                  setShowGlbDownloads((prev) => !prev)
                                }
                              >
                                <Download className="h-4 w-4 mr-2" />
                                GLB
                              </Button>
                              {showGlbDownloads && (
                                <div className="absolute right-0 top-full mt-2 w-80 max-h-64 overflow-y-auto rounded-md border border-border bg-background shadow-lg z-30 p-3 space-y-2">
                                  {glbLinks.map(({ articleId, url }) => (
                                    <div
                                      key={articleId}
                                      className="text-xs sm:text-sm break-words"
                                    >
                                      {url ? (
                                        <a
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex w-full items-start gap-2 text-blue-500 hover:text-blue-600 break-all whitespace-normal"
                                        >
                                          <Download className="h-4 w-4 mt-0.5 shrink-0" />
                                          <span className="w-full break-words text-left whitespace-normal">
                                            {articleId}
                                          </span>
                                        </a>
                                      ) : (
                                        <span className="flex w-full items-start gap-2 text-muted-foreground break-all whitespace-normal">
                                          <Download className="h-4 w-4 mt-0.5 shrink-0" />
                                          <span className="w-full break-words text-left">
                                            {articleId} (unavailable)
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          {zipUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer shadow-sm hover:shadow-md transition-all"
                            >
                              <a
                                href={zipUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                                onClick={(e) => {
                                  if (!zipUrl) {
                                    e.preventDefault();
                                    toast.error(
                                      "ZIP file not found in storage"
                                    );
                                  }
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  <Download className="h-4 w-4" />
                                  OBJ
                                </span>
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description Card */}
                    {asset.description && (
                      <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/70 rounded-full"></div>
                          <h2 className="text-lg font-semibold text-foreground">
                            Description
                          </h2>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {asset.description}
                        </p>
                      </div>
                    )}

                    {/* Specifications Card */}
                    <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/70 rounded-full"></div>
                        <h2 className="text-lg font-semibold text-foreground">
                          Specifications
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                          <p className="text-sm font-semibold text-foreground/80">
                            Article IDs
                          </p>
                          {asset.article_id ? (
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant="secondary"
                                className="text-xs font-mono shadow-sm"
                                title={
                                  getArticleIdsTooltip(
                                    asset.article_ids || []
                                  ) || undefined
                                }
                              >
                                {asset.article_id}
                              </Badge>
                              {getAdditionalArticleIds(asset).map((id) => (
                                <Badge
                                  key={id}
                                  variant="secondary"
                                  className="text-xs font-mono shadow-sm"
                                  title={id}
                                >
                                  {id}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Not specified
                            </p>
                          )}
                        </div>

                        {asset.dimensions && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              Dimensions
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {asset.dimensions}
                            </p>
                          </div>
                        )}

                        {asset.materials && asset.materials.length > 0 && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              Materials
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {asset.materials.join(", ")}
                            </p>
                          </div>
                        )}

                        {asset.colors && asset.colors.length > 0 && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              Colors
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {asset.colors.join(", ")}
                            </p>
                          </div>
                        )}

                        {asset.client && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              Client
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {asset.client}
                            </p>
                          </div>
                        )}

                        {asset.product_link && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              Product Link
                            </p>
                            <a
                              href={asset.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:text-primary/80 transition-colors break-all"
                            >
                              {asset.product_link}
                            </a>
                          </div>
                        )}

                        {glbLinks.length > 0 && (
                          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm font-semibold text-foreground/80">
                              GLB Files
                            </p>
                            <details className="rounded-lg border border-border/40 bg-background/50 p-3 text-sm">
                              <summary className="cursor-pointer font-medium text-foreground hover:text-primary transition-colors">
                                View {glbLinks.length} file
                                {glbLinks.length > 1 ? "s" : ""}
                              </summary>
                              <div className="mt-3 space-y-2">
                                {glbLinks.map(({ articleId, url }) => (
                                  <div
                                    key={articleId}
                                    className="p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
                                  >
                                    {url ? (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block break-all text-sm text-primary hover:text-primary/80 transition-colors"
                                      >
                                        <span className="font-semibold font-mono">
                                          {articleId}
                                        </span>
                                        <span className="text-xs text-muted-foreground block mt-1 truncate">
                                          {url}
                                        </span>
                                      </a>
                                    ) : (
                                      <div>
                                        <span className="font-semibold font-mono text-sm">
                                          {articleId}
                                        </span>
                                        <span className="text-xs text-muted-foreground block mt-1">
                                          Not available
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tags Card */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/70 rounded-full"></div>
                          <h2 className="text-lg font-semibold text-foreground">
                            Tags
                          </h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {asset.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-sm shadow-sm hover:shadow-md transition-shadow"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generated Scenes Section */}
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] flex flex-col h-full">
                      {/* Header - Fixed outside scroll */}
                      <div className="flex items-center justify-between p-6 pb-4 border-b border-border/40 flex-shrink-0">
                        <h2 className="text-lg font-semibold">
                          Lifestyle Scenes
                        </h2>
                        <a
                          href="/scene-render"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3"
                        >
                          Create New Scene
                        </a>
                      </div>
                      {/* Scrollable Content */}
                      <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
                        <RelatedScenesSection
                          assetId={asset.id}
                          articleId={asset.article_id}
                          modelUrl={asset.glb_link}
                          productName={asset.product_name}
                          hideHeader={true}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Saved Packshots Section - Bottom */}
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <div className="bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] flex flex-col h-full">
                      {/* Header - Fixed outside scroll */}
                      <div className="flex items-center justify-between p-6 pb-4 border-b border-border/40 flex-shrink-0">
                        <h2 className="text-lg font-semibold">
                          Saved Packshots
                        </h2>
                      </div>
                      {/* Scrollable Content */}
                      <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
                        <SavedPackshotsSection
                          assetId={asset.id}
                          articleId={asset.article_id}
                          modelUrl={asset.glb_link}
                          productName={asset.product_name}
                          hideHeader={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
