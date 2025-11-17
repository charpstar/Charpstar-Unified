"use client";

import { useState, useEffect } from "react";
import { HunyuanConfigSection } from "./HunyuanConfigSection";
import { HunyuanImageUploadSection } from "./HunyuanImageUploadSection";
import { ModelViewerSection } from "./ModelViewerSection";
import { GeneratedModelsGallery } from "./GeneratedModelsGallery";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/interactive/tabs";
import { Sparkles, Grid3x3 } from "lucide-react";

export interface UploadedImage {
  file: File;
  preview: string;
  base64?: string;
}

export interface UploadedImages {
  front: UploadedImage | null;
  back: UploadedImage | null;
  left: UploadedImage | null;
  right: UploadedImage | null;
}

export function GeneratorPage() {
  const [activeTab, setActiveTab] = useState<"generate" | "gallery">(
    "generate"
  );
  const [uploadedImages, setUploadedImages] = useState<UploadedImages>({
    front: null,
    back: null,
    left: null,
    right: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedModel, setGeneratedModel] = useState<string | null>(null);
  const [tencentModelUrl, setTencentModelUrl] = useState<string | null>(null); // Store original Tencent URL for saving
  const [isSingleImageMode, setIsSingleImageMode] = useState(false);
  const [faceCount, setFaceCount] = useState(500000);
  const [enablePBR, setEnablePBR] = useState(false);
  const [generateType, setGenerateType] = useState<
    "Normal" | "LowPoly" | "Geometry" | "Sketch"
  >("Normal");

  // Clear images when switching modes
  useEffect(() => {
    setUploadedImages({
      front: null,
      back: null,
      left: null,
      right: null,
    });
    setGeneratedModel(null);
    setTencentModelUrl(null);
  }, [isSingleImageMode]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Responsive with collapsible on mobile */}
        <div className="w-full lg:w-80 xl:w-96 bg-background shadow-md border-b lg:border-b-0 lg:border-r border-border flex flex-col max-h-[50vh] lg:max-h-none">
          {/* Page Title Section */}
          <div className="p-3 sm:p-4 border-b border-border">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              AI 3D Generator
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Powered by Tencent
            </p>

            {/* Tabs */}
            <div className="mt-3">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 gap-2 ">
                  <TabsTrigger
                    value="generate"
                    className="gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Generate</span>
                    <span className="xs:hidden">Generator</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="gallery"
                    className="gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm"
                  >
                    <Grid3x3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Gallery
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {activeTab === "generate" && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Scrollable Content Container */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 p-2 sm:p-3">
                {/* Configuration */}
                <div className="bg-card p-2 sm:p-3 rounded-lg shadow-sm border border-border shrink-0">
                  <HunyuanConfigSection
                    isSingleImageMode={isSingleImageMode}
                    setIsSingleImageMode={setIsSingleImageMode}
                    faceCount={faceCount}
                    setFaceCount={setFaceCount}
                    enablePBR={enablePBR}
                    setEnablePBR={setEnablePBR}
                    generateType={generateType}
                    setGenerateType={setGenerateType}
                  />
                </div>

                {/* Upload Section */}
                <div className="bg-card p-3 sm:p-4 rounded-lg shadow-sm border border-border shrink-0">
                  <HunyuanImageUploadSection
                    uploadedImages={uploadedImages}
                    setUploadedImages={setUploadedImages}
                    isGenerating={isGenerating}
                    setIsGenerating={setIsGenerating}
                    setGenerationProgress={setGenerationProgress}
                    setGeneratedModel={setGeneratedModel}
                    setTencentModelUrl={setTencentModelUrl}
                    tencentModelUrl={tencentModelUrl}
                    isSingleImageMode={isSingleImageMode}
                    faceCount={faceCount}
                    enablePBR={enablePBR}
                    generateType={generateType}
                    onModelSaved={() => {
                      setActiveTab("gallery");
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Responsive */}
        {activeTab === "generate" ? (
          /* 3D Viewer */
          <div className="flex-1 bg-gradient-to-br from-background to-muted h-[50vh] lg:h-full min-h-[300px]">
            <ModelViewerSection
              generatedModel={generatedModel}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
            />
          </div>
        ) : (
          /* Gallery Tab */
          <div className="flex-1 overflow-hidden">
            <GeneratedModelsGallery />
          </div>
        )}
      </div>
    </div>
  );
}
