"use client";

import { useState } from "react";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";
import {
  Package,
  ExternalLink,
  FileText,
  Download,
  ImageIcon,
  Link2,
  Edit,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useUser } from "@/contexts/useUser";

interface FileItem {
  url: string;
  name: string;
  isDirect?: boolean;
}

interface Categories {
  glb: FileItem[];
  images: FileItem[];
  documents: FileItem[];
  other: FileItem[];
}

interface ViewReferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any;
  onAddReference?: () => void;
}

// Helper function to parse measurements
const parseMeasurements = (
  measurements: string | null
): { h: string; w: string; d: string } | null => {
  if (!measurements) return null;
  const parts = measurements.split(",").map((p) => p.trim());
  if (parts.length === 3) {
    return { h: parts[0], w: parts[1], d: parts[2] };
  }
  return null;
};

// Helper function to parse references
const parseReferences = (
  referenceImages: string[] | string | null
): string[] => {
  if (!referenceImages) return [];
  if (Array.isArray(referenceImages)) return referenceImages;

  // Check if it's a string with ||| separator
  if (typeof referenceImages === "string" && referenceImages.includes("|||")) {
    return referenceImages
      .split("|||")
      .map((ref) => ref.trim())
      .filter(Boolean);
  }

  try {
    return JSON.parse(referenceImages);
  } catch {
    return [referenceImages];
  }
};

