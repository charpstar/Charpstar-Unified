import React, { useState } from "react";
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

interface SceneConfiguratorProps {
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null
  ) => void;
  onCancel: () => void;
  capturedAssets?: Array<{
    snapshot: string;
    name: string;
    dimensions: { x: number; y: number; z: number } | null;
  }>;
}

const SceneConfigurator: React.FC<SceneConfiguratorProps> = ({
  onGenerate,
  onCancel,
  capturedAssets = [],
}) => {
  const [objectType, setObjectType] = useState("");
  const [sceneDescription, setSceneDescription] = useState(
    scenePresets[0].prompt
  );
  const [isCustomScene, setIsCustomScene] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );

  const handleGenerate = async () => {
    if (!objectType.trim()) return;

    let inspirationBase64: string | null = null;
    if (inspirationImage) {
      inspirationBase64 = await fileToBase64(inspirationImage);
    }

    // Create size description for multiple assets using auto-extracted dimensions
    let sizeDescription = "Multiple assets with varying sizes";
    if (capturedAssets.length > 0) {
      const sizeEntries = capturedAssets.map((asset, index) => {
        if (asset.dimensions) {
          const { x, y, z } = asset.dimensions;
          const size = `Width: ${x.toFixed(2)}m, Height: ${y.toFixed(2)}m, Depth: ${z.toFixed(2)}m`;
          return `Asset ${index + 1} (${asset.name}): ${size}`;
        } else {
          return `Asset ${index + 1} (${asset.name}): Dimensions could not be determined`;
        }
      });
      sizeDescription = sizeEntries.join("; ");
    }

    // Pass empty snapshots array since assets are already captured
    onGenerate(
      [],
      sizeDescription,
      objectType,
      sceneDescription,
      inspirationBase64
    );
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

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden min-h-[100px] max-h-[500px]">
      {/* Configuration Controls in Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-[100px] overflow-hidden ">
        {/* Product Type */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h3 className="text-sm font-semibold">Product Type</h3>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-2 max-h-40 overflow-y-auto">
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
            placeholder="e.g., 'home furniture collection'"
            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
            required
          />
        </Card>

        {/* Asset Dimensions Display - Only show for multi-asset mode */}
        {capturedAssets.length > 0 && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1.5
              </div>
              <h3 className="text-sm font-semibold">Asset Dimensions</h3>
            </div>
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {capturedAssets.map((asset, index) => (
                <div key={index} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {asset.name}
                  </label>
                  <div className="px-2 py-1.5 text-xs bg-muted rounded-md font-mono">
                    {asset.dimensions ? (
                      <>
                        W: {asset.dimensions.x.toFixed(2)}m × H:{" "}
                        {asset.dimensions.y.toFixed(2)}m × D:{" "}
                        {asset.dimensions.z.toFixed(2)}m
                      </>
                    ) : (
                      "Dimensions could not be determined"
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Scene Description */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              2
            </div>
            <h3 className="text-sm font-semibold">Scene</h3>
          </div>
          <div className="space-y-2">
            <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className="w-full px-3 cursor-pointer py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-left flex items-center justify-between hover:bg-muted/50"
                  aria-expanded={sceneDialogOpen}
                >
                  <span className="truncate">
                    {!isCustomScene &&
                    scenePresets.find((p) => p.prompt === sceneDescription)
                      ? scenePresets.find((p) => p.prompt === sceneDescription)
                          ?.label
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
                    <CommandInput placeholder="Search scenes..." />
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

          {!isCustomScene && sceneDescription && (
            <div className="mt-3 p-3 bg-muted/30 rounded-md border">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Selected Scene Description:
              </div>
              <div className="text-sm text-foreground">{sceneDescription}</div>
            </div>
          )}

          {isCustomScene && (
            <textarea
              id="scene-description"
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder="e.g., 'modern minimalist studio with soft lighting'"
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md resize-none h-20 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow mt-2"
            />
          )}
        </Card>

        {/* Inspiration Image */}
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
              3
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
                className="w-full h-[180px] object-contain rounded-md border shadow-sm"
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
              className="flex flex-col items-center justify-center h-[180px] border-2 border-dashed border-muted-foreground/30 rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
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

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onCancel}
          variant="secondary"
          size="sm"
          className="flex-1"
        >
          Back to Assets
        </Button>
        <Button
          onClick={handleGenerate}
          variant="default"
          size="sm"
          className="flex-1"
          disabled={!objectType.trim()}
          title={
            !objectType.trim()
              ? "Please describe the product type first"
              : "Generate scene with all assets"
          }
        >
          Generate Scene
        </Button>
      </div>
    </div>
  );
};

export default SceneConfigurator;
