"use client";

import React, { useState } from "react";
import "./scene-render.css";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
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
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            This page is only available for clients and administrators.
          </p>
        </div>
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
          <div className="text-center p-8 glass-card rounded-xl shadow-2xl animate-fade-in">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              An Error Occurred
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
            <button onClick={handleReset} className="btn btn-primary">
              Try Again
            </button>
          </div>
        );
      default:
        return <FileUploader onFileSelect={handleFileSelect} error={error} />;
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-transparent flex flex-col items-center justify-center p-4">
      {/* Header with Back Button */}
      <header className="w-full max-w-4xl mx-auto text-center mb-10">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          3D Product Stager
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-3">
          Instantly create professional e-commerce photoshoots for your 3D
          models.
        </p>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl min-h-[500px] flex items-center justify-center mx-auto">
        {renderContent()}
      </main>

      {/* Footer */}
    </div>
  );
}
