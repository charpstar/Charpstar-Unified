"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
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
import SceneConfigurator from "@/components/scene-render/SceneConfigurator";
import Loader from "@/components/scene-render/Loader";
import ResultDisplay from "@/components/scene-render/ResultDisplay";
import AssetLibraryPanel from "@/components/scene-render/AssetLibraryPanel";
import { createClient } from "@/utils/supabase/client";

type AppState = "upload" | "preview" | "generating" | "results" | "error";

// Helper function to get viewer parameters based on client viewer type
const getViewerParameters = (viewerType?: string | null) => {
  switch (viewerType) {
    case "v6_aces":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
    case "v5_tester":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/warm.hdr",
        exposure: "1.3",
        toneMapping: "commerce",
      };
    case "synsam":
      return {
        environmentImage: "https://charpstar.se/3DTester/SynsamNewHDRI.jpg",
        exposure: "1",
        toneMapping: "aces",
      };
    case "v2":
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
    default:
      // Default to V6 ACES Tester
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
  }
};

export default function SceneRenderPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading, stopLoading } = useLoadingState();
  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [upscaledImages, setUpscaledImages] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [clientViewerType, setClientViewerType] = useState<string | null>(null);

  // Multi-asset mode states
  const [multiAssetMode, setMultiAssetMode] = useState(false);
  const [capturedAssets, setCapturedAssets] = useState<
    Array<{
      snapshot: string;
      name: string;
      dimensions: { x: number; y: number; z: number } | null;
    }>
  >([]);
  const [isCapturingAssets, setIsCapturingAssets] = useState(false);
  const [isDoneCapturing, setIsDoneCapturing] = useState(false);

  // Fetch client viewer type based on user's client
  useEffect(() => {
    const fetchClientViewerType = async () => {
      if (!user?.id) return;

      try {
        const supabase = createClient();

        // Get user's profile to find their client
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client")
          .eq("id", user.id)
          .single();

        if (profileData?.client) {
          // Get the first client name if it's an array
          const clientName = Array.isArray(profileData.client)
            ? profileData.client[0]
            : profileData.client;

          if (clientName) {
            // Fetch the client's viewer_type
            const { data: clientData } = await supabase
              .from("clients")
              .select("viewer_type")
              .eq("name", clientName)
              .single();

            if (clientData) {
              setClientViewerType(clientData.viewer_type);
            }
          }
        }
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Silently fail and use default viewer
        setClientViewerType(null);
      }
    };

    fetchClientViewerType();
  }, [user?.id]);

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
    } else {
      setError("This asset does not have a 3D model file available.");
    }
  };

  const handleCaptureAsset = (
    snapshot: string,
    dimensions: { x: number; y: number; z: number } | null
  ) => {
    // Add captured asset to the list
    const assetName =
      selectedFile?.name ||
      selectedModelUrl?.split("/").pop() ||
      `Asset ${capturedAssets.length + 1}`;
    setCapturedAssets([
      ...capturedAssets,
      { snapshot, name: assetName, dimensions },
    ]);

    // Reset for next asset selection
    setSelectedFile(null);
    setSelectedModelUrl(null);
    setAppState("upload");
  };

  const handleGenerate = async (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null
  ) => {
    // Multi-asset mode: capture each asset
    if (multiAssetMode && isCapturingAssets) {
      handleCaptureAsset(snapshots[0], null);
      return;
    }

    try {
      setAppState("generating");
      startLoading();
      setError(null);

      // Combine snapshots if in multi-asset mode
      const finalSnapshots =
        multiAssetMode && capturedAssets.length > 0
          ? [...capturedAssets.map((a) => a.snapshot), ...snapshots]
          : snapshots;

      const response = await fetch("/api/scene-render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Images: finalSnapshots,
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
        if (data.upscaledScenes && data.comparison) {
          setUpscaledImages(data.upscaledScenes);
          setShowComparison(true);
        }
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
    // If in done capturing state, go back to capturing mode
    if (isDoneCapturing) {
      setIsDoneCapturing(false);
      setIsCapturingAssets(true);
      setAppState("upload");
      return;
    }

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
    setUpscaledImages([]);
    setShowComparison(false);
    setMultiAssetMode(false);
    setCapturedAssets([]);
    setIsCapturingAssets(false);
    setIsDoneCapturing(false);
    setAppState("upload");
  };

  const handleRemoveAsset = (index: number) => {
    setCapturedAssets(capturedAssets.filter((_, i) => i !== index));
  };

  const handleDoneCapturing = () => {
    if (capturedAssets.length === 0) {
      setError("Please capture at least one asset");
      return;
    }
    setIsDoneCapturing(true);
    setIsCapturingAssets(false);
    setAppState("preview");
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
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4">
            {multiAssetMode &&
              isCapturingAssets &&
              capturedAssets.length > 0 && (
                <div className="w-full max-w-2xl mb-4">
                  <div className="p-3 sm:p-4 bg-primary/10 border border-primary rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                      <p className="text-sm font-semibold text-primary">
                        Captured Assets ({capturedAssets.length})
                      </p>
                      <Button
                        onClick={handleDoneCapturing}
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Done Adding Assets
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                      {capturedAssets.map((asset, index) => (
                        <div
                          key={index}
                          className="relative group bg-muted rounded-lg p-2"
                        >
                          <Image
                            width={320}
                            height={180}
                            src={`data:image/png;base64,${asset.snapshot}`}
                            alt={asset.name}
                            className="w-full h-20 sm:h-24 object-contain rounded"
                          />
                          <p className="text-xs mt-1 truncate">{asset.name}</p>
                          <button
                            onClick={() => handleRemoveAsset(index)}
                            className="absolute top-1 right-1 p-1 bg-destructive/90 rounded-full text-destructive-foreground hover:bg-destructive transition-colors shadow-md opacity-0 group-hover:opacity-100"
                            aria-label="Remove"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            <FileUploader onFileSelect={handleFileSelect} error={error} />

            {!isCapturingAssets && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <Button
                  onClick={() => {
                    setMultiAssetMode(!multiAssetMode);
                    if (!multiAssetMode) {
                      setIsCapturingAssets(true);
                      setCapturedAssets([]);
                    } else {
                      setIsCapturingAssets(false);
                      setCapturedAssets([]);
                    }
                  }}
                  variant={multiAssetMode ? "default" : "outline"}
                  size="sm"
                >
                  {multiAssetMode
                    ? "✓ Multi-Asset Mode Active"
                    : "Render Scene from Multiple Assets"}
                </Button>
                {multiAssetMode && (
                  <p className="text-xs text-muted-foreground text-center max-w-sm">
                    Capture multiple assets, then configure one shared
                    environment for all
                  </p>
                )}
              </div>
            )}
          </div>
        );
      case "preview":
        // If done capturing in multi-asset mode, show config UI without model viewer
        if (isDoneCapturing && multiAssetMode) {
          return (
            <div className="w-full h-full p-2 sm:p-4">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 p-3 sm:p-4 bg-primary/10 border border-primary rounded-lg">
                  <p className="text-sm font-semibold text-primary mb-2">
                    Configure Scene for {capturedAssets.length} Assets
                  </p>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {capturedAssets.map((asset, index) => (
                      <div key={index} className="bg-muted rounded p-2">
                        <Image
                          width={320}
                          height={180}
                          src={`data:image/png;base64,${asset.snapshot}`}
                          alt={asset.name}
                          className="w-full h-12 sm:h-16 object-contain rounded"
                        />
                        <p className="text-xs mt-1 truncate text-center">
                          {asset.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <SceneConfigurator
                  onGenerate={handleGenerate}
                  onCancel={handleCancel}
                  capturedAssets={capturedAssets}
                />
              </div>
            </div>
          );
        }

        return (
          (selectedFile || selectedModelUrl) && (
            <div className="w-full h-full flex flex-col gap-3">
              {multiAssetMode && isCapturingAssets && (
                <div className="p-3 bg-primary/10 border border-primary rounded-lg">
                  <p className="text-sm font-semibold text-primary">
                    Capturing Asset {capturedAssets.length + 1}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;Capture Asset&quot; to add this model to your
                    scene
                  </p>
                </div>
              )}
              <ModelPreviewer
                file={selectedFile}
                modelUrl={selectedModelUrl}
                onGenerate={handleGenerate}
                onCancel={handleCancel}
                environmentImage={
                  getViewerParameters(clientViewerType).environmentImage
                }
                exposure={getViewerParameters(clientViewerType).exposure}
                toneMapping={getViewerParameters(clientViewerType).toneMapping}
                captureMode={multiAssetMode && isCapturingAssets}
                captureButtonText={
                  multiAssetMode && isCapturingAssets
                    ? "Capture Asset"
                    : "Generate Scene"
                }
                onCaptureAsset={handleCaptureAsset}
              />
            </div>
          )
        );
      case "generating":
        return <Loader />;
      case "results":
        return (
          generatedImages && (
            <ResultDisplay
              images={generatedImages}
              upscaledImages={upscaledImages}
              showComparison={showComparison}
              onReset={handleReset}
            />
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
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-1 h-7 text-xs"
          >
            <ChevronLeft className="h-3 w-3" />
            <span className="hidden xs:inline">Back</span>
          </Button>
          <h1 className="text-base sm:text-lg font-semibold">
            3D Product Stager
          </h1>
        </div>

        {/* Responsive Progress Indicator */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs">
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
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-xs ${
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
            <span className="hidden xs:inline sm:inline">Upload</span>
          </div>

          <div className="w-4 sm:w-6 h-px bg-border"></div>

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
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-xs ${
                appState === "preview"
                  ? "border-primary bg-primary/10"
                  : ["generating", "results"].includes(appState)
                    ? "border-green-600 bg-green-600/10"
                    : "border-muted-foreground"
              }`}
            >
              {["generating", "results"].includes(appState) ? "✓" : "2"}
            </div>
            <span className="hidden xs:inline sm:inline">Configure</span>
          </div>

          <div className="w-4 sm:w-6 h-px bg-border"></div>

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
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-xs ${
                appState === "generating"
                  ? "border-primary bg-primary/10"
                  : appState === "results"
                    ? "border-green-600 bg-green-600/10"
                    : "border-muted-foreground"
              }`}
            >
              {appState === "results" ? "✓" : "3"}
            </div>
            <span className="hidden xs:inline sm:inline">Generate</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3 flex-1 min-h-[100px] ">
        {/* Main Content Area - Left Side (2/3 width on desktop) */}
        <div
          className="lg:col-span-2 order-1 lg:order-1 h-full overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            // Only set dragging to false if we're actually leaving the drop zone
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
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
              {isDragging && (
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

        {/* Asset Library Panel - Right Side (1/3 width on desktop, full width on mobile) */}
        <div className="order-2 lg:order-2 h-full overflow-hidden">
          <AssetLibraryPanel onAssetSelect={handleAssetSelect} />
        </div>
      </div>
    </div>
  );
}
