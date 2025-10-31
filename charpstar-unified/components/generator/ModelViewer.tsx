"use client";

import { useEffect, useRef } from "react";

interface ModelViewerProps {
  modelUrl: string;
  cameraAngle?: string;
}

export function ModelViewer({ modelUrl, cameraAngle }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load the model-viewer script once on component mount
    const script = document.createElement("script");
    script.src =
      "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    script.type = "module";
    document.head.appendChild(script);

    return () => {
      // Remove the script when component unmounts
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!modelUrl || !containerRef.current) return;

    // Clear any existing model-viewer elements
    containerRef.current.innerHTML = "";

    // Create a new model-viewer element with auto settings for field-of-view
    const modelViewer = document.createElement("model-viewer");
    modelViewer.setAttribute("src", modelUrl);
    modelViewer.setAttribute("alt", "Generated 3D model");
    // Auto-rotate disabled - model stays still for better preview
    modelViewer.setAttribute("camera-controls", "");
    // Remove any custom camera orbit or field-of-view settings to use defaults
    // Add specific visual settings
    modelViewer.setAttribute(
      "environment-image",
      "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
    );
    modelViewer.setAttribute("exposure", "1.2");
    modelViewer.setAttribute("tone-mapping", "aces");
    modelViewer.setAttribute("shadow-intensity", "0.5");
    modelViewer.setAttribute("shadow-softness", "1");
    modelViewer.style.width = "100%";
    modelViewer.style.height = "100%";

    // Set initial camera angle if provided
    if (cameraAngle) {
      modelViewer.setAttribute("camera-orbit", cameraAngle);
    }

    // Store reference to model-viewer
    modelViewerRef.current = modelViewer;

    // Ensure auto-rotate is disabled after load
    modelViewer.addEventListener("load", () => {
      if (modelViewerRef.current) {
        (modelViewerRef.current as any).autoRotate = false;
      }
    });

    // Append the model-viewer to the container
    containerRef.current.appendChild(modelViewer);

    return () => {
      // Cleanup: remove the model-viewer element when component unmounts or modelUrl changes
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      modelViewerRef.current = null;
    };
  }, [modelUrl]);

  // Update camera angle when it changes
  useEffect(() => {
    if (modelViewerRef.current && cameraAngle) {
      // Use model-viewer's camera API to smoothly animate to the new position
      try {
        if (modelViewerRef.current.cameraOrbit !== undefined) {
          modelViewerRef.current.cameraOrbit = cameraAngle;
        } else {
          // Fallback to setting attribute if API is not available
          modelViewerRef.current.setAttribute("camera-orbit", cameraAngle);
          // Trigger a render update
          modelViewerRef.current.dispatchEvent(new Event("camera-change"));
        }
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // If camera API fails, just update the attribute
        modelViewerRef.current.setAttribute("camera-orbit", cameraAngle);
      }
    }
  }, [cameraAngle]);

  if (!modelUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <p className="text-muted-foreground text-center">
          Model will be displayed here
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full overflow-hidden" />
    </div>
  );
}
