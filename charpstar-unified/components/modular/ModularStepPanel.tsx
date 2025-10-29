"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { ScrollArea } from "@/components/ui/interactive";
import { ChevronLeft, ChevronRight, Check, Plus, X, ArrowRight } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import ModularAssetPanel from "./ModularAssetPanel";

type Asset = {
  id: string;
  product_name: string;
  glb_link: string;
  category?: string;
  preview_image?: string | string[];
  article_id?: string;
};

type ModularStepPanelProps = {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onPlaceAsset?: (asset: Asset) => void;
};

export default function ModularStepPanel({
  isCollapsed = false,
  onToggleCollapse,
  onPlaceAsset,
}: ModularStepPanelProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [configuratorUrl, setConfiguratorUrl] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const MAX_ASSETS = 20;

  // Step 1: Asset Selection
  const handleAssetSelect = (asset: Asset) => {
    if (selectedAssets.find((a) => a.id === asset.id)) {
      // Remove if already selected
      setSelectedAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } else if (selectedAssets.length < MAX_ASSETS) {
      // Add if under limit
      setSelectedAssets((prev) => [...prev, asset]);
    }
  };

  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  const handlePlaceInScene = (asset: Asset) => {
    onPlaceAsset?.(asset);
  };

  const handleProceedToStep2 = () => {
    if (selectedAssets.length > 0) {
      setCurrentStep(2);
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };

  const handleClearAll = () => {
    setSelectedAssets([]);
    setCurrentStep(1);
  };

  const handleGenerateConfigurator = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/modular-3d/generate-configurator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAssets: selectedAssets.map(a => ({
            id: a.id,
            name: a.product_name,
            glbUrl: a.glb_link,
            previewImage: a.preview_image
          }))
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Configurator generation failed:', errorData);
        alert(`Failed to generate configurator: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const { cdnUrl, embedCode: generatedEmbedCode } = await response.json();
      setConfiguratorUrl(cdnUrl);
      setEmbedCode(generatedEmbedCode);
      setCurrentStep(3);
    } catch (error) {
      console.error('Failed to generate configurator:', error);
      alert('Failed to generate configurator. Please check the console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateConfigurator = () => {
    setConfiguratorUrl(null);
    setEmbedCode("");
    handleGenerateConfigurator();
  };

  // Collapsed minimal UI
  if (isCollapsed) {
    return (
      <Card className="h-full flex flex-col surface-elevated border shadow-lg rounded-xl transition-all duration-300">
        <div className="pb-3 pt-4 px-4 flex-shrink-0 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-all"
            title="Expand Panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xs font-medium tracking-wider [writing-mode:vertical-lr] text-muted-foreground">
            {currentStep === 1 ? "Select Assets" : "Place in Scene"}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* Header - Minimal like reference */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border/30 bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              {currentStep === 1 ? "Select Assets" : currentStep === 2 ? "Place in Scene" : "Configurator Ready"}
            </h2>
              {currentStep === 1 && selectedAssets.length > 0 && (
                <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 border border-primary/20">
                  {selectedAssets.length} / {MAX_ASSETS} selected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {currentStep === 1 
                ? "Choose which models will be part of your configurator" 
                : currentStep === 2
                ? "Test your configurator - click assets to place them in the scene. When satisfied, generate the final embed code."
                : "Your configurator is ready! Copy the embed code to add it to your website."}
            </p>
          </div>
          {currentStep === 1 && selectedAssets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-destructive rounded-none"
            >
              Clear All
            </Button>
          )}
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-4">
          <div className={cn(
            "h-1 flex-1 transition-colors",
            currentStep >= 1 ? "bg-primary" : "bg-muted"
          )} />
          <div className={cn(
            "h-1 flex-1 transition-colors",
            currentStep >= 2 ? "bg-primary" : "bg-muted"
          )} />
          <div className={cn(
            "h-1 flex-1 transition-colors",
            currentStep >= 3 ? "bg-primary" : "bg-muted"
          )} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {currentStep === 1 ? (
          // Step 1: Use ModularAssetPanel but styled to match reference grid
          <div className="flex-1 min-h-0 flex flex-col">
            <ModularAssetPanel
              onAssetSelect={handleAssetSelect}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              selectedAssets={selectedAssets}
              showCollapseButton={false}
            />

            {/* Continue Button */}
            <div className="flex-shrink-0 p-6 border-t border-border/30">
              <Button
                onClick={handleProceedToStep2}
                disabled={selectedAssets.length === 0}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg disabled:opacity-50 rounded-none"
              >
                Continue to Placement
              </Button>
            </div>
          </div>
        ) : currentStep === 2 ? (
          // Step 2: Place Assets in Scene - Grid like reference image
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 grid grid-cols-2 gap-4">
                {selectedAssets.map((asset, idx) => (
                  <button
                    key={asset.id}
                    onClick={() => handlePlaceInScene(asset)}
                    className="group relative aspect-square flex flex-col items-center justify-center border-2 border-border/40 bg-white dark:bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 text-center overflow-hidden"
                  >
                    {/* Thumbnail - Large centered */}
                    <div className="relative w-full h-full flex items-center justify-center p-8">
                      {asset.preview_image && !imageErrors.has(asset.id) ? (
                        <Image
                          src={
                            Array.isArray(asset.preview_image)
                              ? asset.preview_image[0]
                              : asset.preview_image
                          }
                          alt={asset.product_name}
                          fill
                          className="object-contain p-4 group-hover:scale-110 transition-transform duration-200"
                          sizes="200px"
                          priority={false}
                          onError={() => {
                            setImageErrors((prev) => new Set(prev).add(asset.id));
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted/30 flex items-center justify-center">
                          <span className="text-2xl text-muted-foreground/50 font-semibold">
                            {asset.product_name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Label at bottom */}
                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                        {asset.product_name}
                      </p>
                    </div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex-shrink-0 p-6 border-t border-border/30 bg-background/50 space-y-3">
              <Button
                onClick={handleGenerateConfigurator}
                disabled={isGenerating}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg disabled:opacity-50 rounded-none"
              >
                {isGenerating ? "Creating Configurator..." : "Create Configurator"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBackToStep1}
                className="w-full h-12 gap-2 font-semibold text-sm shadow-sm rounded-none"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Selection
              </Button>
            </div>
          </div>
        ) : (
          // Step 3: Configurator Ready
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-6">
                {/* Direct Link */}
                {configuratorUrl && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Direct Link</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={configuratorUrl}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm border border-border/40 bg-muted/20 rounded-none"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(configuratorUrl)}
                        className="rounded-none"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}

                {/* Embed Code */}
                {embedCode && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Embed Code</h3>
                    <textarea
                      value={embedCode}
                      readOnly
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-border/40 bg-muted/20 rounded-none font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(embedCode)}
                      className="rounded-none"
                    >
                      Copy Embed Code
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex-shrink-0 p-6 border-t border-border/30 bg-background/50 space-y-3">
              <Button
                onClick={handleRegenerateConfigurator}
                disabled={isGenerating}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg disabled:opacity-50 rounded-none"
              >
                {isGenerating ? "Regenerating..." : "Regenerate Configurator"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBackToStep1}
                className="w-full h-12 gap-2 font-semibold text-sm shadow-sm rounded-none"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Selection
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
