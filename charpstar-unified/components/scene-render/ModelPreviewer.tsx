import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/utilities/command";
import { Check, ChevronsUpDown } from "lucide-react";

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

const scenePresets = [
  // Product Showcase
  {
    category: "Product Showcase",
    label: "Minimalist Podium",
    prompt:
      "A minimalist white podium in a brightly lit studio with soft, diffused lighting.",
  },
  {
    category: "Product Showcase",
    label: "Dark Slate Pedestal",
    prompt:
      "On a rugged, dark slate pedestal in a minimalist concrete gallery.",
  },
  {
    category: "Product Showcase",
    label: "Floating Shelf",
    prompt: "On a floating wooden shelf against a clean, textured white wall.",
  },
  {
    category: "Product Showcase",
    label: "Museum Display",
    prompt: "Inside a brightly lit glass display case in a modern museum.",
  },

  // Lifestyle / Interior
  {
    category: "Lifestyle / Interior",
    label: "Scandinavian Living Room",
    prompt: "In a bright, airy, modern Scandinavian interior living room.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Cozy Cabin",
    prompt:
      "On a rich, dark oak table inside a cozy, rustic cabin with a warm fireplace.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Modern Office Desk",
    prompt:
      "On a sleek, modern office desk with a laptop and a cup of coffee in soft focus.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Marble Kitchen Counter",
    prompt:
      "On a luxurious marble kitchen counter with soft morning light filtering through a window.",
  },

  // Outdoor / Nature
  {
    category: "Outdoor / Nature",
    label: "Misty Beach",
    prompt:
      "Resting on a smooth, weathered rock on a serene, misty beach at sunrise.",
  },
  {
    category: "Outdoor / Nature",
    label: "Forest Floor",
    prompt:
      "On a mossy patch on a forest floor with dappled sunlight filtering through the trees.",
  },
  {
    category: "Outdoor / Nature",
    label: "City Rooftop",
    prompt: "On a city rooftop patio with a view of the skyline at dusk.",
  },
  {
    category: "Outdoor / Nature",
    label: "Zen Garden",
    prompt: "On a flat rock in a tranquil Japanese zen garden with raked sand.",
  },

  // Abstract / Creative
  {
    category: "Abstract / Creative",
    label: "Cyberpunk Street",
    prompt: "In a futuristic, neon-lit cyberpunk city street setting at night.",
  },
  {
    category: "Abstract / Creative",
    label: "Surreal Dreamscape",
    prompt:
      "Floating in a surreal, dreamlike landscape with pastel-colored clouds.",
  },
  {
    category: "Abstract / Creative",
    label: "Geometric Background",
    prompt:
      "Against a clean, abstract background with soft geometric shapes and shadows.",
  },
];

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
}

