"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoading } from "@/contexts/LoadingContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { toast } from "@/components/ui/utilities";
import {
  Paperclip,
  Eye,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Target,
  Image,
  Plus,
  Trophy,
  Star,
  Camera,
  Save,
  Upload,
  File,
  FileText,
  FileImage,
  FileArchive,
  Trash2,
  Download,
  FileVideo,
  Package,
} from "lucide-react";

import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui";
import { useRouter } from "next/navigation";

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export default function ReferenceImagesPage() {
  const user = useUser();
  const { startLoading } = useLoading();
  const router = useRouter();

  const [assets, setAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: boolean;
  }>({});
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingFiles, setViewingFiles] = useState<UploadedFile[]>([]);

  // Fetch assets for this client
  useEffect(() => {
    const fetchAssets = async () => {
      if (!user?.metadata?.client) return;
      setFetching(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user.metadata.client);
      if (error)
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      else {
        // Sort assets by article_id
        const sortedData = (data || []).sort((a, b) => {
          const articleIdA = a.article_id || "";
          const articleIdB = b.article_id || "";
          return articleIdA.localeCompare(articleIdB);
        });
        setAssets(sortedData);
      }
      setFetching(false);
    };
    fetchAssets();
  }, [user]);

  // Helper to always get references as an array
  function getReferenceArray(ref: string | string[] | undefined): string[] {
    if (Array.isArray(ref)) return ref;
    if (typeof ref === "string" && ref.startsWith("[")) {
      try {
        return JSON.parse(ref);
      } catch {
        return [];
      }
    }
    return ref ? [ref] : [];
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!user?.metadata?.client) return;

    const fileId = `${Date.now()}_${Math.random()}`;
    setUploadingFiles((prev) => ({ ...prev, [fileId]: true }));

    try {
      // Upload file to Supabase Storage
      const fileName = `reference-files/${user.metadata.client}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(fileName);

      // Add to uploaded files list
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
      };

      setUploadedFiles((prev) => [...prev, newFile]);

      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => handleFileUpload(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => handleFileUpload(file));
    e.target.value = ""; // Reset input
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const removeViewingFile = (fileId: string) => {
    setViewingFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleViewReferences = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    const refs = getReferenceArray(asset?.reference);

    const files: UploadedFile[] = refs.map((url, index) => ({
      id: `existing_${index}`,
      name: url.split("/").pop() || `File ${index + 1}`,
      url,
      type: "unknown",
      size: 0,
      uploadedAt: new Date(),
    }));

    setViewingFiles(files);
    setSelectedAsset(assetId);
    setShowViewDialog(true);
  };

  const getFileIcon = (fileName: string, fileType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();

    // Image files
    if (
      ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"].includes(
        ext || ""
      )
    ) {
      return <FileImage className="h-4 w-4" />;
    }

    // Video files
    if (
      ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v"].includes(
        ext || ""
      ) ||
      fileType.startsWith("video/")
    ) {
      return <FileVideo className="h-4 w-4" />;
    }

    // PDF files
    if (["pdf"].includes(ext || "") || fileType === "application/pdf") {
      return <FileText className="h-4 w-4" />;
    }

    // Archive files
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
      return <FileArchive className="h-4 w-4" />;
    }

    // 3D model files
    if (
      [
        "glb",
        "gltf",
        "obj",
        "fbx",
        "stl",
        "dae",
        "3ds",
        "max",
        "blend",
      ].includes(ext || "")
    ) {
      return <File className="h-4 w-4" />;
    }

    // CAD files
    if (["dwg", "dxf", "step", "stp", "iges", "igs"].includes(ext || "")) {
      return <File className="h-4 w-4" />;
    }

    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Save references to asset
  const saveReferences = async () => {
    if (!selectedAsset || uploadedFiles.length === 0) return;

    setLoading(true);
    try {
      const fileUrls = uploadedFiles.map((file) => file.url);

      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: fileUrls })
        .eq("id", selectedAsset);

      if (error) {
        throw error;
      }

      toast({
        title: "References saved",
        description: "Reference files have been saved to the asset.",
      });

      // Refresh assets
      const { data } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user?.metadata.client);

      // Sort assets by article_id
      const sortedData = (data || []).sort((a, b) => {
        const articleIdA = a.article_id || "";
        const articleIdB = b.article_id || "";
        return articleIdA.localeCompare(articleIdB);
      });
      setAssets(sortedData);

      // Reset state
      setUploadedFiles([]);
      setSelectedAsset(null);
      setShowUploadDialog(false);
    } catch (error) {
      console.error("Error saving references:", error);
      toast({
        title: "Error",
        description: "Failed to save references. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save references to multiple assets (bulk upload)
  const saveBulkReferences = async () => {
    if (selected.size === 0 || uploadedFiles.length === 0) return;

    setLoading(true);
    try {
      const fileUrls = uploadedFiles.map((file) => file.url);
      const selectedAssetIds = Array.from(selected);

      // Update all selected assets with the same reference files
      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: fileUrls })
        .in("id", selectedAssetIds);

      if (error) {
        throw error;
      }

      toast({
        title: "Bulk upload successful",
        description: `Reference files have been saved to ${selectedAssetIds.length} assets.`,
      });

      // Refresh assets
      const { data } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user?.metadata.client);

      // Sort assets by article_id
      const sortedData = (data || []).sort((a, b) => {
        const articleIdA = a.article_id || "";
        const articleIdB = b.article_id || "";
        return articleIdA.localeCompare(articleIdB);
      });
      setAssets(sortedData);

      // Reset state
      setUploadedFiles([]);
      setSelectedAsset(null);
      setShowUploadDialog(false);
      setSelected(new Set()); // Clear selection after bulk upload
    } catch (error) {
      console.error("Error saving bulk references:", error);
      toast({
        title: "Error",
        description:
          "Failed to save references to selected assets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save changes from view dialog
  const saveViewChanges = async () => {
    if (!selectedAsset) return;

    setLoading(true);
    try {
      const fileUrls = viewingFiles.map((file) => file.url);

      const { error } = await supabase
        .from("onboarding_assets")
        .update({ reference: fileUrls })
        .eq("id", selectedAsset);

      if (error) {
        throw error;
      }

      toast({
        title: "Changes saved",
        description: "Reference files have been updated.",
      });

      // Refresh assets
      const { data } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user?.metadata.client);

      // Sort assets by article_id
      const sortedData = (data || []).sort((a, b) => {
        const articleIdA = a.article_id || "";
        const articleIdB = b.article_id || "";
        return articleIdA.localeCompare(articleIdB);
      });
      setAssets(sortedData);

      // Reset state
      setViewingFiles([]);
      setSelectedAsset(null);
      setShowViewDialog(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    setSelected(new Set(assets.map((a) => a.id)));
  };
  const deselectAll = () => setSelected(new Set());

  // Complete reference images step and redirect to dashboard
  const handleCompleteReferenceImages = async () => {
    if (!user) return;

    setCompleting(true);
    setShowCompletionAnimation(true);

    try {
      // Update user's onboarding progress using the proper API endpoint
      const response = await fetch("/api/users/complete-reference-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Error",
          description:
            errorData.error || "Failed to update progress. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reference Images Complete!",
        description: "You've successfully completed the reference images step.",
      });

      // Wait for animation, then redirect with page reload to refresh user metadata
      setTimeout(() => {
        startLoading(); // Start loading before redirect
        router.push("/dashboard?refreshUser=1");
      }, 2000);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  if (!user) {
    return null;
  }

  // Calculate progress
  const totalAssets = assets.length;
  const assetsWithReferences = assets.filter((asset) => {
    const refs = getReferenceArray(asset.reference);
    return refs.length > 0;
  }).length;
  const progressPercentage =
    totalAssets > 0 ? (assetsWithReferences / totalAssets) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Completion Animation Overlay */}
      {showCompletionAnimation && (
        <div className="fixed inset-0 bg-gradient-to-b from-transparent to-background/80 z-50 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Trophy className="h-12 w-12 text-white" />
              </div>
              <Sparkles className="h-8 w-8 text-yellow-500 absolute -top-3 -right-3 animate-pulse" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -bottom-2 -left-2 animate-pulse delay-300" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Reference Images Complete! 🎉
              </h3>
              <p className="text-muted-foreground">
                Redirecting to onboarding dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6 space-y-6">
        {/* Enhanced Header */}
        <Card className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
          <CardContent className="relative pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                  <Image className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Reference Files Upload
                </h1>
              </div>

              <p className="max-w-7xl text-lg text-muted-foreground mx-auto leading-relaxed">
                <strong>
                  Reference files are optional but highly recommended!
                </strong>{" "}
                Upload any type of reference files (images, videos, PDFs, 3D
                models, CAD files, etc.) to help our 3D modelers understand your
                requirements. You can upload unlimited files and remove them as
                needed.
              </p>

              {/* Progress Overview */}
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span>{totalAssets} products</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>{assetsWithReferences} with references</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span>{Math.round(progressPercentage)}% complete</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/60 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span>Your Products</span>
              </div>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selected.size} selected
                  </span>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedAsset(null); // Clear single asset selection
                      setUploadedFiles([]);
                      setShowUploadDialog(true);
                    }}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload to {selected.size} Assets
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No products found. Please upload your CSV file first.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3">
                        <Input
                          type="checkbox"
                          checked={selected.size === assets.length}
                          onChange={(e) =>
                            e.target.checked ? selectAll() : deselectAll()
                          }
                          className="rounded h-4 w-4"
                          aria-invalid="false"
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Product</th>
                      <th className="text-left p-3 font-medium">Article ID</th>
                      <th className="text-left p-3 font-medium">References</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const refs = getReferenceArray(asset.reference);
                      const hasReferences = refs.length > 0;

                      return (
                        <tr
                          key={asset.id}
                          className="border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3">
                            <Input
                              type="checkbox"
                              checked={selected.has(asset.id)}
                              onChange={() => toggleSelect(asset.id)}
                              className="rounded h-4 w-4"
                              aria-invalid="false"
                            />
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">
                                {asset.product_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {asset.category}{" "}
                                {asset.subcategory && `• ${asset.subcategory}`}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {asset.article_id}
                            </code>
                          </td>
                          <td className="p-3">
                            {hasReferences ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {refs.length} file
                                  {refs.length !== 1 ? "s" : ""}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewReferences(asset.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <Paperclip className="h-3 w-3" />
                                No files
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAsset(asset.id);
                                  setUploadedFiles([]);
                                  setShowUploadDialog(true);
                                }}
                                className="h-8 w-8 p-0 hover:bg-primary/10 cursor-pointer"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Completion Button */}
        {assets.length > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={handleCompleteReferenceImages}
              loading={completing}
              size="lg"
              variant="default"
            >
              {completing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Complete Reference Files
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Image className="h-5 w-5 text-primary" />
                {selectedAsset
                  ? "Upload Reference Files"
                  : `Upload to ${selected.size} Assets`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertDescription>
                  <strong>Supported file types:</strong> Images (JPG, PNG, GIF,
                  etc.), Videos (MP4, AVI, MOV, etc.), PDFs, 3D models (GLB,
                  OBJ, FBX, STL, etc.), CAD files (DWG, STEP, etc.), and
                  archives (ZIP, RAR, etc.). You can upload unlimited files and
                  remove them as needed.
                  {!selectedAsset && selected.size > 0 && (
                    <span className="block mt-2 font-medium text-primary">
                      These files will be uploaded to all {selected.size}{" "}
                      selected assets.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {/* Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                  dragOver
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Input
                  type="file"
                  id="file-input"
                  className="hidden"
                  accept="*/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={loading}
                />

                {Object.values(uploadingFiles).some(Boolean) ? (
                  <div className="space-y-4">
                    <div className="h-12 w-12 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-lg font-semibold">Uploading files...</p>
                    <p className="text-sm text-muted-foreground">
                      Please wait while your files are being uploaded
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold">Drop files here</p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse files
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        document.getElementById("file-input")?.click()
                      }
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Uploaded Files</h3>
                  <div className="grid gap-3 max-h-60 overflow-y-auto">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileIcon(file.name, file.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)} •{" "}
                              {file.uploadedAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.url, "_blank")}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadDialog(false);
                    setUploadedFiles([]);
                    setSelectedAsset(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={selectedAsset ? saveReferences : saveBulkReferences}
                  loading={loading}
                  disabled={uploadedFiles.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {selectedAsset
                    ? "Save Files"
                    : `Save to ${selected.size} Assets`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Reference Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="h-5 w-5 text-primary" />
                View Reference Files
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertDescription>
                  <strong>Manage your reference files:</strong> You can view,
                  download, and remove files. Click &quot;Save Changes&quot; to
                  apply your modifications.
                </AlertDescription>
              </Alert>

              {/* Files List */}
              {viewingFiles.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Reference Files</h3>
                  <div className="grid gap-3 max-h-60 overflow-y-auto">
                    {viewingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileIcon(file.name, file.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.uploadedAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.url, "_blank")}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeViewingFile(file.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No reference files found
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false);
                    setViewingFiles([]);
                    setSelectedAsset(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={saveViewChanges}
                  loading={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
