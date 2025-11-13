"use client";

import { useEffect } from "react";
import { Settings } from "lucide-react";

interface GradioConfigSectionProps {
  gradioUrl: string;
  setGradioUrl: (url: string) => void;
  isSingleImageMode: boolean;
  setIsSingleImageMode: (mode: boolean) => void;
}

export function GradioConfigSection({
  gradioUrl,
  setGradioUrl,
  isSingleImageMode,
  setIsSingleImageMode,
}: GradioConfigSectionProps) {
  // Set the default Gradio URL on mount
  useEffect(() => {
    if (!gradioUrl) {
      setGradioUrl("https://charpstar-multi.eu.ngrok.io");
    }
  }, [gradioUrl, setGradioUrl]);

  // Update URL when mode changes
  useEffect(() => {
    const newUrl = isSingleImageMode
      ? "https://charpstar-single.eu.ngrok.io"
      : "https://charpstar-multi.eu.ngrok.io";
    setGradioUrl(newUrl);
  }, [isSingleImageMode, setGradioUrl]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Settings className="h-4 w-4" />
        Server Configuration
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Generation Mode
        </span>
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
            ? "Generate 3D model from a single image"
            : "Generate 3D model from multiple view angles"}
        </p>
      </div>
    </div>
  );
}
