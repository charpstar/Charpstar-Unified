"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Label } from "@/components/ui/display";
import { Slider } from "@/components/ui/inputs";
import { Select } from "@/components/ui/inputs";
import { ArrowLeft, Edit, Save, X, Download } from "lucide-react";
import Head from "next/head";

interface Texture {
  id: string;
  name: string;
  category: string;
  basecolor_url: string;
  roughness_url?: string;
  metallic_url?: string;
  normal_url?: string;
  preview_url: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export default function TextureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const textureId = params.id as string;

  const [texture, setTexture] = useState<Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTexture, setEditedTexture] = useState<Texture | null>(null);
  const [saving, setSaving] = useState(false);

  // Texture controls
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [wrapMode, setWrapMode] = useState("10497"); // Repeat

  const modelViewerRef = useRef<any>(null);

  // Load model-viewer script (must be before any early returns)
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/model-viewer.js";
    script.onload = () => {
      console.log("✅ model-viewer script loaded");
    };
    script.onerror = () => {
      console.error("❌ Failed to load model-viewer script");
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    fetchTexture();
  }, [textureId]);

  useEffect(() => {
    console.log("Texture effect triggered. Texture:", texture);
    console.log("Window defined:", typeof window !== "undefined");

    if (texture && typeof window !== "undefined") {
      // Wait for model-viewer script to load and DOM to be ready
      const checkAndInit = () => {
        if (typeof customElements !== "undefined") {
          console.log("✅ customElements API available");
          initializeModelViewer();
        } else {
          console.log("⏳ Waiting for customElements API...");
          setTimeout(checkAndInit, 100);
        }
      };

      setTimeout(checkAndInit, 200);
    }
  }, [texture]);

  const fetchTexture = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/textures/${textureId}`);
      const data = await response.json();

      if (data.texture) {
        setTexture(data.texture);
        setEditedTexture(data.texture);
      }
    } catch (error) {
      console.error("Error fetching texture:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeModelViewer = () => {
    console.log("🔧 Initializing model viewer...");
    const viewer = document.getElementById("textureViewer") as any;

    if (!viewer) {
      console.error("❌ Model viewer element not found!");
      return;
    }

    console.log("✅ Model viewer element found:", viewer);
    console.log("Model src attribute:", viewer.getAttribute("src"));
    modelViewerRef.current = viewer;

    // Wait for the web component to be defined
    if (!customElements.get("model-viewer")) {
      console.log("⏳ Waiting for model-viewer to be defined...");
      console.log(
        "Available custom elements:",
        Array.from((customElements as any).entries?.() || [])
      );

      // Set a timeout in case it never loads
      const timeout = setTimeout(() => {
        console.error(
          "❌ Timeout: model-viewer web component never registered!"
        );
        console.error("Check if /model-viewer.js is loading correctly");
      }, 5000);

      customElements
        .whenDefined("model-viewer")
        .then(() => {
          clearTimeout(timeout);
          console.log("✅ model-viewer component defined!");
          setupViewerListeners(viewer);
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error("❌ Error waiting for model-viewer:", err);
        });
    } else {
      console.log("✅ model-viewer component already defined");
      setupViewerListeners(viewer);
    }
  };

  const setupViewerListeners = (viewer: any) => {
    console.log("Setting up viewer listeners...");

    // Add load event listener
    viewer.addEventListener("load", () => {
      console.log("✅ Model loaded successfully!");
      console.log("Model object:", viewer.model);
      applyTexture();
    });

    // Add error event listener
    viewer.addEventListener("error", (event: any) => {
      console.error("❌ Error loading model:", event);
      console.error("Model source (property):", viewer.src);
      console.error("Model source (attribute):", viewer.getAttribute("src"));
    });

    // Add progress event listener
    viewer.addEventListener("progress", (event: any) => {
      const progress = event.detail.totalProgress * 100;
      console.log(`📦 Loading model: ${progress.toFixed(0)}%`);
    });

    // Check if model is already loaded
    setTimeout(() => {
      if (viewer.loaded) {
        console.log("✅ Model already loaded");
        applyTexture();
      } else {
        console.log("⏳ Model still loading...");
      }
    }, 500);
  };

  const applyTexture = async () => {
    console.log("🎨 Applying texture...");
    const viewer = modelViewerRef.current;

    if (!viewer) {
      console.error("❌ Viewer ref is null");
      return;
    }

    if (!texture) {
      console.error("❌ Texture data is null");
      return;
    }

    console.log("Texture data:", texture);

    try {
      const model = viewer.model;
      console.log("Model:", model);

      if (!model) {
        console.error("❌ Model not available yet");
        return;
      }

      // Get the first material
      const materials = model.materials;
      console.log(`Found ${materials?.length || 0} materials`);

      if (!materials || materials.length === 0) {
        console.error("❌ No materials found in model");
        return;
      }

      const material = materials[0];
      console.log("Using material:", material);

      // Apply base color texture
      if (texture.basecolor_url) {
        console.log("📸 Loading base color texture:", texture.basecolor_url);
        try {
          const baseColorTexture = await viewer.createTexture(
            texture.basecolor_url
          );
          console.log("✅ Base color texture created:", baseColorTexture);
          material.pbrMetallicRoughness.baseColorTexture.setTexture(
            baseColorTexture
          );
          updateTextureTransform(
            material.pbrMetallicRoughness.baseColorTexture
          );
          console.log("✅ Base color texture applied");
        } catch (err) {
          console.error("❌ Failed to load base color texture:", err);
        }
      }

      // Apply metallic-roughness texture
      if (texture.roughness_url) {
        console.log("📸 Loading roughness texture:", texture.roughness_url);
        try {
          const roughnessTexture = await viewer.createTexture(
            texture.roughness_url
          );
          console.log("✅ Roughness texture created");
          material.pbrMetallicRoughness.metallicRoughnessTexture.setTexture(
            roughnessTexture
          );
          updateTextureTransform(
            material.pbrMetallicRoughness.metallicRoughnessTexture
          );
          console.log("✅ Roughness texture applied");
        } catch (err) {
          console.error("❌ Failed to load roughness texture:", err);
        }
      }

      // Apply normal texture
      if (texture.normal_url) {
        console.log("📸 Loading normal texture:", texture.normal_url);
        try {
          const normalTexture = await viewer.createTexture(texture.normal_url);
          console.log("✅ Normal texture created");
          material.normalTexture.setTexture(normalTexture);
          updateTextureTransform(material.normalTexture);
          console.log("✅ Normal texture applied");
        } catch (err) {
          console.error("❌ Failed to load normal texture:", err);
        }
      }

      console.log("🎉 Texture application complete!");
    } catch (error) {
      console.error("❌ Error applying texture:", error);
    }
  };

  const updateTextureTransform = (textureInfo: any) => {
    if (!textureInfo || !textureInfo.texture) return;

    const sampler = textureInfo.texture.sampler;
    if (sampler) {
      sampler.setRotation(rotation);
      sampler.setScale({ u: scale, v: scale });
      sampler.setWrapS(parseInt(wrapMode));
      sampler.setWrapT(parseInt(wrapMode));
    }
  };

  const handleTextureUpdate = () => {
    applyTexture();
  };

  useEffect(() => {
    // Only apply texture updates if we have a texture and viewer loaded
    if (texture && modelViewerRef.current) {
      handleTextureUpdate();
    }
  }, [rotation, scale, wrapMode, texture]);

  const handleSave = async () => {
    if (!editedTexture) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/textures/${textureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedTexture.name,
          category: editedTexture.category,
          basecolor_url: editedTexture.basecolor_url,
          roughness_url: editedTexture.roughness_url,
          metallic_url: editedTexture.metallic_url,
          normal_url: editedTexture.normal_url,
          preview_url: editedTexture.preview_url,
          is_public: editedTexture.is_public,
        }),
      });

      const data = await response.json();

      if (data.texture) {
        setTexture(data.texture);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error saving texture:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!texture) return;

    const urls = [
      { url: texture.basecolor_url, name: `${texture.name}_basecolor.jpg` },
      texture.roughness_url && {
        url: texture.roughness_url,
        name: `${texture.name}_roughness.jpg`,
      },
      texture.metallic_url && {
        url: texture.metallic_url,
        name: `${texture.name}_metallic.jpg`,
      },
      texture.normal_url && {
        url: texture.normal_url,
        name: `${texture.name}_normal.jpg`,
      },
    ].filter(Boolean) as { url: string; name: string }[];

    urls.forEach(({ url, name }) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-96 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!texture) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Texture not found</p>
            <Button
              onClick={() => router.push("/texture-library")}
              className="mt-4"
            >
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-fit max-w-6xl mx-auto max-h-screen p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/texture-library")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{texture.name}</h1>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{texture.category}</Badge>
                {!texture.is_public && (
                  <Badge variant="secondary">Private</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download Maps
            </Button>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 3D Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>3D Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                  {/* @ts-expect-error -- model-viewer is a custom element */}
                  <model-viewer
                    id="textureViewer"
                    camera-controls
                    touch-action="pan-y"
                    src="https://maincdn.b-cdn.net/Adam_AB/QC/orb.glb"
                    alt="3D preview of texture"
                    style={{ width: "100%", height: "100%" }}
                    auto-rotate
                    shadow-intensity="1"
                    environment-image="neutral"
                    exposure="1"
                  />

                  {/* Fallback message if model doesn't load */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xs text-muted-foreground opacity-50">
                      Loading 3D model...
                    </p>
                  </div>
                </div>

                {/* Texture Controls */}
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Rotation: {rotation.toFixed(2)}</Label>
                    <Slider
                      min={0}
                      max={Math.PI}
                      step={0.01}
                      value={[rotation]}
                      onValueChange={([v]) => setRotation(v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Scale: {scale.toFixed(2)}</Label>
                    <Slider
                      min={0.5}
                      max={5}
                      step={0.01}
                      value={[scale]}
                      onValueChange={([v]) => setScale(v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Wrap Mode</Label>
                    <Select value={wrapMode} onValueChange={setWrapMode}>
                      <option value="10497">Repeat</option>
                      <option value="33071">ClampToEdge</option>
                      <option value="33648">MirroredRepeat</option>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Texture Properties */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Texture Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing && editedTexture ? (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editedTexture.name}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={editedTexture.category}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            category: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Base Color URL</Label>
                      <Input
                        value={editedTexture.basecolor_url}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            basecolor_url: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Roughness URL</Label>
                      <Input
                        value={editedTexture.roughness_url || ""}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            roughness_url: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Metallic URL</Label>
                      <Input
                        value={editedTexture.metallic_url || ""}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            metallic_url: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Normal URL</Label>
                      <Input
                        value={editedTexture.normal_url || ""}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            normal_url: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Preview URL</Label>
                      <Input
                        value={editedTexture.preview_url}
                        onChange={(e) =>
                          setEditedTexture({
                            ...editedTexture,
                            preview_url: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">
                        {texture.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <p className="text-sm text-muted-foreground">
                        {texture.category}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(texture.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(texture.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
