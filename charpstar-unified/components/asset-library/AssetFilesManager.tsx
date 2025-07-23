"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
      // Extract file path from URL
      const urlParts = file.file_url.split("/");
      const filePath = urlParts.slice(urlParts.indexOf("assets") + 1).join("/");

      const response = await fetch(
        `/api/assets/${assetId}/files?file_name=${file.file_name}&file_path=assets/${filePath}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      toast.success("File deleted successfully");
      setFiles(files.filter((f) => f.id !== file.id));
      onFilesChange?.();
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

  const getFileTypeLabel = (fileType: string) => {
    const labels = {
      glb: "3D Model",
      asset: "Asset File",
      reference: "Reference",
      misc: "Other",
    };
    return labels[fileType as keyof typeof labels] || fileType;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] h-fit overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Asset Files
          </DialogTitle>
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
                            onClick={() => window.open(file.file_url, "_blank")}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFile(file)}
                          disabled={deletingFile === file.id}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
      </DialogContent>
    </Dialog>
  );
}
