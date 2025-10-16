import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/display/button";
import { Download, Loader2, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface ResultDisplayProps {
  images: string[];
  upscaledImages?: string[];
  showComparison?: boolean;
  onReset: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  images,
  upscaledImages,
  showComparison,
  onReset,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const imageData = images[0]; // Single image
  // Check if it's already a URL or base64 data
  const imageUrl = imageData.startsWith("http")
    ? imageData
    : `data:image/png;base64,${imageData}`;

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

  const handleDownloadOriginal = async () => {
    try {
      // Fetch the image as a blob and create a download
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `product-scene-original-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      window.URL.revokeObjectURL(url);

      toast.success("Original image downloaded successfully!");
    } catch (error) {
      console.error("Error downloading original image:", error);
      toast.error("Failed to download original image");
    }
  };

  const handleDownloadUpscaled = async () => {
    try {
      if (upscaledImageUrl) {
        // Fetch the image as a blob and create a download
        const response = await fetch(upscaledImageUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch image");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `product-scene-upscaled-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL
        window.URL.revokeObjectURL(url);

        toast.success("Upscaled image downloaded successfully!");
      } else {
        toast.error("No upscaled image available");
      }
    } catch (error) {
      console.error("Error downloading upscaled image:", error);
      toast.error("Failed to download upscaled image");
    }
  };

  const upscaledImageData = upscaledImages?.[0];
  const upscaledImageUrl = upscaledImageData
    ? upscaledImageData.startsWith("http")
      ? upscaledImageData
      : `data:image/png;base64,${upscaledImageData}`
    : null;

  // Reset loading state when upscaled image changes
  useEffect(() => {
    if (showComparison && upscaledImageUrl) {
      setIsImageLoading(true);
    }
  }, [showComparison, upscaledImageUrl]);

  const handleImageLoad = () => {
    setIsImageLoading(false);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
  };

  return (
    <>
      <div className="w-full h-full flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {showComparison
            ? "Your AI-Upscaled Scene is Ready!"
            : "Your Premium Scene is Ready!"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {showComparison
            ? "High-quality AI-upscaled scene (4096x2048) generated and ready for download"
            : "High-quality product scene generated and ready for download"}
        </p>

        {showComparison && upscaledImageUrl ? (
          // Show only the upscaled image
          <div className="w-full max-w-4xl mb-6 flex-1 min-h-0 overflow-hidden">
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                AI Upscaled (4096x2048)
              </span>
            </div>

            <div
              className="w-full aspect-ratio-1/2 rounded-lg overflow-hidden border-2 border-border shadow-lg cursor-zoom-in group relative"
              onClick={() => setIsModalOpen(true)}
              title="Click to view fullscreen"
              role="button"
              aria-label="View upscaled image fullscreen"
            >
              {/* Loading overlay */}
              {isImageLoading && (
                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-muted-foreground">
                      Processing image...
                    </span>
                  </div>
                </div>
              )}

              <Image
                src={upscaledImageUrl}
                alt="AI upscaled product scene"
                className={`w-full h-full object-contain bg-muted transition-all duration-300 h-auto  ${
                  isImageLoading
                    ? "opacity-0"
                    : "opacity-100 group-hover:scale-105"
                }`}
                width={1024}
                height={1024}
                unoptimized
                onLoad={handleImageLoad}
                onError={handleImageError}
              />

              {!isImageLoading && (
                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-3 w-3 inline mr-1" />
                  Click to enlarge
                </div>
              )}
            </div>
          </div>
        ) : (
          // Single image display
          <div
            className="w-full max-w-2xl aspect-square rounded-lg overflow-hidden border-2 border-border mb-6 shadow-lg cursor-zoom-in group relative flex-1 min-h-0"
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
        )}

        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {showComparison && upscaledImageUrl ? (
            // Single download button for upscaled image
            <Button
              onClick={handleDownloadUpscaled}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
              disabled={isImageLoading}
            >
              {isImageLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download HD Image (4096x2048)
                </>
              )}
            </Button>
          ) : (
            // Single download button for single image mode
            <Button
              onClick={handleDownloadOriginal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
              disabled={isImageLoading}
            >
              {isImageLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </>
              )}
            </Button>
          )}

          <Button
            onClick={onReset}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Create Another Scene
          </Button>

          {isImageLoading && (
            <div className="text-center mt-2">
              <p className="text-xs text-muted-foreground animate-pulse">
                Cloudinary is processing your image to 4096x2048 resolution...
              </p>
            </div>
          )}
        </div>
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
              src={upscaledImageUrl || imageUrl}
              alt="AI upscaled product scene in fullscreen"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              width={1920}
              height={1920}
              unoptimized
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              {showComparison && upscaledImageUrl ? (
                <Button
                  onClick={handleDownloadUpscaled}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download HD (4096x2048)
                </Button>
              ) : (
                <Button
                  onClick={handleDownloadOriginal}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultDisplay;
