"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/display/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";
import { Badge } from "@/components/ui/feedback/badge";
import { Progress } from "@/components/ui/feedback/progress";
import { Camera, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

interface ScreenshotCaptureProps {
  glbUrl: string;
  assetId: string;
  modelViewerRef?: React.RefObject<any>;
  onScreenshotsCaptured: (
    screenshots: string[],
    modelStats?: any,
    failedResult?: any
  ) => void;
  onCancel?: () => void;
}

interface ModelStats {
  meshCount: number;
  materialCount: number;
  vertices: number;
  triangles: number;
  doubleSidedCount: number;
  doubleSidedMaterials: string[];
  fileSize: number;
  requirements?: {
    maxTriangles: number;
    maxMaterials: number;
    maxMeshes: number;
    maxFileSize: number;
  };
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

const ScreenshotCapture: React.FC<ScreenshotCaptureProps> = ({
  glbUrl,
  assetId,
  modelViewerRef,
  onScreenshotsCaptured,
  onCancel,
}) => {
  // Use the passed modelViewerRef - this should be the existing model-viewer from the parent page
  const activeModelViewerRef = modelViewerRef;
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  // Check if the passed modelViewerRef is available
  useEffect(() => {


    if (activeModelViewerRef?.current) {
      
    } else {
      console.warn("No model-viewer ref provided - screenshots may not work");
    }
  }, [activeModelViewerRef, modelViewerRef]);

  // Pre-AI validation function
  const validateModelRequirements = (stats: ModelStats): ValidationResult => {
    const issues: string[] = [];

    // Use requirements from stats if available, otherwise use defaults
    const requirements = stats.requirements || {
      maxTriangles: 150000,
      maxMaterials: 8,
      maxMeshes: 8,
      maxFileSize: 15 * 1024 * 1024, // 15MB in bytes
    };

    // Polycount check
    if (stats.triangles > requirements.maxTriangles) {
      issues.push(
        `Polycount: ${stats.triangles.toLocaleString()} triangles exceeds maximum ${requirements.maxTriangles.toLocaleString()}`
      );
    }

    // Material count check
    if (stats.materialCount > requirements.maxMaterials) {
      issues.push(
        `Material count: ${stats.materialCount} exceeds maximum ${requirements.maxMaterials}`
      );
    }

    // Mesh count check
    if (stats.meshCount > requirements.maxMeshes) {
      issues.push(
        `Mesh count: ${stats.meshCount} exceeds maximum ${requirements.maxMeshes}`
      );
    }

    // File size check
    if (stats.fileSize > requirements.maxFileSize + 1024) { // Add 1KB tolerance
      const actualMB = (stats.fileSize / (1024 * 1024)).toFixed(1);
      const maxMB = (requirements.maxFileSize / (1024 * 1024)).toFixed(1);
      issues.push(`File size: ${actualMB}MB exceeds maximum ${maxMB}MB`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  };

  const cameraAngles = [
    { name: "Front View", cameraOrbit: "0deg 90deg 1.5m" },
    { name: "Back View", cameraOrbit: "180deg 90deg 1.5m" },
    { name: "Left Side", cameraOrbit: "90deg 90deg 1.5m" },
    { name: "Right Side", cameraOrbit: "270deg 90deg 1.5m" },
    { name: "Top View", cameraOrbit: "0deg 0deg 1.5m" },
  ];

  const captureScreenshot = useCallback(
    async (angle: any, index: number) => {

      if (!activeModelViewerRef?.current) {
        console.error("No model viewer ref available for screenshot capture");
        return null;
      }

      const modelViewer = activeModelViewerRef.current;

      // Store original settings to restore later
      const originalSettings = {
        aspectRatio: modelViewer.style.aspectRatio,
        width: modelViewer.style.width,
        height: modelViewer.style.height,
        backgroundColor: modelViewer.backgroundColor,
        autoRotate: modelViewer.autoRotate,
      };

      try {
        // Set camera position
        const modelViewer = activeModelViewerRef.current;
        modelViewer.autoRotate = false; // Ensure auto-rotate is disabled
        modelViewer.cameraOrbit = angle.cameraOrbit;

        // Set background for QA captures (don't change dimensions)
        modelViewer.backgroundColor = "#f5f5f5"; // Light gray background instead of black

        

        // Wait for camera to settle and model to be ready
        
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Ensure model is loaded
        if (!modelViewer.loaded) {
          // Wait longer for model to load
          let loadAttempts = 0;
          while (!modelViewer.loaded && loadAttempts < 10) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            loadAttempts++;
          }

          if (!modelViewer.loaded) {
            
          }
        }

        // Hide grid (if present) before capture
        try {
          if (typeof (modelViewer as any).gridHelper !== "undefined") {
            const gv: any = (modelViewer as any).gridHelper;
            if (gv && gv.visible) {
              gv.visible = false;
              (modelViewer as any).requestRender?.();
              await new Promise((r) => setTimeout(r, 150));
            }
          }
        } catch {}

        // Additional wait to ensure everything is rendered
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Capture screenshot
        

        // Check if toDataURL method exists
        if (typeof modelViewer.toDataURL !== "function") {
          console.error("toDataURL method not available on model-viewer");

          // Try alternative method if available
          if (typeof modelViewer.toBlob === "function") {
            
            const blob = await modelViewer.toBlob({
              mimeType: "image/png",
              qualityArgument: 0.8,
            });
            

            // Upload directly
            const fileName = `qa-screenshots/${assetId}/${index + 1}-${angle.name.toLowerCase().replace(/\s+/g, "-")}.png`;
            const { error } = await supabase.storage
              .from("assets")
              .upload(fileName, blob, {
                cacheControl: "3600",
                upsert: true,
              });

            if (error) {
              console.error("Upload error:", error);
              return null;
            }

            const { data: urlData } = supabase.storage
              .from("assets")
              .getPublicUrl(fileName);

            return urlData.publicUrl;
          }

          return null;
        }

        const canvas = await modelViewer.toDataURL("image/png", 0.8);

        if (!canvas || canvas.length < 100) return null;

        // Return the data URL directly (no upload)
        // Restore original settings
        modelViewer.style.aspectRatio = originalSettings.aspectRatio;
        modelViewer.style.width = originalSettings.width;
        modelViewer.style.height = originalSettings.height;
        modelViewer.backgroundColor = originalSettings.backgroundColor;
        modelViewer.autoRotate = originalSettings.autoRotate;

        return canvas;
      } catch (error) {

        // Restore original settings even on error
        try {
          if (modelViewer && originalSettings) {
            modelViewer.style.aspectRatio = originalSettings.aspectRatio;
            modelViewer.style.width = originalSettings.width;
            modelViewer.style.height = originalSettings.height;
            modelViewer.backgroundColor = originalSettings.backgroundColor;
            modelViewer.autoRotate = originalSettings.autoRotate;
          }
        } catch (restoreError) {}

        return null;
      }
    },
    [assetId]
  );

  const getModelStats = useCallback(async () => {
    if (!activeModelViewerRef?.current) {
      console.warn(
        "No model viewer ref available - make sure the 3D model is loaded on the page"
      );
      return null;
    }

    try {
      const modelViewer = activeModelViewerRef.current;

      // Check if the model-viewer element exists and is ready
      if (!modelViewer || typeof modelViewer.loaded === "undefined") {
        console.warn(
          "Model viewer not ready yet - make sure the 3D model is loaded on the page"
        );
        return null;
      }

      // Check if the model is loaded and wait if necessary
      if (!modelViewer.loaded) {
        // Wait up to 10 seconds for the model to load
        let attempts = 0;
        while (!modelViewer.loaded && attempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          attempts++;
        }

        if (!modelViewer.loaded) {
          console.warn("Model still not loaded after waiting");
          return null;
        }
      }

      // Use the built-in getModelStats method if available
      let modelStats = null;
      if (typeof modelViewer.getModelStats === "function") {
        modelStats = modelViewer.getModelStats();
      } else {
        console.warn(
          "getModelStats method not available, trying to initialize model-viewer"
        );

        // Try to initialize the model-viewer with stats methods
        try {
          // Import and use the model viewer initializer
          const { initializeModelViewer } = await import(
            "@/utils/modelViewerInitializer"
          );
          const initializedViewer = initializeModelViewer(modelViewer);

          if (
            initializedViewer &&
            typeof initializedViewer.getModelStats === "function"
          ) {
            modelStats = initializedViewer.getModelStats();
          } else {
            console.error(
              "Failed to initialize model-viewer with stats methods"
            );
            return null;
          }
        } catch (initError) {
          console.error("Error initializing model-viewer:", initError);
          return null;
        }
      }

      if (!modelStats) {
        console.warn("getModelStats returned null");
        return null;
      }

      // Get file size from the GLB URL
      let fileSize = 0;
      try {
        const response = await fetch(glbUrl, { method: "HEAD" });
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
          fileSize = parseInt(contentLength);
        }
      } catch (error) {
        console.warn("Could not get file size:", error);
      }

      return {
        meshCount: modelStats.meshCount || 0,
        materialCount: modelStats.materialCount || 0,
        vertices: modelStats.vertices || 0,
        triangles: modelStats.triangles || 0,
        doubleSidedCount: modelStats.doubleSidedCount || 0,
        doubleSidedMaterials: modelStats.doubleSidedMaterials || [],
        fileSize,
        requirements: {
          maxTriangles: 150000,
          maxMaterials: 8,
          maxMeshes: 8,
          maxFileSize: 15 * 1024 * 1024, // 15MB in bytes
        },
      };
    } catch (error) {
      console.error("Error getting model stats:", error);
      return null;
    }
  }, [glbUrl]);

  const startCapture = async () => {

    setIsCapturing(true);
    setProgress(0);
    setCapturedScreenshots([]);

    try {
      // Ensure model-viewer is ready
      if (!activeModelViewerRef?.current) {
        throw new Error(
          "Model viewer not available - make sure the 3D model is loaded on the page"
        );
      }

      const modelViewer = activeModelViewerRef.current;


      const stats = await getModelStats();
      setModelStats(stats);

      if (!stats) {
        throw new Error("Failed to get model statistics");
      }


      // Validate model requirements before proceeding
      const validation = validateModelRequirements(stats);

      setValidationResult(validation);

      if (!validation.valid) {

        // Model doesn't meet requirements - show issues to user but don't auto-complete
        // The user can see the issues and decide whether to proceed anyway
        setIsCapturing(false);

        return;
      }


      // Capture screenshots from different angles (preserve order by index)
      const screenshots: string[] = new Array(cameraAngles.length).fill("");

      for (let i = 0; i < 5; i++) {
        setCurrentStep(i + 1);
        setProgress((i / 5) * 100);

    
        const screenshot = await captureScreenshot(cameraAngles[i], i);
        if (screenshot) {
          screenshots[i] = screenshot;
          // update by index to avoid misordered/stale previews
          setCapturedScreenshots((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            next[i] = screenshot;
            return next;
          });
        } else {
        }

        // Small delay between captures
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setProgress(100);
      toast.success("Screenshots captured successfully!");

      // Call the callback with captured screenshots
      onScreenshotsCaptured(screenshots, stats);
    } catch (error) {
      console.error("Capture process failed:", error);
      toast.error("Failed to capture screenshots");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Automated QA Screenshot Capture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Camera className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">Screenshot Capture</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            The system will automatically capture 5 screenshots from different
            angles using the existing model viewer.
          </p>
        </div>

        {/* Progress */}
        {isCapturing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Capturing screenshots...</span>
              <span>{currentStep}/5</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {cameraAngles[currentStep - 1]?.name || "Preparing..."}
            </p>
          </div>
        )}

        {/* Captured Screenshots Preview */}
        {capturedScreenshots.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Captured Screenshots:</h4>
            <div className="grid grid-cols-5 gap-2">
              {capturedScreenshots.map((screenshot, index) => (
                <div key={index} className="relative">
                  <Image
                    src={screenshot}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full h-20 object-cover rounded border"
                    width={100}
                    height={100}
                  />
                  <Badge
                    variant="secondary"
                    className="absolute top-1 left-1 text-xs"
                  >
                    {cameraAngles[index]?.name}
                  </Badge>
                  <CheckCircle className="absolute top-1 right-1 h-4 w-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Stats */}
        {modelStats && (
          <div className="space-y-3">
            <h4 className="font-medium">Model Statistics:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Meshes</p>
                <p className="font-medium">{modelStats.meshCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Materials</p>
                <p className="font-medium">{modelStats.materialCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Vertices</p>
                <p className="font-medium">
                  {modelStats.vertices.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Triangles</p>
                <p className="font-medium">
                  {modelStats.triangles.toLocaleString()}
                </p>
              </div>
            </div>
            {modelStats.doubleSidedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  {modelStats.doubleSidedCount} double-sided material(s)
                  detected
                </span>
              </div>
            )}
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-3">
            <h4 className="font-medium">Technical Requirements:</h4>
            {validationResult.valid ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  All requirements met
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Requirements not met
                  </span>
                </div>
                <div className="space-y-1">
                  {validationResult.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="text-sm text-red-700 bg-red-50 p-2 rounded border-l-4 border-red-400"
                    >
                      {issue}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => {
              startCapture();
            }}
            disabled={isCapturing}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            {isCapturing ? "Capturing..." : "Start QA Capture"}
          </Button>

          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Instructions:</strong> The system will automatically capture
            5 screenshots from different angles (front, back, left, right, top)
            of your 3D model.
          </p>
          <p>
            These screenshots will be compared against reference images using AI
            to ensure visual accuracy and quality.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScreenshotCapture;