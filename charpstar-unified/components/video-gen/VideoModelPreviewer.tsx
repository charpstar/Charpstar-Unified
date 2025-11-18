"use client";

import React, { useEffect, useRef, useState } from "react";
import VideoSceneInput from "./VideoSceneInput";
import { Button } from "@/components/ui/display/button";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-expect-error model-viewer is defined at runtime
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

interface VideoModelPreviewerProps {
  file: File | null;
  modelUrl: string | null;
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null,
    resolution: string,
    durationSeconds: string
  ) => void;
  onCancel: () => void;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
  resolution: string;
  onResolutionChange: (value: string) => void;
}

const VideoModelPreviewer: React.FC<VideoModelPreviewerProps> = ({
  file,
  modelUrl,
  onGenerate,
  onCancel,
  environmentImage = "https://cdn.charpstar.net/Demos/HDR_Furniture.hdr",
  exposure = "1.2",
  toneMapping = "aces",
  resolution,
  onResolutionChange,
}) => {
  const modelViewerRef = useRef<HTMLElement>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [objectSize, setObjectSize] = useState("");
  const [objectType, setObjectType] = useState("Product");
  const [sceneDescription, setSceneDescription] = useState("Cinematic hero video");
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!file && !modelUrl) {
      setFileUrl(null);
      return;
    }
    setIsModelLoading(true);
    const url = modelUrl || URL.createObjectURL(file!);
    setFileUrl(url);
    setModelError(null);

    return () => {
      if (!modelUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, modelUrl]);

  useEffect(() => {
    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer || !fileUrl) return;

    const handleLoad = () => {
      setTimeout(() => {
        try {
          if (typeof modelViewer.getDimensions === "function") {
            const dims = modelViewer.getDimensions();
            if (dims?.x && dims?.y && dims?.z) {
              setObjectSize(
                `Width: ${dims.x.toFixed(2)}m, Height: ${dims.y.toFixed(2)}m, Depth: ${dims.z.toFixed(2)}m.`
              );
            }
          }
        } catch (error) {
          console.error("Failed to get model dimensions", error);
          setObjectSize("Dimensions unavailable - use reasonable scale.");
        }
      }, 1000);
      setIsModelLoading(false);
    };

    const handleError = (event: CustomEvent) => {
      console.error("Model loading error:", event?.detail || "Unknown error");
      setModelError("Failed to load 3D model. Please try a different file.");
      setIsModelLoading(false);
    };

    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    return () => {
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [fileUrl]);

  const handleCapture = async (
    customSceneDescription?: string,
    inspirationBase64?: string | null
  ) => {
    const viewer = modelViewerRef.current as any;
    if (!viewer) return;

    setIsCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const snapshotDataUrl = await viewer.toDataURL();
      const snapshotBase64 = snapshotDataUrl.split(",")[1];
      const finalDescription = customSceneDescription || sceneDescription;
      const finalInspiration = inspirationBase64 || null;

      const finalObjectSize =
        objectSize || "Scale based on standard furniture proportions.";

      onGenerate(
        [snapshotBase64],
        finalObjectSize,
        objectType || "Product",
        finalDescription,
        finalInspiration,
        resolution,
        "8" // VEO 3.1 preview only supports 8 seconds
      );
    } finally {
      setIsCapturing(false);
    }
  };

  if (!fileUrl) {
    return (
      <div className="w-full flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
        <div className="text-center p-8">
          <div className="text-red-600 text-lg font-semibold mb-2">File Error</div>
          <div className="text-gray-500 text-sm mb-4">
            Unable to create file URL. Please try uploading the file again.
          </div>
          <Button onClick={onCancel} variant="default">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden relative">
        {isModelLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-white">Loading 3D model...</p>
            </div>
          </div>
        )}

        {modelError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="text-center p-6">
              <div className="text-red-400 text-lg font-semibold mb-2">
                Model Loading Error
              </div>
              <div className="text-gray-300 text-sm mb-4">{modelError}</div>
              <Button
                variant="default"
                size="sm"
                onClick={() => setModelError(null)}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-white">Preparing video prompt...</p>
            </div>
          </div>
        )}

        {/* @ts-expect-error model-viewer custom element */}
        <model-viewer
          key="video-viewer"
          ref={modelViewerRef}
          src={fileUrl}
          alt="3D model preview"
          camera-controls
          shadow-intensity="0.5"
          environment-image={environmentImage}
          exposure={exposure}
          tone-mapping={toneMapping}
          shadow-softness="1"
          min-field-of-view="5deg"
          max-field-of-view="35deg"
          camera-orbit="0deg 75deg 2.5m"
          max-camera-orbit="auto 100deg auto"
          touch-action="pan-y"
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#060606",
          }}
        />
      </div>

      <div className="bg-background/95 backdrop-blur-sm flex-shrink-0 border-t">
        <VideoSceneInput
          onGenerate={async (
            snapshots,
            objectSizeDesc,
            objectTypeDesc,
            sceneDesc,
            inspirationImg,
            resolutionValue
          ) => {
            setSceneDescription(sceneDesc);
            setObjectType(objectTypeDesc);
            onResolutionChange(resolutionValue);
            await handleCapture(sceneDesc, inspirationImg);
          }}
          onCancel={onCancel}
          objectSizeDescription={objectSize || "Dimensions calculating..."}
          objectType={objectType}
          onObjectTypeChange={setObjectType}
          currentResolution={resolution}
          onResolutionChange={onResolutionChange}
          disabled={isCapturing}
        />
      </div>
    </div>
  );
};

export default VideoModelPreviewer;

