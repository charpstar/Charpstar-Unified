"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display/button";
import { Download, Trash2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";

interface GeneratedModel {
  id: string;
  model_name: string;
  model_url: string;
  file_size: number;
  face_count: number;
  enable_pbr: boolean;
  generate_type: string;
  image_mode: string;
  created_at: string;
  user?: {
    email: string;
    name: string;
  };
}

function ModelPreview({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);

  return <primitive object={scene} />;
}

export function GeneratedModelsGallery() {
  const [models, setModels] = useState<GeneratedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<GeneratedModel | null>(
    null
  );

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    try {
      setLoading(true);
      const response = await fetch("/api/generated-models");

      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }

      const data = await response.json();
      setModels(data.models || []);
    } catch (error: any) {
      console.error("Fetch models error:", error);
      toast.error("Failed to load models");
    } finally {
      setLoading(false);
    }
  }

  async function downloadModel(model: GeneratedModel) {
    try {
      toast.info("Downloading model...");

      const response = await fetch(model.model_url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${model.model_name}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Model downloaded!");
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download model");
    }
  }

  async function deleteModel(id: string) {
    if (!confirm("Are you sure you want to delete this model?")) {
      return;
    }

    try {
      const response = await fetch(`/api/generated-models/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete model");
      }

      toast.success("Model deleted");
      fetchModels(); // Refresh list
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete model");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4">🎨</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No Generated Models Yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Generate your first 3D model using the Generate tab. All your created
          models will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Generated Models
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {models.length} model{models.length !== 1 ? "s" : ""} saved
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {models.map((model) => (
              <Card
                key={model.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* 3D Preview */}
                <div className="relative h-48 bg-gradient-to-br from-muted to-accent">
                  <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <Stage environment="city" intensity={0.5}>
                      <ModelPreview modelUrl={model.model_url} />
                    </Stage>
                    <OrbitControls enableZoom={false} />
                  </Canvas>

                  {/* View button overlay */}
                  <button
                    onClick={() => setSelectedModel(model)}
                    className="absolute top-2 right-2 p-2 bg-background/80 rounded-lg hover:bg-background transition-colors"
                  >
                    <Eye className="h-4 w-4 text-foreground" />
                  </button>
                </div>

                {/* Model Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 truncate">
                    {model.model_name}
                  </h3>

                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    {model.user && (
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-border">
                        <span>Generated by:</span>
                        <span className="font-medium text-foreground">
                          {model.user.name || model.user.email}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium">{model.generate_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Faces:</span>
                      <span className="font-medium">
                        {model.face_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-medium">
                        {formatFileSize(model.file_size)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mode:</span>
                      <span className="font-medium capitalize">
                        {model.image_mode}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-2">
                      {formatDate(model.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => downloadModel(model)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteModel(model.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Full View Dialog */}
      {selectedModel && (
        <Dialog
          open={!!selectedModel}
          onOpenChange={() => setSelectedModel(null)}
        >
          <DialogContent className="min-w-6xl max-w-7xl h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{selectedModel.model_name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 bg-gradient-to-br from-muted to-accent rounded-lg min-h-0 w-full">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <Stage environment="city" intensity={0.5}>
                  <ModelPreview modelUrl={selectedModel.model_url} />
                </Stage>
                <OrbitControls />
              </Canvas>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
