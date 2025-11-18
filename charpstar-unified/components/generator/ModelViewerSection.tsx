"use client";

import React from "react";
import { Box, Download } from "lucide-react";
import { Button } from "@/components/ui/display/button";
import { Progress } from "@/components/ui/feedback/progress";
import { Skeleton } from "@/components/ui/skeletons";
import { ModelViewer } from "./ModelViewer";

interface ModelViewerSectionProps {
  generatedModel: string | null;
  isGenerating: boolean;
  generationProgress: number;
  availableFiles?: Array<{ type: string; url: string }>;
}

export function ModelViewerSection({
  generatedModel,
  isGenerating,
  generationProgress,
  availableFiles = [],
}: ModelViewerSectionProps) {
  const handleDownload = async (fileType: string = "GLB") => {
    // Find the file URL for the requested type
    const file = availableFiles.find((f) => f.type === fileType);

    if (file) {
      try {
        // Use proxy endpoint to bypass CORS restrictions
        const proxyUrl = `/api/hunyuan/download?url=${encodeURIComponent(file.url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`Failed to download ${fileType} file`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `generated_model_${Date.now()}.${fileType.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Error downloading ${fileType}:`, error);
        // Fallback: try direct download
        const link = document.createElement("a");
        link.href = file.url;
        link.download = `generated_model_${Date.now()}.${fileType.toLowerCase()}`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else if (fileType === "GLB" && generatedModel) {
      // Fallback for GLB if availableFiles not set yet
      const link = document.createElement("a");
      link.href = generatedModel;
      link.download = `generated_model_${Date.now()}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderContent = () => {
    // Show loading skeleton if actively generating
    if (isGenerating) {
      return (
        <>
          {/* Main viewer skeleton */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-4">
              <Skeleton className="h-[400px] w-full rounded-lg" />
              <div className="w-full max-w-xs mx-auto space-y-2">
                <Progress value={generationProgress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {generationProgress < 25
                    ? "Preparing images..."
                    : generationProgress < 40
                      ? "Uploading to server..."
                      : generationProgress < 50
                        ? "Starting AI processing..."
                        : generationProgress < 90
                          ? "Generating 3D model... (this may take a few minutes)"
                          : "Almost done..."}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  {generationProgress}% complete
                </p>
              </div>
            </div>
          </div>

          {/* Download section skeleton - matches actual bottom section */}
          <div className="p-4 border-t border-border bg-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </div>
        </>
      );
    }

    if (generatedModel) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1">
            <ModelViewer modelUrl={generatedModel} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
        <Box className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            3D Model Viewer
          </h3>
          <p className="text-muted-foreground">
            Upload images to generate a 3D model
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {isGenerating ? (
        renderContent()
      ) : (
        <>
          {/* Main content area */}
          <div className="flex-1">{renderContent()}</div>

          {/* Download section - always visible */}
          <div className="p-4 border-t border-border bg-muted">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4
                  className={`font-medium ${generatedModel ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {generatedModel ? "Model ready" : "No model generated"}
                </h4>
                <p
                  className={`text-sm ${generatedModel ? "text-muted-foreground" : "text-muted-foreground/70"}`}
                >
                  {availableFiles.length > 0
                    ? `Available formats: ${availableFiles.map((f) => f.type).join(", ")}`
                    : "GLB format"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {availableFiles.length > 0 ? (
                  availableFiles.map((file) => {
                    // Prioritize ZIP for OBJ format (contains OBJ + MTL + textures)
                    const isRecommended =
                      file.type === "ZIP" || file.type === "GLB";
                    return (
                      <Button
                        key={file.type}
                        onClick={() => handleDownload(file.type)}
                        size="sm"
                        variant={isRecommended ? "default" : "outline"}
                        disabled={!generatedModel}
                        className={
                          !generatedModel ? "opacity-50 cursor-not-allowed" : ""
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download {file.type}
                        {file.type === "ZIP" && " "}
                      </Button>
                    );
                  })
                ) : (
                  <Button
                    onClick={() => handleDownload("GLB")}
                    size="sm"
                    disabled={!generatedModel}
                    className={
                      !generatedModel ? "opacity-50 cursor-not-allowed" : ""
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download GLB
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
