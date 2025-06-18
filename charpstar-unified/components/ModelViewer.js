// components/ModelViewer.js
"use client";

import { useState, useEffect, useRef } from "react";
import { initializeModelViewer } from "@/utils/modelViewerInitializer";
import { useParams } from "next/navigation";
import { fetchClientConfig } from "@/config/clientConfig";

export const ModelViewer = ({ onModelLoaded, clientModelUrl }) => {
  const params = useParams();
  const clientName = params?.id;
  console.log(
    "[ModelViewer] Initializing with client:",
    clientName,
    "clientModelUrl:",
    clientModelUrl
  );

  const [modelSrc, setModelSrc] = useState(clientModelUrl || null);
  const [isClient, setIsClient] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [clientConfig, setClientConfig] = useState(null);
  const fileNameRef = useRef("model");
  const modelLoadedRef = useRef(false);
  const modelViewerElementRef = useRef(null);

  // Fetch client config
  useEffect(() => {
    const getConfig = async () => {
      if (clientName) {
        const config = await fetchClientConfig(clientName);
        setClientConfig(config);
      }
    };
    getConfig();
  }, [clientName]);

  // Check if script is loaded
  useEffect(() => {
    if (!clientConfig) return;

    const checkScript = () => {
      const scriptSrc = clientConfig.scriptPath;
      const isLoaded = !!document.querySelector(`script[src="${scriptSrc}"]`);
      console.log("[ModelViewer] Script loaded check:", isLoaded);
      setScriptLoaded(isLoaded);
    };

    // Check immediately
    checkScript();

    // Set up an observer to watch for script loading
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          checkScript();
        }
      });
    });

    observer.observe(document.head, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [clientConfig]);

  useEffect(() => {
    console.log("[ModelViewer] Setting isClient to true");
    setIsClient(true);
  }, []);

  // Update modelSrc when clientModelUrl changes
  useEffect(() => {
    if (clientModelUrl) {
      console.log(
        "[ModelViewer] Updating modelSrc with clientModelUrl:",
        clientModelUrl
      );
      setModelSrc(clientModelUrl);
    }
  }, [clientModelUrl]);

  // Effect to handle model load event
  useEffect(() => {
    console.log(
      "[ModelViewer] Model load effect triggered. isClient:",
      isClient,
      "modelSrc:",
      modelSrc,
      "scriptLoaded:",
      scriptLoaded
    );

    if (!isClient || !modelSrc || !scriptLoaded) {
      console.log(
        "[ModelViewer] Skipping model load setup - isClient:",
        isClient,
        "modelSrc:",
        modelSrc,
        "scriptLoaded:",
        scriptLoaded
      );
      return;
    }

    const modelViewer = document.getElementById("model-viewer");
    console.log("[ModelViewer] Found model-viewer element:", !!modelViewer);

    if (modelViewer) {
      const handleLoad = () => {
        console.log("[ModelViewer] Model load event triggered");

        // Store references
        window.modelViewerElement = modelViewer;
        window.currentFileName = fileNameRef.current;
        console.log("[ModelViewer] Stored global references");

        // Initialize our custom model viewer functions
        modelViewerElementRef.current = initializeModelViewer(modelViewer);
        console.log("[ModelViewer] Initialized model viewer functions");

        // Set a small delay to ensure the model is fully processed
        setTimeout(() => {
          if (onModelLoaded && !modelLoadedRef.current) {
            console.log("[ModelViewer] Triggering onModelLoaded callback");
            modelLoadedRef.current = true;
            onModelLoaded();
          }
        }, 500);
      };

      const handleError = (error) => {
        console.error("[ModelViewer] Error loading model:", error);
      };

      const handleProgress = (event) => {
        console.log(
          "[ModelViewer] Loading progress:",
          event.detail.totalProgress
        );
      };

      modelViewer.addEventListener("load", handleLoad);
      modelViewer.addEventListener("error", handleError);
      modelViewer.addEventListener("progress", handleProgress);

      return () => {
        modelViewer.removeEventListener("load", handleLoad);
        modelViewer.removeEventListener("error", handleError);
        modelViewer.removeEventListener("progress", handleProgress);
        modelLoadedRef.current = false;
      };
    }
  }, [isClient, modelSrc, onModelLoaded, scriptLoaded]);

  // Only enable drag and drop if no client model URL is provided
  const handleDrop = (e) => {
    if (clientModelUrl) return; // Disable drag & drop when client model is specified

    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type === "model/gltf-binary" ||
        file.name.endsWith(".glb") ||
        file.name.endsWith(".gltf"))
    ) {
      const originalFileName = file.name.replace(/\.[^/.]+$/, "");
      fileNameRef.current = originalFileName;
      modelLoadedRef.current = false;

      const url = URL.createObjectURL(file);
      setModelSrc(url);
    } else {
      alert("Please drag and drop a valid .glb or .gltf file.");
    }
  };

  const handleDragOver = (e) => {
    if (!clientModelUrl) {
      e.preventDefault();
      e.currentTarget.classList.add("bg-[#EFEFEF]");
    }
  };

  const handleDragLeave = (e) => {
    if (!clientModelUrl) {
      e.preventDefault();
      e.currentTarget.classList.remove("bg-[#EFEFEF]");
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="w-full h-full flex items-center justify-center transition-colors duration-200 rounded-md bg-[#F8F9FA]"
    >
      <div className="w-full h-full flex items-center justify-center">
        {isClient && modelSrc && scriptLoaded && clientConfig && (
          <model-viewer
            src={modelSrc}
            alt="A 3D model"
            id="model-viewer"
            disable-pan
            interaction-prompt="none"
            shadow-intensity="0"
            environment-image={clientConfig.hdrPath}
            exposure="1"
            tone-mapping="auto"
            camera-orbit="0deg 75deg auto"
            style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
            camera-controls
          ></model-viewer>
        )}

        {(!modelSrc || !scriptLoaded || !clientConfig) && !clientModelUrl && (
          <div className="text-center p-6 rounded-lg border-2 border-dashed border-gray-300 bg-white">
            <p className="text-gray-600 text-sm mb-3">
              {!scriptLoaded || !clientConfig
                ? "Loading viewer..."
                : "Drag and drop a model to view it."}
            </p>
            <p className="text-gray-500 text-xs">
              {!scriptLoaded || !clientConfig
                ? "Please wait while the viewer loads..."
                : "The model structure will be displayed in the left panel once loaded."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
