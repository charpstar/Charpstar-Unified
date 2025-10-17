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
import { Check, ChevronsUpDown } from "lucide-react";
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
    inspirationImage: string | null
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
  const [modelError, setModelError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [captureProgress, setCaptureProgress] = useState({
    current: 0,
    total: 3,
  });
  const [currentAngle, setCurrentAngle] = useState<string | null>(null);
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

  const testOptimalAngle = async () => {
    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer) return;

    // Test the optimal hero shot angle
    const optimalAngle = { orbit: "0deg 75deg 2.5m", name: "Hero Shot" };

    setIsTestingAngles(true);
    setCurrentAngle(optimalAngle.name);

    try {
      // Set camera position
      modelViewer.cameraOrbit = optimalAngle.orbit;

      // Force a re-render
      modelViewer.dispatchEvent(new CustomEvent("camera-change"));

      // Wait for camera to settle
      await new Promise((resolve) => {
        const checkCamera = () => {
          const currentOrbit = modelViewer.cameraOrbit;
          if (currentOrbit === optimalAngle.orbit) {
            resolve(undefined);
          } else {
            setTimeout(checkCamera, 100);
          }
        };
        setTimeout(checkCamera, 200);
        setTimeout(resolve, 2000);
      });

      // Hold the view for a moment
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } finally {
      setIsTestingAngles(false);
      setCurrentAngle(null);
    }
  };

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
            inspirationBase64
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

  const presetCategories = [...new Set(scenePresets.map((p) => p.category))];
  const productPresets = [
    "Furniture",
    "Home Decor",
    "Electronics",
    "Kitchenware",
    "Lighting",
    "Beauty & Cosmetics",
    "Eyewear",
    "Watches & Jewelry",
    "Toys & Games",
    "Sports Equipment",
    "Pet Products",
    "Office Supplies",
  ];

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
    <div className="w-full h-full flex flex-col gap-3 p-2 animate-fade-in overflow-hidden">
      {/* Top: 3D Model Viewer */}
      <div className="h-[650px] rounded-lg overflow-hidden bg-gray-900/50 relative cursor-grab active:cursor-grabbing border border-white/10 shadow-lg">
        {/* Capture Progress Overlay */}
        {(isCapturing || isTestingAngles) && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">
                {isTestingAngles
                  ? "Previewing optimal angle..."
                  : "Capturing hero shot..."}
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

      {/* Bottom: Compact Controls in Grid */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${captureMode ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-3 flex-1 min-h-0 overflow-hidden`}
      >
        {/* Dimensions - hide in capture mode */}
        {!captureMode && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="text-sm font-semibold">Dimensions</h3>
            </div>
            <div className="px-3 py-4 bg-muted rounded-md text-center font-mono">
              {isModelLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-muted-foreground text-sm">
                    Loading...
                  </span>
                </div>
              ) : modelDimensions ? (
                <div className="space-y-2">
                  <div className="text-lg">
                    W: {modelDimensions.x.toFixed(2)}m
                  </div>
                  <div className="text-lg ">
                    H: {modelDimensions.y.toFixed(2)}m
                  </div>
                  <div className="text-lg ">
                    D: {modelDimensions.z.toFixed(2)}m
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Calculating...
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Product Type */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {captureMode ? "1" : "2"}
            </div>
            <h3 className="text-sm font-semibold">
              Product Type{" "}
              {captureMode && (
                <span className="text-xs text-muted-foreground font-normal">
                  (Optional)
                </span>
              )}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2 h-full overflow-y-auto">
            {productPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setObjectType(preset)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  objectType === preset
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            id="object-type"
            type="text"
            value={objectType}
            onChange={(e) => setObjectType(e.target.value)}
            placeholder="e.g., 'leather armchair'"
            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
            required
          />
        </Card>

        {/* Scene Description - hide in capture mode */}
        {!captureMode && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h3 className="text-sm font-semibold">Scene</h3>
            </div>
            {/* Two Button Layout */}
            <div className="space-y-2">
              {/* Scene Dialog Button */}
              <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="w-full px-3 cursor-pointer py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-left flex items-center justify-between hover:bg-muted/50"
                    aria-expanded={sceneDialogOpen}
                  >
                    <span className="truncate">
                      {!isCustomScene &&
                      scenePresets.find((p) => p.prompt === sceneDescription)
                        ? scenePresets.find(
                            (p) => p.prompt === sceneDescription
                          )?.label
                        : "Browse Scene Presets"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </DialogTrigger>
                <DialogContent className="min-w-6xl max-h-[85vh] p-0">
                  <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Choose a Scene</DialogTitle>
                  </DialogHeader>
                  <div className="p-6">
                    <Command>
                      <CommandInput
                        placeholder="Search scenes..."
                        className=""
                      />
                      <CommandList className="max-h-[65vh] overflow-y-auto">
                        <CommandEmpty>No scene found.</CommandEmpty>
                        {presetCategories.map((category) => (
                          <CommandGroup key={category} heading={category}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                              {scenePresets
                                .filter((p) => p.category === category)
                                .map((preset: any) => (
                                  <CommandItem
                                    key={preset.id}
                                    onSelect={() => {
                                      setIsCustomScene(false);
                                      setSceneDescription(preset.prompt);
                                      setSceneDialogOpen(false);
                                    }}
                                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                  >
                                    <Check
                                      className={`h-5 w-5 ${
                                        !isCustomScene &&
                                        sceneDescription === preset.prompt
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                    {preset.thumbnailUrl ? (
                                      <Image
                                        src={preset.thumbnailUrl}
                                        alt={preset.label}
                                        width={64}
                                        height={64}
                                        className="w-16 h-16 object-cover rounded-lg border shadow-sm"
                                        unoptimized
                                      />
                                    ) : (
                                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                                        <span className="text-lg">🎨</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">
                                        {preset.label}
                                      </div>
                                      <div className="text-sm text-muted-foreground line-clamp-2">
                                        {preset.prompt}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                            </div>
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Custom Scene Button */}
              <button
                onClick={() => {
                  setIsCustomScene(true);
                  setSceneDescription("");
                }}
                className={`w-full px-3 cursor-pointer py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-left flex items-center justify-between hover:bg-muted/50 ${
                  isCustomScene
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background"
                }`}
              >
                <span className="truncate flex items-center gap-2">
                  <span className="text-lg">✏️</span>
                  {isCustomScene
                    ? "Custom Scene (Active)"
                    : "Create Custom Scene"}
                </span>
                {isCustomScene && <Check className="h-4 w-4 text-primary" />}
              </button>
            </div>

            {/* Display chosen preset scene description */}
            {!isCustomScene && sceneDescription && (
              <div className="mt-3 p-3 bg-muted/30 rounded-md border">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Selected Scene Description:
                </div>
                <div className="text-sm text-foreground">
                  {sceneDescription}
                </div>
              </div>
            )}

            {isCustomScene && (
              <textarea
                id="scene-description"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="e.g., 'modern minimalist studio with soft lighting'"
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md resize-none h-20 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
              />
            )}
          </Card>
        )}

        {/* Inspiration Image - hide in capture mode */}
        {!captureMode && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                4
              </div>
              <h3 className="text-sm font-semibold">
                Inspiration{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (Optional)
                </span>
              </h3>
            </div>
            {inspirationImageUrl ? (
              <div className="relative group h-full">
                <Image
                  src={inspirationImageUrl}
                  alt="Inspiration"
                  className="w-full  h-[220px] object-contain rounded-md border shadow-sm"
                  width={320}
                  height={180}
                />
                <button
                  onClick={handleRemoveInspirationImage}
                  className="absolute top-1 right-1 p-1 bg-destructive/90 rounded-full text-destructive-foreground hover:bg-destructive transition-colors shadow-md"
                  aria-label="Remove"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className="absolute  p-2 bg-black/50 text-white text-sm rounded-b-md">
                  {inspirationImage?.name}
                </div>
              </div>
            ) : (
              <label
                htmlFor="inspiration-upload"
                className="flex flex-col items-center justify-center h-full border-2 border-dashed border-muted-foreground/30 rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
              >
                <div className="text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mx-auto mb-1 text-muted-foreground group-hover:text-primary transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-xs text-muted-foreground">Upload image</p>
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
          </Card>
        )}
      </div>

      {/* Action Buttons - Full Width Bottom */}
      <div className="flex gap-2">
        <Button
          onClick={onCancel}
          variant="secondary"
          size="sm"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={testOptimalAngle}
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isCapturing || isTestingAngles}
          title="Preview optimal camera angle"
        >
          {isTestingAngles ? "Previewing..." : "Preview Angle"}
        </Button>
        <Button
          onClick={handleCapture}
          variant="default"
          size="sm"
          className="flex-1"
          disabled={
            (!objectType.trim() && !captureMode) ||
            isCapturing ||
            isTestingAngles
          }
          title={
            !objectType.trim() && !captureMode
              ? "Please describe the object first"
              : captureMode
                ? "Capture this asset"
                : "Generate high-quality scene"
          }
        >
          {isCapturing ? "Capturing..." : captureButtonText}
        </Button>
      </div>
    </div>
  );
};

export default ModelPreviewer;
