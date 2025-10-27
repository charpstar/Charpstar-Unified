import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/display";
import { ImageIcon, Download, X, Trash2 } from "lucide-react";
import Image from "next/image";

interface Scene {
  id: string;
  product_name: string;
  description?: string;
  preview_image?: string;
  created_at?: string;
  client?: string;
  tags?: string[];
}

interface RelatedScenesSectionProps {
  articleId?: string;
  modelUrl?: string;
  productName: string;
}

const RelatedScenesSection: React.FC<RelatedScenesSectionProps> = ({
  articleId,
  modelUrl,
}) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (articleId) params.append("article_id", articleId);
        if (modelUrl) params.append("model_url", modelUrl);

        const response = await fetch(`/api/assets/scenes?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch scenes");
        }

        const data = await response.json();
        console.log("Scenes data received:", data);
        console.log(
          "First scene preview_image:",
          data.scenes?.[0]?.preview_image
            ? `${data.scenes[0].preview_image.substring(0, 100)}...`
            : null
        );
        setScenes(data.scenes || []);
      } catch (err) {
        console.error("Error fetching scenes:", err);
        setError("Failed to load related scenes");
      } finally {
        setLoading(false);
      }
    };

    fetchScenes();
  }, [articleId, modelUrl]);

  const handleSceneClick = (scene: Scene) => {
    setSelectedScene(scene);
    setIsDialogOpen(true);
  };

  const handleDownload = async () => {
    if (selectedScene?.preview_image) {
      try {
        // Fetch the image data
        const response = await fetch(selectedScene.preview_image);
        const blob = await response.blob();

        // Get the correct dimensions for the filename
        const dimensions = getSceneDimensions(selectedScene);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedScene.product_name || "scene"}_${dimensions}.png`;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Download failed:", error);
        // Fallback: open in new tab
        window.open(selectedScene.preview_image, "_blank");
      }
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedScene(null);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedScene) return;

    setIsDeleting(true);
    try {
      // Get the asset ID from the URL params or context
      // Since this component is used in the asset detail page, we can extract it from the URL
      const currentPath = window.location.pathname;
      const assetIdMatch = currentPath.match(/\/asset-library\/([^/]+)/);
      const assetId = assetIdMatch ? assetIdMatch[1] : null;

      const response = await fetch(`/api/assets/delete-scene`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sceneId: selectedScene.id,
          assetId: assetId, // Pass the asset ID for the new structure
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete scene");
      }

      // Remove the scene from the local state
      setScenes((prevScenes) =>
        prevScenes.filter((scene) => scene.id !== selectedScene.id)
      );

      // Close the dialogs
      setShowDeleteConfirm(false);
      closeDialog();

      // Show success message (you can add toast here if you have it)
      console.log("Scene deleted successfully");
    } catch (error) {
      console.error("Error deleting scene:", error);
      alert("Failed to delete scene. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Extract dimensions from scene tags
  const getSceneDimensions = (scene: Scene) => {
    const dimensionTag = scene.tags?.find((tag) =>
      tag.startsWith("dimensions:")
    );

    if (dimensionTag) {
      return dimensionTag.replace("dimensions:", "");
    }

    return "1080x1080"; // Default fallback
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Scenes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden border rounded-lg">
              <div className="p-0">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Scenes</h2>
        <div className="p-6 text-center border rounded-lg">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Scenes</h2>
        <div className="p-6 text-center border rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No scenes generated yet</p>
              <p className="text-sm text-muted-foreground">
                Use this model in the scene renderer to create scenes
              </p>
            </div>
            <a
              href="/scene-render"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3"
            >
              Create Scene
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Generated Scenes ({scenes.length})
        </h2>
        <a
          href="/scene-render"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3"
        >
          Create New Scene
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 overflow-y-scroll h-[600px]">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="hover:shadow-md transition-shadow h-fit border rounded-lg cursor-pointer"
            onClick={() => handleSceneClick(scene)}
          >
            <div className="aspect-square rounded-lg relative bg-muted overflow-hidden">
              {scene.preview_image ? (
                <Image
                  width={600}
                  height={600}
                  src={scene.preview_image}
                  alt={scene.product_name}
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-200"
                  quality={95}
                  unoptimized={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Image Dialog */}
      {isDialogOpen && selectedScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
            {/* Close Button */}
            <button
              onClick={closeDialog}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Image */}
            <div className="relative bg-white rounded-lg overflow-hidden">
              {selectedScene.preview_image ? (
                <Image
                  width={1200}
                  height={1200}
                  src={selectedScene.preview_image}
                  alt={selectedScene.product_name}
                  className="w-full h-auto max-h-[80vh] object-contain"
                  quality={100}
                  unoptimized={false}
                />
              ) : (
                <div className="flex h-96 items-center justify-center bg-muted">
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="bg-red-500/80 hover:bg-red-600/80 text-white border-0"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
                <Button
                  onClick={handleDownload}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && selectedScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Scene</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedScene.product_name}? This
              action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleDeleteCancel}
                variant="outline"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatedScenesSection;
