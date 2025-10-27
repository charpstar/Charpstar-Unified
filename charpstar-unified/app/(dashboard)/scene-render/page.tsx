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
import MultiAssetSnapshotCapture from "@/components/scene-render/MultiAssetSnapshotCapture";
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
  const [selectedAssets, setSelectedAssets] = useState<
    Array<{
      id: string;
      name: string;
      glb_link: string;
      category?: string;
      thumbnail?: string;
    }>
  >([]);

  // Image format states
  const [imageFormat, setImageFormat] = useState("square");
  const [customWidth, setCustomWidth] = useState("1080");
  const [customHeight, setCustomHeight] = useState("1080");

  // Collapse state for asset library panel
  const [isAssetPanelCollapsed, setIsAssetPanelCollapsed] = useState(false);

  // Dialog state for scene configuration
  const [showSceneConfigDialog, setShowSceneConfigDialog] = useState(false);

  // Multi-asset snapshot capture state
  const [isCapturingSnapshots, setIsCapturingSnapshots] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [capturedSnapshots, setCapturedSnapshots] = useState<string[]>([]);

  // Scene generation metadata
  const [lastSceneDescription, setLastSceneDescription] = useState<string>("");
  const [lastObjectType, setLastObjectType] = useState<string>("");
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);

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

    if (multiAssetMode) {
      // Multi-asset mode: add/remove from selection
      const isAlreadySelected = selectedAssets.some((a) => a.id === asset.id);

      if (isAlreadySelected) {
        // Remove from selection
        setSelectedAssets((prev) => prev.filter((a) => a.id !== asset.id));
      } else {
        // Add to selection
        if (asset.glb_link) {
          setSelectedAssets((prev) => [
            ...prev,
            {
              id: asset.id,
              name: asset.product_name || asset.name || "Unnamed Asset",
              glb_link: asset.glb_link,
              category: asset.category,
              thumbnail: asset.thumbnail_url,
            },
          ]);
        } else {
          setError("This asset does not have a 3D model file available.");
        }
      }
    } else {
      // Single asset mode: load for preview
      if (asset.glb_link) {
        setError(null);
        setSelectedFile(null); // Clear file when using URL
        setSelectedModelUrl(asset.glb_link); // Use URL directly
        setCurrentModelId(asset.id); // Store model ID for scene saving
        setCurrentModelUrl(asset.glb_link); // Store model URL for scene saving
        setAppState("preview");
      } else {
        setError("This asset does not have a 3D model file available.");
      }
    }
  };

  const handleGenerate = async (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null,
    imageFormat?: string,
    customWidth?: string,
    customHeight?: string
  ) => {
    // Store scene metadata for later use
    setLastSceneDescription(sceneDescription);
    setLastObjectType(objectType);

    // If in multi-asset mode and we have selected assets, start snapshot capture
    if (multiAssetMode && selectedAssets.length > 0) {
      setIsCapturingSnapshots(true);
      setAppState("generating");
      return;
    }

    // Single asset mode or multi-asset with captured snapshots
    try {
      setAppState("generating");
      startLoading();
      setError(null);

      // Get auth token for API requests
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/scene-render", {
        method: "POST",
        headers,
        body: JSON.stringify({
          base64Images: snapshots,
          objectSize,
          objectType,
          sceneDescription,
          inspirationImage,
          imageFormat: imageFormat || "square",
          customWidth: customWidth || "1080",
          customHeight: customHeight || "1080",
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
    setSelectedAssets([]);
    setIsCapturingSnapshots(false);
    setCapturedSnapshots([]);
    setAppState("upload");
  };

  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((asset) => asset.id !== assetId));
  };

  const handleAllSnapshotsCaptured = async (snapshots: string[]) => {
    setCapturedSnapshots(snapshots);
    setIsCapturingSnapshots(false);

    // Now generate the scene with the captured snapshots
    try {
      setAppState("generating");
      startLoading();
      setError(null);

      // Get auth token for API requests
      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Create size description for multi-asset mode
      const sizeDescription = selectedAssets
        .map(
          (asset, index) =>
            `Asset ${index + 1} (${asset.name}): Dimensions calculated from 3D model`
        )
        .join("; ");

      const response = await fetch("/api/scene-render", {
        method: "POST",
        headers,
        body: JSON.stringify({
          base64Images: snapshots,
          objectSize: sizeDescription,
          objectType: "Multiple Products", // You might want to make this configurable
          sceneDescription: "Professional product scene with multiple items",
          inspirationImage: null,
          imageFormat: imageFormat,
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

  const handleSnapshotError = (error: string) => {
    setIsCapturingSnapshots(false);
    setError(error);
    setAppState("error");
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
          <CardContent className="h-full">
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-6">
            {multiAssetMode && selectedAssets.length > 0 && (
              <div className="w-full max-w-4xl">
                <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold text-sm">
                          {selectedAssets.length}
                        </span>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-primary">
                          Selected Assets
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Click Configure Scene to continue
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowSceneConfigDialog(true)}
                      variant="default"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Configure Scene
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {selectedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="relative group bg-background/50 rounded-xl p-3 hover:bg-background/80 transition-all duration-200"
                      >
                        {asset.thumbnail ? (
                          <Image
                            width={320}
                            height={180}
                            src={asset.thumbnail}
                            alt={asset.name}
                            className="w-full h-20 sm:h-24 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-20 sm:h-24 bg-muted rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                          </div>
                        )}
                        <p className="text-xs mt-2 truncate font-medium">
                          {asset.name}
                        </p>
                        <button
                          onClick={() => handleRemoveAsset(asset.id)}
                          className="absolute top-2 right-2 p-1.5 bg-destructive/90 rounded-full text-destructive-foreground hover:bg-destructive transition-all duration-200 shadow-lg opacity-0 group-hover:opacity-100"
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
                </Card>
              </div>
            )}

            <FileUploader onFileSelect={handleFileSelect} error={error} />

            <div className="flex flex-col items-center gap-4 mt-6">
              <Button
                onClick={() => {
                  setMultiAssetMode(!multiAssetMode);
                  if (multiAssetMode) {
                    setSelectedAssets([]);
                  }
                }}
                variant={multiAssetMode ? "default" : "outline"}
                size="lg"
                className="px-8 py-3"
              >
                {multiAssetMode
                  ? "✓ Multi-Asset Mode Active"
                  : "Render Scene from Multiple Assets"}
              </Button>
              {multiAssetMode && (
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Click on assets in the library to select them for your scene
                </p>
              )}
            </div>
          </div>
        );
      case "preview":
        return (
          (selectedFile || selectedModelUrl) && (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <ModelPreviewer
                  file={selectedFile}
                  modelUrl={selectedModelUrl}
                  onGenerate={handleGenerate}
                  onCancel={handleCancel}
                  environmentImage={
                    getViewerParameters(clientViewerType).environmentImage
                  }
                  exposure={getViewerParameters(clientViewerType).exposure}
                  toneMapping={
                    getViewerParameters(clientViewerType).toneMapping
                  }
                  imageFormat={imageFormat}
                  customWidth={customWidth}
                  customHeight={customHeight}
                  onImageFormatChange={setImageFormat}
                  onCustomDimensionsChange={(width, height) => {
                    setCustomWidth(width);
                    setCustomHeight(height);
                  }}
                />
              </div>
            </div>
          )
        );
      case "generating":
        if (isCapturingSnapshots) {
          return (
            <MultiAssetSnapshotCapture
              selectedAssets={selectedAssets}
              onAllSnapshotsCaptured={handleAllSnapshotsCaptured}
              onError={handleSnapshotError}
              environmentImage={
                getViewerParameters(clientViewerType).environmentImage
              }
              exposure={getViewerParameters(clientViewerType).exposure}
              toneMapping={getViewerParameters(clientViewerType).toneMapping}
            />
          );
        }
        return <Loader />;
      case "results":
        return (
          generatedImages && (
            <ResultDisplay
              images={generatedImages}
              upscaledImages={upscaledImages}
              showComparison={showComparison}
              onReset={handleReset}
              imageFormat={imageFormat}
              customWidth={customWidth}
              customHeight={customHeight}
              sceneDescription={lastSceneDescription}
              objectType={lastObjectType}
              sourceModelId={currentModelId || undefined}
              sourceModelUrl={currentModelUrl || undefined}
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
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-background to-muted/20 overflow-hidden">
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2 hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Back to Dashboard</span>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">3D</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                3D Product Stager
              </h1>
              <p className="text-sm text-muted-foreground">
                Create stunning product scenes
              </p>
            </div>
          </div>
        </div>

        {/* Modern Progress Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {[
              { key: "upload", label: "Upload", step: 1 },
              { key: "preview", label: "Configure", step: 2 },
              { key: "generating", label: "Generate", step: 3 },
            ].map((step, index) => {
              const isActive = appState === step.key;
              const isCompleted =
                ["preview", "generating", "results"].includes(appState) &&
                (step.key === "upload" ||
                  (step.key === "preview" &&
                    ["generating", "results"].includes(appState)));

              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : isCompleted
                          ? "bg-green-500 text-white shadow-lg"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? "✓" : step.step}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:inline ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                          ? "text-green-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < 2 && (
                    <div
                      className={`w-6 h-px ${
                        isCompleted ? "bg-green-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-col lg:grid gap-6 flex-1 p-6 transition-all duration-500 ease-out ${
          isAssetPanelCollapsed ? "lg:grid-cols-[1fr_80px]" : "lg:grid-cols-3"
        }`}
      >
        {/* Main Content Area - Left Side (2/3 width on desktop) */}
        <div
          className={`order-1 lg:order-1 h-full overflow-hidden transition-all bg-background duration-500 ease-out ${
            isAssetPanelCollapsed ? "" : "lg:col-span-2"
          }`}
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
            className={`h-full flex flex-col p-0  bg-background border-0 transition-all duration-300 ${
              isDragging
                ? "ring-2 ring-primary bg-primary/5 scale-[1.02]"
                : "hover:shadow-3xl"
            }`}
          >
            {/* Main Content Area */}
            <CardContent className="  relative h-full">
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-2xl z-10 backdrop-blur-sm">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
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
        <div className="order-2 lg:order-2 h-full ">
          <AssetLibraryPanel
            onAssetSelect={handleAssetSelect}
            isCollapsed={isAssetPanelCollapsed}
            onToggleCollapse={() =>
              setIsAssetPanelCollapsed(!isAssetPanelCollapsed)
            }
            multiAssetMode={multiAssetMode}
            selectedAssets={selectedAssets}
          />
        </div>
      </div>

      {/* Scene Configuration Dialog */}
      {showSceneConfigDialog && (
        <SceneConfigurator
          onGenerate={handleGenerate}
          onCancel={() => setShowSceneConfigDialog(false)}
          selectedAssets={selectedAssets}
          imageFormat={imageFormat}
          customWidth={customWidth}
          customHeight={customHeight}
          onImageFormatChange={setImageFormat}
          onCustomDimensionsChange={(width, height) => {
            setCustomWidth(width);
            setCustomHeight(height);
          }}
        />
      )}
    </div>
  );
}
