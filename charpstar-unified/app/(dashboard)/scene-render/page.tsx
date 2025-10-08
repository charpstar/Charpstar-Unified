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
import AssetLibraryPanel from "@/components/scene-render/AssetLibraryPanel";

type AppState = "upload" | "preview" | "generating" | "results" | "error";

export default function SceneRenderPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file.type !== "model/gltf-binary" && !file.name.endsWith(".glb")) {
      setError("Please select a valid .glb file");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setSelectedModelUrl(null); // Clear URL when using file
    setAppState("preview");
  };

  const handleAssetSelect = (asset: any) => {
    console.log("Asset selected:", asset);
    if (asset.glb_link) {
      setError(null);
      setSelectedFile(null); // Clear file when using URL
      setSelectedModelUrl(asset.glb_link); // Use URL directly
      setAppState("preview");
    }
  };

  const handleGenerate = async (
    snapshots: string[],
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
          base64Images: snapshots,
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
    setSelectedModelUrl(null);
    setError(null);
    setAppState("upload");
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSelectedModelUrl(null);
    setError(null);
    setGeneratedImages([]);
    setAppState("upload");
  };

  // Show loading state while user context is initializing
  if (user === null) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied only after user context has loaded and user doesn't have access
  if (
    !user ||
    (user.metadata?.role !== "client" && user.metadata?.role !== "admin")
  ) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
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
          (selectedFile || selectedModelUrl) && (
            <ModelPreviewer
              file={selectedFile}
              modelUrl={selectedModelUrl}
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
    <div className="w-full h-full p-2 space-y-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-1 h-7 text-xs"
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">3D Product Stager</h1>
        </div>

        {/* Compact Progress Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1 ${
              appState === "upload"
                ? "text-primary"
                : ["preview", "generating", "results"].includes(appState)
                  ? "text-green-600"
                  : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
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
            <span className="hidden sm:inline">Upload</span>
          </div>

          <div className="w-6 h-px bg-border"></div>

          <div
            className={`flex items-center gap-1 ${
              appState === "preview"
                ? "text-primary"
                : ["generating", "results"].includes(appState)
                  ? "text-green-600"
                  : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                appState === "preview"
                  ? "border-primary bg-primary/10"
                  : ["generating", "results"].includes(appState)
                    ? "border-green-600 bg-green-600/10"
                    : "border-muted-foreground"
              }`}
            >
              {["generating", "results"].includes(appState) ? "✓" : "2"}
            </div>
            <span className="hidden sm:inline">Configure</span>
          </div>

          <div className="w-6 h-px bg-border"></div>

          <div
            className={`flex items-center gap-1 ${
              appState === "generating"
                ? "text-primary"
                : appState === "results"
                  ? "text-green-600"
                  : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                appState === "generating"
                  ? "border-primary bg-primary/10"
                  : appState === "results"
                    ? "border-green-600 bg-green-600/10"
                    : "border-muted-foreground"
              }`}
            >
              {appState === "results" ? "✓" : "3"}
            </div>
            <span className="hidden sm:inline">Generate</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 ">
        {/* Main Content Area - Left Side (2/3 width) */}
        <div
          className="lg:col-span-2"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);

            try {
              const assetData = e.dataTransfer.getData("application/json");
              if (assetData) {
                const asset = JSON.parse(assetData);
                handleAssetSelect(asset);
              }
            } catch (err) {
              console.error("Error parsing dropped data:", err);
            }
          }}
        >
          <Card
            className={`h-full flex flex-col transition-all ${
              isDragging ? "ring-2 ring-primary bg-primary/5" : ""
            }`}
          >
            {/* Main Content Area */}
            <CardContent className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
              {isDragging && appState === "upload" && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-primary">
                      Drop asset here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Release to load the 3D model
                    </p>
                  </div>
                </div>
              )}

              {renderContent()}
            </CardContent>
          </Card>
        </div>

        {/* Asset Library Panel - Right Side (1/3 width) */}
        <div className="hidden lg:block">
          <AssetLibraryPanel onAssetSelect={handleAssetSelect} />
        </div>
      </div>
    </div>
  );
}
