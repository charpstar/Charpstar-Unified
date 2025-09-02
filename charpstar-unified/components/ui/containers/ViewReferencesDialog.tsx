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
import {
  Package,
  ExternalLink,
  FileText,
  Download,
  ImageIcon,
  FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

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

// Helper function to parse references
const parseReferences = (
  referenceImages: string[] | string | null
): string[] => {
  if (!referenceImages) return [];
  if (Array.isArray(referenceImages)) return referenceImages;
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

  // Get all files (GLB + references)
  const allReferences = asset ? parseReferences(asset.reference) : [];
  const hasDirectGlb = asset?.glb_link;

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
      link.download = `${asset?.product_name || "model"}.glb`;
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
        <DialogContent className="sm:max-w-[600px] h-fit max-h-[80vh] overflow-y-auto dark:bg-background dark:border-border">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-foreground dark:text-foreground">
                  References - {asset?.product_name || "Asset"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
                  View and manage all reference images for this asset.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground dark:text-muted-foreground">
              No files found
            </p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              Click &quot;Add Reference&quot; to upload files
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border dark:border-border">
            {onAddReference && (
              <Button
                onClick={onAddReference}
                variant="outline"
                className="cursor-pointer dark:border-border dark:hover:bg-muted/50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Add Reference
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
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
      <DialogContent className="sm:max-w-[600px] h-fit max-h-[80vh] overflow-y-auto dark:bg-background dark:border-border">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground dark:text-foreground">
                References - {asset?.product_name || "Asset"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
                View and manage all reference images for this asset.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with Download All Button */}
          <div className="flex items-center justify-between border-b border-border dark:border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">
                  Files Available
                </span>
              </div>
              <Badge variant="secondary" className="text-sm">
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
              className="bg-primary hover:bg-primary/90 text-white dark:text-black px-4 py-2"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download All"}
            </Button>
          </div>

          {/* GLB Files Section */}
          {categories.glb.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">
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
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-border dark:bg-muted/10"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Package className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate dark:text-foreground">
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
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50"
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-foreground">
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
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-border dark:bg-muted/10"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Image Preview */}
                      <div className="w-16 h-16 bg-muted rounded-lg border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
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
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate dark:text-foreground">
                          {file.name}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50"
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-foreground">Documents</h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.documents.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.documents.map((file, index) => (
                  <div
                    key={`doc-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-border dark:bg-muted/10"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate dark:text-foreground">
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
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50"
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileIcon className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-foreground">Other Files</h3>
                <Badge variant="secondary" className="text-xs">
                  {categories.other.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {categories.other.map((file, index) => (
                  <div
                    key={`other-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-border dark:bg-muted/10"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate dark:text-foreground">
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
                      className="text-xs flex-shrink-0 dark:border-border dark:hover:bg-muted/50"
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

        <div className="flex gap-3 pt-4 border-t border-border dark:border-border">
          {onAddReference && (
            <Button
              onClick={onAddReference}
              variant="outline"
              className="cursor-pointer dark:border-border dark:hover:bg-muted/50"
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Reference
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
