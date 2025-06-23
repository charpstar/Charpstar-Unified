// src/components/layout/SimpleLayout.tsx
"use client";

import React, { useState } from "react";
import { ModelViewer } from "@/components/ModelViewer";
import StructureTree from "@/components/scene/StructureTree";
import { MaterialProperties } from "@/components/material/MaterialProperties";
import { MaterialVariants } from "@/components/variant/MaterialVariants";
import { Layers, Box, Palette, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

interface SimpleLayoutProps {
  modelStructure: any;
  selectedNode: any;
  modelViewerRef: React.RefObject<any>;
  onNodeSelect: (node: any) => void;
  onModelLoaded: () => void;
  onVariantChange: () => void;
  clientModelUrl?: string;
  isMobile?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  shouldRenderModelViewer?: boolean;
}

export const SimpleLayout: React.FC<SimpleLayoutProps> = ({
  modelStructure,
  selectedNode,
  modelViewerRef,
  onNodeSelect,
  onModelLoaded,
  onVariantChange,
  clientModelUrl,
  isMobile = false,
  onSave,
  isSaving = false,
  shouldRenderModelViewer = true,
}) => {
  const params = useParams();
  const clientName = params?.id as string;

  const [variantChangeCounter, setVariantChangeCounter] = useState(0);

  // Handler for variant changes to force re-render of material panel
  const handleVariantChange = () => {
    setVariantChangeCounter((prev) => prev + 1);
    if (onVariantChange) {
      onVariantChange();
    }
  };

  if (isMobile) {
    return (
      <div className="flex h-full bg-background">
        <div className="flex-1 bg-muted/30 p-4 shadow-md overflow-hidden relative">
          {shouldRenderModelViewer && clientModelUrl ? (
            <ModelViewer
              key={clientModelUrl}
              onModelLoaded={onModelLoaded}
              clientModelUrl={clientModelUrl}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading viewer...</div>
            </div>
          )}
          {/* Overlay buttons for mobile */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <Link href={`/3d-editor/${clientName}/demo`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Eye size={14} className="mr-2" />
                Demo
              </Button>
            </Link>
            {onSave && (
              <Button
                variant="default"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="text-xs h-8 px-3"
              >
                <Save size={14} className="mr-2" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Left panel - Scene */}
      <div className="w-64 bg-card shadow-md overflow-hidden flex flex-col">
        <div className=" p-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <Layers size={18} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">
              Scene Hierarchy
            </h3>
          </div>
        </div>
        <div className="p-3 flex-1 overflow-auto">
          {modelStructure ? (
            <StructureTree
              node={modelStructure}
              onNodeSelect={onNodeSelect}
              selectedNode={selectedNode}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground text-xs mt-4">
                No model structure available
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Upload a model or select an object
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Center panel - 3D Viewer */}
      <div className="flex-1   bg-muted/30 p-4  overflow-hidden relative">
        {shouldRenderModelViewer && clientModelUrl ? (
          <ModelViewer
            key={clientModelUrl}
            onModelLoaded={onModelLoaded}
            clientModelUrl={clientModelUrl}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading viewer...</div>
          </div>
        )}
        {/* Overlay buttons */}
        <div className="absolute top-8 right-8 flex flex-col gap-2 z-10">
          <Link href={`/3d-editor/${clientName}/demo`}>
            <Button variant="outline" size="sm" className="text-xs h-8">
              <Eye size={14} className="mr-2" />
              View Demo Catalog
            </Button>
          </Link>
          {onSave && (
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="text-xs h-8 px-3"
            >
              <Save size={14} className="mr-2" />
              {isSaving ? "Saving..." : "Save Changes to Live"}
            </Button>
          )}
        </div>
      </div>

      {/* Right side panels container */}
      <div className="flex mr-2">
        {/* Variant panel */}
        <div className="w-64 bg-card shadow-md overflow-hidden flex flex-col">
          <div className=" p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <Box size={18} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Variants</h3>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-auto">
            <MaterialVariants
              modelViewerRef={modelViewerRef}
              onVariantChange={handleVariantChange}
              selectedNode={selectedNode}
            />
          </div>
        </div>

        {/* Material panel */}
        <div className="w-80 bg-card shadow-md ml-2 overflow-hidden flex flex-col">
          <div className=" p-3 border-b border-border">
            <div className="flex items-center space-x-2">
              <Palette size={18} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">
                Material Properties
              </h3>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-auto">
            {selectedNode ? (
              <>
                <div className="mb-3 text-xs bg-muted p-2 rounded-md border border-border">
                  <span className="text-muted-foreground">Selected:</span>{" "}
                  <span className="font-medium text-foreground">
                    {selectedNode.name}
                  </span>
                  <span className="text-muted-foreground text-xs ml-1">
                    ({selectedNode.type})
                  </span>
                </div>
                <MaterialProperties
                  selectedNode={selectedNode}
                  modelViewerRef={modelViewerRef}
                  variantChangeCounter={variantChangeCounter}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Palette size={24} className="text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-xs">
                  Select a mesh to view its material properties
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
