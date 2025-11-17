"use client";

import { useState, useRef, useEffect, type DragEvent } from "react";
import { Eye } from "lucide-react";
import RenderOptionsPanel from "@/components/product-render/RenderOptionsPanel";
import ModularAssetPanel from "@/components/modular/ModularAssetPanel";
import CollapsibleRenderQueue from "@/components/product-render/CollapsibleRenderQueue";
import { useUser } from "@/contexts/useUser";
import { ModelViewer } from "@/components/generator/ModelViewer";

export default function RenderPage() {
  const user = useUser();
  const rawClient = Array.isArray(user?.metadata?.client)
    ? user.metadata.client[0]
    : user?.metadata?.client || "";
  const clientName =
    rawClient && String(rawClient).trim().length > 0
      ? String(rawClient)
      : "Shared";

  // State
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [isAssetPanelCollapsed, setIsAssetPanelCollapsed] = useState(false);
  const modelViewerRef = useRef<any>(null);
  const [hoverOrbit, setHoverOrbit] = useState<string | null>(null);
  const [pendingModels, setPendingModels] = useState<Set<string>>(new Set());
  const [isViewerDropActive, setIsViewerDropActive] = useState(false);

  const getAssetModelName = (asset: any) => {
    const file = (
      asset?.glb_link?.split("/").pop() ||
      asset?.product_name ||
      ""
    ).trim();
    return file.replace(/\.(gltf|glb)$/i, "");
  };

  useEffect(() => {
    const onPendingAdd = (e: Event) => {
      const modelName = (e as CustomEvent).detail?.modelName as
        | string
        | undefined;
      if (!modelName) return;
      setPendingModels((prev) => new Set(prev).add(modelName));
      // If currently selected assets include this model, remove it from selection
      setSelectedAssets((prev) =>
        prev.filter((a) => getAssetModelName(a) !== modelName)
      );
    };
    const onPendingRemove = (e: Event) => {
      const modelName = (e as CustomEvent).detail?.modelName as
        | string
        | undefined;
      if (!modelName) return;
      setPendingModels((prev) => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    };
    try {
      window.addEventListener(
        "charpstar:renderPendingAdd",
        onPendingAdd as any
      );
    } catch {}
    try {
      window.addEventListener(
        "charpstar:renderPendingRemove",
        onPendingRemove as any
      );
    } catch {}
    return () => {
      try {
        window.removeEventListener(
          "charpstar:renderPendingAdd",
          onPendingAdd as any
        );
      } catch {}
      try {
        window.removeEventListener(
          "charpstar:renderPendingRemove",
          onPendingRemove as any
        );
      } catch {}
    };
  }, []);

  const selectAsset = (asset: any, options: { toggle?: boolean } = {}) => {
    const { toggle = true } = options;
    const modelName = getAssetModelName(asset);
    // Block selection if model has a pending render
    if (pendingModels.has(modelName)) {
      // Optionally could show a toast; for now silently ignore selection
      return;
    }
    setSelectedAssets((prev) => {
      const exists = prev.some((a) => a.id === asset.id);
      let next: any[] = prev;
      if (toggle) {
        next = exists ? [] : [asset];
      } else {
        next = [asset];
      }
      const active = next.length ? next[0] : null;
      setSelectedModel(active ? active.product_name : null);
      setCurrentModelUrl(active ? active.glb_link : null);
      setSelectedVariants([]);
      return next;
    });
  };

  // Handle asset selection (toggle) from ModularAssetPanel
  const handleAssetSelect = (asset: any) => {
    selectAsset(asset);
  };

  const handleAssetOpen = (asset: any) => {
    setSelectedModel(asset.product_name);
    setCurrentModelUrl(asset.glb_link);
  };

  const handleViewerDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsViewerDropActive(true);
  };

  const handleViewerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsViewerDropActive(true);
  };

  const handleViewerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const relatedTarget = event.relatedTarget as Node | null;
    if (!relatedTarget || !event.currentTarget.contains(relatedTarget)) {
      setIsViewerDropActive(false);
    }
  };

  const handleViewerDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsViewerDropActive(false);
    const data = event.dataTransfer.getData("application/json");
    if (!data) return;
    try {
      const droppedAsset = JSON.parse(data);
      selectAsset(droppedAsset, { toggle: false });
    } catch (error) {
      console.error("Failed to parse dropped asset:", error);
    }
  };

  return (
    <div className="bg-gray-50">
      <div className="flex h-[calc(100vh-85px)]">
        {/* Left - 3D Viewer (55%) and Render Panel (45%) */}
        <div className="flex-1 flex flex-col">
          {/* 3D Viewer - 52% height - NO PADDING */}
          <div className="h-[55%] bg-white">
            <div
              className="h-full bg-[#F8F9FA] flex items-center justify-center relative transition-colors"
              onDragOver={handleViewerDragOver}
              onDragEnter={handleViewerDragEnter}
              onDragLeave={handleViewerDragLeave}
              onDrop={handleViewerDrop}
            >
              {/* 3D Model Viewer */}
              {selectedModel && currentModelUrl && (
                <ModelViewer
                  modelUrl={currentModelUrl}
                  cameraAngle={hoverOrbit || undefined}
                />
              )}

              {/* Empty State */}
              {!selectedModel && (
                <div
                  className={`relative max-w-md mx-auto w-full px-6 py-10 text-center rounded-3xl border-2 border-dashed transition-all duration-200 ${
                    isViewerDropActive
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-gray-300/80 bg-white/60"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                        isViewerDropActive
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Eye className="w-8 h-8" />
                    </div>
                    <div className="text-gray-700">
                      <h3 className="text-lg font-semibold mb-1">
                        Select a Model
                      </h3>
                      <p className="text-sm text-gray-500">
                        Drag a card from the asset library or click one to load
                        it here
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Render Panel - 45% height */}
          <div className="h-[45%] bg-gray-50">
            <RenderOptionsPanel
              modelViewerRef={modelViewerRef}
              modelFilename={
                currentModelUrl
                  ? currentModelUrl.split("/").pop() || null
                  : null
              }
              selectedVariants={selectedVariants}
              isModularMode={false}
              modularViewerRef={undefined}
              modularConfig={null}
              sourceGlbUrl={currentModelUrl || null}
              selectedAssets={selectedAssets}
              onPreviewOrbitChange={(orbit) => setHoverOrbit(orbit)}
            />
          </div>
        </div>

        {/* Right - Asset Library Panel */}
        <div
          className={`${
            isAssetPanelCollapsed ? "w-20" : "w-[420px]"
          } h-full max-h-full  flex-shrink-0 overflow-hidden transition-all duration-300 bg-background dark:bg-background`}
        >
          <ModularAssetPanel
            onAssetSelect={handleAssetSelect}
            onAssetOpen={handleAssetOpen}
            isCollapsed={isAssetPanelCollapsed}
            onToggleCollapse={() =>
              setIsAssetPanelCollapsed(!isAssetPanelCollapsed)
            }
            selectedAssets={selectedAssets}
            showCollapseButton={true}
            selectionMode="card"
            onClearSelection={() => setSelectedAssets([])}
          />
        </div>
      </div>

      {/* Collapsible Render Queue - Bottom Right */}
      <CollapsibleRenderQueue clientName={clientName} />
    </div>
  );
}
