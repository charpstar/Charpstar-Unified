"use client";

import { useEffect, useRef } from "react";

interface ModelViewerProps {
  modelUrl: string;
  cameraAngle?: string;
  backgroundColor?: string;
  zoomLevel?: number; // -50 to 50, where 0 is default
}

export function ModelViewer({ modelUrl, cameraAngle, backgroundColor, zoomLevel = 0 }: ModelViewerProps) {
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

    // Create a new model-viewer element with all interactions disabled
    const modelViewer = document.createElement("model-viewer");
    modelViewer.setAttribute("src", modelUrl);
    modelViewer.setAttribute("alt", "Generated 3D model");
    // Disable all interactions - camera is controlled purely by hovering angle buttons
    modelViewer.setAttribute("interaction-prompt", "none");
    modelViewer.setAttribute("disable-zoom", "");
    // No camera-controls - user cannot interact with the model
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
    modelViewer.style.cursor = "default"; // Remove pointer cursor

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

  // Update field-of-view based on zoom level to approximate render view
  useEffect(() => {
    if (modelViewerRef.current) {
      // Convert zoomLevel (-50 to +50) to field-of-view
      // zoomLevel = -50 (zoom in): smaller FOV (tighter view, like 10deg)
      // zoomLevel = 0 (default): standard FOV (20deg)
      // zoomLevel = +50 (zoom out): larger FOV (wider view, like 35deg)
      // Formula: FOV = 20 - (zoomLevel * 0.2) for zoom in/out
      // But we want zoom in to reduce FOV and zoom out to increase FOV
      // So: FOV = 20 + (zoomLevel * 0.3)
      // zoomLevel = -50: FOV = 20 - 15 = 5deg (very tight)
      // zoomLevel = 0: FOV = 20deg (default)
      // zoomLevel = +50: FOV = 20 + 15 = 35deg (wide)
      const baseFOV = 20;
      const fov = Math.max(5, Math.min(45, baseFOV + (zoomLevel * 0.3)));
      
      try {
        if (modelViewerRef.current.fieldOfView !== undefined) {
          modelViewerRef.current.fieldOfView = `${fov}deg`;
        } else {
          modelViewerRef.current.setAttribute("field-of-view", `${fov}deg`);
        }
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        modelViewerRef.current.setAttribute("field-of-view", `${fov}deg`);
      }
    }
  }, [zoomLevel]);

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
    <div 
      className="relative w-full h-full overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: backgroundColor || '#F8F9FA' }}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden" />
    </div>
  );
}
