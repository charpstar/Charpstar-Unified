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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { toast } from "@/components/ui/utilities";
import {
  CheckCircle,
  ArrowRight,
  Target,
  Image,
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

import { Input } from "@/components/ui/inputs";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { useRouter } from "next/navigation";
import { AddReferenceDialog } from "@/components/ui/containers/AddReferenceDialog";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import { notificationService } from "@/lib/notificationService";

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

  // Add new dialog states for reference management
  const [showAddRefDialog, setShowAddRefDialog] = useState(false);
  const [selectedAssetForRef, setSelectedAssetForRef] = useState<string | null>(
    null
  );
  const [selectedAssetForView, setSelectedAssetForView] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Add progress tracking for bulk operations
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    isActive: boolean;
    message: string;
  }>({
    current: 0,
    total: 0,
    isActive: false,
    message: "",
  });

  // Fetch assets for this client
  useEffect(() => {
    const fetchAssets = async () => {
      if (!user?.metadata?.client) return;
      setFetching(true);

      let query = supabase
        .from("onboarding_assets")
        .select("*")
        .eq("transferred", false)
        .eq("new_upload", true); // Only show assets uploaded via CSV in step 1

      // Filter by user's companies
      if (
        Array.isArray(user.metadata.client) &&
        user.metadata.client.length > 0
      ) {
        query = query.in("client", user.metadata.client);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching assets:", error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
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

  // Function to manually refresh assets data
  const refreshAssetsData = async () => {
    try {
      setFetching(true);

      let query = supabase
        .from("onboarding_assets")
        .select("*")
        .eq("transferred", false)
        .eq("new_upload", true)
        .order("created_at", { ascending: false });

      // Filter by user's companies
      if (
        Array.isArray(user?.metadata?.client) &&
        user.metadata.client.length > 0
      ) {
        query = query.in("client", user.metadata.client);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching assets:", error);
        return;
      }

      setAssets(data || []);
    } catch (error) {
      console.error("❌ Error refreshing assets:", error);
    } finally {
      setFetching(false);
    }
  };

  // Refresh a specific asset's reference/glb data
  const refreshAssetReferenceData = async (assetId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference, glb_link")
        .eq("id", assetId)
        .single();

      if (!error && data) {
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? { ...asset, reference: data.reference, glb_link: data.glb_link }
              : asset
          )
        );
      }
    } catch (error) {
      console.error("Error refreshing asset reference data:", error);
    }
  };

  // Function to test directly updating the reference field

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

  // Helper function to parse references
  const parseReferences = (
    referenceImages: string[] | string | null
  ): string[] => {
    if (!referenceImages) return [];
    if (Array.isArray(referenceImages)) return referenceImages;

    // Check if it's a string with ||| separator
    if (
      typeof referenceImages === "string" &&
      referenceImages.includes("|||")
    ) {
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

  // Helper function to separate GLB files from reference images
  const separateReferences = (referenceImages: string[] | string | null) => {
    const allReferences = parseReferences(referenceImages);
    const glbFiles = allReferences.filter((ref) =>
      ref.toLowerCase().endsWith(".glb")
    );
    const imageReferences = allReferences.filter(
      (ref) => !ref.toLowerCase().endsWith(".glb")
    );
    return { glbFiles, imageReferences };
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!user?.metadata?.client) return;

    const fileId = `${Date.now()}_${Math.random()}`;
    setUploadingFiles((prev) => ({ ...prev, [fileId]: true }));

    try {
      // Upload file to Supabase Storage
      // Use first company if user has multiple for storage path
      const clientFolder = Array.isArray(user.metadata.client)
        ? user.metadata.client[0]
        : user.metadata.client;
      const fileName = `reference-files/${clientFolder}/${Date.now()}_${file.name}`;

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

  // Handle adding reference URL to multiple assets (bulk)
  const handleAddBulkReferenceUrl = async () => {
    if (!referenceUrl.trim() || selected.size === 0) return;

    setLoading(true);
    const selectedAssetIds = Array.from(selected);

    // Initialize progress tracking
    setBulkProgress({
      current: 0,
      total: selectedAssetIds.length,
      isActive: true,
      message: "Adding reference URL to assets...",
    });

    try {
      // Validate URL format
      const url = new URL(referenceUrl.trim());
      if (!url.protocol.startsWith("http")) {
        toast({
          title: "Error",
          description: "Please enter a valid HTTP/HTTPS URL",
          variant: "destructive",
        });
        return;
      }

      // Update all selected assets with the new reference URL
      for (let i = 0; i < selectedAssetIds.length; i++) {
        const assetId = selectedAssetIds[i];
        const currentAsset = assets.find((asset) => asset.id === assetId);

        if (currentAsset) {
          const existingReferences = parseReferences(currentAsset.reference);
          const newReferences = [...existingReferences, referenceUrl.trim()];

          const { error } = await supabase
            .from("onboarding_assets")
            .update({ reference: newReferences })
            .eq("id", assetId);

          if (error) {
            console.error(`Error updating asset ${assetId}:`, error);
            throw error;
          }

          // Update progress
          setBulkProgress((prev) => ({
            ...prev,
            current: i + 1,
            message: `Updated asset ${i + 1} of ${selectedAssetIds.length}`,
          }));
        }
      }

      // Update local state
      setAssets((prev) =>
        prev.map((asset) => {
          if (selected.has(asset.id)) {
            const existingReferences = parseReferences(asset.reference);
            const newReferences = [...existingReferences, referenceUrl.trim()];
            return { ...asset, reference: newReferences };
          }
          return asset;
        })
      );

      toast({
        title: "Success",
        description: `Reference URL added to ${selectedAssetIds.length} assets successfully!`,
      });

      // Reset dialog state
      setReferenceUrl("");
      setSelected(new Set());
      setShowUploadDialog(false);
      setUploadMode("url");
    } catch (error) {
      console.error("Error adding bulk reference URL:", error);
      toast({
        title: "Error",
        description: "Failed to add reference URL to selected assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Reset progress tracking
      setBulkProgress({
        current: 0,
        total: 0,
        isActive: false,
        message: "",
      });
    }
  };

  // Handle file upload to multiple assets (bulk)
  const handleBulkFileUpload = async () => {
    if (!selectedFile || selected.size === 0) return;

    setLoading(true);
    const selectedAssetIds = Array.from(selected);

    // Initialize progress tracking
    setBulkProgress({
      current: 0,
      total: selectedAssetIds.length,
      isActive: true,
      message: "Uploading file to assets...",
    });

    try {
      // Upload file to each selected asset
      for (let i = 0; i < selectedAssetIds.length; i++) {
        const assetId = selectedAssetIds[i];
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("asset_id", assetId);

        // Determine file type based on extension
        const fileExtension = selectedFile.name.toLowerCase().split(".").pop();
        const fileType = fileExtension === "glb" ? "glb" : "reference";
        formData.append("file_type", fileType);

        // Update progress message
        setBulkProgress((prev) => ({
          ...prev,
          message: `Uploading to asset ${i + 1} of ${selectedAssetIds.length}...`,
        }));

        const response = await fetch("/api/assets/upload-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `Upload failed for asset ${assetId}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            // If response is not JSON (e.g., HTML error page), use status text
            errorMessage =
              response.status === 413
                ? `File too large for asset ${assetId}. Please compress the file or use a smaller file.`
                : `Upload failed for asset ${assetId}: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        // Update progress
        setBulkProgress((prev) => ({
          ...prev,
          current: i + 1,
          message: `Uploaded to asset ${i + 1} of ${selectedAssetIds.length}`,
        }));
      }

      // Refresh all affected assets
      setBulkProgress((prev) => ({
        ...prev,
        message: "Refreshing asset data...",
      }));

      // Wait a moment for the database to update, then refresh the asset data
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { error: fetchError } = await supabase
        .from("onboarding_assets")
        .select("id, reference, status, glb_link")
        .in("id", selectedAssetIds);

      if (fetchError) {
        console.error("Error fetching updated assets:", fetchError);
      }

      // Refresh the entire assets list to ensure UI is updated
      await refreshAssetsData();

      const fileType = selectedFile.name.toLowerCase().endsWith(".glb")
        ? "GLB"
        : "reference";
      toast({
        title: "Success",
        description: `${fileType} file uploaded to ${selectedAssetIds.length} assets successfully!`,
      });

      // Reset dialog state
      setSelectedFile(null);
      setSelected(new Set());
      setShowUploadDialog(false);
      setUploadMode("url");
    } catch (error) {
      console.error("Error in bulk file upload:", error);
      toast({
        title: "Error",
        description: "Failed to upload file to selected assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Reset progress tracking
      setBulkProgress({
        current: 0,
        total: 0,
        isActive: false,
        message: "",
      });
    }
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
      let refreshQuery = supabase
        .from("onboarding_assets")
        .select("*")
        .eq("transferred", false)
        .eq("new_upload", true);

      // Filter by user's companies
      if (
        Array.isArray(user?.metadata?.client) &&
        user.metadata.client.length > 0
      ) {
        refreshQuery = refreshQuery.in("client", user.metadata.client);
      }

      const { data } = await refreshQuery;

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

      // Send admin notification now that products are uploaded and references done
      try {
        // Use first company if user has multiple
        const clientName = Array.isArray(user?.metadata?.client)
          ? user.metadata.client[0]
          : user?.metadata?.client;

        await notificationService.sendProductSubmissionNotification({
          client: clientName || "Unknown Client",
          batch: 1,
          productCount: assets.length,
          productNames: assets.map((a) => a.product_name).filter(Boolean),
          submittedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to send product submission notification:", err);
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
    <div className="">
      {/* Completion Animation Overlay */}
      {showCompletionAnimation && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-foreground flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-background" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Reference Images Complete!
              </h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to onboarding dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <Card className="border">
          <CardContent className="pt-6 pb-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Image className="h-6 w-6 text-muted-foreground" />
                <h1 className="text-2xl font-semibold text-foreground">
                  Reference Files Upload
                </h1>
              </div>

              <div className="max-w-3xl mx-auto space-y-4">
                <div className="bg-muted/50 border rounded-lg p-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-medium text-foreground">
                      Reference files are optional but recommended
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We&apos;ll use reference images from your product links,
                      but any additional reference files you upload (images,
                      videos, PDFs, 3D models, CAD files, etc.) will help our 3D
                      modelers understand your requirements better.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        Upload unlimited files and remove them as needed
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 border rounded-lg p-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-medium text-foreground">
                      How to add references:
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground"></span>
                        <span>
                          Click the{" "}
                          <span className="font-medium bg-muted px-2 py-0.5 rounded text-xs">
                            &quot;Ref&quot;
                          </span>{" "}
                          button next to any product
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground"></span>
                        <span>
                          Select multiple products and use the{" "}
                          <span className="font-medium bg-muted px-2 py-0.5 rounded text-xs">
                            &quot;Upload to X Assets&quot;
                          </span>{" "}
                          button
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
                    className="bg-foreground h-2 rounded-full transition-all duration-500"
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
                    Upload to {selected.size} assets
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
              <div className="overflow-x-auto rounded-lg border bg-background flex-1 max-h-[50vh] min-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-left">
                        <Checkbox
                          checked={selected.size === assets.length}
                          onCheckedChange={(checked) =>
                            checked ? selectAll() : deselectAll()
                          }
                        />
                      </TableHead>
                      <TableHead className="text-left font-semibold text-foreground">
                        Product
                      </TableHead>
                      <TableHead className="text-left font-semibold text-foreground">
                        Article ID
                      </TableHead>
                      <TableHead className="text-left font-semibold text-foreground">
                        References
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => {
                      // Debug logging

                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="text-left">
                            <Checkbox
                              checked={selected.has(asset.id)}
                              onCheckedChange={() => toggleSelect(asset.id)}
                            />
                          </TableCell>
                          <TableCell className="text-left">
                            <div>
                              <p
                                className="font-semibold text-foreground truncate max-w-[200px] cursor-help"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 35
                                  ? asset.product_name.substring(0, 35) + "..."
                                  : asset.product_name}
                              </p>
                              <p className="text-sm text-foreground/70 font-medium">
                                {asset.category}{" "}
                                {asset.subcategory && `• ${asset.subcategory}`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <code className="text-sm bg-foreground/10 text-foreground px-3 py-1.5 rounded-md font-mono font-medium">
                              {asset.article_id}
                            </code>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex flex-col items-start gap-1 text-left justify-start">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs px-3 py-1 h-7 text-left justify-start"
                                onClick={() => {
                                  setSelectedAssetForView(asset);
                                  setShowViewDialog(true);
                                }}
                              >
                                <FileText className="mr-1 h-3 w-3" />
                                Ref (
                                {separateReferences(asset.reference)
                                  .imageReferences.length +
                                  separateReferences(asset.reference).glbFiles
                                    .length}
                                )
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
                  Complete Reference Files
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className=" h-fit overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Image className="h-5 w-5 text-primary" />
                {selectedAsset
                  ? "Upload Reference Files"
                  : `Upload to ${selected.size} Assets`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 border rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      Reference files upload
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reference images will be added from your product links, but
                    any additional reference files you upload will help our
                    modelers significantly.
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong>For single products:</strong> Drag & drop files or
                      click &quot;Browse Files&quot;
                    </p>
                    <p>
                      <strong>For multiple products:</strong> Enter a URL or
                      select a file to upload to all selected assets
                    </p>
                    <p>
                      <strong>Supported types:</strong> Images, Videos, PDFs, 3D
                      models, CAD files, archives
                    </p>
                  </div>
                  {!selectedAsset && selected.size > 0 && (
                    <p className="text-sm font-medium text-foreground">
                      These files will be uploaded to all {selected.size}{" "}
                      selected assets.
                    </p>
                  )}
                </div>
              </div>

              {/* Mode Toggle for Bulk Upload */}
              {!selectedAsset && selected.size > 0 && (
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <Button
                    variant={uploadMode === "url" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setUploadMode("url")}
                    className="flex-1"
                  >
                    URL
                  </Button>
                  <Button
                    variant={uploadMode === "file" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setUploadMode("file")}
                    className="flex-1"
                  >
                    File Upload
                  </Button>
                </div>
              )}

              {/* URL Input for Bulk Upload */}
              {!selectedAsset && selected.size > 0 && uploadMode === "url" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Reference Image URL *
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddBulkReferenceUrl();
                      }
                    }}
                    className="border-border focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    This URL will be added to all {selected.size} selected
                    assets.
                  </p>
                </div>
              )}

              {/* Progress Bar for Bulk Operations */}
              {bulkProgress.isActive && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {bulkProgress.message}
                    </span>
                    <span className="text-muted-foreground">
                      {bulkProgress.current} / {bulkProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-foreground h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {bulkProgress.total > 0
                      ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}% complete`
                      : "0% complete"}
                  </div>
                </div>
              )}

              {/* File Upload for Bulk Upload */}
              {!selectedAsset && selected.size > 0 && uploadMode === "file" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Upload Reference File *
                  </label>
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.glb"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    className="border-border focus:border-primary"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} (
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB) - This
                      file will be uploaded to all {selected.size} selected
                      assets.
                    </p>
                  )}
                </div>
              )}

              {/* Upload Area - Only show for single asset or when not in bulk mode */}
              {selectedAsset || selected.size === 0 ? (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    dragOver
                      ? "border-foreground bg-muted/50"
                      : "border-muted-foreground/30 hover:border-foreground/50 hover:bg-muted/30"
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
                    <div className="space-y-3">
                      <div className="h-8 w-8 mx-auto border-2 border-muted-foreground/20 border-t-foreground rounded-full animate-spin" />
                      <p className="text-base font-medium text-foreground">
                        Uploading files...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Please wait while your files are being uploaded
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div>
                        <p className="text-base font-medium text-foreground">
                          Drop files here
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse files
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
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
              ) : null}

              {/* Uploaded Files List - Only show for single asset */}
              {selectedAsset && uploadedFiles.length > 0 && (
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
                    setReferenceUrl("");
                    setSelectedFile(null);
                    setUploadMode("url");
                    // Reset progress tracking
                    setBulkProgress({
                      current: 0,
                      total: 0,
                      isActive: false,
                      message: "",
                    });
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    if (selectedAsset) {
                      saveReferences();
                    } else if (uploadMode === "url") {
                      handleAddBulkReferenceUrl();
                    } else {
                      handleBulkFileUpload();
                    }
                  }}
                  loading={loading}
                  disabled={
                    selectedAsset
                      ? uploadedFiles.length === 0
                      : uploadMode === "url"
                        ? !referenceUrl.trim()
                        : !selectedFile
                  }
                >
                  <Save className="h-4 w-4 mr-2" />
                  {selectedAsset
                    ? "Save Files"
                    : uploadMode === "url"
                      ? `Add URL to ${selected.size} Assets`
                      : `Upload to ${selected.size} Assets`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Reference Dialog (Reusable) */}
        <AddReferenceDialog
          open={showAddRefDialog}
          onOpenChange={(open) => {
            setShowAddRefDialog(open);
            if (!open && selectedAssetForRef) {
              refreshAssetReferenceData(selectedAssetForRef);
            }
          }}
          assetId={selectedAssetForRef}
          onUploadComplete={() => {
            if (selectedAssetForRef) {
              refreshAssetReferenceData(selectedAssetForRef);
            }
          }}
        />

        {/* View References Dialog (Reusable) */}
        <ViewReferencesDialog
          open={showViewDialog}
          onOpenChange={(open) => {
            setShowViewDialog(open);
            if (!open && selectedAssetForView?.id) {
              refreshAssetReferenceData(selectedAssetForView.id);
            }
          }}
          asset={selectedAssetForView}
          onAddReference={() => {
            setSelectedAssetForRef(selectedAssetForView?.id);
            setShowViewDialog(false);
            setShowAddRefDialog(true);
          }}
        />
      </div>
    </div>
  );
}
