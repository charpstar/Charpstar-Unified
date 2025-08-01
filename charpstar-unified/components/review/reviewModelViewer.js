// components/ModelViewer.js

"use client";

import { useState, useEffect, useRef } from "react";

const ReviewModelViewer = ({ onModelLoaded, modelSrc: initialModelSrc }) => {
  const [modelSrc, setModelSrc] = useState(initialModelSrc || null);
  const [isClient, setIsClient] = useState(false);
  const fileNameRef = useRef("model");

  useEffect(() => {
    setIsClient(true); // Set to true only on the client side
  }, []);

  // Update modelSrc when initialModelSrc changes
  useEffect(() => {
    if (initialModelSrc) {
      setModelSrc(initialModelSrc);
    }
  }, [initialModelSrc]);

  // Effect to handle model load event
  useEffect(() => {
    if (!modelSrc) return;

    const modelViewer = document.getElementById("model-viewer");
    if (modelViewer) {
      const handleLoad = () => {
        // Set the custom property directly on the DOM element
        window.modelViewerElement = modelViewer;
        window.currentFileName = fileNameRef.current;

        if (onModelLoaded) {
          // Give a small delay to ensure the model is fully processed
          setTimeout(onModelLoaded, 100);
        }
      };

      modelViewer.addEventListener("load", handleLoad);

      return () => {
        modelViewer.removeEventListener("load", handleLoad);
      };
    }
  }, [modelSrc, onModelLoaded]);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type === "model/gltf-binary" ||
        file.name.endsWith(".glb") ||
        file.name.endsWith(".gltf"))
    ) {
      // Store the original filename without extension
      const originalFileName = file.name.replace(/\.[^/.]+$/, "");
      fileNameRef.current = originalFileName;

      const url = URL.createObjectURL(file);
      setModelSrc(url);
    } else {
      alert("Please drag and drop a valid .glb or .gltf file.");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    // Add subtle visual feedback during drag
    e.currentTarget.classList.add("bg-[#EFEFEF]");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Remove the visual feedback
    e.currentTarget.classList.remove("bg-[#EFEFEF]");
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="w-full h-full flex items-center justify-center transition-colors duration-200"
    >
      <div className="w-full h-full flex items-center justify-center">
        {/* Render <model-viewer> only if a model is loaded */}
        {isClient && modelSrc && (
          <model-viewer
            src={modelSrc}
            alt="A 3D model"
            id="model-viewer"
            shadow-intensity="0.5"
            environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
            exposure="1.2"
            tone-mapping="aces"
            shadow-softness="1"
            min-field-of-view="5deg"
            max-field-of-view="35deg"
            style={{ width: "100%", height: "100%" }}
            camera-controls
          ></model-viewer>
        )}

        {/* Show a message if no model is loaded */}
        {!modelSrc && (
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-2">
              Drag and drop a <strong>.glb</strong> or <strong>.gltf</strong>{" "}
              file here to view it.
            </p>
            <p className="text-gray-500 text-xs">
              The model structure will be displayed in the left panel once
              loaded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewModelViewer;
