"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Switch } from "@/components/ui/inputs";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import Image from "next/image";

export default function UploadTexturePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    basecolor_url: "",
    roughness_url: "",
    metallic_url: "",
    normal_url: "",
    preview_url: "",
    is_public: true,
  });

  const [uploadingFiles, setUploadingFiles] = useState({
    basecolor: false,
    roughness: false,
    metallic: false,
    normal: false,
    preview: false,
  });

  const handleFileUpload = async (
    file: File,
    type: "basecolor" | "roughness" | "metallic" | "normal" | "preview"
  ) => {
    setUploadingFiles((prev) => ({ ...prev, [type]: true }));

    try {
      // Create form data for upload
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("type", "texture");

      // Upload to your existing file upload endpoint
      const response = await fetch("/api/assets/upload-file", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();

      if (data.url) {
        setFormData((prev) => ({
          ...prev,
          [`${type}_url`]: data.url,
        }));
      } else {
        throw new Error("Failed to upload file");
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Failed to upload ${type} file. Please try again.`);
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.category ||
      !formData.basecolor_url ||
      !formData.preview_url
    ) {
      alert(
        "Please fill in all required fields (Name, Category, Base Color, and Preview)"
      );
      return;
    }

    setUploading(true);

    try {
      const response = await fetch("/api/textures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.texture) {
        router.push(`/texture-library/${data.texture.id}`);
      } else {
        throw new Error("Failed to create texture");
      }
    } catch (error) {
      console.error("Error creating texture:", error);
      alert("Failed to create texture. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/texture-library")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Upload New Texture</h1>
          <p className="text-muted-foreground mt-1">
            Add a new PBR texture to the library
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Texture Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Texture Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Allie02 Fabric"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="e.g., Fabric, Wood, Metal"
                  required
                />
              </div>
            </div>

            {/* Public/Private Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_public: checked })
                }
              />
              <Label htmlFor="is_public" className="cursor-pointer">
                Make this texture publicly visible
              </Label>
            </div>

            {/* File Uploads */}
            <div className="space-y-4">
              <h3 className="font-semibold">Texture Maps</h3>

              {/* Base Color */}
              <div className="space-y-2">
                <Label>
                  Base Color Map <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "basecolor");
                    }}
                    disabled={uploadingFiles.basecolor}
                  />
                  {uploadingFiles.basecolor && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
                {formData.basecolor_url && (
                  <p className="text-sm text-green-600">✓ Uploaded</p>
                )}
              </div>

              {/* Roughness */}
              <div className="space-y-2">
                <Label>Roughness Map</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "roughness");
                    }}
                    disabled={uploadingFiles.roughness}
                  />
                  {uploadingFiles.roughness && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
                {formData.roughness_url && (
                  <p className="text-sm text-green-600">✓ Uploaded</p>
                )}
              </div>

              {/* Metallic */}
              <div className="space-y-2">
                <Label>Metallic Map</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "metallic");
                    }}
                    disabled={uploadingFiles.metallic}
                  />
                  {uploadingFiles.metallic && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
                {formData.metallic_url && (
                  <p className="text-sm text-green-600">✓ Uploaded</p>
                )}
              </div>

              {/* Normal */}
              <div className="space-y-2">
                <Label>Normal Map</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "normal");
                    }}
                    disabled={uploadingFiles.normal}
                  />
                  {uploadingFiles.normal && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
                {formData.normal_url && (
                  <p className="text-sm text-green-600">✓ Uploaded</p>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>
                  Preview Image <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "preview");
                    }}
                    disabled={uploadingFiles.preview}
                  />
                  {uploadingFiles.preview && (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                </div>
                {formData.preview_url && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600 mb-2">✓ Uploaded</p>
                    <div className="relative w-32 h-32 rounded border">
                      <Image
                        src={formData.preview_url}
                        alt="Preview"
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Manual URL Entry (Alternative) */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Or enter URLs manually
              </h3>

              <div className="space-y-2">
                <Label htmlFor="basecolor_url">Base Color URL</Label>
                <Input
                  id="basecolor_url"
                  value={formData.basecolor_url}
                  onChange={(e) =>
                    setFormData({ ...formData, basecolor_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roughness_url">Roughness URL</Label>
                <Input
                  id="roughness_url"
                  value={formData.roughness_url}
                  onChange={(e) =>
                    setFormData({ ...formData, roughness_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metallic_url">Metallic URL</Label>
                <Input
                  id="metallic_url"
                  value={formData.metallic_url}
                  onChange={(e) =>
                    setFormData({ ...formData, metallic_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="normal_url">Normal URL</Label>
                <Input
                  id="normal_url"
                  value={formData.normal_url}
                  onChange={(e) =>
                    setFormData({ ...formData, normal_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preview_url">Preview URL</Label>
                <Input
                  id="preview_url"
                  value={formData.preview_url}
                  onChange={(e) =>
                    setFormData({ ...formData, preview_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/texture-library")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Create Texture
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
