import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/display";
import { Video, Download, X, Trash2, Play } from "lucide-react";

interface SavedVideo {
  id: string;
  product_name: string;
  description?: string;
  video_url?: string;
  preview_image?: string;
  created_at?: string;
  client?: string;
  tags?: string[];
  duration_seconds?: number;
  resolution?: string;
  dimensions?: string;
}

interface SavedVideosSectionProps {
  assetId?: string;
  articleId?: string;
  modelUrl?: string;
  productName?: string;
  hideHeader?: boolean;
}

const SavedVideosSection: React.FC<SavedVideosSectionProps> = ({
  assetId,
  articleId,
  modelUrl,
  hideHeader = false,
}) => {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SavedVideo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (assetId) params.append("asset_id", assetId);
        if (articleId) params.append("article_id", articleId);
        if (modelUrl) params.append("model_url", modelUrl);

        const response = await fetch(`/api/assets/videos?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch videos");
        }

        const data = await response.json();
        console.log("Videos data received:", data);
        setVideos(data.videos || []);
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError("Failed to load saved videos");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();

    // Listen for new videos saved
    const handleVideoSaved = () => {
      fetchVideos();
    };

    window.addEventListener("charpstar:videoSaved", handleVideoSaved as any);
    return () => {
      window.removeEventListener(
        "charpstar:videoSaved",
        handleVideoSaved as any
      );
    };
  }, [assetId, articleId, modelUrl]);

  const handleVideoClick = (video: SavedVideo) => {
    setSelectedVideo(video);
    setIsDialogOpen(true);
  };

  const handleDownload = async () => {
    if (!selectedVideo?.video_url) return;

    try {
      const response = await fetch(selectedVideo.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedVideo.product_name || "video"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading video:", error);
      alert("Failed to download video");
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedVideo(null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedVideo) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/assets/delete-scene`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sceneId: selectedVideo.id,
          assetId: assetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete video");
      }

      setVideos((prevVideos) =>
        prevVideos.filter((video) => video.id !== selectedVideo.id)
      );

      setShowDeleteConfirm(false);
      closeDialog();

      console.log("Video deleted successfully");
    } catch (error) {
      console.error("Error deleting video:", error);
      alert("Failed to delete video. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {!hideHeader && (
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Saved Videos</h2>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-video bg-muted rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {!hideHeader && (
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Saved Videos</h2>
          </div>
        )}
        <div className="text-center py-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="space-y-4">
        {!hideHeader && (
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Saved Videos</h2>
          </div>
        )}
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-muted/30 via-muted/20 to-muted/10 rounded-3xl flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]">
            <Video className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            No saved videos yet
          </p>
          <a
            href="/video-gen"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
          >
            Create Your First Video
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            Saved Videos ({videos.length})
          </h2>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => handleVideoClick(video)}
            className="group relative aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer border border-border/40 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
          >
            {video.preview_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  video.preview_image.startsWith("data:")
                    ? video.preview_image
                    : video.preview_image.startsWith("http")
                      ? video.preview_image
                      : `data:image/png;base64,${video.preview_image}`
                }
                alt={video.product_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to video icon if image fails to load
                  e.currentTarget.style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML =
                      '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 via-muted/20 to-muted/10"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg></div>';
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 via-muted/20 to-muted/10">
                <Video className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                <Play className="h-8 w-8 text-primary-foreground ml-1" />
              </div>
            </div>

            {/* Video info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-xs font-semibold text-white truncate">
                {video.product_name}
              </p>
              {video.resolution && (
                <p className="text-xs text-white/80">
                  {video.resolution} • {video.duration_seconds || 8}s
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Video Preview Dialog */}
      {isDialogOpen && selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeDialog}
        >
          <div
            className="relative w-full max-w-4xl bg-card rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeDialog}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Video player */}
            <div className="relative aspect-video bg-black">
              {selectedVideo.video_url ? (
                <video
                  controls
                  autoPlay
                  className="w-full h-full"
                  poster={
                    selectedVideo.preview_image
                      ? selectedVideo.preview_image.startsWith("data:")
                        ? selectedVideo.preview_image
                        : selectedVideo.preview_image.startsWith("http")
                          ? selectedVideo.preview_image
                          : `data:image/png;base64,${selectedVideo.preview_image}`
                      : undefined
                  }
                >
                  <source src={selectedVideo.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-white">Video not available</p>
                </div>
              )}
            </div>

            {/* Video details */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  {selectedVideo.product_name}
                </h3>
                {selectedVideo.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedVideo.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {selectedVideo.resolution && (
                  <span className="px-2 py-1 bg-muted rounded">
                    {selectedVideo.resolution}
                  </span>
                )}
                {selectedVideo.duration_seconds && (
                  <span className="px-2 py-1 bg-muted rounded">
                    {selectedVideo.duration_seconds}s
                  </span>
                )}
                {selectedVideo.created_at && (
                  <span className="px-2 py-1 bg-muted rounded">
                    {new Date(selectedVideo.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleDownload}
                  variant="default"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Video
                </Button>
                <Button
                  onClick={handleDeleteClick}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>

              {/* Delete confirmation */}
              {showDeleteConfirm && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-4">
                    Are you sure you want to delete this video? This action
                    cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDeleteConfirm}
                      variant="destructive"
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      {isDeleting ? "Deleting..." : "Yes, Delete"}
                    </Button>
                    <Button
                      onClick={handleDeleteCancel}
                      variant="outline"
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedVideosSection;
