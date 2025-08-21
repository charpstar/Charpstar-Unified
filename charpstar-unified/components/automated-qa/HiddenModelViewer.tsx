"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";

interface ScreenshotCaptureResult {
  success: boolean;
  screenshots?: string[];
  error?: string;
}

interface HiddenModelViewerProps {
  glbUrl: string;
  onScreenshotsCaptured: (screenshots: string[]) => void;
  onError: (error: string) => void;
  onStatusUpdate: (status: string) => void;
}

const HiddenModelViewer = forwardRef<any, HiddenModelViewerProps>(
  ({ glbUrl, onScreenshotsCaptured, onError, onStatusUpdate }, ref) => {
    const viewerRef = useRef<any>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const modelReadyRef = useRef(false);

    // Reset loading state when GLB URL changes
    useEffect(() => {
      setIsModelLoaded(false);
      setIsProcessing(false);
      modelReadyRef.current = false;
    }, [glbUrl]);

    // Load model-viewer script immediately as ES module and only mark ready once defined
    useEffect(() => {
      const ensureDefined = () => {
        const defined = !!(
          typeof window !== "undefined" &&
          window.customElements &&
          window.customElements.get("model-viewer")
        );
        if (defined) {
          console.log("✅ model-viewer custom element is defined");
          setScriptLoaded(true);
        }
        return defined;
      };

      if (ensureDefined()) return;

      console.log("🔄 Loading local model-viewer script as module...");
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/model-viewer.js";
      script.onload = () => {
        // onload fires when fetched; definition may be async. Poll briefly.
        const start = Date.now();
        const maxMs = 5000;
        const interval = setInterval(() => {
          if (ensureDefined() || Date.now() - start > maxMs) {
            clearInterval(interval);
            if (!scriptLoaded) {
              console.warn(
                "⚠️ model-viewer not defined after load; continuing optimistically"
              );
              setScriptLoaded(true);
            }
          }
        }, 100);
      };
      script.onerror = (error) => {
        console.error("❌ Failed to load local model-viewer module:", error);
      };
      document.head.appendChild(script);
    }, []);

    // Debug GLB URL
    useEffect(() => {
      console.log("🔗 GLB URL:", glbUrl);
      if (glbUrl) {
        console.log("🔗 GLB URL length:", glbUrl.length);
        console.log("🔗 GLB URL starts with:", glbUrl.substring(0, 50));

        // Test if the GLB URL is accessible
        fetch(glbUrl, { method: "HEAD" })
          .then((response) => {
            console.log(
              "🔗 GLB URL accessibility check:",
              response.status,
              response.statusText
            );
            if (!response.ok) {
              console.error(
                "❌ GLB URL not accessible:",
                response.status,
                response.statusText
              );
            }
          })
          .catch((error) => {
            console.error("❌ GLB URL fetch error:", error);
          });
      }
    }, [glbUrl]);

    // Attach model-viewer event listeners imperatively (React doesn't wire custom element events reliably)
    useEffect(() => {
      if (!scriptLoaded) return;
      const viewer = viewerRef.current as any;
      if (!viewer || !glbUrl) return;

      const handleLoadStart = () => {
        console.log("🚀 Model loading started for URL:", glbUrl);
      };
      const handleProgress = (event: any) => {
        console.log(
          "📊 Model loading progress:",
          event?.detail?.totalProgress ?? 0
        );
      };
      const handleLoad = () => {
        console.log("🎯 Hidden model viewer loaded (event)");
        modelReadyRef.current = true;
        setIsModelLoaded(true);
      };
      const handleError = (event: any) => {
        console.error("❌ Hidden model viewer error (event):", event?.detail);
        onError(
          `Model loading failed: ${event?.detail?.message || "Unknown error"}`
        );
      };

      viewer.addEventListener("load", handleLoad);
      viewer.addEventListener("error", handleError);
      viewer.addEventListener("progress", handleProgress);
      viewer.addEventListener("loadstart", handleLoadStart);

      return () => {
        viewer.removeEventListener("load", handleLoad);
        viewer.removeEventListener("error", handleError);
        viewer.removeEventListener("progress", handleProgress);
        viewer.removeEventListener("loadstart", handleLoadStart);
      };
    }, [scriptLoaded, glbUrl]);

    const getSnapshotDataUrl = (viewer: any): string => {
      try {
        if (typeof viewer.toDataURL === "function") {
          return viewer.toDataURL("image/png", 1.0);
        }
      } catch {}
      const root: ShadowRoot | Document | null =
        (viewer as any).renderRoot || (viewer as any).shadowRoot || null;
      const canvas: HTMLCanvasElement | null = root
        ? (root.querySelector("canvas") as HTMLCanvasElement | null)
        : null;
      if (!canvas) throw new Error("Viewer canvas not found");
      return canvas.toDataURL("image/png");
    };

    const captureScreenshots = async (): Promise<ScreenshotCaptureResult> => {
      console.log("📸 Starting screenshot capture...");
      const viewer = viewerRef.current;
      if (!viewer) {
        console.error("❌ Viewer not initialized");
        return { success: false, error: "Viewer not initialized" };
      }

      console.log("🔍 Viewer element:", viewer);
      console.log("🔍 Model ready (ref):", modelReadyRef.current);

      if (!modelReadyRef.current) {
        console.error("❌ Model not loaded yet");
        return { success: false, error: "Model not loaded yet" };
      }

      if (!viewer.updateComplete) {
        console.error("❌ Model viewer not ready for capture");
        console.log("🔍 updateComplete:", viewer.updateComplete);
        return { success: false, error: "Model viewer not ready for capture" };
      }

      console.log("✅ Model viewer ready for capture");

      const angles = [
        "0deg 75deg 150%",
        "90deg 75deg 150%",
        "180deg 75deg 150%",
        "270deg 75deg 150%",
      ];

      const screenshots: string[] = [];

      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        onStatusUpdate(`Capturing screenshot ${i + 1}/4...`);
        console.log(`📸 Capturing screenshot ${i + 1}/4 at angle: ${angle}`);

        try {
          // Set camera angle
          viewer.setAttribute("camera-orbit", angle);

          // Wait for camera change
          await new Promise<void>((resolve) => {
            const handleCameraChange = () => {
              viewer.removeEventListener("camera-change", handleCameraChange);
              resolve();
            };
            viewer.addEventListener("camera-change", handleCameraChange);
            setTimeout(resolve, 2000); // Fallback timeout
          });

          // Wait for render
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Wait for model viewer to be ready
          await viewer.updateComplete;
          // Extra settle frames
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          );
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Capture screenshot (with canvas fallback)
          const dataUrl = getSnapshotDataUrl(viewer);
          screenshots.push(dataUrl);
          console.log(`✅ Captured screenshot ${i + 1}/4`);
        } catch (error) {
          console.error(`❌ Failed to capture screenshot ${i + 1}/4:`, error);
          return {
            success: false,
            error: `Failed to capture screenshot ${i + 1}/4: ${error}`,
          };
        }
      }

      if (screenshots.length === 4) {
        console.log("✅ All screenshots captured successfully");
        return { success: true, screenshots };
      } else {
        console.error(
          `❌ Failed to capture all screenshots. Got ${screenshots.length}/4`
        );
        return {
          success: false,
          error: `Failed to capture all screenshots. Got ${screenshots.length}/4`,
        };
      }
    };

    const uploadScreenshots = async (
      screenshots: string[]
    ): Promise<string[]> => {
      console.log("📤 Uploading screenshots...");
      const uploadedUrls: string[] = [];

      for (let i = 0; i < screenshots.length; i++) {
        try {
          // Convert data URL to file
          const response = await fetch(screenshots[i]);
          const blob = await response.blob();
          const file = new File([blob], `screenshot_${i + 1}.png`, {
            type: "image/png",
          });

          // Upload file
          const formData = new FormData();
          formData.append("file", file);

          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }

          const uploadData = await uploadResponse.json();
          uploadedUrls.push(uploadData.url);
          console.log(`✅ Screenshot ${i + 1} uploaded:`, uploadData.url);
        } catch (error) {
          console.error(`❌ Failed to upload screenshot ${i + 1}:`, error);
          throw error;
        }
      }

      return uploadedUrls;
    };

    const startCaptureProcess = async () => {
      try {
        console.log("🚀 Starting screenshot capture process...");
        if (isProcessing) {
          console.log(
            "⏭️ Capture requested while already processing; ignoring"
          );
          return;
        }

        setIsProcessing(true);
        onStatusUpdate("Starting screenshot capture...");

        if (!modelReadyRef.current) {
          onStatusUpdate("Waiting for model to load...");
          console.log("⏳ Waiting for model to load...");
          let attempts = 0;
          const maxAttempts = 60; // 30 seconds

          while (!modelReadyRef.current && attempts < maxAttempts) {
            // Secondary readiness check: model assigned on element
            const viewer = viewerRef.current as any;
            if (viewer && viewer.model) {
              console.log(
                "✅ Detected model on viewer element; marking as loaded"
              );
              modelReadyRef.current = true;
              setIsModelLoaded(true);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts++;
            console.log(`⏳ Loading attempt ${attempts}/${maxAttempts}`);
          }

          if (!modelReadyRef.current) {
            console.error("❌ Model failed to load within timeout period");
            onError("Model failed to load within timeout period");
            return;
          }
        }

        console.log("✅ Model loaded, starting screenshot capture...");
        const result = await captureScreenshots();

        if (result.success && result.screenshots) {
          onStatusUpdate("Uploading screenshots...");
          console.log("📤 Uploading screenshots...");
          try {
            const uploadedUrls = await uploadScreenshots(result.screenshots);
            console.log("✅ Screenshots uploaded successfully:", uploadedUrls);
            onScreenshotsCaptured(uploadedUrls);
            onStatusUpdate("Screenshot capture completed");
          } catch (error: any) {
            console.error("❌ Upload failed:", error);
            onError(`Upload failed: ${error.message}`);
          }
        } else {
          console.error("❌ Screenshot capture failed:", result.error);
          onError(result.error || "Screenshot capture failed");
        }
      } catch (error: any) {
        console.error("❌ Unexpected error in startCaptureProcess:", error);
        onError(`Unexpected error: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        startCaptureProcess,
      }),
      [isModelLoaded, isProcessing]
    );

    // Don't render if no GLB URL is provided
    if (!glbUrl) {
      console.log("❌ No GLB URL provided to HiddenModelViewer");
      return null;
    }

    console.log("🎯 HiddenModelViewer render - glbUrl:", glbUrl);
    console.log("🎯 HiddenModelViewer render - scriptLoaded:", scriptLoaded);

    if (!scriptLoaded) {
      console.log("⏳ Waiting for model-viewer script to load...");
      return (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: "-9999px",
            width: "800px",
            height: "600px",
          }}
        >
          <div>Loading model-viewer script...</div>
        </div>
      );
    }

    console.log(
      "🎯 Rendering model-viewer element with scriptLoaded:",
      scriptLoaded
    );

    return (
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "800px",
          height: "600px",
        }}
      >
        {/* @ts-expect-error -- model-viewer is a custom element */}
        <model-viewer
          key={glbUrl}
          ref={viewerRef}
          src={glbUrl}
          alt="Hidden model viewer for screenshot capture"
          crossorigin="anonymous"
          loading="eager"
          camera-controls={false}
          auto-rotate={false}
          shadow-intensity="0.5"
          exposure="1.2"
          tone-mapping="aces"
          shadow-softness="1"
          min-field-of-view="5deg"
          max-field-of-view="35deg"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }
);

export default HiddenModelViewer;
