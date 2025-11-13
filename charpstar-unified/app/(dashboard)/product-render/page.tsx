'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Eye } from 'lucide-react';
import RenderOptionsPanel from '@/components/product-render/RenderOptionsPanel';
import ModularAssetPanel from '@/components/modular/ModularAssetPanel';
import CollapsibleRenderQueue from '@/components/product-render/CollapsibleRenderQueue';
import { useUser } from '@/contexts/useUser';
import { ModelViewer } from '@/components/generator/ModelViewer';

export default function RenderPage() {
  const user = useUser();
  const rawClient = Array.isArray(user?.metadata?.client) 
    ? user.metadata.client[0] 
    : user?.metadata?.client || '';
  const clientName = rawClient && String(rawClient).trim().length > 0 ? String(rawClient) : 'Shared';
  
  // State
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [isAssetPanelCollapsed, setIsAssetPanelCollapsed] = useState(false);
  const modelViewerRef = useRef<any>(null);
  const [hoverOrbit, setHoverOrbit] = useState<string | null>(null);
  const [pendingModels, setPendingModels] = useState<Set<string>>(new Set());

  const getAssetModelName = (asset: any) => {
    const file = (asset?.glb_link?.split('/').pop() || asset?.product_name || '').trim();
    return file.replace(/\.(gltf|glb)$/i, '');
  };

  useEffect(() => {
    const onPendingAdd = (e: Event) => {
      const modelName = (e as CustomEvent).detail?.modelName as string | undefined;
      if (!modelName) return;
      setPendingModels(prev => new Set(prev).add(modelName));
      // If currently selected assets include this model, remove it from selection
      setSelectedAssets(prev => prev.filter(a => getAssetModelName(a) !== modelName));
    };
    const onPendingRemove = (e: Event) => {
      const modelName = (e as CustomEvent).detail?.modelName as string | undefined;
      if (!modelName) return;
      setPendingModels(prev => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    };
    try { window.addEventListener('charpstar:renderPendingAdd', onPendingAdd as any); } catch {}
    try { window.addEventListener('charpstar:renderPendingRemove', onPendingRemove as any); } catch {}
    return () => {
      try { window.removeEventListener('charpstar:renderPendingAdd', onPendingAdd as any); } catch {}
      try { window.removeEventListener('charpstar:renderPendingRemove', onPendingRemove as any); } catch {}
    };
  }, []);


  // Handle asset selection (toggle) from ModularAssetPanel
  const handleAssetSelect = (asset: any) => {
    const modelName = getAssetModelName(asset);
    // Block selection if model has a pending render
    if (pendingModels.has(modelName)) {
      // Optionally could show a toast; for now silently ignore selection
      return;
    }
    setSelectedAssets(prev => {
      const exists = prev.some(a => a.id === asset.id);
      const next = exists ? prev.filter(a => a.id !== asset.id) : [...prev, asset];
      // Set viewer to last interacted asset (or clear if none left)
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
    <div className="bg-gray-50">      
      <div className="flex h-[calc(100vh-85px)]">
        {/* Left - 3D Viewer (55%) and Render Panel (45%) */}
        <div className="flex-1 flex flex-col">
          {/* 3D Viewer - 52% height - NO PADDING */}
          <div className="h-[55%] bg-white border-b border-gray-200">
            <div className="h-full bg-[#F8F9FA] flex items-center justify-center relative">
              {/* 3D Model Viewer */}
              {selectedModel && currentModelUrl && (
                <ModelViewer 
                  modelUrl={currentModelUrl}
                  cameraAngle={hoverOrbit || undefined}
                />
              )}

              {/* Empty State */}
              {!selectedModel && (
                <div className="text-gray-400 text-center">
                  <Eye className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Select a Model
                  </h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Choose a model from the sidebar to preview and configure render settings
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Render Panel - 45% height */}
          <div className="h-[45%] bg-gray-50">
            <RenderOptionsPanel
              modelViewerRef={modelViewerRef}
              modelFilename={currentModelUrl ? currentModelUrl.split('/').pop() || null : null}
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
                  isAssetPanelCollapsed ? 'w-20' : 'w-[420px]'
                } h-full max-h-full border-l border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden transition-all duration-300 bg-background dark:bg-background`}
              >
          <ModularAssetPanel
            onAssetSelect={handleAssetSelect}
            onAssetOpen={handleAssetOpen}
            isCollapsed={isAssetPanelCollapsed}
            onToggleCollapse={() => setIsAssetPanelCollapsed(!isAssetPanelCollapsed)}
            selectedAssets={selectedAssets}
            showCollapseButton={true}
            selectionMode="checkbox"
            onClearSelection={() => setSelectedAssets([])}
          />
        </div>
      </div>
      
      {/* Collapsible Render Queue - Bottom Right */}
      <CollapsibleRenderQueue clientName={clientName} />
    </div>
  );
}
