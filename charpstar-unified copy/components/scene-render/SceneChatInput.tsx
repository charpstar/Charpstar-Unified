"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, X, ArrowRight } from "lucide-react";

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

const formatOptions = [
  {
    value: "square",
    label: "Square (1:1)",
    icon: "⬜",
    dimensions: "1080x1080",
  },
  {
    value: "instagram_story",
    label: "Story (9:16)",
    icon: "📱",
    dimensions: "1080x1920",
  },
  {
    value: "instagram_reel",
    label: "Reel (9:16)",
    icon: "🎬",
    dimensions: "1080x1920",
  },
  {
    value: "facebook_cover",
    label: "Cover (16:9)",
    icon: "📺",
    dimensions: "1920x1080",
  },
  { value: "custom", label: "Custom", icon: "⚙️", dimensions: "Custom" },
];

interface SceneChatInputProps {
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
  autoProductType?: string;
}

const SceneChatInput: React.FC<SceneChatInputProps> = ({
  onGenerate,
  onCancel,
  selectedAssets,
  imageFormat,
  customWidth,
  customHeight,
  onImageFormatChange,
  onCustomDimensionsChange,
  autoProductType = "Product",
}) => {
  const [sceneDescription, setSceneDescription] = useState("");
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [sceneDescription]);

  const handleInspirationImageChange = (file: File) => {
    setInspirationImage(file);
    setInspirationImageUrl(URL.createObjectURL(file));
  };

  const handleRemoveInspirationImage = () => {
    if (inspirationImageUrl) {
      URL.revokeObjectURL(inspirationImageUrl);
    }
    setInspirationImage(null);
    setInspirationImageUrl(null);
  };

  const handleGenerate = async () => {
    if (!sceneDescription.trim()) return;

    let inspirationBase64: string | null = null;
    if (inspirationImage) {
      inspirationBase64 = await fileToBase64(inspirationImage);
    }

    let sizeDescription = "Unknown dimensions";
    if (selectedAssets.length > 0) {
      const sizeEntries = selectedAssets.map((asset, index) => {
        return `Asset ${index + 1} (${asset.name}): Dimensions calculated from 3D model`;
      });
      sizeDescription = sizeEntries.join("; ");
    }

    onGenerate(
      [],
      sizeDescription,
      autoProductType,
      sceneDescription,
      inspirationBase64,
      imageFormat,
      customWidth,
      customHeight
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-32 pt-16 px-16">
      {/* Inspiration Image Preview */}
      {inspirationImageUrl && (
        <div className="relative inline-block">
          <Image
            src={inspirationImageUrl}
            alt="Inspiration"
            width={120}
            height={80}
            className="w-full max-w-xs h-20 object-cover rounded-lg border border-border"
          />
          <button
            onClick={handleRemoveInspirationImage}
            className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Format Selection Buttons */}
      <div className="flex items-center gap-2 flex-wrap pl-4">
        <span className="text-xs font-medium text-muted-foreground">
          Format:
        </span>
        {formatOptions.map((format) => (
          <button
            key={format.value}
            onClick={() => onImageFormatChange(format.value)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              imageFormat === format.value
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {format.icon} {format.label}
          </button>
        ))}
      </div>

      {/* Custom Dimensions Input */}
      {imageFormat === "custom" && (
        <div className="flex items-center gap-3 pl-4">
          <span className="text-xs font-medium text-muted-foreground">
            Dimensions:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customWidth}
              onChange={(e) =>
                onCustomDimensionsChange(e.target.value, customHeight)
              }
              placeholder="Width"
              className="w-20 px-2 py-1 text-xs border border-border rounded bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              min="100"
              max="4000"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              value={customHeight}
              onChange={(e) =>
                onCustomDimensionsChange(customWidth, e.target.value)
              }
              placeholder="Height"
              className="w-20 px-2 py-1 text-xs border border-border rounded bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              min="100"
              max="4000"
            />
          </div>
        </div>
      )}

      {/* ChatGPT-style Input */}
      <div className="relative border border-border rounded-2xl bg-background shadow-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want"
          className="w-full px-4 py-4 pr-24 resize-none border-0 bg-transparent focus:ring-0 focus:outline-none placeholder:text-muted-foreground text-base min-h-[120px]"
          rows={1}
        />

        {/* Action Buttons */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2 z-10">
          {/* Inspiration Image Upload */}
          <div className="relative group">
            <button
              type="button"
              className="h-8 w-8 p-0 hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    handleInspirationImageChange(file);
                  }
                };
                input.click();
              }}
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Upload inspiration image
            </div>
          </div>

          {/* Cancel Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="h-8 w-8 p-0 cursor-pointer hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground border border-border bg-background"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full cursor-pointer right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Cancel scene configuration
            </div>
          </div>

          {/* Generate Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerate();
              }}
              disabled={!sceneDescription.trim()}
              className="h-9 w-9 p-0 cursor-pointer bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-sm"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            {!sceneDescription.trim() && (
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Enter a scene description to generate
              </div>
            )}
            {sceneDescription.trim() && (
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Generate scene from description
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Format Picker Dropdown (hidden input) */}
      <input
        type="file"
        id="inspiration-upload"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleInspirationImageChange(file);
          }
        }}
        accept="image/*"
      />
    </div>
  );
};

export default SceneChatInput;
