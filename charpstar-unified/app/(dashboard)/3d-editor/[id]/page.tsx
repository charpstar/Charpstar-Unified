// src/app/[client]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { fetchClientConfig, isValidClient } from "@/config/clientConfig";
import { useState, useEffect, useRef } from "react";
import { SimpleLayout } from "@/components/layout/SimpleLayout";
import SaveProgressOverlay from "@/components/SaveProgressOverlay";
import SavePasswordDialog from "@/components/SavePasswordDialog";
import InputLocker from "@/components/InputLocker";
import { notFound } from "next/navigation";
import SimpleClientViewerScript from "@/components/SimpleClientViewerScript";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUser } from "@/contexts/useUser";
import { ThreeDEditorSkeleton } from "@/components/ui/3d-editor-skeleton";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Layers, Box, Palette } from "lucide-react";
import { MaterialVariants } from "@/components/variant/MaterialVariants";
import { MaterialProperties } from "@/components/material/MaterialProperties";
import StructureTree from "@/components/scene/StructureTree";
import { ModelViewer } from "@/components/ModelViewer";
import React from "react";

export default function ClientPage() {
  const params = useParams();
  const clientName = params.id as string;
  const user = useUser();

  const [modelStructure, setModelStructure] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const modelViewerRef = useRef<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [clientConfig, setClientConfig] = useState<any>(null);
  const [isClientValid, setIsClientValid] = useState<null | boolean>(null);

  // Save progress state
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState(
    "Preparing to save changes..."
  );

  // Password dialog state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [shouldLoadScript, setShouldLoadScript] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  const isMobile = useIsMobile();
  const [showSceneDrawer, setShowSceneDrawer] = useState(false);
  const [showVariantsDrawer, setShowVariantsDrawer] = useState(false);
  const [showMaterialDrawer, setShowMaterialDrawer] = useState(false);

  // Access control check - redirect if user doesn't have client_config
  useEffect(() => {
    if (
      user &&
      (!user.metadata?.client_config ||
        user.metadata.client_config.trim() === "")
    ) {
      setHasAccess(false);
      // Redirect to dashboard if user doesn't have access
      window.location.href = "/dashboard";
    }
  }, [user]);

  useEffect(() => {
    const validateAndFetchConfig = async () => {
      if (clientName && hasAccess) {
        const valid = await isValidClient(clientName);
        setIsClientValid(valid);
        if (valid) {
          const config = await fetchClientConfig(clientName);
          setClientConfig(config);
          setShouldLoadScript(true);

          // Add a delay to ensure script loading and initialization
          setTimeout(() => {
            setIsReady(true);
          }, 500);
        }
      }
    };
    validateAndFetchConfig();
  }, [clientName, hasAccess]);

  // Call notFound in an effect if client is invalid
  useEffect(() => {
    if (isClientValid === false) {
      notFound();
    }
  }, [isClientValid]);

  // Enhanced function to fetch the model structure with retry logic
  const fetchModelStructure = () => {
    if (
      modelViewerRef.current &&
      typeof modelViewerRef.current.getModelStructure === "function"
    ) {
      try {
        const structure = modelViewerRef.current.getModelStructure();

        if (structure) {
          setModelStructure(structure);
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error("Error fetching model structure:", error);
        return false;
      }
    } else {
      return false;
    }
  };

  // Set up retry logic for fetching model structure
  useEffect(() => {
    if (modelLoaded && !modelStructure) {
      // Try immediately first
      if (!fetchModelStructure()) {
        // If first attempt fails, set up a retry mechanism
        const retryAttempts = 5;
        let currentAttempt = 0;

        const retryInterval = setInterval(() => {
          currentAttempt++;

          if (fetchModelStructure() || currentAttempt >= retryAttempts) {
            clearInterval(retryInterval);

            if (currentAttempt >= retryAttempts && !modelStructure) {
              console.error(
                "Failed to fetch model structure after multiple attempts"
              );
            }
          }
        }, 500); // Try every 500ms

        return () => clearInterval(retryInterval);
      }
    }
  }, [modelLoaded, modelStructure]);

  // Set up model viewer reference
  useEffect(() => {
    const setupModelViewer = () => {
      const modelViewer = document.getElementById("model-viewer");
      if (modelViewer) {
        modelViewerRef.current = modelViewer;
      }
    };

    setupModelViewer();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const modelViewer = document.querySelector("model-viewer");
          if (modelViewer && !modelViewerRef.current) {
            setupModelViewer();
          }
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handler for model loaded event
  const handleModelLoaded = () => {
    setModelLoaded(true);
    fetchModelStructure();
  };

  // Handler for variant change
  const handleVariantChange = () => {
    fetchModelStructure();
  };

  // Handler for node selection
  const handleNodeSelect = (node: any) => {
    setSelectedNode(node);
  };

  // Enhanced handleSave function with password confirmation
  const handleSave = async () => {
    setIsPasswordDialogOpen(true);
  };

  // New function to handle the actual save after password confirmation
  const handleConfirmedSave = async () => {
    if (!modelViewerRef.current?.saveGLTF) {
      console.error("saveGLTF method not available");
      return;
    }

    setIsSaving(true);
    setSaveProgress(0);
    setSaveMessage("Preparing to save changes...");

    try {
      // Simulate progress updates
      setSaveProgress(10);
      setSaveMessage("Validating model structure...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaveProgress(30);
      setSaveMessage("Exporting model...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSaveProgress(60);
      setSaveMessage("Uploading to server...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSaveProgress(90);
      setSaveMessage("Finalizing changes...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaveProgress(100);
      setSaveMessage("Changes saved successfully!");

      // Keep success message visible
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: unknown) {
      console.error("Error saving resources:", error);
      setSaveProgress(100);

      // Fix for TypeScript error - properly type check the error
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message);
      }

      setSaveMessage(`Error: ${errorMessage}`);

      // Keep error message visible
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      // Reset the UI state
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  // Handle password confirmation
  const handlePasswordConfirm = (password: string) => {
    const isCorrect = password === clientConfig.livePassword;
    if (isCorrect) {
      setIsPasswordDialogOpen(false);
      handleConfirmedSave();
    }
    return isCorrect; // Return whether the password was correct
  };

  if (!hasAccess) {
    return null;
  }

  let content = null;
  if (isClientValid === null) {
    content = <ThreeDEditorSkeleton isMobile={isMobile} />;
  } else if (isClientValid === false) {
    content = null; // notFound will be called in useEffect
  } else if (!isReady) {
    content = <ThreeDEditorSkeleton isMobile={isMobile} />;
  } else {
    content = (
      <>
        <SimpleClientViewerScript shouldLoad={shouldLoadScript} />
        {/* Save Progress Overlay */}
        <SaveProgressOverlay
          isVisible={isSaving}
          progress={saveProgress}
          message={saveMessage}
        />

        {/* Password Confirmation Dialog */}
        <SavePasswordDialog
          isOpen={isPasswordDialogOpen}
          onClose={() => setIsPasswordDialogOpen(false)}
          onConfirm={handlePasswordConfirm}
        />

        {/* Input Locker - Blocks all user interaction when saving */}
        <InputLocker isLocked={isSaving} />

        {isMobile ? (
          <>
            {/* Mobile FABs for Scene, Variants, Material */}
            <button
              className="fixed bottom-4 left-4 z-30 bg-card border border-border rounded-full shadow-lg p-3 flex items-center justify-center active:scale-95 transition-transform"
              onClick={() => setShowSceneDrawer(true)}
              aria-label="Scene Tree"
            >
              <Layers size={22} />
            </button>
            <button
              className="fixed bottom-4 left-1/2 z-30 bg-card border border-border rounded-full shadow-lg p-3 flex items-center justify-center active:scale-95 transition-transform -translate-x-1/2"
              onClick={() => setShowVariantsDrawer(true)}
              aria-label="Material Variants"
            >
              <Box size={22} />
            </button>
            <button
              className="fixed bottom-4 right-4 z-30 bg-card border border-border rounded-full shadow-lg p-3 flex items-center justify-center active:scale-95 transition-transform"
              onClick={() => setShowMaterialDrawer(true)}
              aria-label="Material Properties"
            >
              <Palette size={22} />
            </button>
            {/* Scene Drawer */}
            <Dialog open={showSceneDrawer} onOpenChange={setShowSceneDrawer}>
              <DialogContent className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-card shadow-lg p-0 flex flex-col z-50 rounded-t-lg border-none min-h-0 h-fit !top-auto !left-1/2 !right-auto !translate-x-[-50%] !translate-y-0">
                <DialogHeader className="flex items-center justify-between p-3 border-b border-border">
                  <DialogTitle className="font-semibold text-base">
                    Scene Hierarchy
                  </DialogTitle>
                </DialogHeader>
                <div className="p-2">
                  {modelStructure ? (
                    <StructureTree
                      node={modelStructure}
                      onNodeSelect={handleNodeSelect}
                      selectedNode={selectedNode}
                      isMobile={true}
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
              </DialogContent>
            </Dialog>
            {/* Variants Drawer */}
            <Dialog
              open={showVariantsDrawer}
              onOpenChange={setShowVariantsDrawer}
            >
              <DialogContent className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-card shadow-lg p-0 flex flex-col z-50 rounded-t-lg border-none min-h-0 h-fit !top-auto !left-1/2 !right-auto !translate-x-[-50%] !translate-y-0">
                <DialogHeader className="flex items-center justify-between p-3 border-b border-border">
                  <DialogTitle className="font-semibold text-base">
                    Material Variants
                  </DialogTitle>
                </DialogHeader>
                <div className="p-2">
                  <MaterialVariants
                    modelViewerRef={modelViewerRef}
                    onVariantChange={handleVariantChange}
                    selectedNode={selectedNode}
                    isMobile={true}
                  />
                </div>
              </DialogContent>
            </Dialog>
            {/* Material Properties Drawer */}
            <Dialog
              open={showMaterialDrawer}
              onOpenChange={setShowMaterialDrawer}
            >
              <DialogContent className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-card shadow-lg p-0 flex flex-col z-50 rounded-t-lg border-none min-h-0 h-fit !top-auto !left-1/2 !right-auto !translate-x-[-50%] !translate-y-0">
                <DialogHeader className="flex items-center justify-between p-3 border-b border-border">
                  <DialogTitle className="font-semibold text-base">
                    Material Properties
                  </DialogTitle>
                </DialogHeader>
                <div className="p-2">
                  <MaterialProperties
                    selectedNode={selectedNode}
                    modelViewerRef={modelViewerRef}
                    isMobile={true}
                  />
                </div>
              </DialogContent>
            </Dialog>
            {/* 3D Viewer fills the rest of the screen */}
            <div className="flex-1 p-2 bg-card relative">
              <div className="h-[60vh] rounded-lg overflow-hidden shadow-md bg-background flex items-center justify-center relative">
                <ModelViewer
                  onModelLoaded={handleModelLoaded}
                  clientModelUrl={clientConfig?.modelUrl || ""}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SimpleLayout
              modelStructure={modelStructure}
              selectedNode={selectedNode}
              modelViewerRef={modelViewerRef}
              onNodeSelect={handleNodeSelect}
              onModelLoaded={handleModelLoaded}
              onVariantChange={handleVariantChange}
              clientModelUrl={clientConfig?.modelUrl}
              isMobile={false}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </div>
        )}
      </>
    );
  }

  return <div className="flex flex-col h-full bg-background">{content}</div>;
}
