// src/components/demo/ClientDemoPage.tsx (updated with camera controls)
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { fetchClientConfig, isValidClient } from "@/config/clientConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Eye,
  RefreshCw,
  Palette,
  ArrowLeft,
} from "lucide-react";
import { VariantSelector } from "@/components/demo/VariantSelector";
import { CompactModelStats } from "@/components/demo/ModelStats";
import { CameraControlsPanel } from "@/components/demo/CameraControlsPanel"; // Import the new component
import { ModelViewer } from "@/components/ModelViewer";
import { notFound } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

// Helper function to parse model name and extract category
const parseModelName = (filename: string) => {
  // Remove file extension
  const name = filename.replace(".gltf", "");

  // Extract category prefix (first part before the dash or number)
  const match = name.match(/^([A-Z]+)/);
  const category = match ? match[0] : "OTHER";

  // Create a more readable display name
  let displayName = name;

  // Remove common suffixes for cleaner display
  displayName = displayName;

  return {
    fullName: name,
    category,
    displayName,
  };
};

// Group models by category
const groupModelsByCategory = (models: string[]) => {
  const grouped: Record<string, string[]> = {};

  models.forEach((model) => {
    const { category } = parseModelName(model);

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(model);
  });

  // Sort categories alphabetically
  return Object.keys(grouped)
    .sort()
    .reduce((result: Record<string, string[]>, key) => {
      result[key] = grouped[key].sort();
      return result;
    }, {});
};

