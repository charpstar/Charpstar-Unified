import React, { useRef, useEffect, useState } from "react";

// Add type declaration for model-viewer element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-expect-error -- model-viewer is a custom element
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src: string;
          alt: string;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "environment-image"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "shadow-softness"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
          "camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "touch-action"?: string;
          onLoad?: () => void;
          onError?: (event: CustomEvent) => void;
        },
        HTMLElement
      >;
    }
  }
}

interface ModelSnapshotCaptureProps {
  modelUrl: string;
  onSnapshot: (snapshot: string) => void;
  onError?: (error: string) => void;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
}

const ModelSnapshotCapture: React.FC<ModelSnapshotCaptureProps> = ({
  modelUrl,
  onSnapshot,
  onError,
  environmentImage = "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
  exposure = "1.2",
  toneMapping = "aces",
}) => {
  const modelViewerRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!modelUrl) return;

    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer) return;

    const handleLoad = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        // Wait for model to fully load
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Set optimal camera angle for product shots
        modelViewer.cameraOrbit = "0deg 75deg 2.5m";

        // Wait for camera to settle
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Capture snapshot
        const snapshotDataUrl = await modelViewer.toDataURL();
        const snapshotBase64 = snapshotDataUrl.split(",")[1];

        onSnapshot(snapshotBase64);
      } catch (error) {
        console.error("Error capturing snapshot:", error);
        setHasError(true);
        onError?.(
          error instanceof Error ? error.message : "Failed to capture snapshot"
        );
      } finally {
        setIsLoading(false);
      }
    };

    const handleError = (event: CustomEvent) => {
      console.error("Model loading error:", event.detail);
      setHasError(true);
      onError?.("Failed to load 3D model");
      setIsLoading(false);
    };

    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    return () => {
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [modelUrl, onSnapshot, onError]);

  if (!modelUrl) {
    return null;
  }

  return (
    <div className="w-full h-full relative">
      {/* Hidden model viewer for snapshot capture */}
      {/* @ts-expect-error -- model-viewer is a custom element */}
      <model-viewer
        ref={modelViewerRef}
        src={modelUrl}
        alt="3D Model for Snapshot"
        camera-controls={false}
        shadow-intensity="0.5"
        environment-image={environmentImage}
        exposure={exposure}
        tone-mapping={toneMapping}
        shadow-softness="1"
        min-field-of-view="5deg"
        max-field-of-view="35deg"
        camera-orbit="0deg 75deg 2.5m"
        max-camera-orbit="auto 100deg auto"
        touch-action="none"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#fafafa",
          opacity: 0, // Hidden but functional
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-white">Capturing snapshot...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 backdrop-blur-sm z-10">
          <div className="text-center">
            <p className="text-sm text-red-200">Failed to capture snapshot</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSnapshotCapture;
