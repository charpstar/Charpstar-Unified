"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
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
  // Use the passed modelViewerRef - this should be the existing model-viewer from the parent page
  const activeModelViewerRef = modelViewerRef;
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Check if the passed modelViewerRef is available
  useEffect(() => {
    console.log('ScreenshotCapture mounted, modelViewerRef:', modelViewerRef);
    console.log('activeModelViewerRef:', activeModelViewerRef);
    console.log('activeModelViewerRef.current:', activeModelViewerRef?.current);
    
    if (activeModelViewerRef?.current) {
      console.log('Model-viewer ref available for QA:', activeModelViewerRef.current);
      console.log('Model loaded:', activeModelViewerRef.current.loaded);
      console.log('Model src:', activeModelViewerRef.current.src);
    } else {
      console.warn('No model-viewer ref provided - screenshots may not work');
    }
  }, [activeModelViewerRef, modelViewerRef]);

  // Pre-AI validation function
  const validateModelRequirements = (stats: ModelStats): ValidationResult => {
    const issues: string[] = [];
    
    // Polycount check: Under 150K triangles
    if (stats.triangles > 150000) {
      issues.push(`Polycount: ${stats.triangles.toLocaleString()} triangles exceeds maximum 150,000`);
    }
    
    // Material count check: Maximum 10 materials (relaxed for testing)
    if (stats.materialCount > 5) {
      issues.push(`Material count: ${stats.materialCount} exceeds maximum 10`);
    }
    
    // Mesh count check: Maximum 10 meshes (relaxed for testing)
    if (stats.meshCount > 5) {
      issues.push(`Mesh count: ${stats.meshCount} exceeds maximum 10`);
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
    console.log(`=== CAPTURE SCREENSHOT CALLED ===`);
    console.log(`Angle:`, angle);
    console.log(`Index:`, index);
    console.log(`activeModelViewerRef:`, activeModelViewerRef);
    console.log(`activeModelViewerRef.current:`, activeModelViewerRef?.current);
    
    if (!activeModelViewerRef?.current) {
      console.error('No model viewer ref available for screenshot capture');
      return null;
    }

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
      console.log('Waiting for camera to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ensure model is loaded
      if (modelViewer.loaded) {
        console.log(`Model loaded, capturing ${angle.name}`);
      } else {
        console.log(`Waiting for model to load...`);
        // Wait longer for model to load
        let loadAttempts = 0;
        while (!modelViewer.loaded && loadAttempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          loadAttempts++;
          console.log(`Load attempt ${loadAttempts}/10, loaded: ${modelViewer.loaded}`);
        }
        
        if (!modelViewer.loaded) {
          console.warn('Model still not loaded after waiting, proceeding anyway...');
        }
      }
      
      // Additional wait to ensure everything is rendered
      console.log('Final wait for rendering...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture screenshot
      console.log('Attempting to capture screenshot...');
      
      // Check if toDataURL method exists
      if (typeof modelViewer.toDataURL !== 'function') {
        console.error('toDataURL method not available on model-viewer');
        console.log('Available methods:', Object.getOwnPropertyNames(modelViewer).filter(name => typeof modelViewer[name] === 'function'));
        
        // Try alternative method if available
        if (typeof modelViewer.toBlob === 'function') {
          console.log('Trying toBlob method instead...');
          const blob = await modelViewer.toBlob({ mimeType: 'image/png', qualityArgument: 0.8 });
          console.log('Blob created via toBlob, size:', blob.size);
          
          // Upload directly
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

          return urlData.publicUrl;
        }
        
        return null;
      }
      
      const canvas = await modelViewer.toDataURL('image/png', 0.8);
      console.log('Screenshot captured, data URL length:', canvas.length);
      
      if (!canvas || canvas.length < 100) {
        console.error('Invalid screenshot data received');
        return null;
      }
      
      // Convert to blob and upload to storage
      const response = await fetch(canvas);
      if (!response.ok) {
        console.error('Failed to fetch canvas data:', response.status);
        return null;
      }
      
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size);
      
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
    if (!activeModelViewerRef?.current) {
      console.warn('No model viewer ref available - make sure the 3D model is loaded on the page');
      return null;
    }

    try {
      const modelViewer = activeModelViewerRef.current;
      
      // Check if the model-viewer element exists and is ready
      if (!modelViewer || typeof modelViewer.loaded === 'undefined') {
        console.warn('Model viewer not ready yet - make sure the 3D model is loaded on the page');
        return null;
      }
      
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
    console.log('=== START CAPTURE CLICKED ===');
    console.log('Starting screenshot capture...');
    console.log('Model viewer ref:', activeModelViewerRef?.current);
    console.log('GLB URL:', glbUrl);
    console.log('Asset ID:', assetId);
    
    // Show immediate feedback
    toast.info('Starting QA capture...');
    
    setIsCapturing(true);
    setProgress(0);
    setCapturedScreenshots([]);

    try {
      // Ensure model-viewer is ready
      if (!activeModelViewerRef?.current) {
        throw new Error('Model viewer not available - make sure the 3D model is loaded on the page');
      }
      
      const modelViewer = activeModelViewerRef.current;
      console.log('Model viewer element:', modelViewer);
      console.log('Model viewer loaded:', modelViewer.loaded);
      console.log('Model viewer methods:', Object.getOwnPropertyNames(modelViewer).filter(name => typeof modelViewer[name] === 'function'));
      
      // Get model stats first
      console.log('Getting model stats...');
      const stats = await getModelStats();
      console.log('Model stats received:', stats);
      setModelStats(stats);

       if (!stats) {
         throw new Error('Failed to get model statistics');
       }

       console.log('Model stats validated, proceeding with validation...');

        // Validate model requirements before proceeding
        const validation = validateModelRequirements(stats);
        console.log('Validation result:', validation);
        console.log('Validation issues:', validation.issues);
      setValidationResult(validation);

      if (!validation.valid) {
        console.log('Model validation failed, showing issues to user...');
        console.log('Validation issues:', validation.issues);
        // Model doesn't meet requirements - show issues to user but don't auto-complete
        // The user can see the issues and decide whether to proceed anyway
        setIsCapturing(false);
        console.log('QA process stopped due to validation failure - user can see issues');
        return;
      }

      // Model meets requirements - proceed with screenshot capture
      console.log('Model validation passed, proceeding with screenshot capture...');
      // Capture screenshots from different angles
      const screenshots: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        setCurrentStep(i + 1);
        setProgress((i / 5) * 100);
        
        console.log(`Capturing screenshot ${i + 1}/5: ${cameraAngles[i].name}`);
        console.log(`About to call captureScreenshot for angle ${i + 1}...`);
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
            onClick={() => {
              console.log('Button clicked!');
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
