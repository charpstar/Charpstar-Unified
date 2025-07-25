// src/components/demo/CameraControlsPanel.tsx
import React, { useState, useRef } from "react";
import {
  Square, // Front view
} from "lucide-react";

interface CameraControlsPanelProps {
  modelViewerRef: React.RefObject<any>;
  isMobile?: boolean;
}

export const CameraControlsPanel: React.FC<CameraControlsPanelProps> = ({
  modelViewerRef,
  isMobile = false,
}) => {
  // State to track the generated poster image URL
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentView, setCurrentView] = useState("");
  const controlsPanelRef = useRef<HTMLDivElement>(null);

  // Camera angle presets with verified Lucide icons
  const cameraPresets = [
    { name: "Default", orbit: "-25deg 80deg 80%", icon: <Square size={16} /> },
    { name: "Front", orbit: "0deg 88deg 80%", icon: <Square size={16} /> },
    { name: "Back", orbit: "180deg 90deg 80%", icon: <Square size={16} /> },
    { name: "Side", orbit: "90deg 91deg 80%", icon: <Square size={16} /> },
    { name: "Top", orbit: "0deg -200deg 80%", icon: <Square size={16} /> },
    { name: "Table", orbit: "-35deg 71deg 80%", icon: <Square size={16} /> },
  ];

  // Function to toggle grid visibility
  const toggleGridVisibility = (visible: boolean) => {
    if (!modelViewerRef.current) return;

    try {
      // Check if gridHelper exists
      if (modelViewerRef.current.gridHelper) {
        // Set visibility
        modelViewerRef.current.gridHelper.visible = visible;

        // Force a render update
        if (typeof modelViewerRef.current.requestRender === "function") {
          modelViewerRef.current.requestRender();
        }
      }
    } catch (error) {
      console.error("Error toggling grid visibility:", error);
    }
  };

  // Function to change camera view and generate poster
  const setCameraView = async (orbit: string, name: string) => {
    if (!modelViewerRef.current) return;

    try {
      setIsGenerating(true);
      setCurrentView(name);

      // Hide the grid before generating the poster
      toggleGridVisibility(false);

      // Call the createSweefPoster function with the orbit value
      if (typeof modelViewerRef.current.createSweefPosterX === "function") {
        const imageUrl = await modelViewerRef.current.createSweefPosterX(orbit);

        setPosterImage(imageUrl);
      } else if (
        typeof modelViewerRef.current.createSweefPoster === "function"
      ) {
        // Try the regular function if X version doesn't exist
        await modelViewerRef.current.createSweefPoster(orbit);
      } else {
        // Fallback to directly setting cameraOrbit if function doesn't exist
        modelViewerRef.current.cameraOrbit = orbit;
      }
    } catch (error) {
      console.error("Error changing camera view:", error);
    } finally {
      // Re-show the grid after generating the poster
      toggleGridVisibility(true);
      setIsGenerating(false);
    }
  };

  // Close the poster preview
  const closePoster = () => {
    setPosterImage(null);
  };

  // Download the poster image
  const downloadPoster = () => {
    if (!posterImage) return;

    // Create a temporary link element
    const link = document.createElement("a");
    link.href = posterImage;
    link.download = `${currentView.toLowerCase()}-view.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      ref={controlsPanelRef}
      className={
        isMobile
          ? "w-full max-w-md mx-auto p-1"
          : "absolute bottom-8 left-4 z-10"
      }
    >
      {/* Poster Preview Panel */}
      {posterImage && (
        <div
          className={
            isMobile
              ? "mb-2 bg-card rounded-md shadow-lg border border-border overflow-hidden w-full"
              : "mb-2 bg-card rounded-md shadow-lg border border-border overflow-hidden"
          }
          style={
            isMobile
              ? { width: "100%", maxWidth: 400 }
              : { width: "300px", maxWidth: "100%" }
          }
        >
          <div
            className={
              isMobile
                ? "flex justify-between items-center px-2 py-1 bg-muted border-b border-border"
                : "flex justify-between items-center px-3 py-1.5 bg-muted border-b border-border"
            }
          >
            <h3
              className={
                isMobile
                  ? "text-xs font-medium text-foreground"
                  : "text-xs font-medium text-foreground"
              }
            >
              {currentView} View Poster
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={downloadPoster}
                className="text-muted-foreground hover:text-foreground"
                title="Download poster"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button
                onClick={closePoster}
                className="text-muted-foreground hover:text-foreground"
                title="Close preview"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div className={isMobile ? "p-1" : "p-2"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterImage}
              alt={`${currentView} view`}
              className="w-full h-auto rounded"
            />
          </div>
        </div>
      )}

      {/* Camera Controls Panel */}
      <div
        className={
          isMobile
            ? "bg-card/95 rounded-md shadow-md border border-border overflow-hidden w-full"
            : "bg-card/95 rounded-md shadow-md border border-border overflow-hidden"
        }
      >
        <div
          className={
            isMobile
              ? "flex justify-between items-center px-2 py-1 bg-muted border-b border-border"
              : "flex justify-between items-center px-3 py-1.5 bg-muted border-b border-border"
          }
        >
          <h3 className="text-xs font-medium text-foreground">Camera Views</h3>
        </div>
        <div
          className={
            isMobile
              ? "p-1 grid grid-cols-3 gap-1"
              : "p-2 grid grid-cols-6 gap-1"
          }
        >
          {cameraPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setCameraView(preset.orbit, preset.name)}
              className={`flex flex-col items-center justify-center ${isMobile ? "p-1" : "p-2"} rounded hover:bg-muted transition-colors ${isGenerating && currentView === preset.name ? "bg-accent text-accent-foreground" : ""}`}
              title={preset.name}
              disabled={isGenerating}
            >
              <div className="text-foreground">{preset.icon}</div>
              <span className="text-xs mt-1 text-muted-foreground">
                {preset.name}
                {isGenerating && currentView === preset.name && "..."}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
