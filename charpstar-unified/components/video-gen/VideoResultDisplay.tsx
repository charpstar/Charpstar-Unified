import React, { useState } from "react";
import { Button } from "@/components/ui/display/button";
import { Download, Film, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import SaveSceneDialog from "@/components/scene-render/SaveSceneDialog";
import { createClient } from "@/utils/supabase/client";

interface VideoResultDisplayProps {
  videoUrl: string;
  posterImage?: string | null;
  resolution: string;
  durationSeconds: string;
  sceneDescription?: string;
  objectType?: string;
  onReset: () => void;
  sourceModelId?: string;
  sourceModelUrl?: string;
}

const VideoResultDisplay: React.FC<VideoResultDisplayProps> = ({
  videoUrl,
  posterImage,
  resolution,
  durationSeconds,
  sceneDescription,
  objectType,
  onReset,
  sourceModelId,
  sourceModelUrl,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const trackDownload = async () => {
    try {
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const user_id = session.data.session?.user?.id;
      if (user_id) {
        await fetch("/api/analytics/video-gen/track-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id }),
        });
      }
    } catch (error) {
      console.warn("Failed to track video download", error);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch video");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `video-scene-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      await trackDownload();
      toast.success("Video downloaded successfully");
    } catch (error) {
      console.error("Error downloading video:", error);
      toast.error("Failed to download video");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToLibrary = async (formData: {
    product_name: string;
    description: string;
  }) => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/assets/save-scene", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...formData,
          scene_video_url: videoUrl,
          scene_image_data: posterImage || null,
          sourceModelId,
          sourceModelUrl,
          category: "Video Scene",
          imageFormat: resolution,
          customWidth: resolution === "1080p" ? "1920" : "1280",
          customHeight: resolution === "1080p" ? "1080" : "720",
          duration_seconds: durationSeconds,
          tags: ["video-gen"],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save video");
      }

      toast.success("Video scene saved to asset library");

      // Emit event to refresh saved videos list
      window.dispatchEvent(new CustomEvent("charpstar:videoSaved"));

      // Close the dialog after successful save
      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error("Error saving video scene:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save video scene"
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="w-full h-full flex flex-col items-center p-4 sm:p-6 gap-4">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.25rem] text-primary">
            Video Gen AI
          </p>
          <h2 className="text-2xl font-bold">Your cinematic clip is ready!</h2>
          <p className="text-sm text-muted-foreground">
            {resolution.toUpperCase()} • ~{durationSeconds}s • {objectType}
          </p>
        </div>

        <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-border shadow-2xl bg-black">
          <video
            controls
            controlsList="nodownload"
            poster={
              posterImage
                ? posterImage.startsWith("data:")
                  ? posterImage
                  : `data:image/png;base64,${posterImage}`
                : undefined
            }
            className="w-full h-full aspect-video bg-black"
            src={videoUrl}
          />
        </div>

        {sceneDescription && (
          <div className="w-full max-w-3xl bg-muted/40 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Creative Brief</p>
            <p>{sceneDescription}</p>
          </div>
        )}

        <div className="w-full max-w-3xl flex flex-col gap-3">
          <Button
            onClick={handleDownload}
            className="w-full h-12 text-base font-semibold"
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Preparing download...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Download video
              </>
            )}
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setIsSaveDialogOpen(true)}
            >
              <Save className="h-4 w-4 mr-2" />
              Save to library
            </Button>
            <Button variant="outline" className="h-11" onClick={onReset}>
              <Film className="h-4 w-4 mr-2" />
              Create another
            </Button>
          </div>
        </div>
      </div>

      <SaveSceneDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={handleSaveToLibrary}
        isLoading={isSaving}
        initialData={{
          product_name: `${objectType || "Generated"} Video - ${new Date().toLocaleDateString()}`,
          description:
            sceneDescription || `Generated ${objectType || "product"} video`,
        }}
      />
    </>
  );
};

export default VideoResultDisplay;
