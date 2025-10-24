import React, { useState } from "react";
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
import { Input } from "@/components/ui/inputs";
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
    inspirationImage: string | null,
    imageFormat: string,
    customWidth?: string,
    customHeight?: string
  ) => void;
  onCancel: () => void;
  selectedAssets: Array<{
    id: string;
    name: string;
    glb_link: string;
    category?: string;
    thumbnail?: string;
  }>;
  imageFormat: string;
  customWidth: string;
  customHeight: string;
  onImageFormatChange: (format: string) => void;
  onCustomDimensionsChange: (width: string, height: string) => void;
}

const SceneConfigurator: React.FC<SceneConfiguratorProps> = ({
  onGenerate,
  onCancel,
  selectedAssets,
  imageFormat: propImageFormat,
  customWidth: propCustomWidth,
  customHeight: propCustomHeight,
  onImageFormatChange,
  onCustomDimensionsChange,
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
  const [imageFormat, setImageFormat] = useState(propImageFormat || "square");
  const [customWidth, setCustomWidth] = useState(propCustomWidth || "1080");
  const [customHeight, setCustomHeight] = useState(propCustomHeight || "1080");

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
      value: "facebook_cover",
      label: "Facebook Cover (16:9)",
      description: "Facebook Cover Photos",
      dimensions: "1920x1080",
      icon: "📺",
    },
    {
      value: "pinterest",
      label: "Pinterest (2:3)",
      description: "Pinterest Pins",
      dimensions: "1080x1620",
      icon: "📌",
    },
    {
      value: "custom",
      label: "Custom",
      description: "Custom dimensions",
      dimensions:
        imageFormat === "custom" ? `${customWidth}x${customHeight}` : "Custom",
      icon: "⚙️",
    },
  ];

  const handleInspirationImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setInspirationImage(file);
      const url = URL.createObjectURL(file);
      setInspirationImageUrl(url);
    }
  };

  const handleGenerate = async () => {
    if (!objectType.trim()) return;

    let inspirationBase64: string | null = null;
    if (inspirationImage) {
      inspirationBase64 = await fileToBase64(inspirationImage);
    }

    // Create size description for multi-asset mode
    let sizeDescription = "Unknown dimensions";
    if (selectedAssets.length > 0) {
      const sizeEntries = selectedAssets.map((asset, index) => {
        return `Asset ${index + 1} (${asset.name}): Dimensions will be calculated from 3D model`;
      });
      sizeDescription = sizeEntries.join("; ");
    }

    onGenerate(
      [],
      sizeDescription,
      objectType,
      sceneDescription,
      inspirationBase64,
      imageFormat,
      customWidth,
      customHeight
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Configure Scene
            {selectedAssets.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedAssets.length} assets)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Simple Configuration */}
          <div className="space-y-3">
            {/* Product Type */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-900">
                Product Type
              </label>
              <input
                type="text"
                value={objectType}
                onChange={(e) => setObjectType(e.target.value)}
                placeholder="e.g., Furniture, Electronics, Clothing..."
                className="w-full px-3 py-2 text-sm border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>

            {/* Asset Count Display - Only show for multi-asset mode */}
            {selectedAssets.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">
                    {selectedAssets.length} assets
                  </span>{" "}
                  ready for scene generation
                </p>
              </div>
            )}

            {/* Scene Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Scene Style</label>
              <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
                <DialogTrigger asChild>
                  <button className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md text-left flex items-center justify-between hover:bg-muted/50">
                    <span className="truncate">
                      {!isCustomScene &&
                      scenePresets.find((p) => p.prompt === sceneDescription)
                        ? scenePresets.find(
                            (p) => p.prompt === sceneDescription
                          )?.label
                        : "Browse Scene Presets"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Choose Scene Style</DialogTitle>
                  </DialogHeader>
                  <Command>
                    <CommandInput placeholder="Search scenes..." />
                    <CommandList className="max-h-[60vh]">
                      <CommandEmpty>No scene found.</CommandEmpty>
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
                        <CommandGroup key={category} heading={category}>
                          {presets.map((preset) => (
                            <CommandItem
                              key={preset.id}
                              value={preset.label}
                              onSelect={() => {
                                setIsCustomScene(false);
                                setSceneDescription(preset.prompt);
                                setSceneDialogOpen(false);
                              }}
                              className="flex items-center gap-3 p-3"
                            >
                              <Check
                                className={`h-4 w-4 ${
                                  sceneDescription === preset.prompt
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {preset.label}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {preset.prompt}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>

              {isCustomScene && (
                <textarea
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  placeholder="Describe your custom scene..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                  rows={2}
                />
              )}
            </div>

            {/* Image Format */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Image Format</label>
              <div className="grid grid-cols-2 gap-1.5">
                {formatOptions.slice(0, 4).map((format) => (
                  <button
                    key={format.value}
                    onClick={() => {
                      setImageFormat(format.value);
                      onImageFormatChange?.(format.value);
                    }}
                    className={`p-1.5 rounded-md border text-left text-xs ${
                      imageFormat === format.value
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{format.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {format.label}
                        </div>
                        <div className="text-muted-foreground text-xs truncate">
                          {format.dimensions}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Size Inputs */}
              {imageFormat === "custom" && (
                <div className="mt-3 p-2 bg-muted/30 rounded-md border border-border">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-foreground">
                      Custom Dimensions
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                          className="text-xs h-7"
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
                          className="text-xs h-7"
                          min="100"
                          max="4000"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Aspect ratio:{" "}
                      {customWidth && customHeight
                        ? (
                            parseFloat(customWidth) / parseFloat(customHeight)
                          ).toFixed(2)
                        : "1.00"}
                      :1
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inspiration Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Inspiration Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleInspirationImageChange}
                className="w-full px-3 py-2 text-sm border border-input rounded-md"
              />
              {inspirationImageUrl && (
                <div className="flex items-center gap-2">
                  <Image
                    src={inspirationImageUrl}
                    alt="Inspiration"
                    width={40}
                    height={40}
                    className="w-10 h-10 object-cover rounded"
                  />
                  <button
                    onClick={() => {
                      setInspirationImage(null);
                      setInspirationImageUrl(null);
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!objectType.trim()}
              className="flex-1"
            >
              Generate Scene
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SceneConfigurator;
