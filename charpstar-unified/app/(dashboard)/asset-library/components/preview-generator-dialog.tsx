"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  PreviewGeneratorDialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Camera, X, CheckCircle, RotateCcw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
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
  preview_image: string;
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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "field-of-view"?: string;
          "environment-image"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "alpha-channel"?: string;
          "background-color"?: string;
        },
        HTMLElement
      >;
    }
  }
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
    ? assets.filter((asset) => asset.glb_link)
    : assets.filter((asset) => !asset.preview_image && asset.glb_link);

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

    const assetsWithPreviews = assets.filter((a) => a.preview_image);
    const totalToCheck = assetsWithPreviews.length;

    for (const asset of assetsWithPreviews) {
      setCurrentCheckingAsset(asset.product_name);
      try {
        const response = await fetch(asset.preview_image, { method: "HEAD" });
        if (response.status !== 200) {
          console.log(
            `Missing preview for: ${asset.product_name} (${asset.preview_image})`
          );
          missing++;
          setFailedUrls((prev) => [
            ...prev,
            {
              id: asset.id,
              name: asset.product_name,
              url: asset.preview_image,
            },
          ]);
        }
      } catch (err) {
        console.log(
          `Error checking preview for: ${asset.product_name} (${asset.preview_image})`
        );
        missing++;
        setFailedUrls((prev) => [
          ...prev,
          {
            id: asset.id,
            name: asset.product_name,
            url: asset.preview_image,
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

  const retryFailedPreviews = async () => {
    if (failedUrls.length === 0) return;

    const assetsToRetry = assets.filter((asset) =>
      failedUrls.some((failed) => failed.id === asset.id)
    );

    if (assetsToRetry.length === 0) return;

    setProcessing(true);
    setProgress(0);
    setError(null);
    setFailedAssets([]);

    try {
      for (const asset of assetsToRetry) {
        setCurrentAsset(asset.product_name);
        const previewUrl = await generatePreview(asset);
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const file = new File([blob], `${asset.id}_preview.png`, {
          type: "image/png",
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", `${asset.id}_preview.png`);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const { url } = await uploadResponse.json();
        const supabase = createClient();
        await supabase
          .from("assets")
          .update({ preview_image: url })
          .eq("id", asset.id);

        URL.revokeObjectURL(previewUrl);
        setProgress(100);
      }
      await refetch();
      setTimeout(() => {
        setProcessing(false);
        setCurrentAsset("");
        checkPreviewUrls(); // Recheck URLs after retry
      }, 1500);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to retry previews"
      );
      setProcessing(false);
      setCurrentAsset("");
    }
  };

  const waitForModelLoad = async (
    modelViewer: any,
    asset: Asset,
    retryCount = 0
  ): Promise<void> => {
    let cleanup: (() => void) | undefined;
    const MAX_RETRIES = 2;

    try {
      return await new Promise((resolve, reject) => {
        if (!modelViewer) {
          reject(new Error("Model viewer not initialized"));
          return;
        }

        const loadTimeout = setTimeout(() => {
          if (retryCount < MAX_RETRIES) {
            console.log(`Retry ${retryCount + 1} for ${asset.product_name}`);
            resolve(waitForModelLoad(modelViewer, asset, retryCount + 1));
          } else {
            reject(
              new Error(
                `Model load timeout for ${asset.product_name}. URL: ${asset.glb_link}`
              )
            );
          }
        }, 30000);

        const handleLoad = () => {
          clearTimeout(loadTimeout);
          setTimeout(resolve, 1000);
        };

        const handleError = (error: any) => {
          clearTimeout(loadTimeout);
          if (retryCount < MAX_RETRIES) {
            console.log(
              `Retry ${retryCount + 1} for ${asset.product_name} after error`
            );
            resolve(waitForModelLoad(modelViewer, asset, retryCount + 1));
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

      const modelViewer = modelViewerRef.current;
      if (!modelViewer) throw new Error("Model viewer component not found");

      const supabase = createClient();
      modelViewer.src = "";
      await new Promise((resolve) => setTimeout(resolve, 100));
      let processed = 0;

      for (const asset of assetsNeedingPreview) {
        try {
          if (!processingRef.current) break;
          if (modelViewerRef.current) {
            modelViewerRef.current.src = "";
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          const previewUrl = await generatePreview(asset);
          const response = await fetch(previewUrl);
          const blob = await response.blob();
          const file = new File([blob], `${asset.id}_preview.png`, {
            type: "image/png",
          });

          let uploadSuccess = false;
          let uploadAttempts = 0;
          const maxAttempts = 3;

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
              if (!response.ok)
                throw new Error(
                  `Upload failed: ${responseData.error || responseData.details || response.statusText}`
                );
              if (responseData.error)
                throw new Error(`Server error: ${responseData.error}`);

              const { url } = responseData;
              console.log(
                "Updating Supabase for asset:",
                asset.id,
                "with preview URL:",
                url
              );
              const { error: updateError } = await supabase
                .from("assets")
                .update({ preview_image: url })
                .eq("id", asset.id);

              if (updateError) {
                console.error("Supabase update error:", updateError);
                throw new Error(
                  `Failed to update asset: ${updateError.message}`
                );
              }
              console.log("Successfully updated Supabase for asset:", asset.id);

              uploadSuccess = true;
            } catch (error) {
              if (uploadAttempts === maxAttempts) {
                setFailedAssets((prev) => [
                  ...prev,
                  {
                    id: asset.id,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    retryCount: uploadAttempts,
                  },
                ]);
                throw error;
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          URL.revokeObjectURL(previewUrl);
          processed++;
          setProgress(
            Math.round((processed / assetsNeedingPreview.length) * 100)
          );
        } catch (error) {
          setFailedAssets((prev) => [
            ...prev,
            {
              id: asset.id,
              error: error instanceof Error ? error.message : "Unknown error",
              retryCount: 0,
            },
          ]);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (failedAssets.length > 0) {
        setError(
          `Failed to process ${failedAssets.length} assets. Check error log for details.`
        );
      }
      await refetch();
      if (failedAssets.length === 0) setTimeout(onClose, 1500);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to process assets"
      );
    } finally {
      setProcessing(false);
      setCurrentAsset("");
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

    try {
      const supabase = createClient();
      let processed = 0;
      for (const asset of assetsToRegenerate) {
        setCurrentAsset(asset.product_name);
        try {
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
              if (!response.ok)
                throw new Error(
                  `Upload failed: ${responseData.error || responseData.details || response.statusText}`
                );
              if (responseData.error)
                throw new Error(`Server error: ${responseData.error}`);
              const { url } = responseData;
              const { error: updateError } = await supabase
                .from("assets")
                .update({ preview_image: url })
                .eq("id", asset.id);
              if (updateError) {
                throw new Error(
                  `Failed to update asset: ${updateError.message}`
                );
              }
              uploadSuccess = true;
            } catch (error) {
              if (uploadAttempts === maxAttempts) {
                setFailedAssets((prev) => [
                  ...prev,
                  {
                    id: asset.id,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    retryCount: uploadAttempts,
                  },
                ]);
                // Instead of throw, just break to continue with next asset
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          URL.revokeObjectURL(previewUrl);
        } catch (error) {
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
        setProgress(Math.round((processed / assetsToRegenerate.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await refetch();
      setTimeout(() => {
        setProcessing(false);
        setCurrentAsset("");
        checkPreviewUrls();
      }, 1500);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to regenerate previews"
      );
      setProcessing(false);
      setCurrentAsset("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <PreviewGeneratorDialogContent className="max-w-3xl w-full h-[calc(100vh-64px)] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Generate Preview Images</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-5 h-5" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription>
            Generate preview images for <b>{assetsNeedingPreview.length}</b>{" "}
            assets without previews.
          </DialogDescription>
        </DialogHeader>

        {/* URL Check Results */}
        {urlCheckResults && (
          <Alert
            variant={urlCheckResults.missing > 0 ? "destructive" : "default"}
          >
            <AlertTitle>
              {urlCheckResults.missing > 0
                ? `${urlCheckResults.missing} missing preview images found`
                : "All preview images are valid"}
            </AlertTitle>
            <AlertDescription>
              Checked {urlCheckResults.total} assets with preview images
              {failedUrls.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Failed URLs:</p>
                  <ul className="text-xs mt-1 space-y-1">
                    {failedUrls.slice(0, 3).map((failed, idx) => (
                      <li key={idx}>{failed.name}</li>
                    ))}
                    {failedUrls.length > 3 && (
                      <li className="text-muted-foreground">
                        ...and {failedUrls.length - 3} more
                      </li>
                    )}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={retryFailedPreviews}
                    disabled={processing}
                  >
                    Retry All Failed Previews
                  </Button>
                </div>
              )}
              {urlCheckResults && urlCheckResults.total > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="mt-2"
                  onClick={regenerateFailedPreviews}
                  disabled={processing}
                >
                  Regenerate Failed Previews
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* URL Check Progress */}
        {checkingUrls && (
          <div className="mt-3">
            <div className="w-full h-2 bg-muted rounded overflow-hidden mb-1">
              <div
                className="bg-primary h-full transition-all duration-200"
                style={{ width: `${urlCheckProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Checking URLs... {urlCheckProgress}%
              {currentCheckingAsset && (
                <span className="block text-[10px]">
                  Current: {currentCheckingAsset}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Model Viewer */}
        <div className="relative flex-1 bg-muted rounded-xl min-h-[400px] overflow-hidden">
          {modelViewerLoaded ? (
            <model-viewer
              ref={modelViewerRef}
              tone-mapping="aces"
              shadow-intensity="0"
              camera-orbit="-20.05deg 79.38deg 6.5m" // Add a distance value (increase to zoom out)
              field-of-view="10deg" // Increase FOV to zoom out
              environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
              exposure="1.2"
              alpha-channel="blend"
              background-color="transparent"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Progress and Status */}
        <div className="flex flex-col gap-3 mt-3">
          {processing && (
            <div>
              <div className="w-full h-2 bg-muted rounded overflow-hidden mb-1">
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Processing... {progress}%
                {currentAsset && (
                  <span className="block text-[10px]">
                    Current: {currentAsset}
                  </span>
                )}
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {failedAssets.length > 0 && (
            <div>
              <p className="text-sm text-destructive font-medium">
                Failed assets:
              </p>
              <div className="max-h-60 overflow-y-auto mt-1 space-y-1">
                {failedAssets.map((asset, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {asset.id}: {asset.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          {progress === 100 && !error && failedAssets.length === 0 && (
            <Alert variant="default">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <AlertTitle>Preview generation complete!</AlertTitle>
            </Alert>
          )}
        </div>

        <DialogFooter className="pt-4 gap-2 flex-col sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => setRetakeAll(!retakeAll)}
              disabled={processing || checkingUrls}
            >
              {retakeAll ? (
                <RotateCcw className="w-4 h-4 mr-2" />
              ) : (
                <Camera className="w-4 h-4 mr-2" />
              )}
              {retakeAll ? "Process Missing Only" : "Retake All Previews"}
            </Button>
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={checkPreviewUrls}
              disabled={processing || checkingUrls}
            >
              {checkingUrls ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {checkingUrls ? "Checking..." : "Check Preview URLs"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {retakeAll
                ? `Will process all ${assets.filter((a) => a.glb_link).length} assets`
                : `Will process ${assets.filter((a) => !a.preview_image && a.glb_link).length} assets`}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={processing || checkingUrls}
              type="button"
            >
              {processing ? "Cancel" : "Close"}
            </Button>
            <Button
              variant="default"
              onClick={processAssets}
              disabled={
                processing ||
                checkingUrls ||
                assetsNeedingPreview.length === 0 ||
                !modelViewerLoaded
              }
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {processing ? "Generating..." : "Generate Previews"}
            </Button>
          </div>
        </DialogFooter>
      </PreviewGeneratorDialogContent>
    </Dialog>
  );
}
