"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  ImageIcon,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import Script from "next/script";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "interaction-prompt"?: string;
          ar?: boolean;
          "ar-modes"?: string;
          "ar-scale"?: string;
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
}

export default function AssetDetailPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newTag, setNewTag] = useState("");

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
          } catch (e) {
            console.warn("Invalid GLB link:", data.glb_link);
            data.glb_link = null; // Set to null if not a valid URL
          }
        }

        setAsset(data);
        setEditedAsset(data);
        console.log("Asset Details:", {
          id: data.id,
          name: data.product_name,
          category: data.category,
          subcategory: data.subcategory,
          description: data.description,
          client: data.client,
          materials: data.materials,
          colors: data.colors,
          tags: data.tags,
          preview_image: data.preview_image,
          product_link: data.product_link,
          glb_link: data.glb_link,
          glb_link_valid: data.glb_link
            ? new URL(data.glb_link).toString()
            : false,
          raw_data: data,
        });
        console.log("Asset Details:", data);
      } catch (err) {
        console.error("Error fetching asset:", err);
        setError("Failed to load asset details");
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [params.id]);

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
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-96 bg-muted rounded animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/asset-library">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Asset Library
            </Button>
          </Link>
          <div className="flex justify-center items-center h-64">
            <p className="text-destructive">{error || "Asset not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
      />
      <div className="p-6 h-[calc(100vh-4rem)]">
        <div className="h-full">
          <div className="flex justify-between items-center mb-6">
            <Link href="/asset-library">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Asset Library
              </Button>
            </Link>
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
          </div>

          <div className="grid gap-8 md:grid-cols-2 h-[calc(100%-4rem)]">
            <div className="space-y-4 h-full">
              {asset.glb_link ? (
                <div className="w-full h-full rounded-lg overflow-hidden bg-muted">
                  <model-viewer
                    src={asset.glb_link}
                    alt={asset.product_name}
                    auto-rotate
                    camera-controls
                    shadow-intensity="1"
                    camera-orbit="0deg 75deg 105%"
                    min-camera-orbit="auto auto 50%"
                    max-camera-orbit="auto auto 150%"
                    interaction-prompt="auto"
                    environment-image="neutral"
                    exposure="1"
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "transparent",
                    }}
                  />
                </div>
              ) : asset.preview_image ? (
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

            <div className="flex flex-col gap-10 space-y-6 h-full overflow-y-auto pr-4">
              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="id">Article ID</Label>
                      <Input
                        id="id"
                        value={editedAsset?.id}
                        disabled
                        className="bg-muted"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <button
                              onClick={() => removeMaterial(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
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
                            <button
                              onClick={() => removeColor(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
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
                        onClick={addTag}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Array.isArray(editedAsset?.tags) &&
                        editedAsset.tags.map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1 border border-border"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditedAsset(asset);
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEdit}>Save Changes</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      {asset.product_name}
                    </h1>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary/90">
                        {asset.category}
                      </Badge>
                      {asset.subcategory && (
                        <Badge
                          variant="secondary"
                          className="bg-background/90 hover:bg-background/90"
                        >
                          {asset.subcategory}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold">
                        Basic Information
                      </h2>
                      <div className="grid gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground w-24">
                            Article ID:
                          </span>
                          <span className="text-sm">{asset.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground w-24">
                            Client:
                          </span>
                          <span className="text-sm">
                            {asset.client || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {asset.description && (
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold">Description</h2>
                        <p className="text-muted-foreground">
                          {asset.description}
                        </p>
                      </div>
                    )}

                    {/* Materials and Colors */}
                    {(Array.isArray(asset.materials) &&
                      asset.materials.length > 0) ||
                    (Array.isArray(asset.colors) && asset.colors.length > 0) ? (
                      <div className="space-y-4">
                        <h2 className="text-xl font-semibold">
                          Specifications
                        </h2>
                        {Array.isArray(asset.materials) &&
                          asset.materials.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium mb-2">
                                Materials
                              </h3>
                              <div className="flex flex-wrap gap-1.5">
                                {asset.materials.map((material: string) => (
                                  <Badge
                                    key={material}
                                    variant="secondary"
                                    className="text-sm font-normal"
                                  >
                                    {material.replace(/[\[\]"]/g, "")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                        {Array.isArray(asset.colors) &&
                          asset.colors.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium mb-2">
                                Colors
                              </h3>
                              <div className="flex flex-wrap gap-1.5">
                                {asset.colors.map((color: string) => (
                                  <Badge
                                    key={color}
                                    variant="outline"
                                    className="text-sm font-normal"
                                  >
                                    {color.replace(/[\[\]"]/g, "")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    ) : null}

                    {/* Tags */}
                    {asset.tags && (
                      <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Tags</h2>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(asset.tags) ? (
                            asset.tags.map((tag: string) => (
                              <div key={tag}>
                                <Badge
                                  variant="secondary"
                                  className="text-sm font-normal border border-border"
                                >
                                  {tag.replace(/[\[\]"]/g, "")}
                                </Badge>
                              </div>
                            ))
                          ) : typeof asset.tags === "string" ? (
                            <div>
                              <Badge
                                variant="secondary"
                                className="text-sm font-normal border border-border"
                              >
                                {asset.tags.replace(/[\[\]"]/g, "")}
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <Button
                        variant="default"
                        className="flex-1 group/btn"
                        asChild
                      >
                        <a
                          href={asset.product_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          View Original Product
                          <ExternalLink className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 hover:bg-muted/50 transition-colors group/download"
                        asChild
                        disabled={!asset.glb_link}
                      >
                        <a
                          href={asset.glb_link}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download 3D Model"
                          className="flex items-center justify-center"
                        >
                          <Download className="h-4 w-4 transition-transform group-hover/download:translate-y-0.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
