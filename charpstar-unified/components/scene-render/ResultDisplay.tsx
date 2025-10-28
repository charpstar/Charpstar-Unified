import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/display/button";
import { Download, Loader2, Maximize2, Save } from "lucide-react";
import { toast } from "sonner";
import SaveSceneDialog from "./SaveSceneDialog";
import { createClient } from "@/utils/supabase/client";

interface ResultDisplayProps {
  images: string[];
  upscaledImages?: string[];
  showComparison?: boolean;
  onReset: () => void;
  imageFormat?: string;
  customWidth?: string;
  customHeight?: string;
  sceneDescription?: string;
  objectType?: string;
  sourceModelId?: string;
  sourceModelUrl?: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  images,
  upscaledImages,
  showComparison,
  onReset,
  imageFormat = "square",
  customWidth = "1080",
  customHeight = "1080",
  sceneDescription,
  objectType,
  sourceModelId,
  sourceModelUrl,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editedImages, setEditedImages] = useState<string[]>(images);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageUpdateKey, setImageUpdateKey] = useState(0);

  // Sync editedImages when images prop changes
  useEffect(() => {
    setEditedImages(images);
  }, [images]);

  // Get dimensions based on image format
  const getImageDimensions = () => {
    if (imageFormat === "custom") {
      return `${customWidth}x${customHeight}`;
    }

    const formatDimensions = {
      square: "1080x1080",
      instagram_story: "1080x1920",
      instagram_reel: "1080x1920",
      facebook_cover: "1920x1080",
      pinterest: "1080x1620",
    };

    return (
      formatDimensions[imageFormat as keyof typeof formatDimensions] ||
      "1080x1080"
    );
  };

  const imageData = editedImages[0]; // Single image (using edited version)
  // Check if it's already a URL or base64 data
  const imageUrl = imageData.startsWith("http")
    ? imageData
    : `data:image/png;base64,${imageData}`;

  // Debug logging
  console.log("Current imageData:", imageData?.substring(0, 100) + "...");
  console.log("Current imageUrl:", imageUrl?.substring(0, 100) + "...");

  // Function to calculate aspect ratio from image URL or data
  const calculateAspectRatio = (url: string) => {
    return new Promise<number>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setImageAspectRatio(aspectRatio);
        resolve(aspectRatio);
      };
      img.onerror = () => {
        // Fallback to square if we can't determine aspect ratio
        setImageAspectRatio(1);
        resolve(1);
      };
      img.src = url;
    });
  };

  // Calculate aspect ratio when component mounts
  useEffect(() => {
    calculateAspectRatio(imageUrl);
  }, [imageUrl]);

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

  const handleSaveToLibrary = async (formData: {
    product_name: string;
    description: string;
  }) => {
    console.log("handleSaveToLibrary called with:", formData);
    setIsSaving(true);
    try {
      // Get auth token for API requests
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      console.log("Auth token:", token ? "present" : "missing");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log("Making save request to /api/assets/save-scene");
      // Save to asset library with base64 image data
      const saveResponse = await fetch("/api/assets/save-scene", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...formData,
          // Use Cloudinary URL if available, otherwise use base64 data
          scene_image_url: imageData.startsWith("http") ? imageData : null,
          scene_image_data: imageData.startsWith("http")
            ? null
            : imageData.startsWith("data:image/")
              ? imageData
              : `data:image/png;base64,${imageData}`,
          original_images: images,
          objectType: "Generated Scene",
          sceneDescription: formData.description,
          sourceModelId: sourceModelId,
          sourceModelUrl: sourceModelUrl,
          // Pass image format information
          imageFormat: imageFormat,
          customWidth: customWidth,
          customHeight: customHeight,
        }),
      });

      console.log(
        "Save response status:",
        saveResponse.status,
        saveResponse.ok
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        console.error("Save scene error:", errorData);
        throw new Error(
          errorData.details ||
            errorData.error ||
            "Failed to save to asset library"
        );
      }

      const result = await saveResponse.json();
      console.log("Save successful:", result);
      toast.success("Scene saved to asset library!");
    } catch (error) {
      console.error("Error saving scene:", error);
      toast.error("Failed to save scene to library");
      throw error;
    } finally {
      setIsSaving(false);
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
      <div className="w-full h-full flex flex-col items-center p-3 sm:p-6 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2 text-center">
          {showComparison
            ? "Your Scene is Ready!"
            : "Your Premium Scene is Ready!"}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center px-2">
          {showComparison
            ? `High-quality upscaled scene (${getImageDimensions()}) generated and ready for download`
            : "High-quality product scene generated and ready for download"}
        </p>

        {showComparison && upscaledImageUrl ? (
          // Show only the upscaled image
          <div className="w-full max-w-4xl h-full mb-4 sm:mb-6 flex-1 min-h-0 max-h-[50vh] overflow-hidden">
            <div className="text-center mb-2 sm:mb-4">
              <span className="inline-flex items-center gap-2 px-2 sm:px-3 py-1 bg-primary/10 text-primary rounded-full text-xs sm:text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                Upscaled Scene ({getImageDimensions()})
              </span>
            </div>

            {imageAspectRatio ? (
              <div
                className=" w-full max-h-[200px] sm:max-h-[300px] rounded-lg overflow-hidden cursor-zoom-in group relative"
                style={{
                  aspectRatio: `${imageAspectRatio}`,
                  maxHeight: "50vh",
                }}
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
                        Rendering image...
                      </span>
                    </div>
                  </div>
                )}

                <Image
                  src={upscaledImageUrl}
                  alt={`Upscaled Scene (${getImageDimensions()})`}
                  className={` h-full max-h-[calc(70vh-100px)] object-contain transition-all duration-300 ${
                    isImageLoading
                      ? "opacity-0"
                      : "opacity-100 group-hover:scale-105"
                  }`}
                  fill
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
            ) : (
              // Loading state while calculating aspect ratio
              <div className="w-full h-full rounded-lg border-2 border-border flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-muted-foreground">
                    Preparing image...
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : // Single image display
        imageAspectRatio ? (
          <div
            className="w-full max-w-2xl rounded-lg overflow-hidden border-2 border-border mb-4 sm:mb-6 shadow-lg cursor-zoom-in group relative flex-1 min-h-0"
            style={{
              aspectRatio: `${imageAspectRatio}`,
              maxHeight: "50vh",
            }}
            onClick={() => setIsModalOpen(true)}
            title="Click to view fullscreen"
            role="button"
            aria-label="View image fullscreen"
          >
            <Image
              key={`main-image-${imageUpdateKey}`}
              src={imageUrl}
              alt="Generated product scene"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              fill
              unoptimized
            />
            <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs backdrop-blur-sm">
              <Maximize2 className="h-3 w-3 inline mr-1" />
              Click to enlarge
            </div>
          </div>
        ) : (
          // Loading state while calculating aspect ratio
          <div className="w-full max-w-2xl h-48 sm:h-64 rounded-lg border-2 border-border mb-4 sm:mb-6 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-muted-foreground">
                Preparing image...
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {/* Inline Image Edit */}

          {/* Image Edit 
          <div className="rounded-lg border border-border p-3 sm:p-4 bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Edit This Image</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Describe your change (e.g., change the blue sofa to vintage brown leather)"
                className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const prompt = (
                      e.currentTarget as HTMLInputElement
                    ).value.trim();
                    if (!prompt) return;

                    setIsEditingImage(true);
                    try {
                      const editRes = await fetch("/api/image-edit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          image: upscaledImageUrl || imageUrl,
                          prompt,
                        }),
                      });

                      if (editRes.ok) {
                        const data = await editRes.json();
                        const newUrl = data.editedImage as string;
                        if (newUrl) {
                          console.log(
                            "Received edited image URL:",
                            newUrl.substring(0, 100) + "..."
                          );
                          // Update the edited images state
                          setEditedImages((prev) => {
                            const updated = [...prev];
                            // Keep the data URL as-is if it's a data URL, otherwise treat as base64
                            updated[0] = newUrl.startsWith("data:image/")
                              ? newUrl.replace(/^data:image\/[^;]+;base64,/, "")
                              : newUrl.startsWith("http")
                                ? newUrl
                                : newUrl;
                            console.log(
                              "Updated editedImages[0]:",
                              updated[0].substring(0, 100) + "..."
                            );
                            return updated;
                          });
                          //eslint-disable-next-line @typescript-eslint/no-unused-vars
                          setImageUpdateKey((prev) => prev + 1);
                          toast.success("Image edited successfully!");
                        }
                        (e.currentTarget as HTMLInputElement).value = "";
                      } else {
                        const errorData = await editRes.json();
                        toast.error(errorData.error || "Failed to edit image");
                      }
                    } catch (error) {
                      console.error("Error editing image:", error);
                      toast.error("Failed to edit image. Please try again.");
                    } finally {
                      setIsEditingImage(false);
                    }
                  }
                }}
              />
              <button
                className="h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isEditingImage}
                onClick={async (e) => {
                  const wrapper = e.currentTarget.parentElement as HTMLElement;
                  const input = wrapper.querySelector("input");
                  const prompt = (input as HTMLInputElement)?.value.trim();
                  if (!prompt) return;

                  setIsEditingImage(true);
                  try {
                    const editRes = await fetch("/api/image-edit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        image: upscaledImageUrl || imageUrl,
                        prompt,
                      }),
                    });

                    if (editRes.ok) {
                      const data = await editRes.json();
                      const newUrl = data.editedImage as string;
                      if (newUrl) {
                        console.log(
                          "Received edited image URL:",
                          newUrl.substring(0, 100) + "..."
                        );
                        // Update the edited images state
                        setEditedImages((prev) => {
                          const updated = [...prev];
                          // Keep the data URL as-is if it's a data URL, otherwise treat as base64
                          updated[0] = newUrl.startsWith("data:image/")
                            ? newUrl.replace(/^data:image\/[^;]+;base64,/, "")
                            : newUrl.startsWith("http")
                              ? newUrl
                              : newUrl;
                          console.log(
                            "Updated editedImages[0]:",
                            updated[0].substring(0, 100) + "..."
                          );
                          return updated;
                        });
                        setImageUpdateKey((prev) => prev + 1);
                        toast.success("Image edited successfully!");
                      }
                      (input as HTMLInputElement).value = "";
                    } else {
                      const errorData = await editRes.json();
                      toast.error(errorData.error || "Failed to edit image");
                    }
                  } catch (error) {
                    console.error("Error editing image:", error);
                    toast.error("Failed to edit image. Please try again.");
                  } finally {
                    setIsEditingImage(false);
                  }
                }}
              >
                {isEditingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Editing...
                  </>
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>
          */}

          {/* Primary Download Button */}
          {showComparison && upscaledImageUrl ? (
            <Button
              onClick={handleDownloadUpscaled}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={isImageLoading}
            >
              {isImageLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Download HD Image ({getImageDimensions()})
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleDownloadOriginal}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={isImageLoading}
            >
              {isImageLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Download Image
                </>
              )}
            </Button>
          )}

          {/* Secondary Actions */}
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              onClick={() => setIsSaveDialogOpen(true)}
              variant="outline"
              className="flex-1 h-11 bg-background hover:bg-muted border-2 border-border hover:border-primary/30 transition-all"
            >
              <Save className="h-4 w-4 mr-2" />
              Save to Library
            </Button>
            <Button
              onClick={onReset}
              variant="outline"
              className="flex-1 h-11 bg-background hover:bg-muted border-2 border-border hover:border-primary/30 transition-all"
            >
              Create Another
            </Button>
          </div>
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
              key={`modal-image-${imageUpdateKey}`}
              src={upscaledImageUrl || imageUrl}
              alt={`Upscaled Scene (${getImageDimensions()}) in fullscreen`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              style={{
                aspectRatio: imageAspectRatio ? `${imageAspectRatio}` : "1",
              }}
              width={1920}
              height={imageAspectRatio ? 1920 / imageAspectRatio : 1920}
              unoptimized
            />
            <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 sm:gap-2">
              {showComparison && upscaledImageUrl ? (
                <Button
                  onClick={handleDownloadUpscaled}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg text-xs sm:text-sm"
                  size="sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">
                    Download HD ({getImageDimensions()})
                  </span>
                  <span className="sm:hidden">Download</span>
                </Button>
              ) : (
                <Button
                  onClick={handleDownloadOriginal}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg text-xs sm:text-sm"
                  size="sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">
                    Download HD ({getImageDimensions()})
                  </span>
                  <span className="sm:hidden">Download</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <SaveSceneDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={handleSaveToLibrary}
        isLoading={isSaving}
        initialData={{
          product_name: `${objectType || "Generated"} Scene - ${new Date().toLocaleDateString()}`,
          description:
            sceneDescription || `Generated ${objectType || "product"} scene`,
        }}
      />
    </>
  );
};

export default ResultDisplay;
