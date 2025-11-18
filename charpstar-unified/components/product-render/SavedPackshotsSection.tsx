import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/display";
import { ImageIcon, Download, X, Trash2 } from "lucide-react";
import Image from "next/image";

interface Packshot {
  id: string;
  product_name: string;
  description?: string;
  preview_image?: string;
  created_at?: string;
  client?: string;
  render_settings?: {
    view?: string;
    resolution?: number;
    background?: string;
    aspectRatio?: string;
    format?: string;
  };
}

interface SavedPackshotsSectionProps {
  articleId?: string;
  modelUrl?: string;
  assetId?: string;
  productName?: string;
  hideHeader?: boolean;
}

const SavedPackshotsSection: React.FC<SavedPackshotsSectionProps> = ({
  articleId,
  modelUrl,
  assetId,
  hideHeader = false,
}) => {
  const [packshots, setPackshots] = useState<Packshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackshot, setSelectedPackshot] = useState<Packshot | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchPackshots = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (articleId) params.append("article_id", articleId);
        if (modelUrl) params.append("model_url", modelUrl);
        if (assetId) params.append("asset_id", assetId);

        const response = await fetch(
          `/api/assets/packshots?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch packshots");
        }

        const data = await response.json();
        console.log("Packshots data received:", data);
        setPackshots(data.packshots || []);
      } catch (err) {
        console.error("Error fetching packshots:", err);
        setError("Failed to load saved packshots");
      } finally {
        setLoading(false);
      }
    };

    fetchPackshots();

    // Listen for new packshots saved
    const handlePackshotSaved = () => {
      fetchPackshots();
    };

    window.addEventListener(
      "charpstar:packshotSaved",
      handlePackshotSaved as any
    );
    return () => {
      window.removeEventListener(
        "charpstar:packshotSaved",
        handlePackshotSaved as any
      );
    };
  }, [articleId, modelUrl, assetId]);

  const handlePackshotClick = (packshot: Packshot) => {
    setSelectedPackshot(packshot);
    setIsDialogOpen(true);
  };

  const handleDownload = async () => {
    if (selectedPackshot?.preview_image) {
      try {
        const response = await fetch(selectedPackshot.preview_image);
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const settings = selectedPackshot.render_settings || {};
        const view = settings.view || "render";
        const resolution = settings.resolution || "";
        const format = settings.format || "png";

        link.download = `${selectedPackshot.product_name || "packshot"}_${view}${resolution ? `_${resolution}` : ""}.${format}`;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Download failed:", error);
        window.open(selectedPackshot.preview_image, "_blank");
      }
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedPackshot(null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPackshot || !assetId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/assets/delete-packshot`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packshotId: selectedPackshot.id,
          assetId: assetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete packshot");
      }

      setPackshots((prevPackshots) =>
        prevPackshots.filter((packshot) => packshot.id !== selectedPackshot.id)
      );

      setShowDeleteConfirm(false);
      closeDialog();

      console.log("Packshot deleted successfully");
    } catch (error) {
      console.error("Error deleting packshot:", error);
      alert("Failed to delete packshot. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const formatRenderSettings = (settings?: Packshot["render_settings"]) => {
    if (!settings) return "";
    const parts = [];
    if (settings.view) parts.push(settings.view);
    if (settings.resolution) parts.push(`${settings.resolution}px`);
    if (settings.background) {
      if (settings.background === "transparent") {
        parts.push("transparent");
      } else {
        parts.push(`#${settings.background}`);
      }
    }
    return parts.join(" • ");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Saved Packshots</h2>
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
        <h2 className="text-lg font-semibold">Saved Packshots</h2>
        <div className="p-6 text-center border rounded-lg">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (packshots.length === 0) {
    return null; // Don't show anything if there are no packshots
  }

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Saved Packshots ({packshots.length})
          </h2>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {packshots.map((packshot) => (
          <div
            key={packshot.id}
            className="hover:shadow-md transition-shadow h-fit border rounded-lg cursor-pointer overflow-hidden"
            onClick={() => handlePackshotClick(packshot)}
          >
            <div className="aspect-square relative bg-muted">
              {packshot.preview_image ? (
                <Image
                  width={300}
                  height={300}
                  src={packshot.preview_image}
                  alt={packshot.product_name}
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
            {packshot.render_settings && (
              <div className="p-2 bg-background">
                <p className="text-xs text-muted-foreground truncate">
                  {formatRenderSettings(packshot.render_settings)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Dialog */}
      {isDialogOpen && selectedPackshot && (
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
              {selectedPackshot.preview_image ? (
                <Image
                  width={1200}
                  height={1200}
                  src={selectedPackshot.preview_image}
                  alt={selectedPackshot.product_name}
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

              {/* Render Settings Info */}
              {selectedPackshot.render_settings && (
                <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm">
                  {formatRenderSettings(selectedPackshot.render_settings)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && selectedPackshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Packshot</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this packshot? This action cannot
              be undone.
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

export default SavedPackshotsSection;