const ModelPreviewer: React.FC<ModelPreviewerProps> = ({
  file,
  modelUrl,
  onGenerate,
  onCancel,
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
  const [sceneOpen, setSceneOpen] = useState(false);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({
    current: 0,
    total: 3,
  });
  const [currentAngle, setCurrentAngle] = useState<string | null>(null);
  const [isTestingAngles, setIsTestingAngles] = useState(false);
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
        // Get model dimensions from model-viewer
        const model = modelViewer.model;
        if (model) {
          const box = model.boundingBox;
          if (box) {
            const size = box.getSize();
            setModelDimensions({
              x: size.x,
              y: size.y,
              z: size.z,
            });
            const sizeString = `Width: ${size.x.toFixed(2)}m, Height: ${size.y.toFixed(2)}m, Depth: ${size.z.toFixed(2)}m.`;
            setObjectSize(sizeString);
          } else {
            setModelDimensions({ x: 0, y: 0, z: 0 });
            setObjectSize("Could not determine object dimensions.");
          }
        }
      } catch (error) {
        console.error("Error getting model dimensions:", error);
        setModelDimensions({ x: 0, y: 0, z: 0 });
        setObjectSize("Could not determine object dimensions.");
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

  const testCameraAngles = async () => {
    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer) return;

    const cameraAngles = [
      { orbit: "0deg 75deg 0deg", name: "Front" },
      { orbit: "45deg 75deg 0deg", name: "Front Right" },
      { orbit: "-45deg 75deg 0deg", name: "Front Left" },
    ];

    setIsTestingAngles(true);
    setTestAngleIndex(0);

    try {
      for (let i = 0; i < cameraAngles.length; i++) {
        const angle = cameraAngles[i];
        setTestAngleIndex(i);
        setCurrentAngle(angle.name);

        // Set camera position
        modelViewer.cameraOrbit = angle.orbit;

        // Force a re-render
        modelViewer.dispatchEvent(new CustomEvent("camera-change"));

        // Wait for camera to settle
        await new Promise((resolve) => {
          const checkCamera = () => {
            const currentOrbit = modelViewer.cameraOrbit;
            if (currentOrbit === angle.orbit) {
              resolve(undefined);
            } else {
              setTimeout(checkCamera, 100);
            }
          };
          setTimeout(checkCamera, 200);
          setTimeout(resolve, 2000);
        });

        // Wait between angles for better visibility
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      setIsTestingAngles(false);
      setCurrentAngle(null);
      setTestAngleIndex(0);
    }
  };

  const handleCapture = async () => {
    if (!objectType.trim()) return;

    const modelViewer = modelViewerRef.current as any;
    if (modelViewer) {
      setIsCapturing(true);
      setCaptureProgress({ current: 0, total: 5 });

      // Short delay to allow any UI updates to render before taking snapshot
      await new Promise((resolve) => setTimeout(resolve, 50));

      const finalObjectSize =
        objectSize || "The object's scale is unknown. Use common sense.";

      // Define 3 different camera angles
      const cameraAngles = [
        { orbit: "0deg 75deg 0deg", name: "Front" },
        { orbit: "45deg 75deg 0deg", name: "Front Right" },
        { orbit: "-45deg 75deg 0deg", name: "Front Left" },
      ];

      const snapshots: string[] = [];

      try {
        // Capture each angle
        for (let i = 0; i < cameraAngles.length; i++) {
          const angle = cameraAngles[i];

          // Update progress and current angle
          setCaptureProgress({ current: i + 1, total: cameraAngles.length });
          setCurrentAngle(angle.name);

          // Set camera position
          modelViewer.cameraOrbit = angle.orbit;

          // Force a re-render by updating the model-viewer element
          modelViewer.dispatchEvent(new CustomEvent("camera-change"));

          // Wait for the camera to actually move to the new position
          await new Promise((resolve) => {
            // Check if camera has moved by comparing current orbit
            const checkCamera = () => {
              const currentOrbit = modelViewer.cameraOrbit;
              if (currentOrbit === angle.orbit) {
                resolve(undefined);
              } else {
                setTimeout(checkCamera, 100);
              }
            };
            // Start checking after a short delay
            setTimeout(checkCamera, 200);
            // Fallback timeout
            setTimeout(resolve, 2000);
          });

          // Additional wait to ensure rendering is complete
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Capture screenshot
          const snapshotDataUrl = await modelViewer.toDataURL();
          const snapshotBase64 = snapshotDataUrl.split(",")[1];
          snapshots.push(snapshotBase64);
        }

        let inspirationBase64: string | null = null;
        if (inspirationImage) {
          inspirationBase64 = await fileToBase64(inspirationImage);
        }

        onGenerate(
          snapshots,
          finalObjectSize,
          objectType,
          sceneDescription,
          inspirationBase64
        );
      } finally {
        setIsCapturing(false);
        setCaptureProgress({ current: 0, total: 5 });
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
    "Electronics",
    "Apparel",
    "Decor",
    "Kitchenware",
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
    <div className="w-full h-full flex flex-col gap-3 p-2 animate-fade-in">
      {/* Top: 3D Model Viewer */}
      <div className="h-[650px] rounded-lg overflow-hidden bg-gray-900/50 relative cursor-grab active:cursor-grabbing border border-white/10 shadow-lg">
        {/* Capture Progress Overlay */}
        {(isCapturing || isTestingAngles) && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">
                  {isTestingAngles
                    ? "Testing angles..."
                    : "Capturing angles..."}
                </span>
              </div>
              <div className="text-sm text-gray-300">
                {isTestingAngles
                  ? `${testAngleIndex + 1} of 3`
                  : `${captureProgress.current} of ${captureProgress.total}`}
              </div>
            </div>
            {currentAngle && (
              <div className="text-center text-lg font-semibold text-blue-400">
                Current: {currentAngle}
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
          environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
          exposure="1.2"
          tone-mapping="aces"
          shadow-softness="1"
          min-field-of-view="5deg"
          max-field-of-view="35deg"
          camera-orbit="0deg 75deg 0deg"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Dimensions */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h3 className="text-sm font-semibold">Dimensions</h3>
          </div>
          <div className="px-3 py-2 bg-muted rounded-md text-xs text-center font-mono">
            {modelDimensions ? (
              <div className="space-y-0.5">
                <div>W: {modelDimensions.x.toFixed(2)}m</div>
                <div>H: {modelDimensions.y.toFixed(2)}m</div>
                <div>D: {modelDimensions.z.toFixed(2)}m</div>
              </div>
            ) : (
              <span className="text-muted-foreground">Calculating...</span>
            )}
          </div>
        </Card>

        {/* Product Type */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              2
            </div>
            <h3 className="text-sm font-semibold">Product Type</h3>
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {productPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setObjectType(preset)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
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

        {/* Scene Description */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              3
            </div>
            <h3 className="text-sm font-semibold">Scene</h3>
          </div>
          <Popover open={sceneOpen} onOpenChange={setSceneOpen} modal={false}>
            <PopoverTrigger asChild>
              <button
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md mb-2 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-left flex items-center justify-between"
                aria-expanded={sceneOpen}
              >
                <span className="truncate">
                  {isCustomScene
                    ? "✏️ Custom Scene..."
                    : scenePresets.find((p) => p.prompt === sceneDescription)
                        ?.label || "Select scene..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto z-[100000]"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search scenes..." />
                <CommandList className="max-h-[300px] overflow-y-auto">
                  <CommandEmpty>No scene found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      key="custom"
                      onSelect={() => {
                        setIsCustomScene(true);
                        setSceneDescription("");
                        setSceneOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          isCustomScene ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      ✏️ Custom Scene...
                    </CommandItem>
                  </CommandGroup>
                  {presetCategories.map((category) => (
                    <CommandGroup key={category} heading={category}>
                      {scenePresets
                        .filter((p) => p.category === category)
                        .map((preset) => (
                          <CommandItem
                            key={preset.label}
                            onSelect={() => {
                              setIsCustomScene(false);
                              setSceneDescription(preset.prompt);
                              setSceneOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                !isCustomScene &&
                                sceneDescription === preset.prompt
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {preset.label}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

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

        {/* Inspiration Image */}
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
            <div className="relative group">
              <Image
                src={inspirationImageUrl}
                alt="Inspiration"
                className="w-full h-20 object-cover rounded-md border shadow-sm"
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
            </div>
          ) : (
            <label
              htmlFor="inspiration-upload"
              className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-muted-foreground/30 rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
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
          onClick={testCameraAngles}
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isCapturing || isTestingAngles}
          title="Test camera angles"
        >
          {isTestingAngles ? `Testing ${testAngleIndex + 1}/3` : "Test Angles"}
        </Button>
        <Button
          onClick={handleCapture}
          variant="default"
          size="sm"
          className="flex-1"
          disabled={!objectType.trim() || isCapturing || isTestingAngles}
          title={
            !objectType.trim()
              ? "Please describe the object first"
              : "Generate scenes"
          }
        >
          {isCapturing
            ? `Capturing ${captureProgress.current}/${captureProgress.total}`
            : "Generate Scenes"}
        </Button>
      </div>
    </div>
  );
};

export default ModelPreviewer;
