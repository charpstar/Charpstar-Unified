import React, { useState, useEffect } from "react";
import ModelSnapshotCapture from "./ModelSnapshotCapture";

interface SelectedAsset {
  id: string;
  name: string;
  glb_link: string;
  category?: string;
  thumbnail?: string;
}

interface MultiAssetSnapshotCaptureProps {
  selectedAssets: SelectedAsset[];
  onAllSnapshotsCaptured: (snapshots: string[]) => void;
  onError?: (error: string) => void;
  environmentImage?: string;
  exposure?: string;
  toneMapping?: string;
}

const MultiAssetSnapshotCapture: React.FC<MultiAssetSnapshotCaptureProps> = ({
  selectedAssets,
  onAllSnapshotsCaptured,
  onError,
  environmentImage,
  exposure,
  toneMapping,
}) => {
  const [capturedSnapshots, setCapturedSnapshots] = useState<string[]>([]);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (selectedAssets.length === 0) return;

    setIsCapturing(true);
    setCapturedSnapshots([]);
    setCurrentAssetIndex(0);
  }, [selectedAssets]);

  const handleSnapshot = (snapshot: string) => {
    const newSnapshots = [...capturedSnapshots, snapshot];
    setCapturedSnapshots(newSnapshots);

    // Move to next asset
    const nextIndex = currentAssetIndex + 1;
    if (nextIndex < selectedAssets.length) {
      setCurrentAssetIndex(nextIndex);
    } else {
      // All snapshots captured
      setIsCapturing(false);
      onAllSnapshotsCaptured(newSnapshots);
    }
  };

  const handleError = (error: string) => {
    setIsCapturing(false);
    onError?.(error);
  };

  if (!isCapturing || currentAssetIndex >= selectedAssets.length) {
    return null;
  }

  const currentAsset = selectedAssets[currentAssetIndex];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Capturing Asset Snapshots
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {currentAsset.name} ({currentAssetIndex + 1} of{" "}
          {selectedAssets.length})
        </p>
        <div className="w-full bg-muted rounded-full h-2 mb-4">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentAssetIndex + 1) / selectedAssets.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="w-full max-w-md h-64 bg-muted rounded-lg overflow-hidden">
        <ModelSnapshotCapture
          modelUrl={currentAsset.glb_link}
          onSnapshot={handleSnapshot}
          onError={handleError}
          environmentImage={environmentImage}
          exposure={exposure}
          toneMapping={toneMapping}
        />
      </div>
    </div>
  );
};

export default MultiAssetSnapshotCapture;