export function ViewReferencesDialog({
  open,
  onOpenChange,
  asset,
  onAddReference,
}: ViewReferencesDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditingMeasurements, setIsEditingMeasurements] = useState(false);
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [isSavingMeasurements, setIsSavingMeasurements] = useState(false);
  const user = useUser();
  const isModeler = user?.metadata?.role === "modeler";

  // Get all files (GLB + references)
  const allReferences = asset ? parseReferences(asset.reference) : [];
  const hasDirectGlb = asset?.glb_link;

  // Get measurements if available
  const measurements = asset ? parseMeasurements(asset.measurements) : null;

  // Categorize files
  const categories: Categories = {
    glb: [],
    images: [],
    documents: [],
    other: [],
  };

  // Add direct GLB if exists
  if (hasDirectGlb) {
    categories.glb.push({
      url: asset.glb_link,
      name: "Main GLB Model",
      isDirect: true,
    });
  }

  // Categorize references
  allReferences.forEach((ref, index) => {
    if (!hasDirectGlb || ref !== asset.glb_link) {
      const extension = ref.toLowerCase().split(".").pop() || "";
      const fileName = ref.split("/").pop() || `File ${index + 1}`;

      if (extension === "glb") {
        categories.glb.push({
          url: ref,
          name: fileName,
          isDirect: false,
        });
      } else if (
        ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)
      ) {
        categories.images.push({
          url: ref,
          name: fileName,
        });
      } else if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension)) {
        categories.documents.push({
          url: ref,
          name: fileName,
        });
      } else {
        categories.other.push({
          url: ref,
          name: fileName,
        });
      }
    }
  });

  const hasAnyFiles = Object.values(categories).some((cat) => cat.length > 0);

  // Function to handle editing measurements
  const handleEditMeasurements = () => {
    if (measurements) {
      setHeight(measurements.h);
      setWidth(measurements.w);
      setDepth(measurements.d);
    } else {
      setHeight("");
      setWidth("");
      setDepth("");
    }
    setIsEditingMeasurements(true);
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setIsEditingMeasurements(false);
    setHeight("");
    setWidth("");
    setDepth("");
  };

  // Function to save measurements
  const handleSaveMeasurements = async () => {
    if (!asset?.id || !height.trim() || !width.trim() || !depth.trim()) {
      toast.error("Please enter all measurements (H, W, D)");
      return;
    }

    // Validate that inputs are numbers
    const h = parseFloat(height);
    const w = parseFloat(width);
    const d = parseFloat(depth);

    if (isNaN(h) || isNaN(w) || isNaN(d) || h <= 0 || w <= 0 || d <= 0) {
      toast.error("Please enter valid positive numbers for measurements");
      return;
    }

    setIsSavingMeasurements(true);

    try {
      const { supabase } = await import("@/lib/supabaseClient");

      // Store measurements as "H,W,D" format in millimeters
      const measurementsString = `${h},${w},${d}`;

      const { error } = await supabase
        .from("onboarding_assets")
        .update({ measurements: measurementsString })
        .eq("id", asset.id);

      if (error) {
        console.error("Error updating measurements:", error);
        toast.error("Failed to save measurements");
        return;
      }

      // Send notification to QA and admin if updated by a client
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (currentUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, title")
            .eq("id", currentUser.id)
            .single();

          if (profile?.role === "client") {
            const { notificationService } = await import(
              "@/lib/notificationService"
            );

            await notificationService.sendClientAssetUpdateNotification({
              assetId: asset.id,
              assetName: asset?.product_name || "Unknown Asset",
              clientName: asset?.client || "Unknown Client",
              updateType: "measurements",
              updatedFields: ["measurements"],
              updatedBy: profile.title || currentUser.email || "Unknown User",
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to send notification:", notificationError);
      }

      toast.success("Measurements saved successfully!");
      setIsEditingMeasurements(false);

      // Trigger refresh by closing and reopening dialog
      if (onAddReference) {
        onAddReference();
      }
    } catch (error) {
      console.error("Error saving measurements:", error);
      toast.error("Failed to save measurements");
    } finally {
      setIsSavingMeasurements(false);
    }
  };

  // Function to download all files
  const downloadAllFiles = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    const allFiles = [
      ...categories.glb.map((file) => ({ ...file, type: "glb" })),
      ...categories.images.map((file) => ({
        ...file,
        type: "image",
      })),
      ...categories.documents.map((file) => ({
        ...file,
        type: "document",
      })),
      ...categories.other.map((file) => ({
        ...file,
        type: "other",
      })),
    ];

    for (const file of allFiles) {
      try {
        // Generate appropriate filename with extension
        const urlParts = file.url.split("/");
        const originalName = urlParts[urlParts.length - 1];
        const extension = originalName.split(".").pop() || "";
        const baseName = asset?.product_name || "asset";

        // Create a unique filename
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/:/g, "-");
        const fileName = `${baseName}_${file.type}_${timestamp}.${extension}`;

        // Use fetch to get the file and then create a blob download
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${file.name}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        window.URL.revokeObjectURL(url);

        // Small delay to prevent browser from blocking multiple downloads
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to download ${file.name}:`, error);
        toast.error(`Failed to download ${file.name}`);
      }
    }

    toast.success(`Downloaded ${allFiles.length} files successfully!`);
    setIsDownloading(false);
  };

  // Function to download individual GLB file
  const downloadGlbFile = async (file: FileItem) => {
    try {
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.name}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${asset?.article_id || "model"}.glb`;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${file.name} successfully!`);
    } catch (error) {
      console.error(`Failed to download ${file.name}:`, error);
      toast.error(`Failed to download ${file.name}`);
    }
  };

  if (!hasAnyFiles) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-[600px] max-h-[90vh] flex flex-col dark:bg-background dark:border-border">
          <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground dark:text-foreground">
                  References - {asset?.product_name || "Asset"}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                  View and manage all reference images for this asset.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-6 sm:py-8">
              <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm sm:text-base text-muted-foreground dark:text-muted-foreground">
                No files found
              </p>
              {onAddReference && !isModeler && (
                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                  Click &quot;Add Reference&quot; to upload files
                </p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-border dark:border-border">
            {onAddReference && (
              <Button
                onClick={onAddReference}
                variant="outline"
                className="cursor-pointer dark:border-border dark:hover:bg-muted/50 w-full sm:w-auto text-sm h-8 sm:h-9"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add Reference</span>
                <span className="sm:hidden">Add Ref</span>
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              className="cursor-pointer w-full sm:w-auto text-sm h-8 sm:h-9"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-[600px] max-h-[90vh] flex flex-col dark:bg-background dark:border-border">
        <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground dark:text-foreground">
                References - {asset?.product_name || "Asset"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                View and manage all reference images for this asset.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Measurements Section */}
          {(measurements || isEditingMeasurements) && (
            <div className="p-3 sm:p-4 bg-muted/30 dark:bg-muted/10 border border-border dark:border-border rounded-lg">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    Product Measurements
                  </h3>
                </div>
                {!isEditingMeasurements && !isModeler && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditMeasurements}
                    className="h-7 text-xs dark:hover:bg-muted/50"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingMeasurements ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Height (H)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        min="0"
                        step="0.1"
                        className="border-border focus:border-primary dark:bg-background dark:border-border dark:text-foreground text-sm h-8 sm:h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Width (W)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        min="0"
                        step="0.1"
                        className="border-border focus:border-primary dark:bg-background dark:border-border dark:text-foreground text-sm h-8 sm:h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Depth (D)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={depth}
                        onChange={(e) => setDepth(e.target.value)}
                        min="0"
                        step="0.1"
                        className="border-border focus:border-primary dark:bg-background dark:border-border dark:text-foreground text-sm h-8 sm:h-9"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    💡 Enter all dimensions in millimeters (mm)
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSavingMeasurements}
                      className="h-8 text-xs dark:border-border dark:hover:bg-muted/50"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMeasurements}
                      disabled={
                        isSavingMeasurements ||
                        !height.trim() ||
                        !width.trim() ||
                        !depth.trim()
                      }
                      className="h-8 text-xs"
                    >
                      {isSavingMeasurements ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-2 sm:p-3 bg-background dark:bg-background/50 rounded border border-border dark:border-border">
                    <p className="text-xs text-muted-foreground mb-1">Height</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground">
                      {measurements?.h || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">mm</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-background dark:bg-background/50 rounded border border-border dark:border-border">
                    <p className="text-xs text-muted-foreground mb-1">Width</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground">
                      {measurements?.w || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">mm</p>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-background dark:bg-background/50 rounded border border-border dark:border-border">
                    <p className="text-xs text-muted-foreground mb-1">Depth</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground">
                      {measurements?.d || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">mm</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {!measurements && !isEditingMeasurements && !isModeler && (
            <div className="p-3 sm:p-4 bg-muted/30 dark:bg-muted/10 border border-dashed border-border dark:border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">
                      Product Measurements
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      No measurements added yet
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditMeasurements}
                  className="h-7 text-xs dark:border-border dark:hover:bg-muted/50"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Header with Download All Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border dark:border-border pb-3 sm:pb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="font-semibold text-foreground text-sm sm:text-base">
                  Files Available
                </span>
              </div>
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {Object.values(categories).reduce(
                  (sum, cat) => sum + cat.length,
                  0
                )}{" "}
                total
              </Badge>
            </div>
            <Button
              onClick={downloadAllFiles}
              disabled={isDownloading}
              className="bg-primary hover:bg-primary/90 text-white dark:text-black px-3 sm:px-4 py-2 text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">
                {isDownloading ? "Downloading..." : "Download All"}
              </span>
              <span className="sm:hidden">
                {isDownloading ? "Downloading..." : "Download All"}
              </span>
            </Button>
          </div>

          {/* GLB Files Section */}
          {categories.glb.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  3D Models (GLB)
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.glb.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.glb.map((file, index) => (
                  <div
                    key={`glb-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 border rounded-lg dark:border-border dark:bg-muted/10 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Package className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate dark:text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                          {file.url}
                        </p>
                        {file.isDirect && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Primary Model
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadGlbFile(file)}
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50 h-7 sm:h-8 w-full sm:w-auto"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images Section */}
          {categories.images.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  Reference Images
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.images.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.images.map((file, index) => (
                  <div
                    key={`img-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 border rounded-lg dark:border-border dark:bg-muted/10 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      {/* Image Preview */}
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-lg border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        <Image
                          width={64}
                          height={64}
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const fallback =
                              target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                        <div className="hidden w-full h-full items-center justify-center bg-muted">
                          <ImageIcon className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate dark:text-foreground">
                          {file.name}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50 h-7 sm:h-8 w-full sm:w-auto"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {categories.documents.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  Documents
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.documents.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.documents.map((file, index) => (
                  <div
                    key={`doc-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 border rounded-lg dark:border-border dark:bg-muted/10 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate dark:text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                          {file.url}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50 h-7 sm:h-8 w-full sm:w-auto"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Files Section */}
          {categories.other.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">
                  External Links
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.other.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.other.map((file, index) => (
                  <div
                    key={`other-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 border rounded-lg dark:border-border dark:bg-muted/10 gap-2 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Link2 className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate dark:text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                          {file.url}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50 h-7 sm:h-8 w-full sm:w-auto"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-border dark:border-border">
          {onAddReference && !isModeler && (
            <Button
              onClick={onAddReference}
              variant="outline"
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50 w-full sm:w-auto text-sm h-8 sm:h-9"
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Reference</span>
              <span className="sm:hidden">Add Ref</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
