"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface ModelViewerProps {
  modelUrl: string;
  alt: string;
  cameraControls?: boolean;
  addHotspotMode?: boolean;
  onAddHotspot?: (position: string, normal: string) => void;
  children?: React.ReactNode;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
}

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
          ar?: boolean;
          "ar-modes"?: string;
          "ar-scale"?: string;
          "camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "shadow-intensity"?: string;
          "camera-controls"?: boolean;
          "touch-action"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function ModelViewer({
  modelUrl,
  alt,
  cameraControls = true,
  addHotspotMode = false,
  onAddHotspot,
  children,
  environmentImage,
  exposure,
  toneMapping,
  ...props
}: ModelViewerProps & React.HTMLAttributes<HTMLElement>) {
  const modelViewerRef = useRef<HTMLElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showDimensions, setShowDimensions] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Handle model loading and errors
  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer) return;

    // Reset states when modelUrl changes
    setIsLoading(true);
    setHasError(false);
    setErrorMessage("");

    const handleLoad = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = (event: any) => {
      console.error("Model loading error:", event);
      setIsLoading(false);
      setHasError(true);
      setErrorMessage(
        "Failed to load 3D model. The file may not exist or is inaccessible."
      );
    };

    (modelViewer as any).addEventListener("load", handleLoad);
    (modelViewer as any).addEventListener("error", handleError);

    return () => {
      (modelViewer as any).removeEventListener("load", handleLoad);
      (modelViewer as any).removeEventListener("error", handleError);
    };
  }, [modelUrl]);

  useEffect(() => {
    if (!modelViewerRef.current) return;

    const modelViewer = modelViewerRef.current as any;
    const checkbox = modelViewer.querySelector(
      "#show-dimensions"
    ) as HTMLInputElement;
    const dimElements = [
      ...modelViewer.querySelectorAll("button"),
      modelViewer.querySelector("#dimLines"),
    ];

    function setVisibility(visible: boolean) {
      dimElements.forEach((element) => {
        if (visible) {
          element.classList.remove("hide");
        } else {
          element.classList.add("hide");
        }
      });
    }

    modelViewer.addEventListener("ar-status", (event: any) => {
      setVisibility(
        checkbox.checked && event.detail.status !== "session-started"
      );
    });

    // Update SVG
    function drawLine(
      svgLine: SVGLineElement,
      dotHotspot1: any,
      dotHotspot2: any,
      dimensionHotspot: any
    ) {
      if (dotHotspot1 && dotHotspot2 && svgLine) {
        svgLine.setAttribute("x1", dotHotspot1.canvasPosition.x);
        svgLine.setAttribute("y1", dotHotspot1.canvasPosition.y);
        svgLine.setAttribute("x2", dotHotspot2.canvasPosition.x);
        svgLine.setAttribute("y2", dotHotspot2.canvasPosition.y);

        if (dimensionHotspot && !dimensionHotspot.facingCamera) {
          svgLine.classList.add("hide");
        } else {
          svgLine.classList.remove("hide");
        }
      }
    }

    const dimLines = modelViewer.querySelectorAll("line");

    const renderSVG = () => {
      drawLine(
        dimLines[0],
        modelViewer.queryHotspot("hotspot-dot+X-Y+Z"),
        modelViewer.queryHotspot("hotspot-dot+X-Y-Z"),
        modelViewer.queryHotspot("hotspot-dim+X-Y")
      );
      drawLine(
        dimLines[1],
        modelViewer.queryHotspot("hotspot-dot+X-Y-Z"),
        modelViewer.queryHotspot("hotspot-dot+X+Y-Z"),
        modelViewer.queryHotspot("hotspot-dim+X-Z")
      );
      drawLine(
        dimLines[2],
        modelViewer.queryHotspot("hotspot-dot+X+Y-Z"),
        modelViewer.queryHotspot("hotspot-dot-X+Y-Z"),
        null
      ); // always visible
      drawLine(
        dimLines[3],
        modelViewer.queryHotspot("hotspot-dot-X+Y-Z"),
        modelViewer.queryHotspot("hotspot-dot-X-Y-Z"),
        modelViewer.queryHotspot("hotspot-dim-X-Z")
      );
      drawLine(
        dimLines[4],
        modelViewer.queryHotspot("hotspot-dot-X-Y-Z"),
        modelViewer.queryHotspot("hotspot-dot-X-Y+Z"),
        modelViewer.queryHotspot("hotspot-dim-X-Y")
      );
    };

    modelViewer.addEventListener("camera-change", renderSVG);

    return () => {
      modelViewer.removeEventListener("camera-change", renderSVG);
      modelViewer.removeEventListener("ar-status", () => {});
    };
  }, [modelUrl]);

  // Hotspot placement logic
  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer || !addHotspotMode) return;

    const handleClick = (event: MouseEvent) => {
      const rect = modelViewer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = (modelViewer as any).positionAndNormalFromPoint(x, y);
      if (hit && hit.position && hit.normal) {
        const position = `${hit.position.x.toFixed(2)} ${hit.position.y.toFixed(2)} ${hit.position.z.toFixed(2)}`;
        const normal = `${hit.normal.x.toFixed(2)} ${hit.normal.y.toFixed(2)} ${hit.normal.z.toFixed(2)}`;
        onAddHotspot?.(position, normal);
      }
    };
    modelViewer.addEventListener("click", handleClick);
    return () => modelViewer.removeEventListener("click", handleClick);
  }, [addHotspotMode, onAddHotspot]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDimensionToggle = (checked: boolean) => {
    setShowDimensions(checked);

    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer) return;

    const dimElements = [
      ...modelViewer.querySelectorAll("button"),
      modelViewer.querySelector("#dimLines"),
    ];

    dimElements.forEach((element) => {
      if (checked) {
        element.classList.remove("hide");
      } else {
        element.classList.add("hide");
      }
    });
  };

  return (
    <>
      <div className="relative w-full h-full">
        {/* @ts-expect-error -- model-viewer is a custom element */}
        <model-viewer
          ref={modelViewerRef}
          id="dimension-demo"
          ar
          ar-modes="webxr"
          ar-scale="fixed"
          camera-orbit="-30deg auto auto"
          max-camera-orbit="auto 100deg auto"
          shadow-intensity="1"
          touch-action="pan-y"
          auto-rotate="false"
          src={modelUrl}
          alt={alt}
          className="w-full h-[300px] sm:h-[200px] md:h-[500px] lg:h-[1000px]"
          {...(cameraControls ? { "camera-controls": true } : {})}
          {...(environmentImage
            ? { "environment-image": environmentImage }
            : {})}
          {...(exposure ? { exposure: exposure } : {})}
          {...(toneMapping ? { "tone-mapping": toneMapping } : {})}
          onLoad={() => {
            if (modelViewerRef.current) {
              (modelViewerRef.current as any).autoRotate = false;
            }
          }}
          {...props}
        >
          {children}

          {/* @ts-expect-error -- model-viewer is a custom element */}
        </model-viewer>

        {/* Loading Overlay */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm rounded-lg z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading 3D model...
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 backdrop-blur-sm rounded-lg border-2 border-destructive/20 z-10">
            <div className="text-center p-6 max-w-md">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Failed to Load Model
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <p className="text-xs text-muted-foreground">URL: {modelUrl}</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .dimension-controls {
          position: absolute;
          bottom: 20px;
          left: 20px;
          z-index: 100;
          pointer-events: auto;
        }

        .dot {
          display: none;
        }

        .dim {
          border-radius: 4px;
          border: none;
          box-sizing: border-box;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
          color: rgba(0, 0, 0, 0.8);
          display: block;
          font-family:
            Futura,
            Helvetica Neue,
            sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          max-width: 128px;
          overflow-wrap: break-word;
          padding: 0.5em 1em;
          position: absolute;
          width: max-content;
          height: max-content;
          transform: translate3d(-50%, -50%, 0);
          pointer-events: none;
          --min-hotspot-opacity: 0;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
        }

        /* Dark mode styles for dimension hotspots */
        @media (prefers-color-scheme: dark) {
          .dim {
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.8);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          }
        }

        /* Alternative approach using CSS custom properties for theme switching */
        .dark .dim {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(0, 0, 0, 0.8);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        @media (min-width: 640px) {
          .dim {
            font-size: 0.875rem;
          }
        }

        @media (min-width: 768px) {
          .dim {
            font-size: 1rem;
          }
        }

        .dimensionLineContainer {
          pointer-events: none;
          display: block;
        }

        .dimensionLine {
          stroke: rgb(113, 123, 129);
          stroke-width: 2;
          stroke-dasharray: 2;
        }

        .hide {
          display: none;
        }

        :not(:defined) > * {
          display: none;
        }
      `}</style>
    </>
  );
}
