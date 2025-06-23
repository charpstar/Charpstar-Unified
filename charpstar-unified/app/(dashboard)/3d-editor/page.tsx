// src/app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { SimpleLayout } from "@/components/layout/SimpleLayout";
import React from "react";
import { Header } from "@/components/Header";

export default function Home() {
  const [modelStructure, setModelStructure] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const modelViewerRef = useRef<any>(null);

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
    if (!modelStructure) {
      console.log("Attempting to fetch model structure...");

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
  }, [modelStructure]);

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

  // Handler for variant change
  const handleVariantChange = () => {
    console.log("Variant changed, updating material view");
    fetchModelStructure();
  };

  // Handler for node selection
  const handleNodeSelect = (node: any) => {
    setSelectedNode(node);
  };

  // Export functions
  const handleExportGLB = () => {
    if (modelViewerRef.current?.exportGLB) {
      modelViewerRef.current.exportGLB();
    }
  };

  const handleExportGLTF = () => {
    if (modelViewerRef.current?.exportGLTF) {
      modelViewerRef.current.exportGLTF();
    }
  };

  const handleExportUSDZ = () => {
    if (modelViewerRef.current?.exportUSDZ) {
      modelViewerRef.current.exportUSDZ();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        onExportGLB={handleExportGLB}
        onExportGLTF={handleExportGLTF}
        onExportUSDZ={handleExportUSDZ}
      />
      {/* Main Area with SimpleLayout */}
      <div className="flex-1 overflow-hidden">
        <SimpleLayout
          modelStructure={modelStructure}
          selectedNode={selectedNode}
          modelViewerRef={modelViewerRef}
          onNodeSelect={handleNodeSelect}
          onModelLoaded={fetchModelStructure}
          onVariantChange={handleVariantChange}
        />
      </div>
    </div>
  );
}
