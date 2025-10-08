"use client";

import React, { useState, useEffect } from "react";
import { Box, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/display/button";
import { Progress } from "@/components/ui/feedback/progress";
import { ModelViewer } from "./ModelViewer";

interface ModelViewerSectionProps {
  generatedModel: string | null;
  isGenerating: boolean;
  generationProgress: number;
}

export function ModelViewerSection({
  generatedModel,
  isGenerating,
  generationProgress,
}: ModelViewerSectionProps) {
  const handleDownload = () => {
    if (generatedModel) {
      const link = document.createElement("a");
      link.href = generatedModel;
      link.download = `generated_model_${Date.now()}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderContent = () => {
    // Show loading if actively generating
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">
            Generating 3D model
          </h3>
          <div className="w-full max-w-xs space-y-2">
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
      );
    }

    if (generatedModel) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1">
            <ModelViewer modelUrl={generatedModel} className="w-full h-full" />
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
      {/* Main content area */}
      <div className="flex-1">{renderContent()}</div>

      {/* Download section - always visible */}
      <div className="p-4 border-t border-border bg-muted flex items-center justify-between">
        <div>
          <h4
            className={`font-medium ${generatedModel ? "text-foreground" : "text-muted-foreground"}`}
          >
            {generatedModel ? "Model ready" : "No model generated"}
          </h4>
          <p
            className={`text-sm ${generatedModel ? "text-muted-foreground" : "text-muted-foreground/70"}`}
          >
            GLB format
          </p>
        </div>
        <Button
          onClick={handleDownload}
          size="sm"
          disabled={!generatedModel}
          className={!generatedModel ? "opacity-50 cursor-not-allowed" : ""}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
}
