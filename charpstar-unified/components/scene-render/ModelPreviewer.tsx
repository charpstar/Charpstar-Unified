import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/utilities/command";
import {
  Check,
  ChevronsUpDown,
  Tag,
  CheckCircle,
  Palette,
  Ruler,
  FileImage,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import sceneLibraryData from "@/lib/sceneLibrary.json";

// Add type declaration for model-viewer element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-expect-error -- model-viewer is a custom element
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src: string;
          alt: string;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "environment-image"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "shadow-softness"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
          "camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "touch-action"?: string;
          onLoad?: () => void;
          onError?: (event: CustomEvent) => void;
        },
        HTMLElement
      >;
    }
  }
}

// Transform scene library data into the expected format
const scenePresets = sceneLibraryData.map((scene: any) => ({
  category: scene.category,
  label: scene.name,
  prompt: scene.description,
  thumbnailUrl: scene.imageUrl,
  id: scene.id,
}));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });

interface ModelPreviewerProps {
  file: File | null;
  modelUrl: string | null;
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null,
    imageFormat: string,
    customWidth?: string,
    customHeight?: string
  ) => void;
  onCancel: () => void;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
  captureMode?: boolean; // If true, shows simplified UI for just capturing
  captureButtonText?: string;
  onCaptureAsset?: (
    snapshot: string,
    dimensions: { x: number; y: number; z: number } | null
  ) => void;
  // Image format props
  imageFormat?: string;
  customWidth?: string;
  customHeight?: string;
  onImageFormatChange?: (format: string) => void;
  onCustomDimensionsChange?: (width: string, height: string) => void;
}

