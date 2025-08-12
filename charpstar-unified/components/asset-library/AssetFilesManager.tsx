"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/display";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Download,
  Trash2,
  File,
  FileImage,
  FileArchive,
  FileCode,
  Eye,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import ErrorBoundary from "@/components/dashboard/error-boundary";

interface AssetFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: "glb" | "asset" | "reference" | "misc";
  file_size: number;
  mime_type?: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface AssetFilesManagerProps {
  assetId: string;
  isOpen: boolean;
  onClose: () => void;
  onFilesChange?: () => void;
}

export function AssetFilesManager({
  assetId,
  isOpen,
  onClose,
  onFilesChange,
}: AssetFilesManagerProps) {
  const [files, setFiles] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assetId) {
      fetchFiles();
    }
  }, [isOpen, assetId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/files`);
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to fetch files");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (file: AssetFile) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    setDeletingFile(file.id);
    try {
      // Extract file path from URL more accurately
      let filePath: string;

      if (file.id.startsWith("models_")) {
        // This is a file from the models folder
        const fileName = file.file_name;
        filePath = `models/${fileName}`;
      } else if (file.id.startsWith("current_")) {
        // This is a current asset file - we can't delete these as they're core asset data
        toast.error(
          "Cannot delete core asset files. These are managed by the asset system."
        );
        setDeletingFile(null);
        return;
      } else {
        // Regular file from storage - extract path from URL
        const urlParts = file.file_url.split("/");
        const assetsIndex = urlParts.indexOf("assets");
        if (assetsIndex !== -1 && assetsIndex + 2 < urlParts.length) {
          // Skip "assets" and "object" parts, get the actual path
          filePath = urlParts.slice(assetsIndex + 3).join("/");
        } else {
          // Try alternative approach - look for the storage path after the domain
          const storageUrlPattern =
            /\/storage\/v1\/object\/public\/assets\/(.+)/;
          const match = file.file_url.match(storageUrlPattern);
          if (match) {
            filePath = match[1];
          } else {
            throw new Error("Could not determine file path from URL");
          }
        }
      }

      console.log("Deleting file:", {
        fileName: file.file_name,
        filePath,
        fileId: file.id,
        fileUrl: file.file_url,
      });

      const response = await fetch(
        `/api/assets/${assetId}/files?file_name=${encodeURIComponent(file.file_name)}&file_path=${encodeURIComponent(filePath)}&asset_id=${encodeURIComponent(assetId)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      const result = await response.json();
      console.log("Delete response:", result);

      toast.success("File deleted successfully");

      // Refresh the file list to ensure it's in sync with the backend
      await fetchFiles();

      // Notify parent component with error handling to prevent app reload
      if (onFilesChange) {
        try {
          // Add a small delay to ensure the file deletion is fully processed
          setTimeout(() => {
            try {
              onFilesChange();
            } catch (error) {
              console.error("Error in onFilesChange callback:", error);
              // Don't let errors in the callback crash the app
              toast.error("File deleted but failed to refresh asset list");
            }
          }, 100);
        } catch (error) {
          console.error("Error calling onFilesChange:", error);
          // Don't let errors in the callback crash the app
          toast.error("File deleted but failed to refresh asset list");
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete file"
      );
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDownloadFile = (file: AssetFile) => {
    const link = document.createElement("a");
    link.href = file.file_url;
    link.download = file.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllModelerFiles = async () => {
    if (!files || files.length === 0) return;
    // Consider modeler-uploaded files as those not marked as core asset
    // and not from models_ internal ids
    const modelerFiles = files.filter((f) => !f.id.startsWith("current_"));
    if (modelerFiles.length === 0) {
      toast.info("No modeler files to download");
      return;
    }
    // Trigger sequential downloads; browsers will handle them
    for (const f of modelerFiles) {
      try {
        const a = document.createElement("a");
        a.href = f.file_url;
        a.download = f.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Small delay to avoid overwhelming the browser
        await new Promise((res) => setTimeout(res, 120));
      } catch (e) {
        console.error("Failed to download:", f.file_name, e);
      }
    }
  };

  const getFileIcon = (fileType: string, mimeType?: string) => {
    if (fileType === "glb")
      return <FileCode className="h-4 w-4 text-blue-500" />;
    if (fileType === "reference" || mimeType?.startsWith("image/")) {
      return <FileImage className="h-4 w-4 text-green-500" />;
    }
    if (mimeType === "application/zip") {
      return <FileArchive className="h-4 w-4 text-orange-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} modal={false}>
      <DialogContent className="max-w-4xl max-h-[80vh] h-fit overflow-hidden flex flex-col">
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Asset Files
            </DialogTitle>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllModelerFiles}
                disabled={loading || files.length === 0}
                className="h-8 px-3"
                title="Download all modeler-uploaded files"
              >
                <Download className="h-4 w-4 mr-1" />
                Download all files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchFiles}
                disabled={loading}
                className="h-8 px-3"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading files...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No files uploaded for this asset yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.file_type, file.mime_type)}
                          <span className="font-medium">{file.file_name}</span>
                          {file.id.startsWith("current_") && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Core Asset
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(file.file_size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {file.uploaded_by || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile(file)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {(file.mime_type?.startsWith("image/") ||
                            file.file_name.match(
                              /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i
                            )) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(file.file_url, "_blank")
                              }
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file)}
                            disabled={
                              deletingFile === file.id ||
                              file.id.startsWith("current_")
                            }
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              file.id.startsWith("current_")
                                ? "Cannot delete core asset files"
                                : "Delete file"
                            }
                          >
                            {deletingFile === file.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
