"use client";

import { useState, useRef, useEffect } from "react";
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
  const [isDragging, setIsDragging] = useState(false);

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

  const handleAssetSelect = (asset: any) => {
    const modelName = getAssetModelName(asset);
    if (pendingModels.has(modelName)) return;

    setSelectedAssets((prev) => {
      const exists = prev.some((a) => a.id === asset.id);
      const next = exists
        ? prev.filter((a) => a.id !== asset.id)
        : [...prev, asset];
      const active = exists ? next[next.length - 1] : asset;
      setSelectedModel(active ? active.product_name : null);
      setCurrentModelUrl(active ? active.glb_link : null);
      setSelectedVariants([]);
      return next;
    });
  };

  const handleAssetOpen = (asset: any) => {
    setSelectedModel(asset.product_name);
    setCurrentModelUrl(asset.glb_link);
  };

  return (
    <div className="h-[calc(100vh-85px)] bg-gradient-to-br from-background via-background to-muted/10">
      <div className="flex h-full gap-4 p-4">
        {/* Left Column - 3D Viewer & Render Options */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          {/* 3D Viewer Card - Enhanced with depth & shadows */}
          <div className="flex-[3] bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden relative">
            <div
              className={`h-full relative transition-all duration-300 ${
                isDragging
                  ? "bg-gradient-to-br from-primary/5 via-primary/3 to-primary/5 ring-2 ring-primary/30 ring-inset"
                  : "bg-gradient-to-br from-muted/20 via-background to-muted/10"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
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
                    const modelName = getAssetModelName(asset);
                    if (!pendingModels.has(modelName)) {
                      setSelectedModel(asset.product_name);
                      setCurrentModelUrl(asset.glb_link);
                      setSelectedVariants([]);
                      setSelectedAssets((prev) => {
                        const exists = prev.some((a) => a.id === asset.id);
                        return exists ? prev : [...prev, asset];
                      });
                    }
                  }
                } catch (err) {
                  console.error("Error parsing dropped data:", err);
                }
              }}
            >
              {/* Enhanced Drag Overlay with depth */}
              {isDragging && (
                <div className="absolute inset-6 flex items-center justify-center bg-gradient-to-br from-primary/8 via-primary/12 to-primary/8 border-2 border-dashed border-primary/40 rounded-3xl z-10 backdrop-blur-lg shadow-[inset_0_2px_12px_rgba(0,0,0,0.1)]">
                  <div className="text-center space-y-5 p-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 rounded-3xl flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_-2px_8px_rgba(255,255,255,0.1)]">
                      <svg
                        className="w-12 h-12 text-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-primary mb-2 drop-shadow-sm">
                        Drop model here
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Release to load the 3D model
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3D Model Viewer */}
              {selectedModel && currentModelUrl && (
                <ModelViewer
                  modelUrl={currentModelUrl}
                  cameraAngle={hoverOrbit || undefined}
                />
              )}

              {/* Enhanced Empty State with depth */}
              {!selectedModel && !isDragging && (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-muted/30 via-muted/20 to-muted/10 rounded-3xl flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
                      <Eye className="w-16 h-16 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground mb-4 tracking-tight">
                      Select a Model
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Choose a model from the asset library or drag and drop to
                      preview and configure professional render settings
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Render Options Card - Enhanced with depth */}
          <div className="flex-[2] bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar">
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
        </div>

        {/* Middle Column - Saved Packshots (appears when asset selected) */}

        {/* Right Column - Asset Library */}
        <div
          className={`${
            isAssetPanelCollapsed
              ? "w-16"
              : "flex-[1.5] min-w-[340px] max-w-[420px]"
          } flex-shrink-0 transition-all duration-300`}
        >
          <div className="h-full bg-card rounded-xl border border-border/40 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden">
            <ModularAssetPanel
              onAssetSelect={handleAssetSelect}
              onAssetOpen={handleAssetOpen}
              isCollapsed={isAssetPanelCollapsed}
              onToggleCollapse={() =>
                setIsAssetPanelCollapsed(!isAssetPanelCollapsed)
              }
              selectedAssets={selectedAssets}
              showCollapseButton={true}
              selectionMode="checkbox"
              onClearSelection={() => setSelectedAssets([])}
            />
          </div>
        </div>
      </div>

      {/* Floating Render Queue - Enhanced with shadow */}
      <div className="fixed bottom-6 right-6 z-50">
        <CollapsibleRenderQueue clientName={clientName} />
      </div>
    </div>
  );
}
