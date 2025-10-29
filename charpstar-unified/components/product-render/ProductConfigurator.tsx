import React, { useState } from "react";
import { Button } from "@/components/ui/display/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";
import { Slider } from "@/components/ui/inputs/slider";

interface ProductConfiguratorProps {
  onGenerate: (settings: {
    resolution: string;
    imageFormat: string;
    quality: string;
    renderMargin: number;
    cameraViews: string[];
  }) => void;
  onCameraViewPreview?: (viewId: string) => void;
  selectedProducts: Array<{
    id: string;
    product_name: string;
    glb_link: string;
    category?: string;
  }>;
  currentSettings: {
    resolution: string;
    imageFormat: string;
    quality: string;
    renderMargin: number;
    cameraViews: string[];
  };
}

// Map camera view IDs to camera-orbit values for model-viewer
// Format: "theta phi radius" where:
// - theta (polar): 0deg = top, 90deg = eye level, 180deg = bottom
// - phi (azimuth): horizontal rotation, 0deg = front, 90deg = right, 180deg = back, 270deg = left
const getCameraOrbitForView = (viewId: string): string => {
  const cameraOrbits: Record<string, string> = {
    front: "270deg 90deg auto", // Eye level, front view
    side: "0deg 90deg auto", // Eye level, right side
    back: "90deg 70deg auto", // Eye level, back view
    top: "10deg 0deg auto", // Slightly angled from top, front-facing
    angled_side1: "-45deg 70deg auto", // Eye level, 45° front-right
    angled_side1_flat: "-45deg 90deg auto", // Slightly elevated, 45° front-right (flat)
    angled_side2: "45deg 90deg auto", // Eye level, 45° back-right
    angled_side2_flat: "45deg 70deg auto", // Slightly elevated, 45° back-right (flat)
  };
  return cameraOrbits[viewId] || "90deg 0deg auto";
};

// Cube icon components for each camera view
interface CameraViewIconProps {
  viewId: string;
  checked: boolean;
}

const CameraViewIcon: React.FC<CameraViewIconProps> = ({ viewId, checked }) => {
  const strokeWidth = checked ? 1.8 : 1.2;
  const size = 22;
  const mainColor = "currentColor";
  const baseOpacity = checked ? 0.28 : 0.12;
  const lightFaceOpacity = checked ? 0.45 : 0.2;
  const darkFaceOpacity = checked ? 0.35 : 0.15;

  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: mainColor,
    strokeWidth,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  const gradients = (
    <defs>
      <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={mainColor} stopOpacity={0.5} />
        <stop offset="100%" stopColor={mainColor} stopOpacity={0.1} />
      </linearGradient>
      <linearGradient id="dark" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={mainColor} stopOpacity={0.25} />
        <stop offset="100%" stopColor={mainColor} stopOpacity={0.05} />
      </linearGradient>
    </defs>
  );

  const Cube = ({
    front,
    top,
    side,
  }: {
    front: string;
    top?: string;
    side?: string;
  }) => (
    <>
      {gradients}
      {top && (
        <polygon
          points={top}
          fill="url(#light)"
          opacity={lightFaceOpacity}
          stroke={mainColor}
        />
      )}
      {side && (
        <polygon
          points={side}
          fill="url(#dark)"
          opacity={darkFaceOpacity}
          stroke={mainColor}
        />
      )}
      <polygon
        points={front}
        fill={mainColor}
        opacity={baseOpacity}
        stroke={mainColor}
      />
    </>
  );

  switch (viewId) {
    // -------------------- FRONT --------------------
    case "front":
      return (
        <svg {...svgProps}>
          {gradients}
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            fill={mainColor}
            opacity={baseOpacity}
            stroke={mainColor}
          />
        </svg>
      );

    // -------------------- SIDE --------------------
    case "side":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube
            front="8,7 16,9 16,19 8,21 4,19 4,9"
            side="16,9 16,19 8,21 8,11"
          />
        </svg>
      );

    // -------------------- BACK --------------------
    case "back":
      return (
        <svg {...svgProps}>
          {gradients}
          {/* rotated cube, tilted backward */}
          <Cube
            front="7,8 19,8 17,18 5,18"
            top="7,8 13,5 19,8 13,11"
            side="19,8 19,18 17,18 17,8"
          />
        </svg>
      );

    // -------------------- BACK FLAT --------------------
    case "back_flat":
      return (
        <svg {...svgProps}>
          {gradients}
          {/* flatter rear angle, less top visible */}
          <Cube
            front="7,10 19,10 17,20 5,20"
            top="7,10 13,7 19,10 13,13"
            side="19,10 19,20 17,20 17,10"
          />
        </svg>
      );

    // -------------------- TOP --------------------
    case "top":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube front="6,12 18,12 18,20 6,20" top="6,12 12,6 18,12 12,16" />
        </svg>
      );

    // -------------------- ANGLED SIDE 1 --------------------
    case "angled_side1":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube
            front="5,7 17,9 15,19 3,17"
            top="5,7 11,5 17,7 11,9"
            side="17,9 17,19 15,19 15,9"
          />
        </svg>
      );

    // -------------------- ANGLED SIDE 1 FLAT --------------------
    case "angled_side1_flat":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube
            front="4,9 16,11 14,21 2,19"
            top="4,9 10,7 16,9 10,11"
            side="16,11 16,21 14,21 14,11"
          />
        </svg>
      );

    // -------------------- ANGLED SIDE 2 --------------------
    case "angled_side2":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube
            front="7,7 19,9 21,19 9,17"
            side="9,17 21,19 13,21 1,19"
            top="7,7 13,5 19,7 13,9"
          />
        </svg>
      );

    // -------------------- ANGLED SIDE 2 FLAT --------------------
    case "angled_side2_flat":
      return (
        <svg {...svgProps}>
          {gradients}
          <Cube
            front="6,9 18,11 20,21 8,19"
            side="8,19 20,21 12,23 0,21"
            top="6,9 12,7 18,9 12,11"
          />
        </svg>
      );

    // -------------------- DEFAULT --------------------
    default:
      return (
        <svg {...svgProps}>
          {gradients}
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            fill={mainColor}
            opacity={baseOpacity}
            stroke={mainColor}
          />
        </svg>
      );
  }
};

