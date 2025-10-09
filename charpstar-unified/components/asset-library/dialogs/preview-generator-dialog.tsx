"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PreviewGeneratorDialogContent,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback";
import {
  Loader2,
  Camera,
  CheckCircle,
  RotateCcw,
  Eye,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useAssets } from "@/hooks/use-assets";

interface Asset {
  id: string;
  product_name: string;
  product_link: string;
  glb_link: string;
  category: string;
  subcategory: string;
  client: string;
  materials: string[];
  colors: string[];
  tags: string[];
  preview_image: string | string[];
  created_at: string;
}

interface PreviewGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FailedAsset {
  id: string;
  error: string;
  retryCount: number;
}

export function PreviewGeneratorDialog({
  isOpen,
  onClose,
}: PreviewGeneratorDialogProps) {
  const { assets, refetch } = useAssets();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string>("");
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [retakeAll, setRetakeAll] = useState(false);
  const [failedAssets, setFailedAssets] = useState<FailedAsset[]>([]);
  const [checkingUrls, setCheckingUrls] = useState(false);
  const [urlCheckResults, setUrlCheckResults] = useState<{
    total: number;
    missing: number;
  } | null>(null);
  const [urlCheckProgress, setUrlCheckProgress] = useState(0);
  const [currentCheckingAsset, setCurrentCheckingAsset] = useState<string>("");
  const [failedUrls, setFailedUrls] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const modelViewerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const assetsNeedingPreview = retakeAll
    ? assets.filter((asset) => asset.glb_link).slice(0, 4000)
    : assets
        .filter((asset) => !asset.preview_image && asset.glb_link)
        .slice(0, 4000);

  useEffect(() => {
    if (!isOpen) return;

    const script = document.createElement("script");
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js";
    script.type = "module";
    script.onload = () => setModelViewerLoaded(true);
    document.head.appendChild(script);
    return () => {
      setModelViewerLoaded(false);
      const existingScript = document.querySelector(
        `script[src="${script.src}"]`
      );
      if (existingScript) document.head.removeChild(existingScript);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (processing) processingRef.current = false;
    onClose();
  };

  const checkPreviewUrls = async () => {
    setCheckingUrls(true);
    setUrlCheckResults(null);
    setUrlCheckProgress(0);
    setFailedUrls([]);
    let missing = 0;
    let total = 0;
    let checked = 0;

    const assetsWithPreviews = assets
      .filter((a) => a.preview_image)
      .slice(0, 4000);
    const totalToCheck = assetsWithPreviews.length;

    for (const asset of assetsWithPreviews) {
      setCurrentCheckingAsset(asset.product_name);
      const previewUrl = Array.isArray(asset.preview_image)
        ? asset.preview_image[0]
        : asset.preview_image;

      try {
        const response = await fetch(previewUrl, { method: "HEAD" });
        if (response.status !== 200) {
          missing++;
          setFailedUrls((prev) => [
            ...prev,
            {
              id: asset.id,
              name: asset.product_name,
              url: previewUrl,
            },
          ]);
        }
      } catch {
        missing++;
        setFailedUrls((prev) => [
          ...prev,
          {
            id: asset.id,
            name: asset.product_name,
            url: previewUrl,
          },
        ]);
      }
      total++;
      checked++;
      setUrlCheckProgress(Math.round((checked / totalToCheck) * 100));
    }

    setUrlCheckResults({ total, missing });
    setCheckingUrls(false);
    setCurrentCheckingAsset("");
  };

  const waitForModelLoad = async (
    modelViewer: any,
    asset: Asset
  ): Promise<void> => {
    let cleanup: (() => void) | undefined;

    try {
      return await new Promise((resolve, reject) => {
        if (!modelViewer) {
          reject(new Error("Model viewer not initialized"));
          return;
        }

        const loadTimeout = setTimeout(() => {
          reject(
            new Error(
              `Model load timeout for ${asset.product_name}. URL: ${asset.glb_link}`
            )
          );
        }, 30000);

        const handleLoad = () => {
          clearTimeout(loadTimeout);
          setTimeout(resolve, 1000);
        };

        const handleError = (error: any) => {
          clearTimeout(loadTimeout);
          if (error.detail?.sourceError?.message?.includes("204")) {
            reject(
              new Error(
                `GLB file is empty or not accessible (204 No Content): ${asset.glb_link}`
              )
            );
          } else {
            reject(
              new Error(`Failed to load 3D model for ${asset.product_name}`)
            );
          }
        };

        modelViewer.addEventListener("load", handleLoad);
        modelViewer.addEventListener("error", handleError);

        cleanup = () => {
          clearTimeout(loadTimeout);
          modelViewer.removeEventListener("load", handleLoad);
          modelViewer.removeEventListener("error", handleError);
        };
      });
    } finally {
      if (cleanup) cleanup();
    }
  };

  const checkGLBFile = async (
    glbLink: string,
    assetId: string,
    retryCount = 0
  ): Promise<void> => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    const supabase = createClient();

    try {
      const response = await fetch(glbLink);

      if (response.status === 204) {
        // Update database with GLB status
        await supabase
          .from("assets")
          .update({ glb_status: "204_no_content" })
          .eq("id", assetId);

        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return checkGLBFile(glbLink, assetId, retryCount + 1);
        }
        throw new Error(
          `GLB file is empty or not accessible (204 No Content after ${maxRetries + 1} attempts): ${glbLink}`
        );
      }

      if (!response.ok) {
        // Update database with GLB status
        await supabase
          .from("assets")
          .update({ glb_status: `error_${response.status}` })
          .eq("id", assetId);

        throw new Error(
          `GLB file not accessible: ${response.status} ${response.statusText}`
        );
      }

      const contentLength = response.headers.get("content-length");

      if (contentLength === "0") {
        // Update database with GLB status
        await supabase
          .from("assets")
          .update({ glb_status: "empty_file" })
          .eq("id", assetId);

        throw new Error(`GLB file is empty (0 bytes): ${glbLink}`);
      }

      // Update database with successful GLB status
      await supabase
        .from("assets")
        .update({ glb_status: "ok" })
        .eq("id", assetId);
    } catch (error) {
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return checkGLBFile(glbLink, assetId, retryCount + 1);
      }
      throw error;
    }
  };

  const generatePreview = async (asset: Asset): Promise<string> => {
    try {
      const modelViewer = modelViewerRef.current;
      if (!modelViewer) throw new Error("Model viewer not initialized");

      modelViewer.src = "";
      modelViewer.dismissPoster?.();
      modelViewer.scene?.clear?.();
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!asset.glb_link)
        throw new Error(`Missing GLB link for asset: ${asset.product_name}`);

      // Check GLB file accessibility with retries
      await checkGLBFile(asset.glb_link, asset.id);

      modelViewer.src = asset.glb_link;
      await waitForModelLoad(modelViewer, asset);

      if (modelViewer.src !== asset.glb_link)
        throw new Error(
          `Model URL mismatch: Expected ${asset.glb_link}, got ${modelViewer.src}`
        );

      const blob = await modelViewer.toBlob({
        idealAspect: true,
        mimeType: "image/png",
        qualityArgument: 1,
        dimensionLimit: 2048,
      });

      if (!blob || blob.size === 0)
        throw new Error(
          `Failed to generate preview image for: ${asset.product_name}`
        );

      return URL.createObjectURL(blob);
    } catch (error) {
      throw error;
    }
  };

  const processAssets = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      if (!modelViewerLoaded)
        throw new Error("Model viewer not initialized. Please try again.");

      setProcessing(true);
      setProgress(0);
      setError(null);
      setFailedAssets([]);
      setCurrentPosition(0);

      const modelViewer = modelViewerRef.current;
      if (!modelViewer) throw new Error("Model viewer component not found");

      const supabase = createClient();
      let processed = 0;

      for (const asset of assetsNeedingPreview) {
        try {
          if (!processingRef.current) break;

          setCurrentAsset(asset.product_name);
          setCurrentPosition(processed + 1);

          // Clear existing model

          modelViewer.src = "";
          modelViewer.dismissPoster?.();
          modelViewer.scene?.clear?.();
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check GLB file accessibility

          await checkGLBFile(asset.glb_link, asset.id);

          const previewUrl = await generatePreview(asset);

          const response = await fetch(previewUrl);
          const blob = await response.blob();

          const file = new File([blob], `${asset.id}_preview.png`, {
            type: "image/png",
          });

          let uploadSuccess = false;
          let uploadAttempts = 0;
          const maxAttempts = 1;

          while (!uploadSuccess && uploadAttempts < maxAttempts) {
            try {
              uploadAttempts++;

              const formData = new FormData();
              formData.append("file", file);
              formData.append("fileName", `${asset.id}_preview.png`);

              const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              const responseData = await response.json();
              if (!response.ok) {
                console.error("Upload failed:", responseData);
                throw new Error(
                  `Upload failed: ${responseData.error || responseData.details || response.statusText}`
                );
              }
              if (responseData.error) {
                console.error("Server error:", responseData.error);
                throw new Error(`Server error: ${responseData.error}`);
              }
              const { url } = responseData;

              const { error: updateError } = await supabase
                .from("assets")
                .update({ preview_image: url })
                .eq("id", asset.id);
              if (updateError) {
                console.error("Database update failed:", updateError);
                throw new Error(
                  `Failed to update asset: ${updateError.message}`
                );
              }

              uploadSuccess = true;
            } catch (error) {
              console.error(`Upload attempt ${uploadAttempts} failed:`, error);
              if (uploadAttempts === maxAttempts) {
                console.error("Max upload attempts reached, marking as failed");
                setFailedAssets((prev) => [
                  ...prev,
                  {
                    id: asset.id,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    retryCount: uploadAttempts,
                  },
                ]);
                break;
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          URL.revokeObjectURL(previewUrl);

          processed++;
          const progress = Math.round(
            (processed / assetsNeedingPreview.length) * 100
          );

          setProgress(progress);

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to process ${asset.product_name}:`, error);
          setFailedAssets((prev) => [
            ...prev,
            {
              id: asset.id,
              error: error instanceof Error ? error.message : "Unknown error",
              retryCount: 0,
            },
          ]);
        }
      }

      if (failedAssets.length > 0) {
        setError(
          `Failed to process ${failedAssets.length} assets. Check error log for details.`
        );
      }
      await refetch();
      if (failedAssets.length === 0) setTimeout(onClose, 1500);
    } catch (error) {
      console.error("Processing failed:", error);
      setError(
        error instanceof Error ? error.message : "Failed to process assets"
      );
    } finally {
      setProcessing(false);
      setCurrentAsset("");
      setCurrentPosition(0);
      processingRef.current = false;
    }
  };

  // Regenerate previews only for assets with failed URLs
  const regenerateFailedPreviews = async () => {
    if (failedUrls.length === 0) return;
    const assetsToRegenerate = assets.filter((a) =>
      failedUrls.some((f) => f.id === a.id && a.glb_link)
    );
    if (assetsToRegenerate.length === 0) return;

    setProcessing(true);
    setProgress(0);
    setError(null);
    setFailedAssets([]);
    setCurrentPosition(0);

    try {
      const supabase = createClient();
      let processed = 0;
      for (const asset of assetsToRegenerate) {
        setCurrentAsset(asset.product_name);
        setCurrentPosition(processed + 1);
        try {
          // Ensure model-viewer is ready for each asset
          const modelViewer = modelViewerRef.current;
          if (!modelViewer) {
            console.error("Model viewer not initialized");
            throw new Error("Model viewer not initialized");
          }

          // Clear existing model

          modelViewer.src = "";
          modelViewer.dismissPoster?.();
          modelViewer.scene?.clear?.();
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check GLB file accessibility

          await checkGLBFile(asset.glb_link, asset.id);

          const previewUrl = await generatePreview(asset);

          const response = await fetch(previewUrl);
          const blob = await response.blob();

          const file = new File([blob], `${asset.id}_preview.png`, {
            type: "image/png",
          });
          let uploadSuccess = false;
          let uploadAttempts = 0;
          const maxAttempts = 1;

          while (!uploadSuccess && uploadAttempts < maxAttempts) {
            try {
              uploadAttempts++;

              const formData = new FormData();
              formData.append("file", file);
              formData.append("fileName", `${asset.id}_preview.png`);

              const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              const responseData = await response.json();
              if (!response.ok) {
                console.error("Upload failed:", responseData);
                throw new Error(
                  `Upload failed: ${responseData.error || responseData.details || response.statusText}`
                );
              }
              if (responseData.error) {
                console.error("Server error:", responseData.error);
                throw new Error(`Server error: ${responseData.error}`);
              }
              const { url } = responseData;

              const { error: updateError } = await supabase
                .from("assets")
                .update({ preview_image: url })
                .eq("id", asset.id);
              if (updateError) {
                console.error("Database update failed:", updateError);
                throw new Error(
                  `Failed to update asset: ${updateError.message}`
                );
              }

              uploadSuccess = true;
            } catch (error) {
              console.error(`Upload attempt ${uploadAttempts} failed:`, error);
              if (uploadAttempts === maxAttempts) {
                console.error("Max upload attempts reached, marking as failed");
                setFailedAssets((prev) => [
                  ...prev,
                  {
                    id: asset.id,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    retryCount: uploadAttempts,
                  },
                ]);
                break;
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          URL.revokeObjectURL(previewUrl);
        } catch (error) {
          console.error(`Failed to process ${asset.product_name}:`, error);
          setFailedAssets((prev) => [
            ...prev,
            {
              id: asset.id,
              error: error instanceof Error ? error.message : "Unknown error",
              retryCount: 0,
            },
          ]);
        }
        processed++;
        const progress = Math.round(
          (processed / assetsToRegenerate.length) * 100
        );

        setProgress(progress);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await refetch();
      setTimeout(() => {
        setProcessing(false);
        setCurrentAsset("");
        setCurrentPosition(0);
        checkPreviewUrls();
      }, 1500);
    } catch (error) {
      console.error("Regeneration process failed:", error);
      setError(
        error instanceof Error ? error.message : "Failed to regenerate previews"
      );
      setProcessing(false);
      setCurrentAsset("");
      setCurrentPosition(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <PreviewGeneratorDialogContent className="max-w-4xl w-full h-[calc(85vh-32px)] flex flex-col border-0 shadow-2xl bg-background">
        {/* Enhanced Header with Global Colors */}
        <DialogHeader className="relative px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Camera className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-primary">
                  Generate Preview Images
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Preview generation for{" "}
                  <span className="font-semibold text-primary">
                    {assetsNeedingPreview.length} / {assets.length} (limited to
                    4000 assets for now)
                  </span>{" "}
                  assets
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-6  overflow-hidden ">
          {/* Enhanced URL Check Results */}
          {urlCheckResults && (
            <div className="animate-in fade-in-50 slide-in-from-top-2">
              <Alert
                className={`border-0 shadow-lg ${
                  urlCheckResults.missing > 0
                    ? "bg-destructive/10"
                    : "bg-success/10"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    urlCheckResults.missing > 0
                      ? "bg-destructive/20"
                      : "bg-success/20"
                  }`}
                >
                  {urlCheckResults.missing > 0 ? (
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                  ) : (
                    <CheckCircle className="w-3 h-3 text-success" />
                  )}
                </div>
                <AlertTitle
                  className={`font-semibold ${
                    urlCheckResults.missing > 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  {urlCheckResults.missing > 0
                    ? `${urlCheckResults.missing} broken preview image URL${urlCheckResults.missing > 1 ? "s" : ""} found`
                    : "All preview images are valid"}
                </AlertTitle>
                <AlertDescription className="text-foreground">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-muted"></div>
                    <span>
                      Checked {urlCheckResults.total} assets with preview images
                    </span>
                  </div>

                  {urlCheckResults && urlCheckResults.total > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary hover:bg-primary/90 shadow-lg "
                      onClick={regenerateFailedPreviews}
                      disabled={processing}
                      title="Regenerate previews for assets with broken preview image URLs."
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate Broken URL Previews
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Enhanced URL Check Progress */}
          {checkingUrls && (
            <div className="bg-muted backdrop-blur-sm rounded-xl p-4 border border-border shadow-lg animate-in fade-in-50">
              <div className="relative">
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out rounded-full shadow-sm"
                    style={{ width: `${urlCheckProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs font-medium text-foreground">
                    Checking URLs... {urlCheckProgress}%
                  </p>
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  </div>
                </div>
                {currentCheckingAsset && (
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                    Current: {currentCheckingAsset}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Model Viewer */}
          <div className="relative flex-1 bg-muted rounded-md  max-h-[600px] overflow-hidden shadow-xl border border-border mt-auto">
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-background backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-xs font-medium text-foreground">
                    3D Preview
                  </span>
                </div>
              </div>
            </div>

            {modelViewerLoaded ? (
              // @ts-expect-error -- model-viewer is a custom element
              <model-viewer
                ref={modelViewerRef}
                tone-mapping="aces"
                shadow-intensity="0"
                camera-orbit="-20.05deg 79.38deg 6.5m"
                field-of-view="10deg"
                environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
                exposure="1.2"
                alpha-channel="blend"
                background-color="transparent"
                style={{ width: "100%", height: "100%" }}
                className="rounded-2xl"
                poster="https://drive.charpstar.net/preview_images/0000efe2-1210-442e-8a07-a274e26ad4cf_preview.png"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 shadow-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Loading 3D viewer...
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Progress and Status */}
          {!processing && (
            <div className="flex flex-row gap-4 flex-wrap w-full">
              {/* Section: Generate for missing/empty preview images */}
              <div className="flex-1 min-w-[280px] bg-muted/30 rounded-xl p-4 border border-border shadow-lg animate-in fade-in-50 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    Generate Previews for Assets Missing a Preview Image
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  This will generate preview images for assets that do not
                  currently have a preview image (i.e., the preview image field
                  is empty or missing). Assets with a preview image (working or
                  broken) will be skipped.
                </p>
                <div className="gap-3">
                  <Button
                    onClick={processAssets}
                    disabled={
                      processing ||
                      checkingUrls ||
                      assetsNeedingPreview.length === 0 ||
                      !modelViewerLoaded
                    }
                    className="border-border border-1 hover:bg-muted bg-background text-foreground"
                    title="Generate previews for assets missing a preview image."
                  >
                    {processing && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        Generating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Generate Missing Previews
                      </span>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Only assets with a GLB link and no preview image will be
                  processed.
                </p>
              </div>

              {/* Section: Check Broken Preview URLs */}
              <div className="flex-1 min-w-[280px] bg-muted/30 rounded-xl p-4 border border-border shadow-lg animate-in fade-in-50 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    Check Broken Preview URLs
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3 text-wrap items-center">
                  This will check all preview image URLs for broken links (404
                  or unreachable). Assets with broken preview image URLs will be
                  listed for regeneration.
                </p>
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={checkPreviewUrls}
                    disabled={processing || checkingUrls}
                    className="border-border hover:bg-muted"
                    title="Check all preview image URLs for broken links (404 or unreachable)."
                  >
                    {checkingUrls ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    {checkingUrls ? "Checking..." : "Check Broken Preview URLs"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-wrap">
                  Only assets with a preview image will be checked.
                </p>
              </div>
            </div>
          )}

          {processing && (
            <div className="bg-muted backdrop-blur-sm rounded-xl p-4 border border-border shadow-lg animate-in fade-in-50">
              <div className="relative">
                <div className="w-full h-3 bg-background rounded-full overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out rounded-full shadow-sm animate-pulse animate-infinite animate-duration-1000 animate-ease-linear"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs font-medium text-foreground">
                    Processing... {progress}% ({currentPosition}/
                    {assetsNeedingPreview.length})
                  </p>
                </div>
                {currentAsset && (
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                    Current: {currentAsset}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-0 shadow-lg bg-destructive/10 animate-in fade-in-50 slide-in-from-bottom-2">
              <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-destructive" />
              </div>
              <AlertTitle className="text-destructive font-semibold">
                Error
              </AlertTitle>
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {progress === 100 && !error && failedAssets.length === 0 && (
            <Alert className="border-0 shadow-lg bg-success/10 animate-in fade-in-50 slide-in-from-bottom-2">
              <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-success" />
              </div>
              <AlertTitle className="text-success font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Preview generation complete!
              </AlertTitle>
            </Alert>
          )}
        </div>

        {/* Enhanced Footer */}
        <DialogFooter className="px-6 py-4 bg-background border-t border-border">
          <div className="flex flex-col sm:flex-row w-full gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetakeAll(!retakeAll)}
                disabled={processing || checkingUrls}
                className="border-border hover:bg-muted"
                title={
                  retakeAll
                    ? "Switch to only generating previews for assets missing a preview image."
                    : "Switch to regenerating previews for all assets with a GLB link."
                }
              >
                {retakeAll ? (
                  <RotateCcw className="w-4 h-4 mr-2" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {retakeAll ? "Process Missing Only" : "Retake All Previews"}
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={processing || checkingUrls}
                className="border-border hover:bg-muted"
              >
                {processing ? "Cancel" : "Close"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </PreviewGeneratorDialogContent>
    </Dialog>
  );
}
