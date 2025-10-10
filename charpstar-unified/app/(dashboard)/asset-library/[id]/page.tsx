"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { ArrowLeft, Download, ImageIcon, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/inputs";
import Script from "next/script";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/contexts/useUser";

import { ModelViewer } from "@/components/asset-library/viewers/model-viewer";

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
  client?: string;
  materials?: string[];
  colors?: string[];
  tags?: string[];
  preview_image?: string;
  product_link?: string;
  glb_link?: string;
  zip_link?: string;
  created_at?: string;
  article_id?: string;
  modelUrl?: string;
  dimensions?: string;
}

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

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
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

        setAsset(data);
        setEditedAsset(data);

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
            onClick={() => router.push("/asset-library")}
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
    <>
      <Script type="module" src="/model-viewer.js" />
      <div className=" p-2 sm:p-4 md:p-6">
        <div className="h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/asset-library")}
              className="gap-2"
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

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 p-2 sm:p-4 md:p-6">
            {/* Left Side - Model Viewer */}
            <div className="flex flex-col gap-4 h-full w-full lg:w-2/3">
              <div className="w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px]">
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
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Details */}
            <div className="flex flex-col gap-4 sm:gap-6 w-full lg:w-1/3">
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
                      {Array.isArray(editedAsset?.tags) ? (
                        editedAsset.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-sm font-normal border border-border bg-background/50"
                          >
                            {tag}
                          </Badge>
                        ))
                      ) : editedAsset?.tags &&
                        typeof editedAsset.tags === "string" ? (
                        <Badge
                          variant="secondary"
                          className="text-sm font-normal border border-border bg-background/50"
                        >
                          {editedAsset.tags}
                        </Badge>
                      ) : null}
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
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                        {asset.product_name}
                      </h1>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {asset.category}{" "}
                        {asset.subcategory ? `> ${asset.subcategory}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {asset.glb_link && canDownloadGLB && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                        >
                          <a
                            href={asset.glb_link}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <span className="flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              GLB
                            </span>
                          </a>
                        </Button>
                      )}
                      {zipUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
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
                                toast.error("ZIP file not found in storage");
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

                  {/* Description */}
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold">
                      Description
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {asset.description}
                    </p>
                  </div>

                  {/* Specifications */}
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold">
                      Specifications
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-medium">
                          Dimensions
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {asset.dimensions || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-medium">
                          Materials
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {asset.materials?.join(", ") || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-medium">Colors</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {asset.colors?.join(", ") || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-medium">Client</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {asset.client || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="space-y-2">
                      <h2 className="text-base sm:text-lg font-semibold">
                        Tags
                      </h2>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {asset.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs sm:text-sm"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Related Assets */}
              {!isEditing && relatedAssets.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="text-base sm:text-lg font-semibold">
                    Related Assets
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
                    {relatedAssets.map((relatedAsset) => (
                      <Link
                        key={relatedAsset.id}
                        href={`/asset-library/${relatedAsset.id}`}
                        className="block"
                      >
                        <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                          {relatedAsset.preview_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={relatedAsset.preview_image}
                              alt={relatedAsset.product_name}
                              className="object-cover w-full h-full transition-transform "
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-medium text-white">
                              {relatedAsset.product_name}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-white/80">
                              {relatedAsset.category}
                              {relatedAsset.subcategory
                                ? ` > ${relatedAsset.subcategory}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
