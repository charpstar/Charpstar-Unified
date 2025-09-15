"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";
import { Upload, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface AddReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string | null;
  onUploadComplete?: () => void;
}

export function AddReferenceDialog({
  open,
  onOpenChange,
  assetId,
  onUploadComplete,
}: AddReferenceDialogProps) {
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file types
  const validateFiles = (
    files: File[]
  ): { valid: File[]; invalid: string[] } => {
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    const supportedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "glb",
    ];
    const maxFileSize = 100 * 1024 * 1024; // 100MB limit

    files.forEach((file) => {
      const extension = file.name.toLowerCase().split(".").pop();

      if (!extension || !supportedExtensions.includes(extension)) {
        invalidFiles.push(`${file.name} (unsupported type)`);
      } else if (file.size > maxFileSize) {
        invalidFiles.push(
          `${file.name} (too large: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
        );
      } else {
        validFiles.push(file);
      }
    });

    return { valid: validFiles, invalid: invalidFiles };
  };

  // Handle clipboard paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles: File[] = [];

    items.forEach((item) => {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Generate a filename for pasted images
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-");
          const extension = file.type.split("/")[1] || "png";
          const newFile = new File(
            [file],
            `pasted-image-${timestamp}.${extension}`,
            {
              type: file.type,
              lastModified: Date.now(),
            }
          );
          imageFiles.push(newFile);
        }
      }
    });

    if (imageFiles.length > 0) {
      const { valid, invalid } = validateFiles(imageFiles);

      if (invalid.length > 0) {
        setFileError(`Invalid pasted image(s): ${invalid.join(", ")}`);
        setTimeout(() => setFileError(null), 5000);
      }

      if (valid.length > 0) {
        setPastedImages((prev) => [...prev, ...valid]);
        setFileError(null);
        toast.success(
          `Pasted ${valid.length} image${valid.length > 1 ? "s" : ""} from clipboard!`
        );
      }
    }
  };

  // Handle file reordering
  const handleFileDragStart = (index: number) => {
    setDraggedFileIndex(index);
  };

  const handleFileDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFileIndex === null || draggedFileIndex === index) return;

    const newFiles = [...droppedFiles];
    const draggedFile = newFiles[draggedFileIndex];
    newFiles.splice(draggedFileIndex, 1);
    newFiles.splice(index, 0, draggedFile);

    setDroppedFiles(newFiles);
    setDraggedFileIndex(index);
  };

  const handleFileDragEnd = () => {
    setDraggedFileIndex(null);
  };

  // Handle adding reference URL
  const handleAddReferenceUrl = async () => {
    if (!referenceUrl.trim() || !assetId) return;

    try {
      // Validate URL format
      const url = new URL(referenceUrl.trim());
      if (!url.protocol.startsWith("http")) {
        toast.error("Please enter a valid HTTP/HTTPS URL");
        return;
      }

      // Update the asset in the database
      const response = await fetch("/api/assets/add-reference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset_id: assetId,
          reference_url: referenceUrl.trim(),
        }),
        credentials: "include",
      });

      if (!response.ok) {
        let details = "";
        try {
          const errJson = await response.json();
          details = errJson?.error || errJson?.details || response.statusText;
        } catch {}
        throw new Error(details || "Failed to add reference URL");
      }

      toast.success("Reference image URL added successfully!");

      // Reset dialog state
      setReferenceUrl("");
      onOpenChange(false);

      // Notify parent component that upload is complete
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Error adding reference image URL:", error);
      toast.error("Please enter a valid image URL");
    }
  };

  // Handle multiple file uploads
  const handleMultipleFileUpload = async () => {
    const allFiles = [...droppedFiles, ...pastedImages];
    if (allFiles.length === 0 || !assetId) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: allFiles.length, fileName: "" });

    try {
      // Upload files sequentially
      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        setUploadProgress({
          current: i + 1,
          total: droppedFiles.length,
          fileName: file.name,
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("asset_id", assetId);

        // Determine file type based on extension
        const fileExtension = file.name.toLowerCase().split(".").pop();
        const fileType = fileExtension === "glb" ? "glb" : "reference";
        formData.append("file_type", fileType);

        const response = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          let details = "";
          try {
            const errJson = await response.json();
            details = errJson?.error || errJson?.details || response.statusText;
          } catch {}
          throw new Error(
            `Upload failed for ${file.name}${details ? `: ${details}` : ""}`
          );
        }
      }

      toast.success(
        `Successfully uploaded ${allFiles.length} file${
          allFiles.length > 1 ? "s" : ""
        }!`
      );

      // Reset dialog state
      setDroppedFiles([]);
      setPastedImages([]);
      setFileError(null);
      setUploadProgress(null);
      setDraggedFileIndex(null);
      onOpenChange(false);
      setUploadMode("url");

      // Notify parent component that upload is complete
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(
        `Failed to upload some files${error?.message ? `: ${error.message}` : ""}`
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const resetDialog = () => {
    setReferenceUrl("");
    setDroppedFiles([]);
    setPastedImages([]);
    setFileError(null);
    setUploadProgress(null);
    setDraggedFileIndex(null);
    setUploadMode("url");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] h-fit dark:bg-background dark:border-border"
        onPaste={handlePaste}
        tabIndex={-1}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground dark:text-foreground">
            Add Reference or GLB File
          </DialogTitle>
          <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
            Add a reference image URL or upload a reference/GLB file.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-1 bg-muted dark:bg-muted/20 rounded-lg">
          <Button
            variant={uploadMode === "url" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("url")}
            className="flex-1 dark:hover:bg-muted/50"
          >
            URL
          </Button>
          <Button
            variant={uploadMode === "file" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("file")}
            className="flex-1 dark:hover:bg-muted/50"
          >
            File Upload
          </Button>
        </div>

        <div className="space-y-4">
          {uploadMode === "url" ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground dark:text-foreground">
                Image URL *
              </label>
              <Input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddReferenceUrl();
                  }
                }}
                className="border-border focus:border-primary dark:bg-background dark:border-border dark:text-foreground"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground dark:text-foreground">
                Upload File *
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-primary bg-primary/10 scale-102"
                    : "border-border dark:border-border hover:border-primary/50 hover:bg-muted/20 hover:scale-101"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files);
                  const { valid, invalid } = validateFiles(files);

                  if (invalid.length > 0) {
                    setFileError(
                      `Unsupported file type(s): ${invalid.join(", ")}`
                    );
                    setTimeout(() => setFileError(null), 5000); // Clear error after 5 seconds
                  }

                  if (valid.length > 0) {
                    setDroppedFiles(valid);
                    setFileError(null);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.glb"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const { valid, invalid } = validateFiles(files);

                    if (invalid.length > 0) {
                      setFileError(
                        `Unsupported file type(s): ${invalid.join(", ")}`
                      );
                      setTimeout(() => setFileError(null), 5000); // Clear error after 5 seconds
                    }

                    if (valid.length > 0) {
                      setDroppedFiles(valid);
                      setFileError(null);
                    }
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center">
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    Drag and drop files here or click to select files
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                    Supported: JPG, PNG, GIF, WebP, SVG, GLB (max 100MB per
                    file)
                  </p>
                  <p className="text-xs text-primary dark:text-primary mt-2 font-medium">
                    💡 Tip: You can also paste images from clipboard (Ctrl+V)
                  </p>
                </div>
                {fileError && (
                  <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded">
                    <p className="text-xs text-destructive font-medium">
                      {fileError}
                    </p>
                  </div>
                )}
                {(droppedFiles.length > 0 || pastedImages.length > 0) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {droppedFiles.length + pastedImages.length} file
                      {droppedFiles.length + pastedImages.length > 1
                        ? "s"
                        : ""}{" "}
                      selected:
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDroppedFiles([]);
                          setPastedImages([]);
                        }}
                        className="h-6 text-xs hover:bg-destructive/10 hover:text-destructive"
                      >
                        Clear All
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Drag files to reorder upload sequence
                      </span>
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {/* Dropped Files */}
                      {droppedFiles.map((file, index) => (
                        <div
                          key={`dropped-${index}`}
                          className={`flex items-center justify-between text-xs bg-muted/50 dark:bg-muted/20 rounded px-2 py-1 cursor-move transition-all ${
                            draggedFileIndex === index
                              ? "opacity-50 scale-95"
                              : "hover:bg-muted/70"
                          }`}
                          draggable
                          onDragStart={() => handleFileDragStart(index)}
                          onDragOver={(e) => handleFileDragOver(e, index)}
                          onDragEnd={handleFileDragEnd}
                          onDragLeave={() => handleFileDragEnd()}
                          onDrop={() => handleFileDragEnd()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">
                              {file.name} (
                              {(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFiles = droppedFiles.filter(
                                (_, i) => i !== index
                              );
                              setDroppedFiles(newFiles);
                            }}
                            className="h-4 w-4 p-0 ml-2 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {/* Pasted Images */}
                      {pastedImages.map((file, index) => (
                        <div
                          key={`pasted-${index}`}
                          className="flex items-center justify-between text-xs bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-blue-600 dark:text-blue-400">
                              📋
                            </span>
                            <span className="truncate">
                              {file.name} (
                              {(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFiles = pastedImages.filter(
                                (_, i) => i !== index
                              );
                              setPastedImages(newFiles);
                            }}
                            className="h-4 w-4 p-0 ml-2 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-border dark:border-border">
          <Button
            onClick={() => {
              resetDialog();
              onOpenChange(false);
            }}
            variant="outline"
            className="cursor-pointer dark:border-border dark:hover:bg-muted/50"
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={
              uploadMode === "url"
                ? handleAddReferenceUrl
                : handleMultipleFileUpload
            }
            disabled={
              uploading ||
              (uploadMode === "url"
                ? !referenceUrl.trim()
                : droppedFiles.length === 0 && pastedImages.length === 0)
            }
            className="cursor-pointer"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                {uploadProgress
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total}: ${uploadProgress.fileName}`
                  : "Uploading..."}
              </>
            ) : (
              `Add ${uploadMode === "url" ? "URL" : droppedFiles.length + pastedImages.length > 1 ? `${droppedFiles.length + pastedImages.length} Files` : "File"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