export default function ClientDemoPage() {
  const params = useParams();
  const clientName = (params?.id as string) || "";
  const modelViewerRef = useRef<any>(null);
  const [clientConfig, setClientConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [modelList, setModelList] = useState<string[]>([]);
  const [groupedModels, setGroupedModels] = useState<Record<string, string[]>>(
    {}
  );
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [modelLoadError, setModelLoadError] = useState(false);
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [showCatalog, setShowCatalog] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);

  const [showStatsDrawer, setShowStatsDrawer] = useState(false);

  useEffect(() => {
    const validateAndFetchConfig = async () => {
      const isValid = await isValidClient(clientName);
      if (!isValid) {
        notFound();
      }
      const config = await fetchClientConfig(clientName);
      setClientConfig(config);
      setIsLoadingConfig(false);
    };
    validateAndFetchConfig();
  }, [clientName]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          "/api/3d-editor/models?client=" + clientName
        );
        const models = await response.json();
        setModelList(models);
        const grouped = groupModelsByCategory(models);
        setGroupedModels(grouped);
        const initialExpanded: Record<string, boolean> = {};
        Object.keys(grouped).forEach((category) => {
          initialExpanded[category] = grouped[category].length <= 10;
        });
        setExpandedCategories(initialExpanded);
        if (models.length > 0) {
          setSelectedModel(models[0]);
          setCurrentModelUrl(getModelUrl(models[0]));
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching models:", error);
        setIsLoading(false);
      }
    };
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Select a model to view
  const handleSelectModel = (model: string) => {
    console.log("[ClientDemoPage] Selecting model:", model);
    setSelectedModel(model);
    const modelUrl = getModelUrl(model);
    console.log("[ClientDemoPage] Model URL:", modelUrl);
    setCurrentModelUrl(modelUrl);
    setModelLoadError(false);
  };

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // Handle model load error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModelError = () => {
    console.error("[ClientDemoPage] Model load error occurred");
    setModelLoadError(true);
  };

  // Filter models based on search query
  const filteredCategories = searchQuery
    ? Object.keys(groupedModels).reduce(
        (filtered: Record<string, string[]>, category) => {
          const matchingModels = groupedModels[category].filter((model) =>
            model.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (matchingModels.length > 0) {
            filtered[category] = matchingModels;
          }

          return filtered;
        },
        {}
      )
    : groupedModels;

  // Get model URL
  const getModelUrl = (modelName: string) => {
    // This would be replaced with actual URL construction
    const baseUrl = clientConfig.modelUrl.split("/");
    baseUrl.pop(); // Remove the file name
    return `${baseUrl.join("/")}/${modelName}`;
  };

  // Model categories stats
  const categoryCount = Object.keys(filteredCategories).length;
  const totalModelCount = Object.values(filteredCategories).reduce(
    (count, models) => count + models.length,
    0
  );

  // Handle model loaded event
  const handleModelLoaded = () => {
    console.log("[ClientDemoPage] Model loaded callback received");

    // After the model loads, store a reference to the model-viewer element
    setTimeout(() => {
      // Get the initialized model-viewer element with our custom functions attached
      const modelViewer = window.modelViewerElement;
      console.log(
        "[ClientDemoPage] Model viewer element found:",
        !!modelViewer
      );
      if (modelViewer && !modelViewerRef.current) {
        modelViewerRef.current = modelViewer;
        console.log(
          "[ClientDemoPage] Stored model-viewer reference with custom functions"
        );
      }
    }, 100);
  };

  // Render
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-100px)]  bg-background">
      {isLoadingConfig ? (
        <div className="flex items-center justify-center h-full">
          Loading config...
        </div>
      ) : (
        <>
          {isMobile ? (
            <>
              {/* Mobile Top Bar */}
              <div className="flex items-center justify-between p-2 border-b border-border bg-card">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCatalog(true)}
                >
                  Catalog
                </Button>
                <div className="flex-1 flex justify-center">
                  <span className="font-semibold text-base">3D Viewer</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVariants(true)}
                >
                  Variants
                </Button>
              </div>
              {/* Drawers/Modals for Catalog and Variants */}
              <Dialog
                open={showCatalog}
                onOpenChange={(open) => setShowCatalog(open)}
              >
                <DialogContent className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-card shadow-lg p-0 flex flex-col z-50 rounded-none border-none min-h-0 h-full !top-0 !left-0 !translate-x-0 !translate-y-0">
                  <DialogHeader className="flex items-center justify-between p-4 border-b border-border">
                    <DialogTitle className="font-semibold">
                      Model Catalog
                    </DialogTitle>
                  </DialogHeader>
                  {/* Model Catalog Content (copied from left panel) */}
                  <div className="flex-1 overflow-y-auto scrollbar-none">
                    {/* Search and Filter Controls */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-foreground">
                          Model Catalog
                        </h2>
                        <div className="flex space-x-2">
                          <Button
                            variant={
                              viewMode === "list" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className="h-8 w-8 p-0"
                          >
                            <List size={16} />
                          </Button>
                          <Button
                            variant={
                              viewMode === "grid" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setViewMode("grid")}
                            className="h-8 w-8 p-0"
                          >
                            <LayoutGrid size={16} />
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                          size={16}
                        />
                        <Input
                          type="text"
                          placeholder="Search models..."
                          value={searchQuery}
                          onChange={handleSearch}
                          className="pl-8 pr-8 py-2 text-sm"
                        />
                        {searchQuery && (
                          <button
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <span className="text-xs">✕</span>
                          </button>
                        )}
                        {searchQuery && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Found {totalModelCount} models in {categoryCount}{" "}
                            categories
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Model List (reuse logic) */}
                    <div className="flex-1 overflow-y-auto scrollbar-none">
                      {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-muted-foreground">
                            Loading models...
                          </div>
                        </div>
                      ) : viewMode === "list" ? (
                        <div className="divide-y divide-border">
                          {Object.keys(filteredCategories).length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              No models found for &quot;{searchQuery}&quot;
                            </div>
                          ) : (
                            Object.keys(filteredCategories).map((category) => (
                              <div
                                key={category}
                                className="border-b border-border"
                              >
                                <div
                                  className="flex items-center p-3 bg-muted cursor-pointer hover:bg-muted/80"
                                  onClick={() => toggleCategory(category)}
                                >
                                  {expandedCategories[category] ? (
                                    <ChevronDown
                                      size={16}
                                      className="text-muted-foreground mr-2"
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={16}
                                      className="text-muted-foreground mr-2"
                                    />
                                  )}
                                  <span className="font-semibold text-foreground">
                                    {category}
                                  </span>
                                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                                    ({filteredCategories[category].length})
                                  </span>
                                </div>
                                {expandedCategories[category] && (
                                  <div className="bg-card">
                                    {filteredCategories[category].map(
                                      (model) => (
                                        <div
                                          key={model}
                                          className={`px-8 py-2 cursor-pointer hover:bg-accent flex items-center justify-between ${
                                            selectedModel === model
                                              ? "bg-accent text-accent-foreground"
                                              : ""
                                          }`}
                                          onClick={() => {
                                            handleSelectModel(model);
                                            setShowCatalog(false);
                                          }}
                                        >
                                          <div className="text-sm truncate text-foreground">
                                            {parseModelName(model).displayName}
                                          </div>
                                          {selectedModel === model && (
                                            <Eye
                                              size={14}
                                              className="text-accent-foreground ml-2"
                                            />
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-2 gap-3">
                          {Object.keys(filteredCategories).length === 0 ? (
                            <div className="col-span-2 p-4 text-center text-muted-foreground">
                              No models found for &quot;{searchQuery}&quot;
                            </div>
                          ) : (
                            Object.keys(filteredCategories).map((category) => (
                              <div key={category} className="col-span-2 mb-4">
                                <div
                                  className="flex items-center p-2 bg-muted cursor-pointer hover:bg-muted/80"
                                  onClick={() => toggleCategory(category)}
                                >
                                  {expandedCategories[category] ? (
                                    <ChevronDown
                                      size={16}
                                      className="text-muted-foreground mr-2"
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={16}
                                      className="text-muted-foreground mr-2"
                                    />
                                  )}
                                  <span className="font-semibold text-foreground">
                                    {category}
                                  </span>
                                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                                    ({filteredCategories[category].length})
                                  </span>
                                </div>
                                {expandedCategories[category] && (
                                  <div className="grid grid-cols-2 gap-2 p-2 border border-border rounded-b-lg">
                                    {filteredCategories[category].map(
                                      (model) => (
                                        <div
                                          key={model}
                                          className={`p-2 cursor-pointer hover:bg-accent rounded border ${
                                            selectedModel === model
                                              ? "border-accent bg-accent text-accent-foreground"
                                              : "border-border"
                                          }`}
                                          onClick={() => {
                                            handleSelectModel(model);
                                            setShowCatalog(false);
                                          }}
                                        >
                                          <div className="text-xs text-center truncate text-foreground">
                                            {parseModelName(model).displayName}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showVariants} onOpenChange={setShowVariants}>
                <DialogContent className="fixed inset-y-0 right-0 w-4/5 max-w-xs bg-card shadow-lg p-0 flex flex-col z-50 rounded-none border-none min-h-0 h-full !top-0 !right-0 !translate-x-[-35%] !translate-y-0">
                  <DialogHeader className="flex items-center justify-between p-4 border-b border-border">
                    <DialogTitle className="font-semibold">
                      Material Variants
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 p-2 overflow-y-auto scrollbar-thin">
                    {selectedModel && !modelLoadError ? (
                      <VariantSelector
                        modelViewerRef={modelViewerRef}
                        modelName={parseModelName(selectedModel).displayName}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Palette
                          size={20}
                          className="text-muted-foreground/50 mb-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {isLoading
                            ? "Loading..."
                            : modelLoadError
                              ? "Cannot load variants"
                              : "Select a model to view variants"}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              {/* 3D Viewer fills the rest of the screen */}
              <div className="flex-1 p-2 bg-card relative">
                <div className="h-full rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
                  {selectedModel ? (
                    <>
                      <ModelViewer
                        clientModelUrl={currentModelUrl}
                        onModelLoaded={handleModelLoaded}
                      />
                      {/* Floating Action Buttons for Camera and Stats */}
                      {/* <button
                        className="fixed bottom-4 left-4 z-30 bg-card border border-border rounded-full shadow-lg p-3 flex items-center justify-center active:scale-95 transition-transform"
                        onClick={() => setShowCameraDrawer(true)}
                        aria-label="Camera Controls"
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="7"
                            width="18"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <circle cx="12" cy="13" r="4"></circle>
                          <path d="M5 3h2"></path>
                        </svg>
                      </button> */}
                      <button
                        className="fixed bottom-4 right-4 z-30 bg-card border border-border rounded-full shadow-lg p-3 flex items-center justify-center active:scale-95 transition-transform"
                        onClick={() => setShowStatsDrawer(true)}
                        aria-label="Model Stats"
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <line x1="9" y1="9" x2="9" y2="15"></line>
                          <line x1="15" y1="9" x2="15" y2="15"></line>
                        </svg>
                      </button>
                      {/* Camera Controls Drawer */}
                      {/* <Dialog
                        open={showCameraDrawer}
                        onOpenChange={setShowCameraDrawer}
                      >
                        <DialogContent className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-card shadow-lg p-0 flex flex-col z-50 rounded-t-lg border-none min-h-0 h-fit !top-auto !left-1/2 !right-auto !translate-x-[-50%] !translate-y-0">
                          <DialogHeader className="flex items-center justify-between p-3 border-b border-border">
                            <DialogTitle className="font-semibold text-base">
                              Camera Controls
                            </DialogTitle>
                          </DialogHeader>
                          <div className="p-2">
                            <CameraControlsPanel
                              modelViewerRef={modelViewerRef}
                              isMobile
                            />
                          </div>
                        </DialogContent>
                      </Dialog> */}
                      {/* Stats Drawer */}
                      <Dialog
                        open={showStatsDrawer}
                        onOpenChange={setShowStatsDrawer}
                      >
                        <DialogContent className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-card shadow-lg p-0 flex flex-col z-50 rounded-t-lg border-none min-h-0 h-fit !top-auto !left-1/2 !right-auto !translate-x-[-50%] !translate-y-0">
                          <DialogHeader className="flex items-center justify-between p-3 border-b border-border">
                            <DialogTitle className="font-semibold text-base">
                              Model Stats
                            </DialogTitle>
                          </DialogHeader>
                          <div className="p-2">
                            <CompactModelStats
                              modelViewerRef={modelViewerRef}
                              modelName={selectedModel || ""}
                              isMobile
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                      {modelLoadError && (
                        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                          <div className="text-destructive mb-2">
                            Error loading model
                          </div>
                          <div className="text-muted-foreground text-sm mb-4">
                            The model might not be available in this location
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModelLoadError(false)}
                            className="flex items-center"
                          >
                            <RefreshCw size={14} className="mr-2" />
                            Try Again
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground text-center p-8">
                      {isLoading
                        ? "Loading models..."
                        : "Select a model to view"}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Desktop layout (original)
            <div className="flex flex-1 overflow-hidden h-full max-h-[calc(100vh]">
              {/* Left side - Model navigation */}
              <div className="w-1/10 border-r border-border bg-card shadow-inner flex flex-col">
                {/* Search and Filter Controls */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-foreground">
                      Model Catalog
                    </h2>
                    <div className="flex space-x-2">
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="h-8 w-8 p-0"
                      >
                        <List size={16} />
                      </Button>
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-8 w-8 p-0"
                      >
                        <LayoutGrid size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                      size={16}
                    />
                    <Input
                      type="text"
                      placeholder="Search models..."
                      value={searchQuery}
                      onChange={handleSearch}
                      className="pl-8 pr-8 py-2 text-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    )}
                    {searchQuery && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Found {totalModelCount} models in {categoryCount}{" "}
                        categories
                      </div>
                    )}
                  </div>
                </div>
                {/* Model List */}
                <div className="flex-1 overflow-y-auto scrollbar-none">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">
                        Loading models...
                      </div>
                    </div>
                  ) : viewMode === "list" ? (
                    <div className="divide-y divide-border">
                      {Object.keys(filteredCategories).length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No models found for &quot;{searchQuery}&quot;
                        </div>
                      ) : (
                        Object.keys(filteredCategories).map((category) => (
                          <div
                            key={category}
                            className="border-b border-border"
                          >
                            <div
                              className="flex items-center p-3 bg-muted cursor-pointer hover:bg-muted/80"
                              onClick={() => toggleCategory(category)}
                            >
                              {expandedCategories[category] ? (
                                <ChevronDown
                                  size={16}
                                  className="text-muted-foreground mr-2"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="text-muted-foreground mr-2"
                                />
                              )}
                              <span className="font-semibold text-foreground">
                                {category}
                              </span>
                              <span className="ml-2 text-xs font-medium text-muted-foreground">
                                ({filteredCategories[category].length})
                              </span>
                            </div>
                            {expandedCategories[category] && (
                              <div className="bg-card">
                                {filteredCategories[category].map((model) => (
                                  <div
                                    key={model}
                                    className={`px-8 py-2 cursor-pointer hover:bg-accent flex items-center justify-between ${
                                      selectedModel === model
                                        ? "bg-accent text-accent-foreground"
                                        : ""
                                    }`}
                                    onClick={() => handleSelectModel(model)}
                                  >
                                    <div className="text-sm truncate text-foreground">
                                      {parseModelName(model).displayName}
                                    </div>
                                    {selectedModel === model && (
                                      <Eye
                                        size={14}
                                        className="text-accent-foreground ml-2"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {Object.keys(filteredCategories).length === 0 ? (
                        <div className="col-span-2 p-4 text-center text-muted-foreground">
                          No models found for &quot;{searchQuery}&quot;
                        </div>
                      ) : (
                        Object.keys(filteredCategories).map((category) => (
                          <div key={category} className="col-span-2 mb-4">
                            <div
                              className="flex items-center p-2 bg-muted cursor-pointer hover:bg-muted/80"
                              onClick={() => toggleCategory(category)}
                            >
                              {expandedCategories[category] ? (
                                <ChevronDown
                                  size={16}
                                  className="text-muted-foreground mr-2"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="text-muted-foreground mr-2"
                                />
                              )}
                              <span className="font-semibold text-foreground">
                                {category}
                              </span>
                              <span className="ml-2 text-xs font-medium text-muted-foreground">
                                ({filteredCategories[category].length})
                              </span>
                            </div>
                            {expandedCategories[category] && (
                              <div className="grid grid-cols-2 gap-2 p-2 border border-border rounded-b-lg">
                                {filteredCategories[category].map((model) => (
                                  <div
                                    key={model}
                                    className={`p-2 cursor-pointer hover:bg-accent rounded border ${
                                      selectedModel === model
                                        ? "border-accent bg-accent text-accent-foreground"
                                        : "border-border"
                                    }`}
                                    onClick={() => handleSelectModel(model)}
                                  >
                                    <div className="text-xs text-center truncate text-foreground">
                                      {parseModelName(model).displayName}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Center - 3D Viewer */}
              <div className="flex-1 p-4 bg-card h-full max-h-[calc(100vh-100px)]">
                <div className="h-full rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
                  {selectedModel ? (
                    <>
                      <ModelViewer
                        clientModelUrl={currentModelUrl}
                        onModelLoaded={handleModelLoaded}
                      />
                      {/* Back to Editor button overlay */}
                      <div className="absolute top-4 right-4   z-10">
                        <Link href={`/3d-editor/${clientName}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                          >
                            <ArrowLeft size={14} className="mr-2" />
                            Back to Editor
                          </Button>
                        </Link>
                      </div>
                      {!modelLoadError && (
                        <CompactModelStats
                          modelViewerRef={modelViewerRef}
                          modelName={selectedModel}
                        />
                      )}

                      {!modelLoadError && (
                        <CameraControlsPanel modelViewerRef={modelViewerRef} />
                      )}
                      {modelLoadError && (
                        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                          <div className="text-destructive mb-2">
                            Error loading model
                          </div>
                          <div className="text-muted-foreground text-sm mb-4">
                            The model might not be available in this location
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModelLoadError(false)}
                            className="flex items-center"
                          >
                            <RefreshCw size={14} className="mr-2" />
                            Try Again
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground text-center p-8">
                      {isLoading
                        ? "Loading models..."
                        : "Select a model to view"}
                    </div>
                  )}
                </div>
              </div>
              {/* Right side - Variants panel */}
              <div className="w-1/10 border-l border-border bg-card shadow-inner flex flex-col">
                <div className="p-2 border-b border-border">
                  <div className="flex items-center space-x-1.5">
                    <Palette size={14} className="text-muted-foreground" />
                    <h3 className="text-xs font-medium text-foreground">
                      Material Variants
                    </h3>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto scrollbar-thin">
                  {selectedModel && !modelLoadError ? (
                    <VariantSelector
                      modelViewerRef={modelViewerRef}
                      modelName={parseModelName(selectedModel).displayName}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Palette
                        size={20}
                        className="text-muted-foreground/50 mb-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        {isLoading
                          ? "Loading..."
                          : modelLoadError
                            ? "Cannot load variants"
                            : "Select a model to view variants"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
