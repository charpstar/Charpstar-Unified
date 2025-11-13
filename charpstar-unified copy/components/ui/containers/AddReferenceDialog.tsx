"use client";
import { useState, useRef, useMemo } from "react";
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
import { useUser } from "@/contexts/useUser";

type ReferenceVisibility = "client" | "internal";

const parseStoredReferences = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.includes("|||")) {
      return trimmed
        .split("|||")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      trimmed.startsWith('"')
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
        }
      } catch {
        // Fallback to treating as single value
      }
    }

    return [trimmed];
  }

  return [];
};

const serializeStoredReferences = (
  refs: string[],
  originalValue?: unknown
): string | string[] | null => {
  if (!refs.length) return null;

  if (Array.isArray(originalValue)) {
    return refs;
  }

  if (typeof originalValue === "string") {
    const trimmed = originalValue.trim();
    if (trimmed.includes("|||")) {
      return refs.join("|||");
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        JSON.parse(trimmed);
        return JSON.stringify(refs);
      } catch {
        // Fallthrough
      }
    }

    if (refs.length === 1) {
      return refs[0];
    }

    return refs.join("|||");
  }

  return refs.join("|||");
};

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
  const [uploadMode, setUploadMode] = useState<"url" | "file" | "measurements">(
    "url"
  );
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
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const user = useUser();
  const userRole = (user?.metadata?.role || "").toString().toLowerCase();
  const canUseInternalReferences = useMemo(
    () => userRole !== "client" && userRole !== "",
    [userRole]
  );
  const [visibility, setVisibility] = useState<ReferenceVisibility>("client");

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
          visibility,
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
      // First, fetch the asset to get the client name and other details for notifications
      const { supabase } = await import("@/lib/supabaseClient");

      const baseQuery = supabase
        .from("onboarding_assets")
        .select("client, product_name, reference, internal_reference")
        .eq("id", assetId);

      const { data: asset, error: assetError } = await baseQuery.single();

      let resolvedAsset = asset as
        | (typeof asset & { internal_reference?: unknown })
        | null;
      let resolvedError = assetError;
      let internalReferencesSupported = true;

      if (resolvedError && resolvedError.code === "42703") {
        internalReferencesSupported = false;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("onboarding_assets")
          .select("client, product_name, reference")
          .eq("id", assetId)
          .single();

        if (!fallbackError && fallbackData) {
          resolvedAsset = { ...fallbackData } as typeof resolvedAsset;
          resolvedError = null;
        } else {
          resolvedError = fallbackError ?? resolvedError;
        }
      }

      if (resolvedError || !resolvedAsset) {
        throw new Error("Failed to get asset client name");
      }

      if (!internalReferencesSupported && visibility === "internal") {
        toast.error(
          "Internal references are not enabled yet. Please add the internal_reference column or choose Client visibility."
        );
        setUploading(false);
        setUploadProgress(null);
        setVisibility("client");
        return;
      }

      const assetData = resolvedAsset;
      const assetClientName =
        (assetData.client || "Internal").trim() || "Internal";

      // Upload files sequentially and collect URLs
      const uploadedUrls: string[] = [];

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        setUploadProgress({
          current: i + 1,
          total: allFiles.length,
          fileName: file.name,
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("client_name", assetClientName);

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
          } catch {
            // If response is not JSON (e.g., HTML error page), use status text
            details =
              response.status === 413
                ? "File too large. Please compress the file or use a smaller file."
                : `Upload failed: ${response.status} ${response.statusText}`;
          }
          throw new Error(
            `Upload failed for ${file.name}${details ? `: ${details}` : ""}`
          );
        }

        // Get the uploaded file URL
        const uploadData = await response.json();
        if (uploadData.url) {
          uploadedUrls.push(uploadData.url);
        }
      }

      // Add uploaded URLs to the asset's references
      if (uploadedUrls.length > 0) {
        const existingReferenceValue =
          visibility === "internal"
            ? (assetData as any).internal_reference
            : assetData.reference;

        const existingReferences = parseStoredReferences(
          existingReferenceValue
        );
        const updatedReferences = [...existingReferences, ...uploadedUrls];
        const serialized = serializeStoredReferences(
          updatedReferences,
          existingReferenceValue
        );

        const updatePayload =
          visibility === "internal"
            ? { internal_reference: serialized }
            : { reference: serialized };

        const { error: updateError } = await supabase
          .from("onboarding_assets")
          .update(updatePayload)
          .eq("id", assetId);

        if (updateError) {
          throw updateError;
        }

        // Send notification to QA, production, and admin if updated by a client
        try {
          // Get current user's profile to check if they're a client
          const {
            data: { user },
          } = await supabase.auth.getUser();

          console.log(
            "📋 [AddReferenceDialog] Getting user profile for notification..."
          );

          if (user) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("role, title")
              .eq("id", user.id)
              .single();

            console.log("📋 [AddReferenceDialog] User profile:", {
              role: profile?.role,
              title: profile?.title,
              userId: user.id,
              email: user.email,
              profileError,
            });

            if (profile?.role === "client") {
              console.log(
                "🔔 [AddReferenceDialog] User is a client, sending notification..."
              );

              // Import notification service
              const { notificationService } = await import(
                "@/lib/notificationService"
              );

              await notificationService.sendClientAssetUpdateNotification({
                assetId: assetId,
                assetName: assetData.product_name || "Unknown Asset",
                clientName: assetClientName || "Unknown Client",
                updateType: "references",
                updatedFields: ["reference"],
                updatedBy: profile.title || user.email || "Unknown User",
                updatedAt: new Date().toISOString(),
              });

              console.log(
                "✅ [AddReferenceDialog] Successfully triggered notification service"
              );
            } else {
              console.log(
                `ℹ️ [AddReferenceDialog] Skipping notification - user role is '${profile?.role}', not 'client'`
              );
            }
          }
        } catch (notificationError) {
          console.error(
            "❌ [AddReferenceDialog] Failed to send notification:",
            notificationError
          );
          // Don't fail the upload if notification fails
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
      setVisibility("client");

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

  // Handle adding measurements
  const handleAddMeasurements = async () => {
    if (!assetId || !height.trim() || !width.trim() || !depth.trim()) {
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

    try {
      const { supabase } = await import("@/lib/supabaseClient");

      // Store measurements as "H,W,D" format in millimeters
      const measurementsString = `${h},${w},${d}`;

      const { error } = await supabase
        .from("onboarding_assets")
        .update({ measurements: measurementsString })
        .eq("id", assetId);

      if (error) {
        console.error("Error updating measurements:", error);
        toast.error("Failed to save measurements");
        return;
      }

      // Send notification to QA and admin if updated by a client
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, title")
            .eq("id", user.id)
            .single();

          const { data: asset } = await supabase
            .from("onboarding_assets")
            .select("product_name, client")
            .eq("id", assetId)
            .single();

          if (profile?.role === "client") {
            const { notificationService } = await import(
              "@/lib/notificationService"
            );

            await notificationService.sendClientAssetUpdateNotification({
              assetId: assetId,
              assetName: asset?.product_name || "Unknown Asset",
              clientName: asset?.client || "Unknown Client",
              updateType: "measurements",
              updatedFields: ["measurements"],
              updatedBy: profile.title || user.email || "Unknown User",
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to send notification:", notificationError);
      }

      toast.success("Measurements saved successfully!");

      // Reset dialog state
      setHeight("");
      setWidth("");
      setDepth("");
      onOpenChange(false);

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Error saving measurements:", error);
      toast.error("Failed to save measurements");
    }
  };

  const resetDialog = () => {
    setReferenceUrl("");
    setDroppedFiles([]);
    setPastedImages([]);
    setFileError(null);
    setUploadProgress(null);
    setDraggedFileIndex(null);
    setHeight("");
    setWidth("");
    setDepth("");
    setUploadMode("url");
    setVisibility("client");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-[500px] h-fit dark:bg-background dark:border-border"
        onPaste={handlePaste}
        tabIndex={-1}
      >
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground dark:text-foreground">
            Add Reference, GLB File, or Measurements
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            Add a reference image URL, upload a reference/GLB file, or enter
            product measurements.
          </DialogDescription>
        </DialogHeader>

        {canUseInternalReferences && (
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-semibold text-foreground dark:text-foreground">
              Visibility
            </label>
            <div className="flex gap-1 sm:gap-2 p-1 bg-muted dark:bg-muted/20 rounded-lg">
              <Button
                variant={visibility === "client" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVisibility("client")}
                className="flex-1 dark:hover:bg-muted/50 text-xs sm:text-sm h-7 sm:h-8"
              >
                Client
              </Button>
              <Button
                variant={visibility === "internal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVisibility("internal")}
                className="flex-1 dark:hover:bg-muted/50 text-xs sm:text-sm h-7 sm:h-8"
              >
                Internal
              </Button>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground dark:text-muted-foreground">
              Internal references are only visible to Charpstar staff. Clients
              will continue to see only client-visible references.
            </p>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-muted dark:bg-muted/20 rounded-lg">
          <Button
            variant={uploadMode === "url" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("url")}
            className="flex-1 dark:hover:bg-muted/50 text-xs sm:text-sm h-7 sm:h-8"
          >
            URL
          </Button>
          <Button
            variant={uploadMode === "file" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("file")}
            className="flex-1 dark:hover:bg-muted/50 text-xs sm:text-sm h-7 sm:h-8"
          >
            <span className="hidden sm:inline">File Upload</span>
            <span className="sm:hidden">Upload</span>
          </Button>
          <Button
            variant={uploadMode === "measurements" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("measurements")}
            className="flex-1 dark:hover:bg-muted/50 text-xs sm:text-sm h-7 sm:h-8"
          >
            <span className="hidden sm:inline">Measurements</span>
            <span className="sm:hidden">Size</span>
          </Button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {uploadMode === "url" ? (
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground dark:text-foreground">
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
                className="border-border focus:border-primary dark:bg-background dark:border-border dark:text-foreground text-sm sm:text-base h-8 sm:h-9"
              />
            </div>
          ) : uploadMode === "measurements" ? (
            <div className="space-y-3">
              <label className="text-xs sm:text-sm font-semibold text-foreground dark:text-foreground">
                Product Measurements (in millimeters) *
              </label>
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
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground dark:text-foreground">
                Upload File *
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-all duration-200 ${
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
                  <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
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
                  <div className="mt-2 sm:mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded">
                    <p className="text-xs text-destructive font-medium">
                      {fileError}
                    </p>
                  </div>
                )}
                {(droppedFiles.length > 0 || pastedImages.length > 0) && (
                  <div className="mt-2 sm:mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {droppedFiles.length + pastedImages.length} file
                      {droppedFiles.length + pastedImages.length > 1
                        ? "s"
                        : ""}{" "}
                      selected:
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDroppedFiles([]);
                          setPastedImages([]);
                        }}
                        className="h-6 text-xs hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto"
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

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-border dark:border-border">
          <Button
            onClick={() => {
              resetDialog();
              onOpenChange(false);
            }}
            variant="outline"
            className="cursor-pointer dark:border-border dark:hover:bg-muted/50 w-full sm:w-auto text-sm h-8 sm:h-9"
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={
              uploadMode === "url"
                ? handleAddReferenceUrl
                : uploadMode === "measurements"
                  ? handleAddMeasurements
                  : handleMultipleFileUpload
            }
            disabled={
              uploading ||
              (uploadMode === "url"
                ? !referenceUrl.trim()
                : uploadMode === "measurements"
                  ? !height.trim() || !width.trim() || !depth.trim()
                  : droppedFiles.length === 0 && pastedImages.length === 0)
            }
            className="cursor-pointer w-full sm:w-auto text-sm h-8 sm:h-9"
          >
            {uploading ? (
              <>
                <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1 sm:mr-2" />
                <span className="hidden sm:inline">
                  {uploadProgress
                    ? `Uploading ${uploadProgress.current}/${uploadProgress.total}: ${uploadProgress.fileName}`
                    : "Uploading..."}
                </span>
                <span className="sm:hidden">
                  {uploadProgress
                    ? `Uploading ${uploadProgress.current}/${uploadProgress.total}`
                    : "Uploading..."}
                </span>
              </>
            ) : uploadMode === "measurements" ? (
              "Save Measurements"
            ) : (
              `Add ${uploadMode === "url" ? "URL" : droppedFiles.length + pastedImages.length > 1 ? `${droppedFiles.length + pastedImages.length} Files` : "File"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
