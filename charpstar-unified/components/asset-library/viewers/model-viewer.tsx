"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Switch } from "@/components/ui/inputs";
import { Ruler } from "lucide-react";

interface ModelViewerProps {
  modelUrl: string;
  alt: string;
  cameraControls?: boolean;
  addHotspotMode?: boolean;
  onAddHotspot?: (position: string, normal: string) => void;
  children?: React.ReactNode;
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
  ...props
}: ModelViewerProps & React.HTMLAttributes<HTMLElement>) {
  const modelViewerRef = useRef<HTMLElement | null>(null);
  const [showDimensions, setShowDimensions] = useState(true);

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

    checkbox.addEventListener("change", () => {
      setVisibility(checkbox.checked);
    });

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
      if (dotHotspot1 && dotHotspot2) {
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

    modelViewer.addEventListener("load", () => {
      const center = modelViewer.getBoundingBoxCenter();
      const size = modelViewer.getDimensions();
      const x2 = size.x / 2;
      const y2 = size.y / 2;
      const z2 = size.z / 2;

      // Unhide the SVG lines now that everything is ready
      const dimLines = modelViewer.querySelector("#dimLines");
      if (dimLines) {
        dimLines.classList.remove("hide");
      }
    });

    modelViewer.addEventListener("camera-change", renderSVG);

    return () => {
      modelViewer.removeEventListener("ar-status", () => {});
      checkbox.removeEventListener("change", () => {});
    };
  }, [modelUrl]);

  // Hotspot placement logic
  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer || !addHotspotMode) return;
  });

  return (
    <>
      <Script src="/model-viewer.js" />
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
        src={modelUrl}
        alt={alt}
        className="w-full h-[300px] sm:h-[200px] md:h-[500px] lg:h-[1000px]"
        {...(cameraControls ? { "camera-controls": true } : {})}
        {...props}
      >
        {children}
        <button
          slot="hotspot-dot+X-Y+Z"
          className="dot"
          data-position="1 -1 1"
          data-normal="1 0 0"
        ></button>
        <button
          slot="hotspot-dim+X-Y"
          className="dim"
          data-position="1 -1 0"
          data-normal="1 0 0"
        ></button>
        <button
          slot="hotspot-dot+X-Y-Z"
          className="dot"
          data-position="1 -1 -1"
          data-normal="1 0 0"
        ></button>
        <button
          slot="hotspot-dim+X-Z"
          className="dim"
          data-position="1 0 -1"
          data-normal="1 0 0"
        ></button>
        <button
          slot="hotspot-dot+X+Y-Z"
          className="dot"
          data-position="1 1 -1"
          data-normal="0 1 0"
        ></button>
        <button
          slot="hotspot-dim+Y-Z"
          className="dim"
          data-position="0 -1 -1"
          data-normal="0 1 0"
        ></button>
        <button
          slot="hotspot-dot-X+Y-Z"
          className="dot"
          data-position="-1 1 -1"
          data-normal="0 1 0"
        ></button>
        <button
          slot="hotspot-dim-X-Z"
          className="dim"
          data-position="-1 0 -1"
          data-normal="-1 0 0"
        ></button>
        <button
          slot="hotspot-dot-X-Y-Z"
          className="dot"
          data-position="-1 -1 -1"
          data-normal="-1 0 0"
        ></button>
        <button
          slot="hotspot-dim-X-Y"
          className="dim"
          data-position="-1 -1 0"
          data-normal="-1 0 0"
        ></button>
        <button
          slot="hotspot-dot-X-Y+Z"
          className="dot"
          data-position="-1 -1 1"
          data-normal="-1 0 0"
        ></button>
        <svg
          id="dimLines"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          className="dimensionLineContainer hide"
        >
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
        </svg>

        <div id="controls" className="dimension-controls">
          <div className="control-panel bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-3 min-w-[140px]">
            <div className="control-header flex items-center gap-2 flex-1">
              <Ruler className="control-icon w-4 h-4 text-gray-600 dark:text-gray-300 flex-shrink-0" />
              <span className="control-label text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                Dimensions
              </span>
            </div>
            <div className="control-switch flex-shrink-0">
              <Switch
                id="show-dimensions"
                checked={showDimensions}
                onCheckedChange={handleDimensionToggle}
                className="scale-90"
              />
            </div>
          </div>
        </div>
        {/* @ts-expect-error -- model-viewer is a custom element */}
      </model-viewer>

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
          font-family: Futura, Helvetica Neue, sans-serif;
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

        /* General Button Reset */
        .annotation-hotspot {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          appearance: none;
          outline: none;
        }

        /* Neon Halo Marker */
        .hotspot-marker {
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          transition: transform 0.22s cubic-bezier(0.5, 1.5, 0.5, 1);
        }

        .hotspot-marker.selected {
          transform: scale(1.18) rotate(-2deg);
          z-index: 10;
        }

        /* Pulse Halo Animation */

        .hotspot-marker.selected::before {
          opacity: 0.55;
          animation-duration: 1.6s;
        }

        /* Main Dot */
        .hotspot-dot,
        .hotspot-icon {
          width: 28px;
          height: 28px;
          background: linear-gradient(
            130deg,
            var(--hotspot-accent) 80%,
            #fff2 100%
          );
          border-radius: 50%;
          border: 2.5px solid rgba(8, 247, 254, 0.42);
          box-shadow: 0 0 0 3px rgba(8, 247, 254, 0.07),
            0 3px 18px 0 rgba(8, 247, 254, 0.17),
            0 1px 5px 0 rgba(0, 0, 0, 0.09);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.2s cubic-bezier(0.5, 1.5, 0.5, 1),
            border-color 0.18s cubic-bezier(0.72, 0, 0, 1),
            background 0.19s cubic-bezier(0.7, 0.1, 0.2, 1),
            transform 0.15s cubic-bezier(0.5, 1.5, 0.5, 1);
          position: relative;
        }

        /* Number inside hotspot */
        .hotspot-number {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          z-index: 3;
          pointer-events: none;
        }

        /* Revision badge on hotspot */
        .hotspot-revision-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          font-size: 8px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          z-index: 4;
          pointer-events: none;
          backdrop-filter: blur(4px);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .hotspot-dot:hover,
        .hotspot-icon:hover {
          border-color: var(--hotspot-accent);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--hotspot-accent) 96%
          );
          transform: scale(1.12);
        }

        /* Active State */
        .hotspot-marker.selected .hotspot-dot,
        .hotspot-marker.selected .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--hotspot-accent-dark),
            var(--hotspot-accent) 98%
          );
          border-color: #fff;

          transform: scale(1.08);
        }

        /* Annotation-specific colors */
        .hotspot-marker[data-annotation="1"] .hotspot-dot,
        .hotspot-marker[data-annotation="1"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-1) 80%,
            #fff2 100%
          );
          border-color: rgba(59, 130, 246, 0.42);
        }

        .hotspot-marker[data-annotation="2"] .hotspot-dot,
        .hotspot-marker[data-annotation="2"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-2) 80%,
            #fff2 100%
          );
          border-color: rgba(16, 185, 129, 0.42);
        }

        .hotspot-marker[data-annotation="3"] .hotspot-dot,
        .hotspot-marker[data-annotation="3"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-3) 80%,
            #fff2 100%
          );
          border-color: rgba(139, 92, 246, 0.42);
        }

        .hotspot-marker[data-annotation="4"] .hotspot-dot,
        .hotspot-marker[data-annotation="4"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-4) 80%,
            #fff2 100%
          );
          border-color: rgba(249, 115, 22, 0.42);
        }

        .hotspot-marker[data-annotation="5"] .hotspot-dot,
        .hotspot-marker[data-annotation="5"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-5) 80%,
            #fff2 100%
          );
          border-color: rgba(239, 68, 68, 0.42);
        }

        .hotspot-marker[data-annotation="6"] .hotspot-dot,
        .hotspot-marker[data-annotation="6"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-6) 80%,
            #fff2 100%
          );
          border-color: rgba(99, 102, 241, 0.42);
        }

        .hotspot-marker[data-annotation="7"] .hotspot-dot,
        .hotspot-marker[data-annotation="7"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-7) 80%,
            #fff2 100%
          );
          border-color: rgba(236, 72, 153, 0.42);
        }

        .hotspot-marker[data-annotation="8"] .hotspot-dot,
        .hotspot-marker[data-annotation="8"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-8) 80%,
            #fff2 100%
          );
          border-color: rgba(20, 184, 166, 0.42);
        }

        .hotspot-marker[data-annotation="9"] .hotspot-dot,
        .hotspot-marker[data-annotation="9"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-9) 80%,
            #fff2 100%
          );
          border-color: rgba(245, 158, 11, 0.42);
        }

        .hotspot-marker[data-annotation="10"] .hotspot-dot,
        .hotspot-marker[data-annotation="10"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-10) 80%,
            #fff2 100%
          );
          border-color: rgba(6, 182, 212, 0.42);
        }

        /* Hover states for annotation-specific colors */
        .hotspot-marker[data-annotation="1"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="1"] .hotspot-icon:hover {
          border-color: var(--annotation-1);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-1) 96%
          );
        }

        .hotspot-marker[data-annotation="2"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="2"] .hotspot-icon:hover {
          border-color: var(--annotation-2);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-2) 96%
          );
        }

        .hotspot-marker[data-annotation="3"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="3"] .hotspot-icon:hover {
          border-color: var(--annotation-3);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-3) 96%
          );
        }

        .hotspot-marker[data-annotation="4"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="4"] .hotspot-icon:hover {
          border-color: var(--annotation-4);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-4) 96%
          );
        }

        .hotspot-marker[data-annotation="5"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="5"] .hotspot-icon:hover {
          border-color: var(--annotation-5);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-5) 96%
          );
        }

        .hotspot-marker[data-annotation="6"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="6"] .hotspot-icon:hover {
          border-color: var(--annotation-6);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-6) 96%
          );
        }

        .hotspot-marker[data-annotation="7"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="7"] .hotspot-icon:hover {
          border-color: var(--annotation-7);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-7) 96%
          );
        }

        .hotspot-marker[data-annotation="8"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="8"] .hotspot-icon:hover {
          border-color: var(--annotation-8);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-8) 96%
          );
        }

        .hotspot-marker[data-annotation="9"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="9"] .hotspot-icon:hover {
          border-color: var(--annotation-9);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-9) 96%
          );
        }

        .hotspot-marker[data-annotation="10"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="10"] .hotspot-icon:hover {
          border-color: var(--annotation-10);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-10) 96%
          );
        }

        .hotspot-marker[data-annotation="11"] .hotspot-dot,
        .hotspot-marker[data-annotation="11"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-11) 80%,
            #fff2 100%
          );
          border-color: rgba(244, 63, 94, 0.42);
        }

        .hotspot-marker[data-annotation="12"] .hotspot-dot,
        .hotspot-marker[data-annotation="12"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-12) 80%,
            #fff2 100%
          );
          border-color: rgba(34, 197, 94, 0.42);
        }

        .hotspot-marker[data-annotation="13"] .hotspot-dot,
        .hotspot-marker[data-annotation="13"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-13) 80%,
            #fff2 100%
          );
          border-color: rgba(234, 179, 8, 0.42);
        }

        .hotspot-marker[data-annotation="14"] .hotspot-dot,
        .hotspot-marker[data-annotation="14"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-14) 80%,
            #fff2 100%
          );
          border-color: rgba(20, 184, 166, 0.42);
        }

        .hotspot-marker[data-annotation="15"] .hotspot-dot,
        .hotspot-marker[data-annotation="15"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-15) 80%,
            #fff2 100%
          );
          border-color: rgba(249, 115, 22, 0.42);
        }

        .hotspot-marker[data-annotation="16"] .hotspot-dot,
        .hotspot-marker[data-annotation="16"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-16) 80%,
            #fff2 100%
          );
          border-color: rgba(139, 92, 246, 0.42);
        }

        .hotspot-marker[data-annotation="17"] .hotspot-dot,
        .hotspot-marker[data-annotation="17"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-17) 80%,
            #fff2 100%
          );
          border-color: rgba(6, 182, 212, 0.42);
        }

        .hotspot-marker[data-annotation="18"] .hotspot-dot,
        .hotspot-marker[data-annotation="18"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-18) 80%,
            #fff2 100%
          );
          border-color: rgba(236, 72, 153, 0.42);
        }

        .hotspot-marker[data-annotation="19"] .hotspot-dot,
        .hotspot-marker[data-annotation="19"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-19) 80%,
            #fff2 100%
          );
          border-color: rgba(132, 204, 22, 0.42);
        }

        .hotspot-marker[data-annotation="20"] .hotspot-dot,
        .hotspot-marker[data-annotation="20"] .hotspot-icon {
          background: linear-gradient(
            130deg,
            var(--annotation-20) 80%,
            #fff2 100%
          );
          border-color: rgba(168, 85, 247, 0.42);
        }

        /* Hover states for new annotation colors */
        .hotspot-marker[data-annotation="11"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="11"] .hotspot-icon:hover {
          border-color: var(--annotation-11);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-11) 96%
          );
        }

        .hotspot-marker[data-annotation="12"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="12"] .hotspot-icon:hover {
          border-color: var(--annotation-12);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-12) 96%
          );
        }

        .hotspot-marker[data-annotation="13"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="13"] .hotspot-icon:hover {
          border-color: var(--annotation-13);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-13) 96%
          );
        }

        .hotspot-marker[data-annotation="14"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="14"] .hotspot-icon:hover {
          border-color: var(--annotation-14);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-14) 96%
          );
        }

        .hotspot-marker[data-annotation="15"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="15"] .hotspot-icon:hover {
          border-color: var(--annotation-15);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-15) 96%
          );
        }

        .hotspot-marker[data-annotation="16"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="16"] .hotspot-icon:hover {
          border-color: var(--annotation-16);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-16) 96%
          );
        }

        .hotspot-marker[data-annotation="17"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="17"] .hotspot-icon:hover {
          border-color: var(--annotation-17);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-17) 96%
          );
        }

        .hotspot-marker[data-annotation="18"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="18"] .hotspot-icon:hover {
          border-color: var(--annotation-18);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-18) 96%
          );
        }

        .hotspot-marker[data-annotation="19"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="19"] .hotspot-icon:hover {
          border-color: var(--annotation-19);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-19) 96%
          );
        }

        .hotspot-marker[data-annotation="20"] .hotspot-dot:hover,
        .hotspot-marker[data-annotation="20"] .hotspot-icon:hover {
          border-color: var(--annotation-20);
          background: linear-gradient(
            130deg,
            #fff 14%,
            var(--annotation-20) 96%
          );
        }

        /* Replace .hotspot-icon with a symbol (ex: plus, dot, or emoji) as needed */

        /* Glassy Floating Comment Bubble */
        .hotspot-comment {
          position: absolute;
          top: -58px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 15;
          pointer-events: none;
          transition: filter 0.18s;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
        }

        /* Show comment bubble only when hotspot is selected */
        .hotspot-annotation.selected .hotspot-comment {
          opacity: 1;
          visibility: visible;
        }

        .comment-bubble {
          position: relative;
          min-width: 140px;
          max-width: 260px;
          padding: 13px 20px 14px 18px;

          border: 1.5px solid var(--hotspot-glass-border);
          border-radius: 14px 14px 18px 5px;
          color: #082032;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 2px 24px rgba(8, 247, 254, 0.09),
            0 16px 46px rgba(0, 0, 0, 0.13);
          background: white;
          transition: box-shadow 0.2s, border 0.17s;
          pointer-events: auto;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .hotspot-marker.selected .comment-bubble {
          border: 2.5px solid var(--hotspot-accent);
          box-shadow: 0 3px 48px rgba(8, 247, 254, 0.24),
            0 20px 60px rgba(0, 0, 0, 0.19);
        }

        /* Bubble Tail, NEON Style */
        .comment-bubble::after {
          content: "";
          position: absolute;
          bottom: -14px;
          left: 50%;
          transform: translateX(-20%) rotate(6deg);
          width: 32px;
          height: 18px;
          background: transparent;
          border-radius: 40% 50% 60% 0;
          box-shadow: 0 10px 0 0 var(--hotspot-glass-bg);
          z-index: 2;
        }

        /* Edit icon hint, minimal style */
        .comment-edit-icon {
          position: absolute;
          top: 8px;
          right: 8px;
          opacity: 0;
          font-size: 15px;
          color: var(--hotspot-accent);
          transition: opacity 0.14s;
          pointer-events: auto;
        }
        .comment-bubble:hover .comment-edit-icon {
          opacity: 1;
        }

        /* Textarea, minimal */
        .comment-textarea {
          background: transparent;
          border: none;
          outline: none;
          width: 100%;
          color: #597992;
          font-size: 15px;
          resize: none;
        }

        .comment-edit-hint {
          font-size: 10px;
          color: #3f4141;
          font-style: italic;
          margin-top: 4px;
        }

        /* Dimension styles */
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
          font-family: Futura, Helvetica Neue, sans-serif;
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
