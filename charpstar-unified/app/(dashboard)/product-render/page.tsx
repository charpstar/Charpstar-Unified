"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoadingState } from "@/hooks/useLoadingState";
import { Button } from "@/components/ui/display";
import { Card, CardContent } from "@/components/ui/containers";
import { ChevronLeft, Download, Play, X, Check } from "lucide-react";
import AssetLibraryPanel from "@/components/scene-render/AssetLibraryPanel";
import { ModelViewer } from "@/components/generator/ModelViewer";

type AppState = "select" | "configure" | "generating" | "results" | "error";

interface SelectedProduct {
  id: string;
  product_name: string;
  glb_link: string;
  category?: string;
}

interface RenderSettings {
  resolution: string;
  imageFormat: string;
  quality: string;
  renderMargin: number;
  cameraViews: string[];
}

interface RenderJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  downloadUrl?: string;
  settings: RenderSettings;
  products: SelectedProduct[];
  createdAt: string;
}

export default function ProductRenderPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoadingState();

  const [appState, setAppState] = useState<AppState>("select");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    []
  );
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    resolution: "2048x2048",
    imageFormat: "JPEG",
    quality: "medium",
    renderMargin: 20,
    cameraViews: ["front", "angled_side1", "side", "top"],
  });
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingCleanupRef = React.useRef<(() => void) | null>(null);

  // Asset Library Panel state
  const [isAssetPanelCollapsed, setIsAssetPanelCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Load existing jobs and products on mount
  useEffect(() => {
    loadJobs();

    // Check for active job in localStorage on mount
    const savedJobId = localStorage.getItem("activeRenderJobId");
    if (savedJobId) {
      console.log("[Product Render] Restoring active job:", savedJobId);
      // Restore the job and start polling
      setAppState("generating");
      startLoading();

      // Fetch the job details
      fetch(`/api/product-render/jobs/${savedJobId}/status`)
        .then((res) => res.json())
        .then((data) => {
          console.log("[Product Render] Restored job status:", data);
          if (data.status === "completed") {
            setCurrentJob({ ...data, id: savedJobId });
            setAppState("results");
            stopLoading();
            localStorage.removeItem("activeRenderJobId");
          } else if (data.status === "failed") {
            setError("Job failed");
            setAppState("error");
            stopLoading();
            localStorage.removeItem("activeRenderJobId");
          } else {
            // Job is still processing
            setCurrentJob({ ...data, id: savedJobId });
            const cleanup = pollJobStatus(savedJobId);
            pollingCleanupRef.current = cleanup;
          }
        })
        .catch((error) => {
          console.error("Error restoring job:", error);
          localStorage.removeItem("activeRenderJobId");
          stopLoading();
        });
    }

    // Cleanup polling when component unmounts
    return () => {
      if (pollingCleanupRef.current) {
        console.log("[Product Render] Cleaning up polling on unmount");
        pollingCleanupRef.current();
      }
    };
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch("/api/product-render/jobs");
      if (response.ok) {
        const data = await response.json();
        console.log("Jobs loaded:", data.jobs || []);
      }
    } catch (error) {
      console.error("Error loading jobs:", error);
    }
  };

  const handleAssetSelect = (asset: any) => {
    console.log("Asset selected:", asset);
    if (!asset.glb_link) {
      setError("This asset does not have a 3D model file available.");
      return;
    }

    setError(null);
    // Replace selection with only this product
    setSelectedProducts([
      {
        id: asset.id,
        product_name: asset.product_name,
        glb_link: asset.glb_link,
        category: asset.category,
      },
    ]);

    // Automatically transition to configure state
    setAppState("configure");
  };

  const handleSubmitJob = async () => {
    if (selectedProducts.length === 0) {
      setError("Please select a product");
      return;
    }

    try {
      setAppState("generating");
      startLoading();
      setError(null);

      const response = await fetch("/api/product-render/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: selectedProducts,
          settings: renderSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit render job");
      }

      const data = await response.json();
      setCurrentJob(data.job);

      // Save job ID to localStorage so it persists across page refreshes
      localStorage.setItem("activeRenderJobId", data.job.id);

      // Stay in "generating" state while job is being processed
      // pollJobStatus will update to "results" when complete

      // Start polling for job status and store cleanup function
      const cleanup = pollJobStatus(data.job.id);
      pollingCleanupRef.current = cleanup;
    } catch (error) {
      console.error("Error submitting job:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred."
      );
      setAppState("error");
    } finally {
      stopLoading();
    }
  };

  const pollJobStatus = (jobId: string) => {
    let pollCount = 0;
    const maxPollsBeforeWarning = 30; // 30 polls * 2 seconds = 60 seconds
    const maxPolls = 300; // 300 polls * 2 seconds = 10 minutes max
    let timeoutId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        pollCount++;

        // Stop polling if we've exceeded the maximum
        if (pollCount > maxPolls) {
          console.error("[Product Render] Max polling attempts reached");
          setError(
            "Render job timed out after 10 minutes. Please check the render client."
          );
          setAppState("error");
          localStorage.removeItem("activeRenderJobId");
          stopLoading();
          return;
        }

        const response = await fetch(
          `/api/product-render/jobs/${jobId}/status`
        );
        if (!response.ok) {
          throw new Error("Failed to check job status");
        }

        const data = await response.json();

        if (data.status === "completed") {
          setCurrentJob((prev) =>
            prev
              ? { ...prev, status: "completed", downloadUrl: data.downloadUrl }
              : null
          );
          setAppState("results"); // Show results screen when complete
          localStorage.removeItem("activeRenderJobId"); // Clear saved job
          stopLoading();
        } else if (data.status === "failed") {
          setError("Job failed");
          setAppState("error");
          localStorage.removeItem("activeRenderJobId"); // Clear saved job
          stopLoading();
        } else {
          // Still processing, update progress and check again in 2 seconds
          setCurrentJob((prev) =>
            prev
              ? { ...prev, status: data.status, progress: data.progress }
              : null
          );

          // Warn if job has been queued for too long
          if (data.status === "queued" && pollCount >= maxPollsBeforeWarning) {
            setError(
              "Job has been queued for over 60 seconds. Make sure the render client is running."
            );
            setAppState("error");
            localStorage.removeItem("activeRenderJobId"); // Clear saved job
            stopLoading();
            return;
          }

          timeoutId = setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error("Error checking job status:", error);
        setError("Failed to check job status");
        setAppState("error");
        localStorage.removeItem("activeRenderJobId"); // Clear saved job
        stopLoading();
      }
    };

    checkStatus();

    // Return cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  };

  const handleReset = () => {
    // Clean up any active polling
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }

    // Clear localStorage
    localStorage.removeItem("activeRenderJobId");

    setSelectedProducts([]);
    setCurrentJob(null);
    setError(null);
    setAppState("select");
  };

  // Show loading state while user context is initializing
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-2 overflow-hidden">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-semibold">Product Render</h1>
        </div>
      </div>

      <div
        className={`flex flex-col lg:grid gap-3 flex-1 min-h-[100px] transition-all duration-500 ease-out ${
          isAssetPanelCollapsed ? "lg:grid-cols-[1fr_80px]" : "lg:grid-cols-3"
        }`}
      >
        {/* Main Content Area - Left Side (2/3 width on desktop) */}
        <div
          className={`order-1 lg:order-1 h-full overflow-hidden transition-all duration-500 ease-out ${
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
            className={`h-full flex flex-col surface-elevated border border-light shadow-md rounded-xl transition-all ${
              isDragging ? "ring-2 ring-primary bg-primary/5" : ""
            }`}
          >
            {/* Main Content Area */}
            <CardContent className="flex-1 flex items-center justify-center p-2 relative overflow-auto">
              {isDragging && appState === "select" && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-primary">
                      Drop product here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Release to select for rendering
                    </p>
                  </div>
                </div>
              )}

              {appState === "select" && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <div className="text-center max-w-md">
                    <div className="mb-6 opacity-50">
                      <svg
                        className="h-16 w-16 mx-auto text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      Select a Product
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop a product from the Asset Library on the
                      right, or click on a product to select it for rendering.
                    </p>
                  </div>
                </div>
              )}

              {appState === "configure" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Rendering Settings
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure render options for {selectedProducts.length}{" "}
                        product{selectedProducts.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      onClick={() => setAppState("select")}
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>

                  {/* 3D Model Viewer */}
                  {selectedProducts.length > 0 && (
                    <div className="p-4 bg-card border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">
                            3D Preview
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedProducts[0]?.product_name} •{" "}
                            {selectedProducts[0]?.category}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedProducts([]);
                            setAppState("select");
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="w-full h-64 bg-muted rounded-lg overflow-hidden">
                        {selectedProducts[0]?.glb_link ? (
                          <ModelViewer
                            modelUrl={selectedProducts[0].glb_link}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <svg
                                className="h-8 w-8 mx-auto mb-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <p className="text-sm">No 3D model available</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Resolution */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Resolution
                        </label>
                        <select
                          value={renderSettings.resolution}
                          onChange={(e) =>
                            setRenderSettings((prev) => ({
                              ...prev,
                              resolution: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="1024x1024">1024×1024</option>
                          <option value="2048x2048">2048×2048</option>
                          <option value="4096x4096">4096×4096</option>
                          <option value="1920x1080">1920×1080 (16:9)</option>
                          <option value="3840x2160">3840×2160 (4K)</option>
                        </select>
                      </div>

                      {/* Image Format */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Image Format
                        </label>
                        <select
                          value={renderSettings.imageFormat}
                          onChange={(e) =>
                            setRenderSettings((prev) => ({
                              ...prev,
                              imageFormat: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="JPEG">JPEG (Smaller file size)</option>
                          <option value="PNG">
                            PNG (Supports transparency)
                          </option>
                          <option value="WEBP">WebP (Modern format)</option>
                          <option value="TIFF">TIFF (High quality)</option>
                        </select>
                      </div>

                      {/* Render Margin */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">
                          Render Margin{" "}
                          <span className="text-primary font-semibold">
                            {renderSettings.renderMargin}%
                          </span>
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={renderSettings.renderMargin}
                          onChange={(e) =>
                            setRenderSettings((prev) => ({
                              ...prev,
                              renderMargin: parseInt(e.target.value),
                            }))
                          }
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Tight crop</span>
                          <span>More space</span>
                        </div>
                      </div>

                      {/* Quality */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Render Quality
                        </label>
                        <select
                          value={renderSettings.quality}
                          onChange={(e) =>
                            setRenderSettings((prev) => ({
                              ...prev,
                              quality: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="low">Low (Faster)</option>
                          <option value="medium">Medium</option>
                          <option value="high">High (Slower)</option>
                        </select>
                      </div>

                      {/* Camera Views */}
                      <div className="space-y-4 md:col-span-2">
                        <h3 className="text-sm font-medium">Camera Views</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { id: "front", label: "Front" },
                            { id: "angled_side1", label: "45° Front-Side" },
                            {
                              id: "angled_side1_flat",
                              label: "45° Front-Side (Flat)",
                            },
                            { id: "side", label: "Side" },
                            { id: "angled_side2", label: "45° Back-Side" },
                            {
                              id: "angled_side2_flat",
                              label: "45° Back-Side (Flat)",
                            },
                            { id: "back", label: "Back" },
                            { id: "top", label: "Top" },
                          ].map((view) => (
                            <label
                              key={view.id}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  id={view.id}
                                  checked={renderSettings.cameraViews.includes(
                                    view.id
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRenderSettings((prev) => ({
                                        ...prev,
                                        cameraViews: [
                                          ...prev.cameraViews,
                                          view.id,
                                        ],
                                      }));
                                    } else {
                                      setRenderSettings((prev) => ({
                                        ...prev,
                                        cameraViews: prev.cameraViews.filter(
                                          (v) => v !== view.id
                                        ),
                                      }));
                                    }
                                  }}
                                  className="peer sr-only"
                                />
                                <div className="w-5 h-5 border-2 border-input rounded peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                                <Check className="absolute top-0.5 left-0.5 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                              </div>
                              <span className="text-sm group-hover:text-foreground transition-colors">
                                {view.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setAppState("select")}
                      variant="outline"
                      className="flex-1"
                    >
                      Back to Selection
                    </Button>
                    <Button
                      onClick={handleSubmitJob}
                      className="flex-1"
                      size="lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Rendering
                    </Button>
                  </div>
                </div>
              )}

              {appState === "generating" && (
                <div className="text-center py-12">
                  <div className="bg-card border border-border rounded-lg p-8 max-w-md mx-auto">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
                    <h2 className="text-xl font-semibold mb-2">
                      {currentJob?.status === "queued"
                        ? "Queued..."
                        : "Rendering..."}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {currentJob?.status === "queued"
                        ? "Waiting for render client to pick up the job..."
                        : "Please wait while we render your products..."}
                    </p>
                    {currentJob?.progress !== undefined &&
                      currentJob.progress > 0 && (
                        <div>
                          <div className="w-full bg-muted rounded-full h-2.5 mb-2">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${currentJob.progress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {currentJob.progress}% complete
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {appState === "results" && currentJob && (
                <div className="text-center py-12">
                  <div className="bg-card border border-border rounded-lg p-8 max-w-md mx-auto">
                    <div className="h-16 w-16 mx-auto bg-green-100 dark:bg-green-900 dark:opacity-20 rounded-full flex items-center justify-center mb-6">
                      <svg
                        className="h-8 w-8 text-green-600 dark:text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      Render Complete!
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Your renders are ready to download
                    </p>

                    <div className="flex gap-3">
                      {currentJob.downloadUrl && (
                        <Button
                          onClick={() =>
                            window.open(currentJob.downloadUrl, "_blank")
                          }
                          className="flex-1"
                          size="lg"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Results
                        </Button>
                      )}
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="flex-1"
                      >
                        Start New Render
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {appState === "error" && (
                <div className="text-center py-12">
                  <div className="bg-card border border-destructive rounded-lg p-8 max-w-md mx-auto">
                    <div className="h-16 w-16 mx-auto bg-destructive opacity-10 rounded-full flex items-center justify-center mb-6">
                      <svg
                        className="h-8 w-8 text-destructive"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-destructive mb-2">
                      Error
                    </h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Asset Library Panel - Right Side (1/3 width on desktop, full width on mobile) */}
        <div className="order-2 lg:order-2 h-full overflow-hidden">
          <AssetLibraryPanel
            onAssetSelect={handleAssetSelect}
            isCollapsed={isAssetPanelCollapsed}
            onToggleCollapse={() =>
              setIsAssetPanelCollapsed(!isAssetPanelCollapsed)
            }
          />
        </div>
      </div>
    </div>
  );
}
