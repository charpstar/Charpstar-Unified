"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface ModelViewerProps {
  modelUrl: string;
  alt: string;
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

export function ModelViewer({ modelUrl, alt }: ModelViewerProps) {
  const modelViewerRef = useRef<HTMLElement | null>(null);

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

    modelViewer.addEventListener("load", () => {
      const center = modelViewer.getBoundingBoxCenter();
      const size = modelViewer.getDimensions();
      const x2 = size.x / 2;
      const y2 = size.y / 2;
      const z2 = size.z / 2;

      modelViewer.updateHotspot({
        name: "hotspot-dot+X-Y+Z",
        position: `${center.x + x2} ${center.y - y2} ${center.z + z2}`,
      });

      modelViewer.updateHotspot({
        name: "hotspot-dim+X-Y",
        position: `${center.x + x2 * 1.2} ${center.y - y2 * 1.1} ${center.z}`,
      });
      modelViewer.querySelector('button[slot="hotspot-dim+X-Y"]').textContent =
        `${(size.z * 100).toFixed(0)} cm`;

      modelViewer.updateHotspot({
        name: "hotspot-dot+X-Y-Z",
        position: `${center.x + x2} ${center.y - y2} ${center.z - z2}`,
      });

      modelViewer.updateHotspot({
        name: "hotspot-dim+X-Z",
        position: `${center.x + x2 * 1.2} ${center.y} ${center.z - z2 * 1.2}`,
      });
      modelViewer.querySelector('button[slot="hotspot-dim+X-Z"]').textContent =
        `${(size.y * 100).toFixed(0)} cm`;

      modelViewer.updateHotspot({
        name: "hotspot-dot+X+Y-Z",
        position: `${center.x + x2} ${center.y + y2} ${center.z - z2}`,
      });

      modelViewer.updateHotspot({
        name: "hotspot-dim+Y-Z",
        position: `${center.x} ${center.y + y2 * 1.1} ${center.z - z2 * 1.1}`,
      });
      modelViewer.querySelector('button[slot="hotspot-dim+Y-Z"]').textContent =
        `${(size.x * 100).toFixed(0)} cm`;

      modelViewer.updateHotspot({
        name: "hotspot-dot-X+Y-Z",
        position: `${center.x - x2} ${center.y + y2} ${center.z - z2}`,
      });

      modelViewer.updateHotspot({
        name: "hotspot-dim-X-Z",
        position: `${center.x - x2 * 1.2} ${center.y} ${center.z - z2 * 1.2}`,
      });
      modelViewer.querySelector('button[slot="hotspot-dim-X-Z"]').textContent =
        `${(size.y * 100).toFixed(0)} cm`;

      modelViewer.updateHotspot({
        name: "hotspot-dot-X-Y-Z",
        position: `${center.x - x2} ${center.y - y2} ${center.z - z2}`,
      });

      modelViewer.updateHotspot({
        name: "hotspot-dim-X-Y",
        position: `${center.x - x2 * 1.2} ${center.y - y2 * 1.1} ${center.z}`,
      });
      modelViewer.querySelector('button[slot="hotspot-dim-X-Y"]').textContent =
        `${(size.z * 100).toFixed(0)} cm`;

      modelViewer.updateHotspot({
        name: "hotspot-dot-X-Y+Z",
        position: `${center.x - x2} ${center.y - y2} ${center.z + z2}`,
      });

      renderSVG();

      modelViewer.addEventListener("camera-change", renderSVG);
    });

    return () => {
      modelViewer.removeEventListener("camera-change", renderSVG);
      modelViewer.removeEventListener("ar-status", () => {});
      checkbox.removeEventListener("change", () => {});
    };
  }, [modelUrl]);

  return (
    <>
      <Script src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" />
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
        camera-controls
        touch-action="pan-y"
        src={modelUrl}
        alt={alt}
        className="w-full h-[300px] sm:h-[200px] md:h-[500px] lg:h-[1000px]"
      >
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
          className="dimensionLineContainer"
        >
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
          <line className="dimensionLine"></line>
        </svg>

        <div id="controls" className="dim glass">
          <label htmlFor="show-dimensions" className="text-xs sm:text-sm">
            Show Dimensions:
          </label>
          <input id="show-dimensions" type="checkbox" defaultChecked />
        </div>
        {/* @ts-expect-error -- model-viewer is a custom element */}
      </model-viewer>

      <style jsx>{`
        #controls {
          position: absolute;
          bottom: 16px;
          left: 16px;
          max-width: unset;
          transform: unset;
          pointer-events: auto;
          z-index: 100;
        }

        .dot {
          display: none;
        }

        .glass {
          background: rgba(255, 255, 255, 0.37);
          backdrop-filter: blur(8px) contrast(0.89) saturate(1.27);
          -webkit-backdrop-filter: blur(8px) contrast(0.89) saturate(1.27);
          border: 1px solid rgba(255, 255, 255, 0.4);
          padding: 0.5rem;
          border-radius: 0.5rem;
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
