"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import FileUploader from "@/components/scene-render/FileUploader";
import VideoLoader from "@/components/video-gen/VideoLoader";
import AssetLibraryPanel from "@/components/scene-render/AssetLibraryPanel";
import VideoModelPreviewer from "@/components/video-gen/VideoModelPreviewer";
import VideoResultDisplay from "@/components/video-gen/VideoResultDisplay";
import VideoSceneInput from "@/components/video-gen/VideoSceneInput";
import MultiAssetSnapshotCapture from "@/components/scene-render/MultiAssetSnapshotCapture";
import { createClient } from "@/utils/supabase/client";

type AppState = "upload" | "preview" | "generating" | "results" | "error";

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
        environmentImage: "https://demosetc.b-cdn.net/HDR/HDRI-Default.hdr",
        exposure: "1.3",
        toneMapping: "linear",
      };
    case "v4":
      return {
        environmentImage: "https://demosetc.b-cdn.net/HDR/HDRI-Default.hdr",
        exposure: "1.3",
        toneMapping: "aces",
      };
    default:
      return {
        environmentImage: "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
        exposure: "1.2",
        toneMapping: "aces",
      };
  }
};

export default function VideoGenPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientViewerType, setClientViewerType] = useState<string | null>(null);

  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [lastSceneDescription, setLastSceneDescription] = useState<string>("");
  const [lastObjectType, setLastObjectType] = useState<string>("Product");
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);

  const [videoResolution, setVideoResolution] = useState("720p");
  const [videoDuration, setVideoDuration] = useState("8");
  const [isAssetPanelCollapsed, setIsAssetPanelCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Multi-asset mode states
  const [multiAssetMode, setMultiAssetMode] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<
    Array<{
      id: string;
      product_name: string;
      glb_link: string;
      category?: string;
      preview_image?: string;
    }>
  >([]);
  const [isCapturingSnapshots, setIsCapturingSnapshots] = useState(false);

  useEffect(() => {
    const fetchClientViewerType = async () => {
      if (!user?.id) return;

      try {
        const supabase = createClient();
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client")
          .eq("id", user.id)
          .single();

        if (profileData?.client) {
          const clientName = Array.isArray(profileData.client)
            ? profileData.client[0]
            : profileData.client;

          if (clientName) {
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
      } catch (fetchError) {
        console.warn("Failed to fetch client viewer type", fetchError);
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
    setSelectedModelUrl(null);
    setAppState("preview");
  };

  const handleAssetSelect = (asset: any) => {
    if (!asset.glb_link) {
      setError("This asset does not include a GLB file");
      return;
    }

    // Multi-asset mode: toggle selection
    if (multiAssetMode) {
      setError(null);
      const isAlreadySelected = selectedAssets.some((a) => a.id === asset.id);

      if (isAlreadySelected) {
        // Remove from selection
        setSelectedAssets((prev) => prev.filter((a) => a.id !== asset.id));
      } else {
        // Add to selection (VEO supports up to 3 asset references)
        if (selectedAssets.length < 3) {
          setSelectedAssets((prev) => [
            ...prev,
            {
              id: asset.id,
              product_name: asset.product_name || "Unnamed Asset",
              glb_link: asset.glb_link,
              category: asset.category,
              preview_image: asset.preview_image,
            },
          ]);
        } else {
          setError("Maximum 3 assets can be selected for video generation");
        }
      }
      return;
    }

    // Single asset mode: load immediately
    setSelectedFile(null);
    setSelectedModelUrl(asset.glb_link);
    setCurrentModelId(asset.id);
    setCurrentModelUrl(asset.glb_link);
    setAppState("preview");
  };

  const handleGenerate = async (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null,
    resolution: string,
    durationSeconds: string
  ) => {
    if (!snapshots.length) {
      setError("Unable to capture model snapshot for video generation.");
      return;
    }

    setLastSceneDescription(sceneDescription);
    setLastObjectType(objectType);

    try {
      setAppState("generating");
      startLoading();
      setError(null);

      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/video-gen", {
        method: "POST",
        headers,
        body: JSON.stringify({
          base64Images: snapshots,
          objectSize,
          objectType,
          sceneDescription,
          inspirationImage,
          resolution,
          durationSeconds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate video scene");
      }

      const data = await response.json();
      if (data.videoUrl) {
        setGeneratedVideoUrl(data.videoUrl);
        setPosterImage(data.posterImage || snapshots[0]);
        setAppState("results");
      } else {
        throw new Error("Video generation did not return a valid clip.");
      }
    } catch (generationError) {
      console.error("Video generation error:", generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "An unknown error occurred while generating the video."
      );
      setAppState("error");
    } finally {
      stopLoading();
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSelectedModelUrl(null);
    setError(null);
    setGeneratedVideoUrl(null);
    setPosterImage(null);
    setSelectedAssets([]);
    setAppState("upload");
  };

  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((asset) => asset.id !== assetId));
  };

  const handleAllSnapshotsCaptured = async (snapshots: string[]) => {
    setIsCapturingSnapshots(false);

    // Now generate the video with the captured snapshots
    try {
      setAppState("generating");
      startLoading();
      setError(null);

      const supabase = createClient();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const sizeDescription = selectedAssets
        .map((asset) => `${asset.product_name}`)
        .join(", ");

      const response = await fetch("/api/video-gen", {
        method: "POST",
        headers,
        body: JSON.stringify({
          base64Images: snapshots,
          objectSize: sizeDescription,
          objectType: lastObjectType || "Product",
          sceneDescription: lastSceneDescription,
          inspirationImage: null,
          resolution: videoResolution,
          durationSeconds: videoDuration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate video scene");
      }

      const data = await response.json();
      if (data.videoUrl) {
        setGeneratedVideoUrl(data.videoUrl);
        setPosterImage(data.posterImage || snapshots[0]);
        setAppState("results");
      } else {
        throw new Error("Video generation did not return a valid clip.");
      }
    } catch (generationError) {
      console.error("Video generation error:", generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "An unknown error occurred while generating the video."
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

  const renderContent = () => {
    switch (appState) {
      case "upload":
        return (
          <div className="w-full h-full flex flex-col p-6">
            {multiAssetMode ? (
              // Multi-asset mode with modern design
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <div className="w-full max-w-2xl flex flex-col gap-6">
                    {/* Upload Zone */}
                    <FileUploader
                      onFileSelect={handleFileSelect}
                      error={error}
                    />

                    {/* Selected Assets - Pills aligned with upload zone */}
                    {selectedAssets.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground font-medium mr-2">
                          {selectedAssets.length} selected:
                        </span>
                        {selectedAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-sm group hover:bg-primary/20 transition-colors"
                          >
                            <span className="text-foreground font-medium truncate max-w-[100px]">
                              {asset.product_name}
                            </span>
                            <button
                              onClick={() => handleRemoveAsset(asset.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                              aria-label="Remove"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
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
                    )}
                  </div>
                </div>

                {/* Video Configuration - Always visible textarea */}
                <div className="border-t bg-background/95 backdrop-blur-sm">
                  <VideoSceneInput
                    onGenerate={async (
                      snapshots,
                      objectSizeDesc,
                      objectTypeDesc,
                      sceneDesc,
                      inspirationImg,
                      resolutionValue
                    ) => {
                      setLastSceneDescription(sceneDesc);
                      setLastObjectType(objectTypeDesc);
                      setVideoResolution(resolutionValue);
                      // VEO 3.1 preview only supports 8 seconds
                      setVideoDuration("8");
                      
                      // Start capturing snapshots from all selected assets
                      setIsCapturingSnapshots(true);
                      setAppState("generating");
                    }}
                    onCancel={() => {
                      setMultiAssetMode(false);
                      setSelectedAssets([]);
                    }}
                    currentResolution={videoResolution}
                    onResolutionChange={setVideoResolution}
                    objectSizeDescription=""
                    objectType="Product"
                    onObjectTypeChange={() => {}}
                  />
                </div>
              </div>
            ) : (
              // Single asset mode - original design
              <div className="w-full h-full flex flex-col items-center justify-center gap-6">
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
                      : "Render Video from Multiple Assets"}
                  </Button>
                  {multiAssetMode && (
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Click on assets in the library to select them for your
                      video
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case "preview":
        if (!selectedFile && !selectedModelUrl) return null;
        return (
          <VideoModelPreviewer
            file={selectedFile}
            modelUrl={selectedModelUrl}
            onGenerate={handleGenerate}
            onCancel={handleReset}
            environmentImage={getViewerParameters(clientViewerType).environmentImage}
            exposure={getViewerParameters(clientViewerType).exposure}
            toneMapping={getViewerParameters(clientViewerType).toneMapping}
            resolution={videoResolution}
            onResolutionChange={setVideoResolution}
          />
        );
      case "generating":
        if (isCapturingSnapshots) {
          return (
            <MultiAssetSnapshotCapture
              selectedAssets={selectedAssets.map(asset => ({
                id: asset.id,
                name: asset.product_name,
                glb_link: asset.glb_link,
                category: asset.category,
                thumbnail: asset.preview_image,
              }))}
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
        return <VideoLoader />;
      case "results":
        if (!generatedVideoUrl) return null;
        return (
          <VideoResultDisplay
            videoUrl={generatedVideoUrl}
            posterImage={posterImage ? `data:image/png;base64,${posterImage}` : null}
            resolution={videoResolution}
            durationSeconds={videoDuration}
            sceneDescription={lastSceneDescription}
            objectType={lastObjectType}
            onReset={handleReset}
            sourceModelId={currentModelId || undefined}
            sourceModelUrl={currentModelUrl || undefined}
          />
        );
      case "error":
        return (
          <div className="text-center p-6">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleReset} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

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

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-background to-muted/20 overflow-hidden">
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
            className={`h-full flex flex-col p-0 bg-background border-0 transition-all duration-300 ${
              isDragging
                ? "ring-2 ring-primary bg-primary/5 scale-[1.02]"
                : "hover:shadow-3xl"
            }`}
          >
            {/* Main Content Area */}
            <CardContent className="relative h-full">
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
                      Drop GLB model here
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

        <div className="order-2 lg:order-2 h-full">
          <AssetLibraryPanel
            onAssetSelect={handleAssetSelect}
            isCollapsed={isAssetPanelCollapsed}
            onToggleCollapse={() =>
              setIsAssetPanelCollapsed((prev) => !prev)
            }
            multiAssetMode={multiAssetMode}
            selectedAssets={selectedAssets.map(asset => ({
              id: asset.id,
              name: asset.product_name,
              glb_link: asset.glb_link,
              category: asset.category,
              thumbnail: asset.preview_image,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

