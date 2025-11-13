"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/display";
import { Label } from "@/components/ui/display";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Clipboard } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  bugReportId?: string;
  disabled?: boolean;
}

export function ImageUpload({
  images,
  onImagesChange,
  bugReportId,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (bugReportId) {
        formData.append("bugReportId", bugReportId);
      }

      const response = await fetch("/api/upload-bug-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        onImagesChange([...images, data.url]);
        toast.success("Image uploaded successfully");
      } else {
        throw new Error(data.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      uploadImage(file);
    }
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await uploadImage(file);
          }
          break;
        }
      }
    },
    [disabled, uploadImage]
  );

  // Global paste listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (disabled || !isFocused) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await uploadImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, [disabled, isFocused, uploadImage]);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Images</Label>

      {/* Upload Area */}
      <div
        ref={uploadAreaRef}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer focus:outline-none ${
          isFocused
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onPaste={handlePaste}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => {
          if (!disabled && !uploading) {
            fileInputRef.current?.click();
          }
        }}
      >
        <div className="space-y-2">
          <div className="flex justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Upload or paste images</p>
            <p className="text-xs text-muted-foreground">
              Click to browse files or focus here and press Ctrl+V to paste
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Choose File
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                uploadAreaRef.current?.focus();
              }}
            >
              <Clipboard className="h-4 w-4" />
              Paste Image
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>

      {/* Image Preview */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Uploaded Images ({images.length})
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square relative rounded-lg overflow-hidden border">
                  <Image
                    src={imageUrl}
                    alt={`Bug report image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploading && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Uploading image...
          </div>
        </div>
      )}
    </div>
  );
}
