import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
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
    productDescription: string,
    inspirationImage: string | null
  ) => void;
  onCancel: () => void;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
  captureMode?: boolean;
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
  environmentImage,
  exposure,
  toneMapping,
  captureMode = false,
  captureButtonText = "Generate Product Render",
  onCaptureAsset,
}) => {
  const modelViewerRef = useRef<any>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [objectType, setObjectType] = useState("");
  const [productDescription, setProductDescription] = useState(
    scenePresets[0].prompt
  );
  const [isCustomScene, setIsCustomScene] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Get the file URL for the model viewer
  const fileUrl = file ? URL.createObjectURL(file) : modelUrl;

  const handleGenerate = async () => {
    if (!objectType.trim()) return;

    setIsGenerating(true);
    try {
      // Capture snapshot from the model viewer
      const canvas = await modelViewerRef.current?.toDataURL();
      if (!canvas) {
        throw new Error("Failed to capture model snapshot");
      }

      const base64Snapshot = canvas.split(",")[1];

      let inspirationBase64: string | null = null;
      if (inspirationImage) {
        inspirationBase64 = await fileToBase64(inspirationImage);
      }

      // Create size description
      const sizeDescription = "Product dimensions to be determined";

      if (captureMode && onCaptureAsset) {
        // In capture mode, just capture the asset
        onCaptureAsset(base64Snapshot, null);
      } else {
        // Generate the product render
        onGenerate(
          [base64Snapshot],
          sizeDescription,
          objectType,
          productDescription,
          inspirationBase64
        );
      }
    } catch (error) {
      console.error("Error generating product render:", error);
      setModelError("Failed to generate product render. Please try again.");
    } finally {
      setIsGenerating(false);
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
    setInspirationImage(null);
    setInspirationImageUrl(null);
  };

  const handleSceneSelect = (scene: any) => {
    setProductDescription(scene.prompt);
    setIsCustomScene(false);
    setSceneDialogOpen(false);
  };

  const handleCustomSceneToggle = () => {
    setIsCustomScene(!isCustomScene);
    if (!isCustomScene) {
      setProductDescription("");
    } else {
      setProductDescription(scenePresets[0].prompt);
    }
  };

  // Load model-viewer script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/model-viewer.js";
    script.type = "module";
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="/model-viewer.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);


  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Top: Model Viewer */}
      <div className="flex-1 relative bg-gray-100 rounded-lg overflow-hidden">
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
        className={`grid grid-cols-1 md:grid-cols-2 
        ${captureMode ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3`}
      >
        {/* Object Type Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Product Type *
          </label>
          <input
            type="text"
            value={objectType}
            onChange={(e) => setObjectType(e.target.value)}
            placeholder="e.g., Furniture, Electronics, Clothing"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Scene Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Product Style
          </label>
          <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left"
              >
                {isCustomScene ? "Custom Description" : "Select Style"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Choose Product Style</DialogTitle>
              </DialogHeader>
              <Command>
                <CommandInput placeholder="Search styles..." />
                <CommandList>
                  <CommandEmpty>No styles found.</CommandEmpty>
                  <CommandGroup>
                    {scenePresets.map((scene) => (
                      <CommandItem
                        key={scene.id}
                        onSelect={() => handleSceneSelect(scene)}
                        className="flex items-center space-x-2"
                      >
                        <Image
                          src={scene.thumbnailUrl}
                          alt={scene.label}
                          width={40}
                          height={40}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium">{scene.label}</div>
                          <div className="text-sm text-gray-500">
                            {scene.category}
                          </div>
                        </div>
                        <Check className="ml-auto h-4 w-4" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>

        {/* Custom Scene Toggle */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Custom Description
          </label>
          <Button
            variant={isCustomScene ? "default" : "outline"}
            onClick={handleCustomSceneToggle}
            className="w-full"
          >
            {isCustomScene ? "Using Custom" : "Use Custom"}
          </Button>
        </div>

        {/* Inspiration Image */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Inspiration Image
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="inspiration-image"
              accept="image/*"
              onChange={handleInspirationImageChange}
              className="hidden"
            />
            <label
              htmlFor="inspiration-image"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 text-center text-sm"
            >
              {inspirationImage ? "Change Image" : "Add Image"}
            </label>
            {inspirationImage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveInspirationImage}
              >
                Remove
              </Button>
            )}
          </div>
          {inspirationImageUrl && (
            <div className="mt-2">
              <Image
                src={inspirationImageUrl}
                alt="Inspiration"
                width={60}
                height={60}
                className="rounded object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Product Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Product Description
        </label>
        <textarea
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          placeholder="Describe the product and desired render style..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleGenerate}
          disabled={!objectType.trim() || isGenerating}
          className="flex-1"
        >
          {isGenerating ? "Generating..." : captureButtonText}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ModelPreviewer;

