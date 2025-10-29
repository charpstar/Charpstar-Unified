"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/display";
import { Card, CardContent } from "@/components/ui/containers";
import ModularStepPanel from "@/components/modular/ModularStepPanel";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

declare global {
  interface Window {
    __charpstAR_threeInit?: (config: {
      mountId: string;
      allowEmpty?: boolean;
      modelUrl?: string;
    }) => void;
    __charpstAR_threeAddGltf?: (mountId: string, url: string) => void;
    __charpstAR_threeRemoveAllModules?: (mountId: string) => void;
  }
}

export default function Modular3DCreatorPage() {
  const router = useRouter();
  const initedRef = useRef(false);
  const mountId = useMemo(() => "modular-viewer", []);
  const [isStepPanelCollapsed, setIsStepPanelCollapsed] = useState(false);

  // Initialize viewer once the module script is available
  useEffect(() => {
    if (initedRef.current) return;
    if (typeof window !== "undefined" && window.__charpstAR_threeInit) {
      initedRef.current = true;
      window.__charpstAR_threeInit({
        mountId,
        allowEmpty: true,
      });
    }
  }, [mountId]);

  function handlePlaceAsset(asset: any) {
    const url = asset?.glb_link;
    if (!url || !window.__charpstAR_threeAddGltf) return;
    window.__charpstAR_threeAddGltf(mountId, url);
  }

  function clearScene() {
    if (!window.__charpstAR_threeRemoveAllModules) return;
    window.__charpstAR_threeRemoveAllModules(mountId);
  }

  return (
    <div className="w-full h-full flex flex-col bg-muted/20 overflow-hidden">
      {/* Header - Minimal */}
      <div className="flex items-center justify-between px-8 py-5 bg-background border-b border-border/40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2 hover:bg-muted/50 transition-colors -ml-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Modular 3D Creator
          </h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Viewer Area - White background like reference */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-background">
          <div id={mountId} className="w-full h-full" />
        </div>

        {/* Step Panel - Stronger gray background */}
        <div className={`flex-shrink-0 transition-all duration-500 ${isStepPanelCollapsed ? "w-20" : "w-[420px]"} h-full min-h-0 overflow-hidden bg-muted/50 dark:bg-muted/30`}>
          <ModularStepPanel
            onPlaceAsset={handlePlaceAsset}
            isCollapsed={isStepPanelCollapsed}
            onToggleCollapse={() => setIsStepPanelCollapsed(!isStepPanelCollapsed)}
          />
        </div>
      </div>

      {/* Viewer module script */}
      <Script
        type="module"
        src="/js/three-viewer-module.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (!initedRef.current && window.__charpstAR_threeInit) {
            initedRef.current = true;
            window.__charpstAR_threeInit({ mountId, allowEmpty: true });
          }
        }}
      />
    </div>
  );
}