const ModelPreviewer: React.FC<ModelPreviewerProps> = ({
  file,
  modelUrl,
  onGenerate,
  onCancel,
  environmentImage = "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
  exposure = "1.2",
  toneMapping = "aces",
  captureMode = false,
  captureButtonText = "Generate Scene",
  onCaptureAsset,
  imageFormat: propImageFormat,
  customWidth: propCustomWidth,
  customHeight: propCustomHeight,
  onImageFormatChange,
  onCustomDimensionsChange,
}) => {
  const modelViewerRef = useRef<HTMLElement>(null);
  const [objectSize, setObjectSize] = useState("");
  const [objectType, setObjectType] = useState("");
  const [modelDimensions, setModelDimensions] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [sceneDescription, setSceneDescription] = useState(
    scenePresets[0].prompt
  );
  const [isCustomScene, setIsCustomScene] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );
  const [imageFormat, setImageFormat] = useState(propImageFormat || "square");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [customWidth, setCustomWidth] = useState(propCustomWidth || "1080");
  const [customHeight, setCustomHeight] = useState(propCustomHeight || "1080");

  // Sync with props
  useEffect(() => {
    if (propImageFormat) {
      setImageFormat(propImageFormat);
    }
  }, [propImageFormat]);

  useEffect(() => {
    if (propCustomWidth) {
      setCustomWidth(propCustomWidth);
    }
  }, [propCustomWidth]);

  useEffect(() => {
    if (propCustomHeight) {
      setCustomHeight(propCustomHeight);
    }
  }, [propCustomHeight]);

  // Image format options for social media
  const formatOptions = [
    {
      value: "square",
      label: "Square (1:1)",
      description: "Instagram Feed, Facebook Posts",
      dimensions: "1080x1080",
      icon: "⬜",
    },
    {
      value: "instagram_story",
      label: "Instagram Story (9:16)",
      description: "Instagram Stories, TikTok",
      dimensions: "1080x1920",
      icon: "📱",
    },
    {
      value: "instagram_reel",
      label: "Instagram Reel (9:16)",
      description: "Instagram Reels, YouTube Shorts",
      dimensions: "1080x1920",
      icon: "🎬",
    },
    {
      value: "custom",
      label: "Custom Size",
      description: "Specify your own dimensions",
      dimensions:
        imageFormat === "custom" ? `${customWidth}x${customHeight}` : "Custom",
      icon: "⚙️",
    },
  ];
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [captureProgress, setCaptureProgress] = useState({
    current: 0,
    total: 3,
  });
  const [currentAngle, setCurrentAngle] = useState<string | null>(null);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isTestingAngles, setIsTestingAngles] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [testAngleIndex, setTestAngleIndex] = useState(0);

  // Simplified file URL handling - create once, cleanup on change
  useEffect(() => {
    if (!file && !modelUrl) {
      setFileUrl(null);
      return;
    }

    setIsModelLoading(true);
    const url = modelUrl || URL.createObjectURL(file!);
    setFileUrl(url);
    setModelError(null);

    return () => {
      // Only revoke if it's a blob URL we created
      if (!modelUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, modelUrl]);

  // Cleanup inspiration image URL on unmount
  useEffect(() => {
    return () => {
      if (inspirationImageUrl) {
        URL.revokeObjectURL(inspirationImageUrl);
      }
    };
  }, [inspirationImageUrl]);

  // Handle model-viewer load event to get dimensions
  useEffect(() => {
    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer || !fileUrl) return;

    const handleLoad = () => {
      try {
        // Wait a bit for the model to fully load and render
        setTimeout(() => {
          try {
            // Get model dimensions using the official getDimensions() method
            let dimensions = null;

            if (typeof modelViewer.getDimensions === "function") {
              try {
                const modelDimensions = modelViewer.getDimensions();
                if (
                  modelDimensions &&
                  modelDimensions.x &&
                  modelDimensions.y &&
                  modelDimensions.z
                ) {
                  dimensions = {
                    x: modelDimensions.x,
                    y: modelDimensions.y,
                    z: modelDimensions.z,
                  };
                }
              } catch (error) {
                console.error("Failed to get model dimensions:", error);
              }
            }

            if (
              dimensions &&
              dimensions.x > 0 &&
              dimensions.y > 0 &&
              dimensions.z > 0
            ) {
              setModelDimensions(dimensions);
              const sizeString = `Width: ${dimensions.x.toFixed(2)}m, Height: ${dimensions.y.toFixed(2)}m, Depth: ${dimensions.z.toFixed(2)}m.`;
              setObjectSize(sizeString);
            } else {
              console.warn("Could not determine model dimensions");
              setModelDimensions({ x: 1, y: 1, z: 1 }); // Fallback dimensions
              setObjectSize(
                "Model dimensions could not be determined. Using default scale."
              );
            }
          } catch (error) {
            console.error("Error calculating model dimensions:", error);
            setModelDimensions({ x: 1, y: 1, z: 1 }); // Fallback dimensions
            setObjectSize(
              "Model dimensions could not be determined. Using default scale."
            );
          }
        }, 1500); // Wait 1.5 seconds for model to fully load
      } catch (error) {
        console.error("Error in model load handler:", error);
        setModelDimensions({ x: 1, y: 1, z: 1 }); // Fallback dimensions
        setObjectSize(
          "Model dimensions could not be determined. Using default scale."
        );
      }
      setIsModelLoading(false);
    };

    const handleError = (event: CustomEvent) => {
      console.error("Model loading error:", event.detail);
      setModelError("Failed to load 3D model. Please try a different file.");
      setIsModelLoading(false);
    };

    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    return () => {
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [fileUrl]);

  const handleCapture = async () => {
    // In capture mode, skip validation - just capture the model
    if (!captureMode && !objectType.trim()) return;

    const modelViewer = modelViewerRef.current as any;
    if (modelViewer) {
      setIsCapturing(true);
      setCaptureProgress({ current: 1, total: 1 });

      // Short delay to allow any UI updates to render before taking snapshot
      await new Promise((resolve) => setTimeout(resolve, 50));

      const finalObjectSize =
        objectSize || "The object's scale is unknown. Use common sense.";

      // Preserve current camera position instead of forcing zoom

      try {
        setCurrentAngle("Current View");

        // Keep current camera position - no need to change it
        // Just wait a moment to ensure the model is ready for capture
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Capture single high-quality screenshot
        const snapshotDataUrl = await modelViewer.toDataURL();
        const snapshotBase64 = snapshotDataUrl.split(",")[1];

        let inspirationBase64: string | null = null;
        if (inspirationImage) {
          inspirationBase64 = await fileToBase64(inspirationImage);
        }

        // In capture mode, use onCaptureAsset callback with dimensions
        if (captureMode && onCaptureAsset) {
          onCaptureAsset(snapshotBase64, modelDimensions);
        } else {
          // Pass single snapshot in array for API compatibility
          onGenerate(
            [snapshotBase64],
            finalObjectSize,
            objectType || "Product",
            sceneDescription,
            inspirationBase64,
            imageFormat,
            customWidth,
            customHeight
          );
        }
      } finally {
        setIsCapturing(false);
        setCaptureProgress({ current: 0, total: 1 });
        setCurrentAngle(null);
      }
    }
  };

  const handleInspirationImageChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setInspirationImage(file);
      setInspirationImageUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveInspirationImage = () => {
    if (inspirationImageUrl) {
      URL.revokeObjectURL(inspirationImageUrl);
    }
    setInspirationImage(null);
    setInspirationImageUrl(null);
  };

  // Don't render if fileUrl is empty
  if (!fileUrl) {
    return (
      <div className="w-full flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
        <div className="text-center p-8">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            File Error
          </div>
          <div className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            Unable to create file URL. Please try uploading the file again.
          </div>
          <Button onClick={onCancel} variant="default">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Wait for both file URL and custom element to be ready
  if (
    !fileUrl ||
    (typeof window !== "undefined" &&
      !window.customElements?.get("model-viewer"))
  ) {
    return (
      <div className="w-full h-full flex items-center justify-center p-2">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            Preparing 3D viewer...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with Compact Config */}
      <div className="flex items-center justify-between p-2 sm:p-3 border-b bg-background/80 backdrop-blur-sm gap-2">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">🎯</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">3D Model Preview</h3>
            <p className="text-xs text-muted-foreground">
              {captureMode ? "Capture Asset" : "Configure Scene"}
            </p>
          </div>
        </div>

        {/* Compact Configuration Status - Icons Only */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Product Type Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${
                  objectType
                    ? "bg-green-100 border-green-300 text-green-600"
                    : "bg-gray-100 border-gray-300 text-gray-400"
                }`}
              >
                {objectType ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Tag className="w-3 h-3" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-semibold">
                  Product Type <span className="text-red-500">*</span>
                </p>
                <p className="text-sm">
                  {objectType ? objectType : "Not set (Required)"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Scene Style Status */}
          {!captureMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${
                    sceneDescription
                      ? "bg-green-100 border-green-300 text-green-600"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  }`}
                >
                  {sceneDescription ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <Palette className="w-3 h-3" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-semibold">Scene Style</p>
                  <p className="text-sm">
                    {sceneDescription
                      ? isCustomScene
                        ? "Custom Scene"
                        : scenePresets.find(
                            (p) => p.prompt === sceneDescription
                          )?.label || "Custom"
                      : "Not set"}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Image Format Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full flex items-center justify-center border text-xs bg-green-100 border-green-300 text-green-600">
                <CheckCircle className="w-3 h-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-semibold">Image Format</p>
                <p className="text-sm">
                  {formatOptions.find((f) => f.value === imageFormat)?.label}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Dimensions Status */}
          {!captureMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs hidden md:flex ${
                    modelDimensions
                      ? "bg-green-100 border-green-300 text-green-600"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  }`}
                >
                  {modelDimensions ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <Ruler className="w-3 h-3" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-semibold">Model Dimensions</p>
                  <p className="text-sm">
                    {modelDimensions
                      ? `${modelDimensions.x.toFixed(1)}×${modelDimensions.y.toFixed(1)}×${modelDimensions.z.toFixed(1)}m`
                      : "Loading..."}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Inspiration Image Status */}
          {!captureMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs hidden lg:flex ${
                    inspirationImageUrl
                      ? "bg-green-100 border-green-300 text-green-600"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  }`}
                >
                  {inspirationImageUrl ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <FileImage className="w-3 h-3" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-semibold">Inspiration Image</p>
                  <p className="text-sm">
                    {inspirationImageUrl
                      ? inspirationImage?.name || "Image uploaded"
                      : "Not set"}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Action Buttons - Responsive */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            onClick={() => setShowConfigDialog(true)}
            variant="default"
            size="lg"
            className="text-xs px-2 py-1 h-6 lg:h-11 lg:px-8"
          >
            <span className="hidden sm:inline">Configure Scene</span>
            <span className="sm:hidden">⚙️</span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={handleCapture}
                  variant="default"
                  size="lg"
                  className="text-xs px-2 py-1 h-6 lg:h-11 lg:px-8"
                  disabled={
                    (!objectType.trim() && !captureMode) ||
                    isCapturing ||
                    isTestingAngles
                  }
                >
                  <span className="hidden sm:inline">
                    {isCapturing ? "..." : captureButtonText}
                  </span>
                  <span className="sm:hidden">
                    {isCapturing ? "..." : "▶"}
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                {isCapturing || isTestingAngles ? (
                  <p className="text-sm">
                    {isTestingAngles
                      ? "Rendering preview..."
                      : "Rendering scene..."}
                  </p>
                ) : !objectType.trim() && !captureMode ? (
                  <div>
                    <p className="font-semibold text-sm">
                      Missing Configuration
                    </p>
                    <p className="text-xs">
                      Please set a product type to generate scene
                    </p>
                  </div>
                ) : (
                  <p className="text-sm">Ready to generate scene</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          <Button
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="text-xs px-2 py-1 h-6 lg:h-11 lg:px-8"
          >
            <span className="hidden sm:inline">Cancel</span>
            <span className="sm:hidden">✕</span>
          </Button>
        </div>
      </div>

      {/* 3D Viewer - Full Space */}
      <div className="flex-1 p-4 min-h-0">
        <div className="w-full h-full rounded-lg overflow-hidden  relative cursor-grab active:cursor-grabbing">
          {/* Capture Progress Overlay */}
          {(isCapturing || isTestingAngles) && (
            <div className="absolute top-4 left-4 right-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">
                  {isTestingAngles
                    ? "Rendering preview..."
                    : "Rendering image..."}
                </span>
              </div>
              {currentAngle && (
                <div className="text-center text-sm font-medium text-blue-400 mt-2">
                  {currentAngle}
                </div>
              )}
            </div>
          )}
          {/* Loading overlay */}
          {isModelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-white">Loading 3D model...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {modelError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
              <div className="text-center p-6">
                <div className="text-red-400 text-lg font-semibold mb-2">
                  Model Loading Error
                </div>
                <div className="text-gray-300 text-sm mb-4">{modelError}</div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setModelError(null);
                    // The model will retry automatically when fileUrl changes
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Persistent model-viewer element - never unmounted */}
          {/* @ts-expect-error -- model-viewer is a custom element */}
          <model-viewer
            key="viewer"
            ref={modelViewerRef}
            src={fileUrl || ""}
            alt="3D Model Preview"
            camera-controls
            shadow-intensity="0.5"
            environment-image={environmentImage}
            exposure={exposure}
            tone-mapping={toneMapping}
            shadow-softness="1"
            min-field-of-view="5deg"
            max-field-of-view="35deg"
            camera-orbit="0deg 75deg 2.5m"
            max-camera-orbit="auto 100deg auto"
            touch-action="pan-y"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#fafafa",
            }}
          />
        </div>
      </div>

      {/* Configuration Dialog */}
      {showConfigDialog && (
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Configure Scene
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Configuration Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dimensions Card */}
                {!captureMode && (
                  <Card className="p-6 hover:shadow-lg transition-all duration-200 border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-lg">
                          📏
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          Model Dimensions
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Automatically calculated from your 3D model
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg text-center">
                      {isModelLoading ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-muted-foreground">
                            Loading dimensions...
                          </span>
                        </div>
                      ) : modelDimensions ? (
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-primary">
                            {modelDimensions.x.toFixed(2)}m ×{" "}
                            {modelDimensions.y.toFixed(2)}m ×{" "}
                            {modelDimensions.z.toFixed(2)}m
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Width × Height × Depth
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Calculating dimensions...
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Product Type Card */}
                <Card className="p-6 hover:shadow-lg transition-all duration-200 border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">🏷️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Product Type</h3>
                      <p className="text-sm text-muted-foreground">
                        {captureMode
                          ? "Optional - helps with scene generation"
                          : "Required - describes your product"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={objectType}
                      onChange={(e) => setObjectType(e.target.value)}
                      placeholder="e.g., Furniture, Electronics, Clothing, Jewelry..."
                      className="w-full px-4 py-3 text-sm border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Furniture",
                        "Electronics",
                        "Clothing",
                        "Jewelry",
                        "Home Decor",
                        "Beauty",
                      ].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setObjectType(preset)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                            objectType === preset
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Scene Style Card - hide in capture mode */}
                {!captureMode && (
                  <Card className="p-6 hover:shadow-lg transition-all duration-200 border-primary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-lg">
                          🎨
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Scene Style</h3>
                        <p className="text-sm text-muted-foreground">
                          Choose the environment for your product
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Dialog
                        open={sceneDialogOpen}
                        onOpenChange={setSceneDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <button className="w-full px-4 py-3 text-sm bg-background border border-input rounded-lg text-left flex items-center justify-between hover:bg-muted/50 transition-all">
                            <span className="truncate">
                              {!isCustomScene &&
                              scenePresets.find(
                                (p) => p.prompt === sceneDescription
                              )
                                ? scenePresets.find(
                                    (p) => p.prompt === sceneDescription
                                  )?.label
                                : "Browse Scene Presets"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="min-w-6xl w-[95vw] h-[90vh] p-0">
                          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                            <DialogTitle className="text-xl font-semibold">
                              Choose Scene Style
                            </DialogTitle>
                          </DialogHeader>
                          <div className="flex-1 overflow-hidden">
                            <Command className="h-full">
                              <div className="px-6 py-4 border-b">
                                <CommandInput
                                  placeholder="Search scenes..."
                                  className="text-base"
                                />
                              </div>
                              <CommandList className="h-full overflow-y-auto">
                                <CommandEmpty className="py-8 text-center text-muted-foreground">
                                  No scene found. Try a different search term.
                                </CommandEmpty>
                                <div className="p-6">
                                  {/* Custom Scene Option */}
                                  <CommandGroup
                                    heading="Custom Scene"
                                    className="mb-8"
                                  >
                                    <div className="grid grid-cols-1 gap-4 mt-4">
                                      <CommandItem
                                        value="custom-scene"
                                        onSelect={() => {
                                          setIsCustomScene(true);
                                          setSceneDescription("");
                                          setSceneDialogOpen(false);
                                        }}
                                        className="flex flex-row items-center gap-6 p-6 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                                      >
                                        <Check
                                          className={`h-6 w-6 flex-shrink-0 ${
                                            isCustomScene
                                              ? "opacity-100 text-primary"
                                              : "opacity-0 group-hover:opacity-50"
                                          }`}
                                        />
                                        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                          <span className="text-3xl">✏️</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-bold text-xl mb-2 text-primary">
                                            Create Custom Scene
                                          </div>
                                          <div className="text-base text-muted-foreground leading-relaxed">
                                            Write your own scene description for
                                            a completely custom environment.
                                            Perfect for unique or specific
                                            requirements that aren&apos;t
                                            covered by our preset scenes.
                                          </div>
                                        </div>
                                      </CommandItem>
                                    </div>
                                  </CommandGroup>

                                  {Object.entries(
                                    scenePresets.reduce(
                                      (acc, preset) => {
                                        if (!acc[preset.category]) {
                                          acc[preset.category] = [];
                                        }
                                        acc[preset.category].push(preset);
                                        return acc;
                                      },
                                      {} as Record<string, typeof scenePresets>
                                    )
                                  ).map(([category, presets]) => (
                                    <CommandGroup
                                      key={category}
                                      heading={category}
                                      className="mb-8"
                                    >
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                        {presets.map((preset) => (
                                          <CommandItem
                                            key={preset.id}
                                            value={preset.label}
                                            onSelect={() => {
                                              setIsCustomScene(false);
                                              setSceneDescription(
                                                preset.prompt
                                              );
                                              setSceneDialogOpen(false);
                                            }}
                                            className="flex flex-col gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-all cursor-pointer group"
                                          >
                                            <div className="flex items-start gap-3">
                                              <Check
                                                className={`h-5 w-5 mt-1 flex-shrink-0 ${
                                                  !isCustomScene &&
                                                  sceneDescription ===
                                                    preset.prompt
                                                    ? "opacity-100 text-primary"
                                                    : "opacity-0 group-hover:opacity-50"
                                                }`}
                                              />
                                              {preset.thumbnailUrl ? (
                                                <Image
                                                  src={preset.thumbnailUrl}
                                                  alt={preset.label}
                                                  width={64}
                                                  height={64}
                                                  className="w-16 h-16 object-cover rounded-lg border shadow-sm flex-shrink-0"
                                                  unoptimized
                                                />
                                              ) : (
                                                <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                                  <span className="text-2xl">
                                                    🎨
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-semibold text-base mb-2">
                                                {preset.label}
                                              </div>
                                              <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                                {preset.prompt}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </div>
                                    </CommandGroup>
                                  ))}
                                </div>
                              </CommandList>
                            </Command>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {isCustomScene && (
                        <textarea
                          value={sceneDescription}
                          onChange={(e) => setSceneDescription(e.target.value)}
                          placeholder="Describe your custom scene... (e.g., modern minimalist studio with soft lighting)"
                          className="w-full px-4 py-3 text-sm border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                          rows={3}
                        />
                      )}
                    </div>
                  </Card>
                )}

                {/* Image Format Card */}
                <Card className="p-6 hover:shadow-lg transition-all duration-200 border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">📐</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Image Format</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose the best format for your use case
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formatOptions.map((format) => (
                      <button
                        key={format.value}
                        onClick={() => {
                          setImageFormat(format.value);
                          onImageFormatChange?.(format.value);
                        }}
                        className={`p-2 rounded-md border text-left transition-all duration-200 ${
                          imageFormat === format.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-input hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{format.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate">
                              {format.label}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {format.dimensions}
                            </div>
                          </div>
                          {imageFormat === format.value && (
                            <Check className="h-3 w-3 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Size Inputs */}
                  {imageFormat === "custom" && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-foreground">
                          Custom Dimensions
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Width (px)
                            </label>
                            <Input
                              type="number"
                              value={customWidth}
                              onChange={(e) => {
                                setCustomWidth(e.target.value);
                                onCustomDimensionsChange?.(
                                  e.target.value,
                                  customHeight
                                );
                              }}
                              placeholder="1080"
                              className="text-xs h-8"
                              min="100"
                              max="4000"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Height (px)
                            </label>
                            <Input
                              type="number"
                              value={customHeight}
                              onChange={(e) => {
                                setCustomHeight(e.target.value);
                                onCustomDimensionsChange?.(
                                  customWidth,
                                  e.target.value
                                );
                              }}
                              placeholder="1080"
                              className="text-xs h-8"
                              min="100"
                              max="4000"
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Aspect ratio:{" "}
                          {customWidth && customHeight
                            ? (
                                parseFloat(customWidth) /
                                parseFloat(customHeight)
                              ).toFixed(2)
                            : "1.00"}
                          :1
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Inspiration Image Card - hide in capture mode */}
                {!captureMode && (
                  <Card className="p-6 hover:shadow-lg transition-all grid-span-2 duration-200 border-primary/20">
                    <div className="space-y-3">
                      {inspirationImageUrl ? (
                        <div className="relative group">
                          <Image
                            src={inspirationImageUrl}
                            alt="Inspiration"
                            width={320}
                            height={180}
                            className="w-full h-32 object-cover rounded-lg border shadow-sm"
                          />
                          <button
                            onClick={handleRemoveInspirationImage}
                            className="absolute top-2 right-2 p-2 bg-destructive/90 rounded-full text-destructive-foreground hover:bg-destructive transition-all shadow-lg"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                          <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/70 text-white text-xs rounded">
                            {inspirationImage?.name}
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor="inspiration-upload"
                          className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
                        >
                          <div className="text-center">
                            <svg
                              className="h-8 w-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <p className="text-sm text-muted-foreground group-hover:text-primary">
                              Click to upload inspiration image
                            </p>
                          </div>
                          <input
                            id="inspiration-upload"
                            type="file"
                            className="hidden"
                            onChange={handleInspirationImageChange}
                            accept="image/png, image/jpeg, image/webp"
                          />
                        </label>
                      )}
                    </div>
                  </Card>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  onClick={() => setShowConfigDialog(false)}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowConfigDialog(false);
                    handleCapture();
                  }}
                  disabled={!objectType.trim()}
                  size="lg"
                  className="flex-1"
                >
                  {captureButtonText}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ModelPreviewer;
