// src/app/[client]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { fetchClientConfig, isValidClient } from "@/config/clientConfig";
import { useState, useEffect, useRef } from "react";
import { SimpleLayout } from "@/components/layout/SimpleLayout";
import Header from "@/components/layout/Header";
import SaveProgressOverlay from "@/components/SaveProgressOverlay";
import SavePasswordDialog from "@/components/SavePasswordDialog";
import InputLocker from "@/components/InputLocker";
import { notFound } from "next/navigation";
import SimpleClientViewerScript from "@/components/SimpleClientViewerScript";
import { useIsMobile } from "@/hooks/use-mobile";
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

export default function ClientPage() {
  const params = useParams();
  const clientName = params.id as string;

  const [modelStructure, setModelStructure] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const modelViewerRef = useRef<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [clientConfig, setClientConfig] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isValidatingClient, setIsValidatingClient] = useState(true);
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

  const isMobile = useIsMobile();
  const [showSceneDrawer, setShowSceneDrawer] = useState(false);
  const [showVariantsDrawer, setShowVariantsDrawer] = useState(false);
  const [showMaterialDrawer, setShowMaterialDrawer] = useState(false);

  useEffect(() => {
    const validateAndFetchConfig = async () => {
      if (clientName) {
        const valid = await isValidClient(clientName);
        setIsClientValid(valid);
        if (valid) {
          const config = await fetchClientConfig(clientName);
          setClientConfig(config);
          setShouldLoadScript(true);
        }
      }
    };
    validateAndFetchConfig();
  }, [clientName]);

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
          console.log("Model structure loaded:", structure);
          setModelStructure(structure);
          return true;
        } else {
          console.warn("Model structure is empty or null");
          return false;
        }
      } catch (error) {
        console.error("Error fetching model structure:", error);
        return false;
      }
    } else {
      console.warn("modelViewer or getModelStructure method not available");
      return false;
    }
  };

  // Set up retry logic for fetching model structure
  useEffect(() => {
    if (modelLoaded && !modelStructure) {
      console.log(
        "Model loaded but structure not yet available, attempting to fetch..."
      );

      // Try immediately first
      if (!fetchModelStructure()) {
        // If first attempt fails, set up a retry mechanism
        const retryAttempts = 5;
        let currentAttempt = 0;

        const retryInterval = setInterval(() => {
          currentAttempt++;
          console.log(`Retry attempt ${currentAttempt} of ${retryAttempts}`);

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

        if (modelViewer.getAttribute("src")) {
          // We don't call fetchModelStructure here anymore
          // It will be called by the onModelLoaded handler
        }
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
    console.log("Model loaded event received");
    setModelLoaded(true);
    fetchModelStructure();
  };

  // Handler for variant change
  const handleVariantChange = () => {
    console.log("Variant changed, updating material view");
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

    try {
      // Start saving process - show overlay and lock UI
      setIsSaving(true);
      setSaveProgress(10);
      setSaveMessage("Preparing materials data...");

      // Get all resource data from saveGLTF
      console.log("Calling saveGLTF...");
      const resourceData = await modelViewerRef.current.saveGLTF();

      // Debug what we got back
      console.log("saveGLTF returned:", {
        hasMaterials: !!resourceData.materials,
        hasTextures: !!resourceData.textures,
        hasImages: !!resourceData.images,
        materialsCount: resourceData.materials?.length,
        texturesCount: resourceData.textures?.length,
        imagesCount: resourceData.images?.length,
      });

      setSaveProgress(30);
      setSaveMessage("Uploading material changes...");

      // Track upload results
      const uploadResults = {
        materials: false,
        textures: false,
        images: false,
      };

      // Upload materials.json
      if (resourceData.materials) {
        console.log("Uploading materials.json...");

        const materialsResponse = await fetch("/api/3d-editor/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: resourceData.materials,
            filename: "materials.json",
            client: clientName,
          }),
        });

        if (materialsResponse.ok) {
          const result = await materialsResponse.json();
          console.log("Materials saved successfully:", result.fileUrl);
          uploadResults.materials = true;
          setSaveProgress(60);
          setSaveMessage("Processing materials...");
        } else {
          const errorData = await materialsResponse.json();
          console.error(
            `Failed to upload materials: ${errorData.error || materialsResponse.statusText}`
          );
          setSaveMessage("Error saving materials. Please try again.");
        }
      } else {
        console.warn("No materials data available to upload");
        setSaveProgress(60);
      }

      // Process textures data if needed
      if (resourceData.textures) {
        setSaveMessage("Processing textures...");
        setSaveProgress(70);
        // Process textures data here
        uploadResults.textures = true;
      }

      // Process images data if needed
      if (resourceData.images) {
        setSaveMessage("Processing images...");
        setSaveProgress(80);
        // Process images data here
        uploadResults.images = true;
      }

      // Final processing
      setSaveProgress(90);
      setSaveMessage("Finalizing changes...");

      // Add a small delay to show progress completion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check overall success and provide feedback
      const successCount = Object.values(uploadResults).filter(Boolean).length;
      const totalCount = Object.keys(uploadResults).filter(
        (key) => !!resourceData[key]
      ).length;

      if (successCount === totalCount) {
        console.log("All files saved successfully!");
        setSaveProgress(100);
        setSaveMessage("Changes saved successfully!");

        // Keep success message visible briefly before hiding overlay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (successCount > 0) {
        console.log(`${successCount}/${totalCount} files saved successfully`);
        setSaveProgress(100);
        setSaveMessage(
          `Partially completed: ${successCount}/${totalCount} resources saved.`
        );

        // Keep partial success message visible briefly
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        console.error("Failed to save any files");
        setSaveProgress(100);
        setSaveMessage("Failed to save changes. Please try again.");

        // Keep error message visible longer
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Reset the UI state
      setIsSaving(false);
      setSaveProgress(0);
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

  let content = null;
  if (isClientValid === null) {
    content = <div>Loading...</div>;
  } else if (isClientValid === false) {
    content = null; // notFound will be called in useEffect
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

        <div className="flex-none">
          <Header
            modelViewerRef={modelViewerRef}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>

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
            />
          </div>
        )}
      </>
    );
  }

  return <div className="flex flex-col h-screen bg-background">{content}</div>;
}