const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  onGenerate,
  onCameraViewPreview,
  currentSettings,
}) => {
  const [settings, setSettings] = useState(currentSettings);

  const handleSubmit = () => {
    onGenerate(settings);
  };

  const cameraViewOptions = [
    { id: "front", label: "Front" },
    { id: "angled_side1", label: "45° Front-Side" },
    { id: "angled_side1_flat", label: "45° Front-Side (Flat)" },
    { id: "side", label: "Side" },
    { id: "angled_side2", label: "45° Back-Side" },
    { id: "angled_side2_flat", label: "45° Back-Side (Flat)" },
    { id: "back", label: "Back" },
    { id: "top", label: "Top" },
  ];

  return (
    <div className="h-full flex flex-col ">
      {/* Compact, no-scroll content */}
      <div className="flex-1 p-2 sm:p-3  space-y-2 sm:space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3 h-[70%]">
          {/* Resolution */}
          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-[12px] font-semibold text-muted-foreground tracking-wide uppercase">
              Resolution
            </label>
            <Select
              value={settings.resolution}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, resolution: value }))
              }
            >
              <SelectTrigger
                size="sm"
                className="w-full h-8 px-2 text-xs bg-surface-raised border border-border-light shadow-depth-sm cursor-pointer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1024x1024" className="cursor-pointer">
                  1024×1024
                </SelectItem>
                <SelectItem value="2048x2048" className="cursor-pointer">
                  2048×2048
                </SelectItem>
                <SelectItem value="4096x4096" className="cursor-pointer">
                  4096×4096
                </SelectItem>
                <SelectItem value="1920x1080" className="cursor-pointer">
                  1920×1080 (16:9)
                </SelectItem>
                <SelectItem value="3840x2160" className="cursor-pointer">
                  3840×2160 (4K)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image Format */}
          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-[12px] font-semibold text-muted-foreground tracking-wide uppercase">
              Image Format
            </label>
            <Select
              value={settings.imageFormat}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, imageFormat: value }))
              }
            >
              <SelectTrigger
                size="sm"
                className="w-full h-8 px-2 text-xs bg-surface-raised border border-border-light shadow-depth-sm cursor-pointer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JPEG" className="cursor-pointer">
                  JPEG
                </SelectItem>
                <SelectItem value="PNG" className="cursor-pointer">
                  PNG
                </SelectItem>
                <SelectItem value="WEBP" className="cursor-pointer">
                  WebP
                </SelectItem>
                <SelectItem value="TIFF" className="cursor-pointer">
                  TIFF
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-[12px] font-semibold text-muted-foreground tracking-wide uppercase">
              Quality
            </label>
            <Select
              value={settings.quality}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, quality: value }))
              }
            >
              <SelectTrigger
                size="sm"
                className="w-full h-8 px-2 text-xs bg-surface-raised border border-border-light shadow-depth-sm cursor-pointer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="cursor-pointer">
                  Low
                </SelectItem>
                <SelectItem value="medium" className="cursor-pointer">
                  Medium
                </SelectItem>
                <SelectItem value="high" className="cursor-pointer">
                  High
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Render Margin */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
                Margin
              </label>
              <span className=" absolute right-1 text-[10px] sm:text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-1 rounded ">
                {settings.renderMargin}%
              </span>
            </div>

            <Slider
              min={5}
              max={50}
              step={5}
              value={[settings.renderMargin]}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  renderMargin: value[0],
                }))
              }
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[11px] sm:text-[12px] text-muted-foreground">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Camera Views - compact chips */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <label className="text-[11px] sm:text-[12px] font-semibold text-muted-foreground tracking-wide uppercase">
                Camera Views{" "}
                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-normal normal-case">
                  (Hover to preview)
                </span>
              </label>
            </div>
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {cameraViewOptions.map((view) => {
                const checked = settings.cameraViews.includes(view.id);
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({
                        ...prev,
                        cameraViews: checked
                          ? prev.cameraViews.filter((v) => v !== view.id)
                          : [...prev.cameraViews, view.id],
                      }));
                    }}
                    onMouseEnter={() => {
                      // Preview camera angle when hovering over the button
                      if (onCameraViewPreview) {
                        onCameraViewPreview(getCameraOrbitForView(view.id));
                      }
                    }}
                    onMouseLeave={() => {
                      // Reset to default view when mouse leaves (optional - can be removed if you want it to stay)
                      // if (onCameraViewPreview) {
                      //   onCameraViewPreview("0deg 0deg auto");
                      // }
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-1 rounded-md border shadow-depth-sm transition-colors cursor-pointer ${
                      checked
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-surface-raised border-border text-muted-foreground hover:bg-surface-elevated"
                    }`}
                    aria-pressed={checked}
                  >
                    <span
                      className={`flex-shrink-0 transition-colors ${checked ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <CameraViewIcon viewId={view.id} checked={checked} />
                    </span>
                    <span className="truncate">{view.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Action Button */}
      <div className="p-2 sm:p-3  w-full mx-auto text-center bg-surface-raised">
        <Button
          onClick={handleSubmit}
          className="w-1/2 mx-auto"
          size="sm"
          disabled={settings.cameraViews.length === 0}
        >
          Start Rendering
        </Button>
      </div>
    </div>
  );
};

export default ProductConfigurator;
