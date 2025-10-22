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

interface ProductConfiguratorProps {
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    productDescription: string,
    inspirationImage: string | null
  ) => void;
  onCancel: () => void;
  capturedAssets?: Array<{
    snapshot: string;
    name: string;
    dimensions: { x: number; y: number; z: number } | null;
  }>;
}

const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  onGenerate,
  onCancel,
  capturedAssets = [],
}) => {
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
      productDescription,
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

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configure Product Render
          </h2>
          <p className="text-gray-600">
            Set up your product render parameters and style preferences
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Object Type */}
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
        </div>

        {/* Custom Scene Toggle */}
        <div className="flex items-center space-x-4">
          <Button
            variant={isCustomScene ? "default" : "outline"}
            onClick={handleCustomSceneToggle}
          >
            {isCustomScene ? "Using Custom Description" : "Use Custom Description"}
          </Button>
          {isCustomScene && (
            <p className="text-sm text-gray-600">
              You can now write your own product description below
            </p>
          )}
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
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Inspiration Image */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Inspiration Image (Optional)
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              id="inspiration-image"
              accept="image/*"
              onChange={handleInspirationImageChange}
              className="hidden"
            />
            <label
              htmlFor="inspiration-image"
              className="px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
            >
              {inspirationImage ? "Change Image" : "Add Inspiration Image"}
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
            <div className="mt-4">
              <Image
                src={inspirationImageUrl}
                alt="Inspiration"
                width={200}
                height={200}
                className="rounded-lg object-cover"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            onClick={handleGenerate}
            disabled={!objectType.trim()}
            className="flex-1"
          >
            Generate Product Render
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ProductConfigurator;

