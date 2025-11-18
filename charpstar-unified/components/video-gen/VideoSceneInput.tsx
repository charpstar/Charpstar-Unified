"use client";

import React, { useRef, useState, useEffect } from "react";
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

const resolutionOptions = [
  { value: "720p", label: "HD 720p", description: "1280 x 720" },
  { value: "1080p", label: "Full HD 1080p", description: "1920 x 1080" },
];

const durationOptions = [
  { value: "4", label: "4 seconds" },
  { value: "6", label: "6 seconds" },
  { value: "8", label: "8 seconds" },
];

interface VideoSceneInputProps {
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null,
    resolution: string,
    durationSeconds: string
  ) => void;
  onCancel: () => void;
  objectSizeDescription: string;
  objectType: string;
  onObjectTypeChange: (value: string) => void;
  currentResolution: string;
  currentDuration: string;
  onResolutionChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  disabled?: boolean;
  selectedAssets?: Array<{
    id: string;
    product_name: string;
    glb_link: string;
  }>;
}

const VideoSceneInput: React.FC<VideoSceneInputProps> = ({
  onGenerate,
  onCancel,
  objectSizeDescription,
  objectType: objectTypeValue,
  onObjectTypeChange,
  currentResolution,
  currentDuration,
  onResolutionChange,
  onDurationChange,
  disabled = false,
  selectedAssets,
}) => {
  const [sceneDescription, setSceneDescription] = useState("");
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationPreviewUrl, setInspirationPreviewUrl] = useState<
    string | null
  >(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [sceneDescription]);

  useEffect(() => {
    return () => {
      if (inspirationPreviewUrl) {
        URL.revokeObjectURL(inspirationPreviewUrl);
      }
    };
  }, [inspirationPreviewUrl]);

  const handleGenerate = async () => {
    if (!sceneDescription.trim() || disabled) return;

    let inspirationBase64: string | null = null;
    if (inspirationImage) {
      inspirationBase64 = await fileToBase64(inspirationImage);
    }

    onGenerate(
      [],
      objectSizeDescription,
      objectTypeValue || "Product",
      sceneDescription,
      inspirationBase64,
      currentResolution,
      currentDuration
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleGenerate();
    }
  };

  const handleInspirationChange = (file: File) => {
    setInspirationImage(file);
    setInspirationPreviewUrl(URL.createObjectURL(file));
  };

  const clearInspiration = () => {
    if (inspirationPreviewUrl) {
      URL.revokeObjectURL(inspirationPreviewUrl);
    }
    setInspirationImage(null);
    setInspirationPreviewUrl(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Product Type
        </label>
        <input
          type="text"
          value={objectTypeValue}
          onChange={(e) => onObjectTypeChange(e.target.value)}
          placeholder="e.g., Lounge Chair, Pendant Lamp..."
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
          disabled={disabled}
        />
      </div>

      {inspirationPreviewUrl && (
        <div className="relative inline-block">
          <Image
            src={inspirationPreviewUrl}
            alt="Inspiration"
            width={160}
            height={100}
            className="w-full max-w-xs h-24 object-cover rounded-lg border border-border"
          />
          <button
            onClick={clearInspiration}
            className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90 transition-colors"
            aria-label="Remove inspiration image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Resolution
          </span>
          <div className="flex gap-2 flex-wrap">
            {resolutionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onResolutionChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  currentResolution === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Duration
          </span>
          <div className="flex gap-2">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onDurationChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  currentDuration === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border border-border rounded-2xl bg-background shadow-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the video scene you want to create..."
          className="w-full px-4 py-4 pr-28 resize-none border-0 bg-transparent focus:ring-0 focus:outline-none placeholder:text-muted-foreground text-base min-h-[120px]"
          rows={1}
          disabled={disabled}
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-2 z-10">
          <button
            type="button"
            className="h-8 w-8 p-0 hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (file) {
                  handleInspirationChange(file);
                }
              };
              input.click();
            }}
            aria-label="Upload inspiration image"
            disabled={disabled}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="h-8 w-8 p-0 cursor-pointer hover:bg-muted rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground border border-border bg-background"
            aria-label="Cancel video configuration"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleGenerate();
            }}
            disabled={!sceneDescription.trim() || disabled}
            className="h-9 w-9 p-0 cursor-pointer bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-sm"
            aria-label="Generate video scene"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoSceneInput;

