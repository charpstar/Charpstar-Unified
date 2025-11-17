"use client";

import { Settings, Sliders } from "lucide-react";
import { Label } from "@/components/ui/display/label";
import { Slider } from "@/components/ui/inputs/slider";
import { Switch } from "@/components/ui/inputs/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";

interface HunyuanConfigSectionProps {
  isSingleImageMode: boolean;
  setIsSingleImageMode: (mode: boolean) => void;
  faceCount: number;
  setFaceCount: (count: number) => void;
  enablePBR: boolean;
  setEnablePBR: (enable: boolean) => void;
  generateType: "Normal" | "LowPoly" | "Geometry" | "Sketch";
  setGenerateType: (type: "Normal" | "LowPoly" | "Geometry" | "Sketch") => void;
}

export function HunyuanConfigSection({
  isSingleImageMode,
  setIsSingleImageMode,
  faceCount,
  setFaceCount,
  enablePBR,
  setEnablePBR,
  generateType,
  setGenerateType,
}: HunyuanConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Settings className="h-4 w-4" />
        Generation Settings
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Generation Mode
        </Label>
        <div className="flex bg-muted rounded-md p-1">
          <button
            onClick={() => setIsSingleImageMode(false)}
            className={`cursor-pointer flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              !isSingleImageMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Multi View
          </button>
          <button
            onClick={() => setIsSingleImageMode(true)}
            className={`cursor-pointer flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              isSingleImageMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Single Image
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isSingleImageMode
            ? "Generate from a single image"
            : "Generate from multiple view angles"}
        </p>
      </div>

      {/* Generation Type */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Generation Type
        </Label>
        <Select
          value={generateType}
          onValueChange={(value: any) => setGenerateType(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Normal">Normal (Textured)</SelectItem>
            <SelectItem value="LowPoly">Low Poly</SelectItem>
            <SelectItem value="Geometry">Geometry (White Model)</SelectItem>
            <SelectItem value="Sketch">Sketch to 3D</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Face Count Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Sliders className="h-3 w-3" />
            Face Count
          </Label>
          <span className="text-xs text-foreground font-mono">
            {faceCount.toLocaleString()}
          </span>
        </div>
        <Slider
          min={40000}
          max={300000}
          step={10000}
          value={[faceCount]}
          onValueChange={(values) => setFaceCount(values[0])}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Higher values = more detail but slower generation
        </p>
      </div>

      {/* PBR Material Toggle */}
      <div className="flex items-center justify-between space-x-2">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium text-foreground">
            Enable PBR Materials
          </Label>
          <p className="text-xs text-muted-foreground">
            Physically-based rendering materials
          </p>
        </div>
        <Switch checked={enablePBR} onCheckedChange={setEnablePBR} />
      </div>
    </div>
  );
}
