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
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const fileNameRef = useRef("model");
  const modelLoadedRef = useRef(false);
  const modelViewerElementRef = useRef(null);
  const initializationTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Fetch client config
  useEffect(() => {
    const getConfig = async () => {
      if (clientName) {
        try {
          const config = await fetchClientConfig(clientName);
          setClientConfig(config);
        } catch (error) {
          console.error("[ModelViewer] Error fetching client config:", error);
        }
      }
    };
    getConfig();
  }, [clientName]);

  // Check if script is loaded with improved detection
  useEffect(() => {
    if (!clientConfig) return;

    const checkScript = () => {
      const scriptSrc = clientConfig.scriptPath;
      const isLoaded = !!document.querySelector(`script[src="${scriptSrc}"]`);
      console.log("[ModelViewer] Script loaded check:", isLoaded);

      if (isLoaded) {
        setScriptLoaded(true);
        // Give the script a moment to initialize
        setTimeout(() => {
          setModelViewerReady(true);
        }, 500);
      } else {
        setScriptLoaded(false);
        setModelViewerReady(false);
      }
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
      modelLoadedRef.current = false;
      retryCountRef.current = 0;
    }
  }, [clientModelUrl]);

  // Improved model initialization with retry logic
  const initializeModelViewerWithRetry = (modelViewer) => {
    try {
      const initialized = initializeModelViewer(modelViewer);
      if (initialized) {
        console.log(
          "[ModelViewer] Successfully initialized model viewer functions"
        );
        return true;
      } else {
        console.warn("[ModelViewer] Model viewer initialization returned null");
        return false;
      }
    } catch (error) {
      console.error("[ModelViewer] Error initializing model viewer:", error);
      return false;
    }
  };

  // Effect to handle model load event with improved error handling
  useEffect(() => {
    console.log(
      "[ModelViewer] Model load effect triggered. isClient:",
      isClient,
      "modelSrc:",
      modelSrc,
      "scriptLoaded:",
      scriptLoaded,
      "modelViewerReady:",
      modelViewerReady
    );

    if (!isClient || !modelSrc || !scriptLoaded || !modelViewerReady) {
      console.log(
        "[ModelViewer] Skipping model load setup - missing dependencies"
      );
      return;
    }

    const setupModelViewer = () => {
      const modelViewer = document.getElementById("model-viewer");
      console.log("[ModelViewer] Found model-viewer element:", !!modelViewer);

      if (!modelViewer) {
        console.warn("[ModelViewer] Model viewer element not found");
        return;
      }

      // Clear any existing timeout
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }

      const handleLoad = () => {
        console.log("[ModelViewer] Model load event triggered");

        // Clear any pending timeouts
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
        }

        // Store references
        window.modelViewerElement = modelViewer;
        window.currentFileName = fileNameRef.current;
        console.log("[ModelViewer] Stored global references");

        // Initialize with retry logic
        const initSuccess = initializeModelViewerWithRetry(modelViewer);
        if (initSuccess) {
          modelViewerElementRef.current = modelViewer;
          retryCountRef.current = 0;

          // Set a small delay to ensure the model is fully processed
          setTimeout(() => {
            if (onModelLoaded && !modelLoadedRef.current) {
              console.log("[ModelViewer] Triggering onModelLoaded callback");
              modelLoadedRef.current = true;
              onModelLoaded();
            }
          }, 500);
        } else {
          // Retry initialization if it failed
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(
              `[ModelViewer] Retrying initialization (${retryCountRef.current}/${maxRetries})`
            );

            initializationTimeoutRef.current = setTimeout(() => {
              const retrySuccess = initializeModelViewerWithRetry(modelViewer);
              if (retrySuccess) {
                modelViewerElementRef.current = modelViewer;
                retryCountRef.current = 0;

                setTimeout(() => {
                  if (onModelLoaded && !modelLoadedRef.current) {
                    console.log(
                      "[ModelViewer] Triggering onModelLoaded callback after retry"
                    );
                    modelLoadedRef.current = true;
                    onModelLoaded();
                  }
                }, 500);
              }
            }, 1000 * retryCountRef.current); // Exponential backoff
          } else {
            console.error(
              "[ModelViewer] Failed to initialize after maximum retries"
            );
          }
        }
      };

      const handleError = (error) => {
        console.error("[ModelViewer] Error loading model:", error);
        modelLoadedRef.current = false;
      };

      const handleProgress = (event) => {
        console.log(
          "[ModelViewer] Loading progress:",
          event.detail.totalProgress
        );
      };

      // Remove existing listeners to prevent duplicates
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
      modelViewer.removeEventListener("progress", handleProgress);

      // Add new listeners
      modelViewer.addEventListener("load", handleLoad);
      modelViewer.addEventListener("error", handleError);
      modelViewer.addEventListener("progress", handleProgress);

      return () => {
        modelViewer.removeEventListener("load", handleLoad);
        modelViewer.removeEventListener("error", handleError);
        modelViewer.removeEventListener("progress", handleProgress);
        modelLoadedRef.current = false;
      };
    };

    // Add a small delay to ensure the model-viewer element is fully ready
    const setupTimeout = setTimeout(setupModelViewer, 100);

    return () => {
      clearTimeout(setupTimeout);
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [isClient, modelSrc, onModelLoaded, scriptLoaded, modelViewerReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      modelLoadedRef.current = false;
      retryCountRef.current = 0;
    };
  }, []);

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
      retryCountRef.current = 0;

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
      className="w-full h-full flex items-center justify-center transition-colors duration-200 rounded-md bg-background "
    >
      <div className="w-full h-full flex items-center justify-center">
        {isClient &&
          modelSrc &&
          scriptLoaded &&
          clientConfig &&
          modelViewerReady && (
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

        {(!modelSrc || !scriptLoaded || !clientConfig || !modelViewerReady) &&
          !clientModelUrl && (
            <div className="text-center p-6 rounded-lg border-2 border-dashed border-gray-300 bg-muted/30 text-muted-foreground">
              <p className="text-gray-600 text-sm font-medium mb-3">
                {!scriptLoaded || !clientConfig || !modelViewerReady
                  ? "Loading viewer..."
                  : "Drag and drop a model to view it."}
              </p>
              <p className="text-gray-500 text-xs">
                {!scriptLoaded || !clientConfig || !modelViewerReady
                  ? "Please wait while the viewer loads..."
                  : "The model structure will be displayed in the left panel once loaded."}
              </p>
            </div>
          )}
      </div>
    </div>
  );
};
