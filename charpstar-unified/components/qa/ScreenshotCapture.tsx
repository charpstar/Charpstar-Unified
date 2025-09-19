"use client";

import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/display/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers/card";
import { Badge } from "@/components/ui/feedback/badge";
import { Progress } from "@/components/ui/feedback/progress";
import { Camera, Download, RotateCcw, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface ScreenshotCaptureProps {
  glbUrl: string;
  assetId: string;
  modelViewerRef?: React.RefObject<any>;
  onScreenshotsCaptured: (screenshots: string[], modelStats?: any, failedResult?: any) => void;
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
  // Use the passed modelViewerRef or create a fallback
  const fallbackModelViewerRef = useRef<any>(null);
  const activeModelViewerRef = modelViewerRef || fallbackModelViewerRef;
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Pre-AI validation function
  const validateModelRequirements = (stats: ModelStats): ValidationResult => {
    const issues: string[] = [];
    
    // Polycount check: Under 150K triangles
    if (stats.triangles > 150000) {
      issues.push(`Polycount: ${stats.triangles.toLocaleString()} triangles exceeds maximum 150,000`);
    }
    
    // Material count check: Maximum 5 materials
    if (stats.materialCount > 5) {
      issues.push(`Material count: ${stats.materialCount} exceeds maximum 5`);
    }
    
    // Mesh count check: Maximum 5 meshes
    if (stats.meshCount > 5) {
      issues.push(`Mesh count: ${stats.meshCount} exceeds maximum 5`);
    }
    
    // File size check: 15MB or less
    const maxFileSize = 15 * 1024 * 1024; // 15MB in bytes
    if (stats.fileSize > maxFileSize) {
      const actualMB = (stats.fileSize / (1024 * 1024)).toFixed(1);
      issues.push(`File size: ${actualMB}MB exceeds maximum 15MB`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  };

  const cameraAngles = [
    { name: "Front View", cameraOrbit: "0deg 90deg 1.5m" },
    { name: "Back View", cameraOrbit: "180deg 90deg 1.5m" },
    { name: "Left Side", cameraOrbit: "90deg 90deg 1.5m" },
    { name: "Right Side", cameraOrbit: "270deg 90deg 1.5m" },
    { name: "Top View", cameraOrbit: "0deg 0deg 1.5m" },
  ];

  const captureScreenshot = useCallback(async (angle: any, index: number) => {
    if (!activeModelViewerRef.current) return null;

    const modelViewer = activeModelViewerRef.current;
    console.log(`Setting camera for ${angle.name}: ${angle.cameraOrbit}`);
    
    // Store original settings to restore later
    const originalSettings = {
      aspectRatio: modelViewer.style.aspectRatio,
      width: modelViewer.style.width,
      height: modelViewer.style.height,
      backgroundColor: modelViewer.backgroundColor,
      autoRotate: modelViewer.autoRotate
    };

    try {
      // Set camera position
      const modelViewer = activeModelViewerRef.current;
      modelViewer.autoRotate = false; // Ensure auto-rotate is disabled
      modelViewer.cameraOrbit = angle.cameraOrbit;
      
      // Set background for QA captures (don't change dimensions)
      modelViewer.backgroundColor = '#f5f5f5'; // Light gray background instead of black
      
      console.log(`Camera set to: ${modelViewer.cameraOrbit}, autoRotate: ${modelViewer.autoRotate}`);
      
      // Wait for camera to settle and model to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ensure model is loaded
      if (modelViewer.loaded) {
        console.log(`Model loaded, capturing ${angle.name}`);
      } else {
        console.log(`Waiting for model to load...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Capture screenshot
      const canvas = await modelViewer.toDataURL();
      
      // Convert to blob and upload to storage
      const response = await fetch(canvas);
      const blob = await response.blob();
      
      // Upload to Supabase storage
      const fileName = `qa-screenshots/${assetId}/${index + 1}-${angle.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      const { data, error } = await supabase.storage
        .from('assets')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(fileName);

      // Restore original settings
      modelViewer.style.aspectRatio = originalSettings.aspectRatio;
      modelViewer.style.width = originalSettings.width;
      modelViewer.style.height = originalSettings.height;
      modelViewer.backgroundColor = originalSettings.backgroundColor;
      modelViewer.autoRotate = originalSettings.autoRotate;

      return urlData.publicUrl;
    } catch (error) {
      console.error('Screenshot capture error:', error);
      
      // Restore original settings even on error
      try {
        if (modelViewer && originalSettings) {
          modelViewer.style.aspectRatio = originalSettings.aspectRatio;
          modelViewer.style.width = originalSettings.width;
          modelViewer.style.height = originalSettings.height;
          modelViewer.backgroundColor = originalSettings.backgroundColor;
          modelViewer.autoRotate = originalSettings.autoRotate;
        }
      } catch (restoreError) {
        console.error('Error restoring original settings:', restoreError);
      }
      
      return null;
    }
  }, [assetId]);

  const getModelStats = useCallback(async () => {
    if (!activeModelViewerRef.current) return null;

    try {
      const modelViewer = activeModelViewerRef.current;
      
      // Check if the model is loaded and wait if necessary
      if (!modelViewer.loaded) {
        console.log('Model not loaded yet, waiting...');
        // Wait up to 10 seconds for the model to load
        let attempts = 0;
        while (!modelViewer.loaded && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!modelViewer.loaded) {
          console.warn('Model still not loaded after waiting');
          return null;
        }
      }

      // Use the built-in getModelStats method if available
      let modelStats = null;
      if (typeof modelViewer.getModelStats === 'function') {
        modelStats = modelViewer.getModelStats();
        console.log('Got model stats from getModelStats():', modelStats);
      } else {
        console.warn('getModelStats method not available, trying to initialize model-viewer');
        
        // Try to initialize the model-viewer with stats methods
        try {
          // Import and use the model viewer initializer
          const { initializeModelViewer } = await import('@/utils/modelViewerInitializer');
          const initializedViewer = initializeModelViewer(modelViewer);
          
          if (initializedViewer && typeof initializedViewer.getModelStats === 'function') {
            modelStats = initializedViewer.getModelStats();
            console.log('Got model stats after initialization:', modelStats);
          } else {
            console.error('Failed to initialize model-viewer with stats methods');
            return null;
          }
        } catch (initError) {
          console.error('Error initializing model-viewer:', initError);
          return null;
        }
      }

      if (!modelStats) {
        console.warn('getModelStats returned null');
        return null;
      }

      // Get file size from the GLB URL
      let fileSize = 0;
      try {
        const response = await fetch(glbUrl, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          fileSize = parseInt(contentLength);
        }
      } catch (error) {
        console.warn('Could not get file size:', error);
      }

      return {
        meshCount: modelStats.meshCount || 0,
        materialCount: modelStats.materialCount || 0,
        vertices: modelStats.vertices || 0,
        triangles: modelStats.triangles || 0,
        doubleSidedCount: modelStats.doubleSidedCount || 0,
        doubleSidedMaterials: modelStats.doubleSidedMaterials || [],
        fileSize,
      };
    } catch (error) {
      console.error('Error getting model stats:', error);
      return null;
    }
  }, [glbUrl]);

  const startCapture = async () => {
    setIsCapturing(true);
    setProgress(0);
    setCapturedScreenshots([]);

    try {
      // Get model stats first
      const stats = await getModelStats();
      setModelStats(stats);

      if (!stats) {
        throw new Error('Failed to get model statistics');
      }

      // Validate model requirements before proceeding
      const validation = validateModelRequirements(stats);
      setValidationResult(validation);

      if (!validation.valid) {
        // Model doesn't meet requirements - create a failed QA result
        const failedResult = {
          status: 'Not Approved',
          summary: `Model failed technical requirements: ${validation.issues.join(', ')}`,
          similarityScores: {
            overall: 0
          },
          differences: validation.issues.map(issue => ({
            renderIndex: 0,
            referenceIndex: 0,
            issues: [issue],
            bbox: [0, 0, 0, 0],
            severity: 'high' as const
          }))
        };

        // Call the completion handler with the failed result
        onScreenshotsCaptured([], stats, failedResult);
        setIsCapturing(false);
        return;
      }

      // Model meets requirements - proceed with screenshot capture
      // Capture screenshots from different angles
      const screenshots: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        setCurrentStep(i + 1);
        setProgress((i / 5) * 100);
        
        console.log(`Capturing screenshot ${i + 1}/5: ${cameraAngles[i].name}`);
        const screenshot = await captureScreenshot(cameraAngles[i], i);
        if (screenshot) {
          screenshots.push(screenshot);
          setCapturedScreenshots([...screenshots]);
          console.log(`Successfully captured ${cameraAngles[i].name}`);
        } else {
          console.error(`Failed to capture ${cameraAngles[i].name}`);
        }
        
        // Small delay between captures
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setProgress(100);
      toast.success("Screenshots captured successfully!");
      
      // Call the callback with captured screenshots
      onScreenshotsCaptured(screenshots, stats);
      
    } catch (error) {
      console.error('Capture process failed:', error);
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
            The system will automatically capture 5 screenshots from different angles using the existing model viewer.
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
              {cameraAngles[currentStep - 1]?.name || 'Preparing...'}
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
                  <img
                    src={screenshot}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full h-20 object-cover rounded border"
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
                <p className="font-medium">{modelStats.vertices.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Triangles</p>
                <p className="font-medium">{modelStats.triangles.toLocaleString()}</p>
              </div>
            </div>
            {modelStats.doubleSidedCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  {modelStats.doubleSidedCount} double-sided material(s) detected
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
                <span className="text-sm font-medium">All requirements met</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Requirements not met</span>
                </div>
                <div className="space-y-1">
                  {validationResult.issues.map((issue, index) => (
                    <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded border-l-4 border-red-400">
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
            onClick={startCapture}
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
            <strong>Instructions:</strong> The system will automatically capture 5 screenshots 
            from different angles (front, back, left, right, top) of your 3D model.
          </p>
          <p>
            These screenshots will be compared against reference images using AI to ensure 
            visual accuracy and quality.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScreenshotCapture;
