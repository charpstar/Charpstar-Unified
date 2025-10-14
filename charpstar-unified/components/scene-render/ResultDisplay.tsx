import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/display/button";
import { Download, Loader2, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface ResultDisplayProps {
  images: string[];
  onReset: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ images, onReset }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);

  const imageBase64 = images[0]; // Single image
  const imageUrl = `data:image/png;base64,${imageBase64}`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  const handleDownloadHD = async () => {
    setIsUpscaling(true);
    try {
      // Call upscale API
      const response = await fetch("/api/scene-render/upscale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image: imageBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upscale image");
      }

      const data = await response.json();
      const upscaledImageUrl = `data:image/png;base64,${data.upscaledImage}`;

      // Create download link
      const link = document.createElement("a");
      link.href = upscaledImageUrl;
      link.download = `product-scene-hd-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("HD image downloaded successfully!");
    } catch (error) {
      console.error("Error upscaling image:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upscale image"
      );
    } finally {
      setIsUpscaling(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Your Premium Scene is Ready!
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          High-quality product scene generated and ready for download
        </p>

        <div
          className="w-full max-w-2xl aspect-square rounded-lg overflow-hidden border-2 border-border mb-6 shadow-lg cursor-zoom-in group relative"
          onClick={() => setIsModalOpen(true)}
          title="Click to view fullscreen"
          role="button"
          aria-label="View image fullscreen"
        >
          <Image
            src={imageUrl}
            alt="Generated product scene"
            className="w-full h-full object-contain bg-muted transition-transform duration-300 group-hover:scale-105"
            width={1024}
            height={1024}
            unoptimized
          />
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm">
            <Maximize2 className="h-3 w-3 inline mr-1" />
            Click to enlarge
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button
            onClick={handleDownloadHD}
            disabled={isUpscaling}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            {isUpscaling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upscaling...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download HD Image
              </>
            )}
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            Create Another Scene
          </Button>
        </div>

        {isUpscaling && (
          <p className="text-xs text-muted-foreground mt-3 animate-pulse">
            Enhancing image quality for download...
          </p>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
            aria-label="Close fullscreen view"
          >
            &times;
          </button>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Image
              src={imageUrl}
              alt="Generated product scene in fullscreen"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              width={1920}
              height={1920}
              unoptimized
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <Button
                onClick={handleDownloadHD}
                disabled={isUpscaling}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
              >
                {isUpscaling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upscaling...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download HD
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultDisplay;
