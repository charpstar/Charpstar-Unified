"use client";

import { useCallback, useState } from "react";
import { Upload, Star, X, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/display/button";
import {
  UploadedImages,
  UploadedImage,
} from "@/components/generator/GeneratorPage";
import Image from "next/image";
import { toast } from "sonner";

interface HunyuanImageUploadSectionProps {
  uploadedImages: UploadedImages;
  setUploadedImages: (images: UploadedImages) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setGeneratedModel: (model: string | null) => void;
  setTencentModelUrl: (url: string | null) => void;
  tencentModelUrl: string | null;
  isSingleImageMode: boolean;
  faceCount: number;
  enablePBR: boolean;
  generateType: "Normal" | "LowPoly" | "Geometry" | "Sketch";
  onModelSaved?: () => void;
}

type ViewType = "front" | "back" | "left" | "right";

interface ViewConfig {
  type: ViewType;
  label: string;
  required: boolean;
  icon?: React.ReactNode;
}

const viewConfigs: ViewConfig[] = [
  {
    type: "front",
    label: "Front (Required)",
    required: true,
    icon: <Star className="h-3 w-3 text-orange-500" />,
  },
  { type: "back", label: "Back", required: false },
  { type: "left", label: "Left", required: false },
  { type: "right", label: "Right", required: false },
];

export function HunyuanImageUploadSection({
  uploadedImages,
  setUploadedImages,
  isGenerating,
  setIsGenerating,
  setGenerationProgress,
  setGeneratedModel,
  setTencentModelUrl,
  tencentModelUrl,
  isSingleImageMode,
  faceCount,
  enablePBR,
  generateType,
  onModelSaved,
}: HunyuanImageUploadSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64Data = base64String.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Validate image dimensions
  const validateImageDimensions = (
    file: File
  ): Promise<{ width: number; height: number; valid: boolean }> => {
    return new Promise((resolve) => {
      // Use HTMLImageElement to avoid conflicts with Next.js Image component
      const img = document.createElement("img");
      img.onload = () => {
        const width = img.width;
        const height = img.height;
        const valid =
          width >= 128 && height >= 128 && width <= 5000 && height <= 5000;

        console.log(
          `Image dimensions: ${width}x${height} - ${valid ? "✓ Valid" : "❌ Invalid"}`
        );

        if (!valid) {
          if (width < 128 || height < 128) {
            toast.error(
              `Image too small: ${width}x${height}. Minimum 128x128 pixels required.`
            );
          } else {
            toast.error(
              `Image too large: ${width}x${height}. Maximum 5000x5000 pixels allowed.`
            );
          }
        }

        resolve({ width, height, valid });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        console.error("Failed to load image for dimension check");
        resolve({ width: 0, height: 0, valid: false });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = useCallback(
    async (file: File, viewType: ViewType) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file.");
        return;
      }

      // Validate image format (JPG/PNG only)
      if (!file.type.match(/^image\/(jpeg|jpg|png)$/i)) {
        toast.error("Only JPG and PNG formats are supported.");
        return;
      }

      console.log(`=== Uploading ${viewType} image ===`);
      console.log("File name:", file.name);
      console.log("File size:", (file.size / 1024).toFixed(2), "KB");
      console.log("File type:", file.type);

      // Warn if file seems too small (likely a thumbnail/placeholder)
      if (file.size < 10 * 1024) {
        console.warn(
          "⚠️ File size is very small (< 10KB). This might be a thumbnail or placeholder image."
        );
      }

      try {
        // Validate dimensions first
        const dimensions = await validateImageDimensions(file);
        if (!dimensions.valid) {
          console.error(
            `❌ Image validation failed: ${dimensions.width}x${dimensions.height} does not meet requirements (128-5000px)`
          );
          return; // Error toast already shown
        }

        console.log(
          `✓ Image dimensions valid: ${dimensions.width}x${dimensions.height}`
        );

        const preview = URL.createObjectURL(file);
        const base64 = await fileToBase64(file);

        console.log(`Base64 length for ${viewType}:`, base64.length);
        console.log(
          `Base64 size: ${((base64.length * 3) / 4 / 1024).toFixed(2)} KB`
        );

        // Validate base64 size (8MB limit after encoding)
        const base64SizeMB = (base64.length * 3) / 4 / 1024 / 1024;
        if (base64SizeMB > 6) {
          toast.error(
            `${viewType} image is too large (${base64SizeMB.toFixed(1)}MB). Please use images under 6MB.`
          );
          return;
        }

        const uploadedImage: UploadedImage = { file, preview, base64 };

        setUploadedImages({
          ...uploadedImages,
          [viewType]: uploadedImage,
        });

        toast.success(
          `${viewType} image uploaded (${dimensions.width}x${dimensions.height})`
        );
      } catch (error) {
        console.error("Error processing image:", error);
        toast.error("Failed to process image");
      }
    },
    [uploadedImages, setUploadedImages, validateImageDimensions]
  );

  const handleFileRemove = useCallback(
    (viewType: ViewType) => {
      setUploadedImages({
        ...uploadedImages,
        [viewType]: null,
      });
    },
    [uploadedImages, setUploadedImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, viewType: ViewType) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0], viewType);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  async function generateModel() {
    // Check if we have at least the front view (required)
    if (!uploadedImages.front) {
      toast.error("Please upload at least the front view image.");
      return;
    }

    // Validate image sizes (Tencent limit: 8MB after base64)
    const validateImageSize = (img: UploadedImage | null, viewName: string) => {
      if (!img) return true;
      const base64Size = img.base64 ? img.base64.length : 0;
      const sizeInMB = (base64Size * 3) / 4 / 1024 / 1024; // Approximate decoded size
      if (sizeInMB > 6) {
        // Use 6MB limit to be safe (8MB after encoding)
        toast.error(
          `${viewName} image is too large (${sizeInMB.toFixed(1)}MB). Please use images under 6MB.`
        );
        return false;
      }
      return true;
    };

    if (!isSingleImageMode) {
      // Validate all images in multi-view mode
      if (!validateImageSize(uploadedImages.front, "Front")) return;
      if (!validateImageSize(uploadedImages.back, "Back")) return;
      if (!validateImageSize(uploadedImages.left, "Left")) return;
      if (!validateImageSize(uploadedImages.right, "Right")) return;
    } else {
      if (!validateImageSize(uploadedImages.front, "Image")) return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(10);

      // Build the request payload
      const payload: any = {
        FaceCount: faceCount,
        EnablePBR: enablePBR,
        GenerateType: generateType,
      };

      if (isSingleImageMode) {
        // Single image mode
        payload.ImageBase64 = uploadedImages.front.base64;
      } else {
        // Multi-view mode - According to Tencent API docs:
        // - Front view goes in ImageBase64 (or ImageUrl)
        // - Additional views (back, left, right) go in MultiViewImages array
        // - MultiViewImages should NOT include the front view

        // Front view is required and goes in ImageBase64
        if (!uploadedImages.front) {
          toast.error("Front view is required for multi-view generation.");
          setIsGenerating(false);
          setGenerationProgress(0);
          return;
        }

        payload.ImageBase64 = uploadedImages.front.base64;

        // Build MultiViewImages array with only additional views (back, left, right)
        // According to Tencent API docs: MultiViewImages.N should only contain:
        // - left view
        // - right view
        // - back view
        // Front view is NOT included here - it goes in ImageBase64 above
        const multiViewImages: any[] = [];

        // Additional views (optional, but at least one is recommended)
        if (uploadedImages.back) {
          multiViewImages.push({
            ViewType: "back",
            ViewImageBase64: uploadedImages.back.base64,
          });
        }

        if (uploadedImages.left) {
          multiViewImages.push({
            ViewType: "left",
            ViewImageBase64: uploadedImages.left.base64,
          });
        }

        if (uploadedImages.right) {
          multiViewImages.push({
            ViewType: "right",
            ViewImageBase64: uploadedImages.right.base64,
          });
        }

        // Check for duplicate images (same base64)
        const base64Hashes = new Set<string>();
        base64Hashes.add(uploadedImages.front?.base64 || ""); // Include front in duplicate check

        for (const img of multiViewImages) {
          if (base64Hashes.has(img.ViewImageBase64)) {
            console.warn(
              `⚠️ Duplicate image detected for view: ${img.ViewType}`
            );
            toast.warning(
              `Warning: ${img.ViewType} view appears to be a duplicate. Please use different images.`
            );
          }
          base64Hashes.add(img.ViewImageBase64);
        }

        // Validate base64 format (should be pure base64, no data URL prefix)
        if (
          uploadedImages.front?.base64?.includes(",") ||
          uploadedImages.front?.base64?.includes("data:")
        ) {
          console.error(
            "❌ Invalid base64 format for front: contains data URL prefix"
          );
          toast.error("Invalid image format for front view. Please re-upload.");
          setIsGenerating(false);
          setGenerationProgress(0);
          return;
        }

        for (const img of multiViewImages) {
          if (
            img.ViewImageBase64.includes(",") ||
            img.ViewImageBase64.includes("data:")
          ) {
            console.error(
              `❌ Invalid base64 format for ${img.ViewType}: contains data URL prefix`
            );
            toast.error(
              `Invalid image format for ${img.ViewType}. Please re-upload.`
            );
            setIsGenerating(false);
            setGenerationProgress(0);
            return;
          }
        }

        // Only add MultiViewImages if we have additional views
        if (multiViewImages.length > 0) {
          console.log(
            `✓ Multi-view array prepared: ${multiViewImages.length} additional views`
          );
          console.log(
            "Additional view types:",
            multiViewImages.map((img) => img.ViewType).join(", ")
          );
          payload.MultiViewImages = multiViewImages;
        } else {
          console.log(
            "⚠️ Multi-view mode but no additional views provided. Using front view only."
          );
        }
      }

      setGenerationProgress(20);

      console.log("=== GENERATION DEBUG INFO ===");
      console.log("Mode:", isSingleImageMode ? "Single Image" : "Multi-View");
      console.log("Payload structure:", {
        hasImageBase64: !!payload.ImageBase64,
        hasMultiViewImages: !!payload.MultiViewImages,
        multiViewCount: payload.MultiViewImages?.length || 0,
        faceCount: payload.FaceCount,
        enablePBR: payload.EnablePBR,
        generateType: payload.GenerateType,
      });

      // Debug multi-view details
      if (payload.MultiViewImages) {
        console.log("Multi-view images details:");
        payload.MultiViewImages.forEach((img: any, index: number) => {
          const base64Size = img.ViewImageBase64?.length || 0;
          const sizeInMB = ((base64Size * 3) / 4 / 1024 / 1024).toFixed(2);
          console.log(`  ${index + 1}. ${img.ViewType}:`, {
            hasBase64: !!img.ViewImageBase64,
            base64Length: base64Size,
            sizeInMB: `${sizeInMB} MB`,
            startsWithValidPrefix:
              img.ViewImageBase64?.startsWith("iVBORw") ||
              img.ViewImageBase64?.startsWith("/9j/") ||
              img.ViewImageBase64?.startsWith("data:"),
          });
        });
      }

      // Check for potential issues
      const potentialIssues = [];

      // In multi-view mode, both ImageBase64 (front) and MultiViewImages (additional views) should be set
      // In single-image mode, only ImageBase64 should be set
      if (isSingleImageMode && payload.MultiViewImages) {
        potentialIssues.push(
          "⚠️ MultiViewImages should not be set in single-image mode"
        );
      }

      if (!isSingleImageMode && !payload.ImageBase64) {
        potentialIssues.push(
          "⚠️ ImageBase64 (front view) is required in multi-view mode"
        );
      }

      if (payload.MultiViewImages) {
        payload.MultiViewImages.forEach((img: any) => {
          const base64Size = img.ViewImageBase64?.length || 0;
          const sizeInMB = (base64Size * 3) / 4 / 1024 / 1024;
          if (sizeInMB > 8) {
            potentialIssues.push(
              `⚠️ ${img.ViewType} image is ${sizeInMB.toFixed(1)}MB (exceeds 8MB limit)`
            );
          }
          if (!img.ViewImageBase64) {
            potentialIssues.push(
              `⚠️ ${img.ViewType} is missing ViewImageBase64`
            );
          }
        });
      }

      if (potentialIssues.length > 0) {
        console.warn("Potential issues detected:");
        potentialIssues.forEach((issue) => console.warn(issue));
      } else {
        console.log("✓ No obvious issues detected in payload");
      }

      console.log("Submitting to Hunyuan API...");

      // Submit the job
      const submitResponse = await fetch("/api/hunyuan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();

        // Show helpful message for service activation error
        if (
          error.code === "SERVICE_NOT_ACTIVATED" ||
          error.error?.includes("not activated")
        ) {
          toast.error(
            "Hunyuan 3D service not activated. Please activate it in Tencent Cloud Console first.",
            { duration: 10000 }
          );
          throw new Error(
            "Service not activated. See SERVICE_SETUP_GUIDE.md for instructions."
          );
        }

        throw new Error(error.error || error.details || "Failed to submit job");
      }

      const submitResult = await submitResponse.json();
      console.log(
        "Submit API response:",
        JSON.stringify(submitResult, null, 2)
      );

      const jobId = submitResult.Response?.JobId;

      if (!jobId) {
        console.error("Full API response:", submitResult);
        throw new Error(
          `No JobId received from API. Response: ${JSON.stringify(submitResult)}`
        );
      }

      console.log("Job submitted successfully. JobId:", jobId);
      toast.success("Job submitted! Waiting for processing...");
      setGenerationProgress(30);

      // Poll for results
      let attempts = 0;
      const maxAttempts = 300; // 10 minutes with 2-second intervals (increased for first tests)
      const pollInterval = 2000;

      const poll = async (): Promise<void> => {
        attempts++;
        const progress = 30 + Math.min((attempts / maxAttempts) * 60, 60);
        setGenerationProgress(progress);

        try {
          const queryResponse = await fetch("/api/hunyuan/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ JobId: jobId }),
          });

          if (!queryResponse.ok) {
            const errorData = await queryResponse.json();
            console.error("Query API error:", errorData);
            throw new Error(errorData.error || "Failed to query job status");
          }

          const queryResult = await queryResponse.json();
          const status = queryResult.Response?.Status;

          console.log(
            `Poll attempt ${attempts}/${maxAttempts}: Status = ${status} (${Math.round(progress)}%)`
          );

          if (status === "DONE") {
            // Success!
            const resultFiles = queryResult.Response?.ResultFile3Ds;
            if (resultFiles && resultFiles.length > 0) {
              const glbFile = resultFiles.find((f: any) => f.Type === "GLB");
              if (glbFile) {
                console.log("✓ Generation complete! Model URL:", glbFile.Url);
                await downloadAndDisplayModel(glbFile.Url);
                setGenerationProgress(100);
                toast.success("3D model generated successfully!");
                setIsGenerating(false);
                return;
              } else {
                throw new Error("No GLB file found in results");
              }
            } else {
              throw new Error("No result files returned");
            }
          } else if (status === "FAIL") {
            const errorCode = queryResult.Response?.ErrorCode || "Unknown";
            const errorMsg =
              queryResult.Response?.ErrorMessage || "Generation failed";
            console.error(`Job failed: [${errorCode}] ${errorMsg}`);
            console.error(
              "Full error response:",
              JSON.stringify(queryResult, null, 2)
            );
            setIsGenerating(false);
            setGenerationProgress(0);

            // Handle specific error codes with user-friendly messages
            if (errorCode === "FailedOperation.ModerationFailed") {
              console.warn(
                "⚠️ Content moderation failed. This could be due to:",
                "\n- Images containing text, logos, or watermarks",
                "\n- Images with patterns that trigger false positives",
                "\n- Inappropriate content (if applicable)",
                "\n\nTry:",
                "\n- Using only the front view first to isolate the issue",
                "\n- Different images without text or complex patterns",
                "\n- Ensuring images are clear product photos"
              );
              toast.error(
                "Content moderation failed. Try using only the front view first, or use different images without text/watermarks.",
                { duration: 10000 }
              );
              // Return early instead of throwing to prevent unhandled rejection
              return;
            }

            if (errorCode === "FailedOperation.InnerError") {
              console.warn(
                "⚠️ Tencent API internal server error. This is usually temporary.",
                "\n\nSuggestions:",
                "\n- Wait a few minutes and try again",
                "\n- Try with fewer images (e.g., just front view)",
                "\n- Check if Tencent Cloud service status is normal",
                "\n- The request might be too large - try reducing image sizes"
              );
              toast.error(
                "Tencent API internal error. Please wait a moment and try again. If it persists, try with fewer images or smaller file sizes.",
                { duration: 10000 }
              );
              // Return early instead of throwing to prevent unhandled rejection
              return;
            }

            toast.error(`Generation failed: ${errorMsg} (Code: ${errorCode})`, {
              duration: 8000,
            });
            // Return early instead of throwing to prevent unhandled rejection
            return;
          } else if (status === "WAIT" || status === "RUN") {
            // Continue polling
            if (attempts < maxAttempts) {
              setTimeout(poll, pollInterval);
            } else {
              setIsGenerating(false);
              setGenerationProgress(0);
              toast.error(
                `Job timed out after ${maxAttempts * 2} seconds. The model may still be processing - check Tencent console.`,
                { duration: 8000 }
              );
              // Return early instead of throwing
              return;
            }
          } else {
            console.error("Unknown status received:", queryResult);
            setIsGenerating(false);
            setGenerationProgress(0);
            toast.error(`Unknown status: ${status}`, { duration: 8000 });
            // Return early instead of throwing
            return;
          }
        } catch (error: any) {
          console.error("Poll error:", error);
          setIsGenerating(false);
          // Don't show duplicate toast if we already showed one for moderation
          if (!error.message?.includes("Content moderation failed")) {
            toast.error(error.message || "Polling failed");
          }
          // Don't re-throw to prevent unhandled promise rejection
          // The error is already logged and user is notified
          return;
        }
      };

      // Start polling - wrap in try-catch to handle any unhandled errors
      try {
        await poll();
      } catch (error: any) {
        // This should not happen, but catch it just in case
        console.error("Unexpected error in poll:", error);
        setIsGenerating(false);
        setGenerationProgress(0);
        if (!error.message?.includes("Content moderation failed")) {
          toast.error(error.message || "Unexpected error during polling");
        }
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      toast.error(`Generation failed: ${error.message}`);
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }

  async function downloadAndDisplayModel(fileUrl: string) {
    try {
      console.log("Downloading model from:", fileUrl);

      // Store the Tencent URL for later saving
      setTencentModelUrl(fileUrl);

      // Use proxy endpoint to bypass CORS restrictions
      const proxyUrl = `/api/hunyuan/download?url=${encodeURIComponent(fileUrl)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to download model: ${response.status}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
      const modelUrl = URL.createObjectURL(blob);

      console.log("✓ Model loaded successfully!");
      setGeneratedModel(modelUrl);

      // Auto-save to gallery (for testing stage)
      await autoSaveToGallery(fileUrl);
    } catch (error: any) {
      console.error("Failed to download/display model:", error);
      toast.error(`Failed to load model: ${error.message}`);
      throw error;
    }
  }

  async function autoSaveToGallery(tencentUrl: string) {
    try {
      console.log("Auto-saving model to gallery...");

      const response = await fetch("/api/generated-models/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tencentUrl: tencentUrl,
          modelName: `Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          settings: {
            faceCount,
            enablePBR,
            generateType,
            imageMode: isSingleImageMode ? "single" : "multi-view",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save model");
      }

      const result = await response.json();
      console.log("✓ Model auto-saved to gallery:", result.model.id);
      toast.success("Model automatically saved to gallery!");
    } catch (error: any) {
      console.error("Failed to auto-save model:", error);
      toast.error(`Auto-save failed: ${error.message}`);
      // Don't throw - we still want to show the model even if save fails
    }
  }

  async function saveModelToGallery() {
    if (!tencentModelUrl) {
      toast.error("No model to save");
      return;
    }

    setIsSaving(true);
    try {
      console.log("Saving model to gallery...");

      const response = await fetch("/api/generated-models/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tencentUrl: tencentModelUrl,
          modelName: `Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          settings: {
            faceCount,
            enablePBR,
            generateType,
            imageMode: isSingleImageMode ? "single" : "multi-view",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save model");
      }

      const result = await response.json();
      console.log("✓ Model saved to gallery:", result.model.id);
      toast.success("Model saved to gallery!");

      // Call callback to switch to gallery tab
      if (onModelSaved) {
        onModelSaved();
      }
    } catch (error: any) {
      console.error("Failed to save model:", error);
      toast.error(`Failed to save model: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  const canGenerate = uploadedImages.front !== null;

  return (
    <div className="space-y-6">
      {/* Upload Images */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload className="h-4 w-4" />
          Upload Images
        </div>
        <p className="text-xs text-muted-foreground">
          {isSingleImageMode
            ? "Upload a single image to generate a 3D model"
            : "Upload front view (required). Add back, left, or right views (optional) for better quality"}
        </p>

        {isSingleImageMode ? (
          /* Single Image Upload */
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Star className="h-3 w-3 text-orange-500" />
              Single Image
            </div>

            {!uploadedImages.front ? (
              <div
                className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-muted-foreground hover:bg-accent transition-colors min-h-[120px] flex flex-col items-center justify-center"
                onDrop={(e) => handleDrop(e, "front")}
                onDragOver={handleDragOver}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileSelect(file, "front");
                  };
                  input.click();
                }}
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-foreground font-medium">
                  Click or drag image here
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, WebP
                </p>
              </div>
            ) : (
              <div className="relative">
                <Image
                  width={120}
                  height={250}
                  src={uploadedImages.front.preview}
                  alt="Single image"
                  className="w-full h-[350px] object-cover rounded-md"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                  onClick={() => handleFileRemove("front")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Multi-view Upload - Front view as primary, others as additional */
          <div className="space-y-4">
            {/* Primary Front View */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                <Star className="h-3 w-3 text-orange-500" />
                Front View (Required)
              </div>
              {!uploadedImages.front ? (
                <div
                  className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-muted-foreground hover:bg-accent transition-colors min-h-[120px] flex flex-col items-center justify-center"
                  onDrop={(e) => handleDrop(e, "front")}
                  onDragOver={handleDragOver}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileSelect(file, "front");
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-foreground font-medium">
                    Click or drag front view image here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports JPG, PNG (128-5000px, max 6MB)
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <Image
                    width={200}
                    height={200}
                    src={uploadedImages.front.preview}
                    alt="Front view"
                    className="w-full h-[200px] object-cover rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0"
                    onClick={() => handleFileRemove("front")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Views (Optional) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Additional Views (Optional)
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Add back, left, or right views for better quality 3D generation
              </p>
              <div className="grid grid-cols-3 gap-3">
                {viewConfigs
                  .filter((config) => config.type !== "front")
                  .map((config) => {
                    const uploadedImage = uploadedImages[config.type];
                    return (
                      <div key={config.type} className="space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          {config.label}
                        </div>

                        {!uploadedImage ? (
                          <div
                            className="border-2 border-dashed border-border rounded-md p-3 text-center cursor-pointer hover:border-muted-foreground hover:bg-accent transition-colors min-h-[80px] flex flex-col items-center justify-center"
                            onDrop={(e) => handleDrop(e, config.type)}
                            onDragOver={handleDragOver}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement)
                                  .files?.[0];
                                if (file) handleFileSelect(file, config.type);
                              };
                              input.click();
                            }}
                          >
                            <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                            <p className="text-xs text-muted-foreground">
                              Optional
                            </p>
                          </div>
                        ) : (
                          <div className="relative">
                            <Image
                              width={80}
                              height={80}
                              src={uploadedImage.preview}
                              alt={`${config.type} view`}
                              className="w-full h-[80px] object-cover rounded-md"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-5 w-5 p-0"
                              onClick={() => handleFileRemove(config.type)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Button
          disabled={!canGenerate || isGenerating}
          onClick={generateModel}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Generate 3D Model"}
        </Button>

        {tencentModelUrl && (
          <Button
            disabled={isSaving}
            onClick={saveModelToGallery}
            variant="outline"
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save to Gallery"}
          </Button>
        )}
      </div>
    </div>
  );
}
