"use client";

import React, { useState } from "react";
import "./scene-render.css";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import FileUploader from "@/components/scene-render/FileUploader";
import ModelPreviewer from "@/components/scene-render/ModelPreviewer";
import Loader from "@/components/scene-render/Loader";
import ResultDisplay from "@/components/scene-render/ResultDisplay";

type AppState = "upload" | "preview" | "generating" | "results" | "error";

export default function SceneRenderPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const handleFileSelect = (file: File) => {
    if (file.type !== "model/gltf-binary" && !file.name.endsWith(".glb")) {
      setError("Please select a valid .glb file");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setAppState("preview");
  };

  const handleGenerate = async (
    snapshot: string,
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null
  ) => {
    try {
      setAppState("generating");
      startLoading();
      setError(null);

      const response = await fetch("/api/scene-render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image: snapshot,
          objectSize,
          objectType,
          sceneDescription,
          inspirationImage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate scenes");
      }

      const data = await response.json();
      if (data.scenes && data.scenes.length > 0) {
        setGeneratedImages(data.scenes);
        setAppState("results");
      } else {
        throw new Error("The AI did not return any images. Please try again.");
      }
    } catch (error) {
      console.error("Error generating scenes:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred."
      );
      setAppState("error");
    } finally {
      stopLoading();
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setError(null);
    setAppState("upload");
  };

  const handleReset = () => {
    setSelectedFile(null);
    setError(null);
    setGeneratedImages([]);
    setAppState("upload");
  };

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Card className="p-6 flex-1 flex flex-col border-0 shadow-none">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show access denied only after user context has loaded and user doesn't have access
  if (
    !user ||
    (user.metadata?.role !== "client" && user.metadata?.role !== "admin")
  ) {
    return (
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Card className="p-6 flex-1 flex flex-col border-0 shadow-none">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-semibold">
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              This page is only available for clients and administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (appState) {
      case "upload":
        return <FileUploader onFileSelect={handleFileSelect} error={error} />;
      case "preview":
        return (
          selectedFile && (
            <ModelPreviewer
              file={selectedFile}
              onGenerate={handleGenerate}
              onCancel={handleCancel}
            />
          )
        );
      case "generating":
        return <Loader />;
      case "results":
        return (
          generatedImages && (
            <ResultDisplay images={generatedImages} onReset={handleReset} />
          )
        );
      case "error":
        return (
          <div className="text-center p-6">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
              <h3 className="text-lg font-semibold text-destructive mb-2">
                An Error Occurred
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleReset} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </div>
        );
      default:
        return <FileUploader onFileSelect={handleFileSelect} error={error} />;
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2 h-8 sm:h-9 text-sm"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </div>

      <Card className="p-3 sm:p-6 flex-1 flex flex-col border-0 shadow-none">
        {/* Page Title and Description */}
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl sm:text-3xl font-bold mb-2">
            3D Product Stager
          </CardTitle>
          <p className="text-muted-foreground text-sm sm:text-base">
            Instantly create professional e-commerce photoshoots for your 3D
            models.
          </p>
        </CardHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Step 1 - Upload */}
            <div
              className={`flex items-center gap-2 ${
                appState === "upload"
                  ? "text-primary"
                  : ["preview", "generating", "results"].includes(appState)
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
                  appState === "upload"
                    ? "border-primary bg-primary/10"
                    : ["preview", "generating", "results"].includes(appState)
                      ? "border-green-600 bg-green-600/10"
                      : "border-muted-foreground"
                }`}
              >
                {["preview", "generating", "results"].includes(appState)
                  ? "✓"
                  : "1"}
              </div>
              <span className="text-xs sm:text-sm font-medium">Upload</span>
            </div>

            {/* Divider */}
            <div className="w-8 sm:w-12 h-px bg-border"></div>

            {/* Step 2 - Configure */}
            <div
              className={`flex items-center gap-2 ${
                appState === "preview"
                  ? "text-primary"
                  : ["generating", "results"].includes(appState)
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
                  appState === "preview"
                    ? "border-primary bg-primary/10"
                    : ["generating", "results"].includes(appState)
                      ? "border-green-600 bg-green-600/10"
                      : "border-muted-foreground"
                }`}
              >
                {["generating", "results"].includes(appState) ? "✓" : "2"}
              </div>
              <span className="text-xs sm:text-sm font-medium">Configure</span>
            </div>

            {/* Divider */}
            <div className="w-8 sm:w-12 h-px bg-border"></div>

            {/* Step 3 - Generate */}
            <div
              className={`flex items-center gap-2 ${
                appState === "generating"
                  ? "text-primary"
                  : appState === "results"
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
                  appState === "generating"
                    ? "border-primary bg-primary/10"
                    : appState === "results"
                      ? "border-green-600 bg-green-600/10"
                      : "border-muted-foreground"
                }`}
              >
                {appState === "results" ? "✓" : "3"}
              </div>
              <span className="text-xs sm:text-sm font-medium">Generate</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <CardContent className="flex-1 flex items-center justify-center min-h-[400px]">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
