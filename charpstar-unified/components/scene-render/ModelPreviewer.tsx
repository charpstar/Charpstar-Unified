import React, { useRef, useEffect, useState } from "react";
import Script from "next/script";
import Image from "next/image";

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

const scenePresets = [
  // Product Showcase
  {
    category: "Product Showcase",
    label: "Minimalist Podium",
    prompt:
      "A minimalist white podium in a brightly lit studio with soft, diffused lighting.",
  },
  {
    category: "Product Showcase",
    label: "Dark Slate Pedestal",
    prompt:
      "On a rugged, dark slate pedestal in a minimalist concrete gallery.",
  },
  {
    category: "Product Showcase",
    label: "Floating Shelf",
    prompt: "On a floating wooden shelf against a clean, textured white wall.",
  },
  {
    category: "Product Showcase",
    label: "Museum Display",
    prompt: "Inside a brightly lit glass display case in a modern museum.",
  },

  // Lifestyle / Interior
  {
    category: "Lifestyle / Interior",
    label: "Scandinavian Living Room",
    prompt: "In a bright, airy, modern Scandinavian interior living room.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Cozy Cabin",
    prompt:
      "On a rich, dark oak table inside a cozy, rustic cabin with a warm fireplace.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Modern Office Desk",
    prompt:
      "On a sleek, modern office desk with a laptop and a cup of coffee in soft focus.",
  },
  {
    category: "Lifestyle / Interior",
    label: "Marble Kitchen Counter",
    prompt:
      "On a luxurious marble kitchen counter with soft morning light filtering through a window.",
  },

  // Outdoor / Nature
  {
    category: "Outdoor / Nature",
    label: "Misty Beach",
    prompt:
      "Resting on a smooth, weathered rock on a serene, misty beach at sunrise.",
  },
  {
    category: "Outdoor / Nature",
    label: "Forest Floor",
    prompt:
      "On a mossy patch on a forest floor with dappled sunlight filtering through the trees.",
  },
  {
    category: "Outdoor / Nature",
    label: "City Rooftop",
    prompt: "On a city rooftop patio with a view of the skyline at dusk.",
  },
  {
    category: "Outdoor / Nature",
    label: "Zen Garden",
    prompt: "On a flat rock in a tranquil Japanese zen garden with raked sand.",
  },

  // Abstract / Creative
  {
    category: "Abstract / Creative",
    label: "Cyberpunk Street",
    prompt: "In a futuristic, neon-lit cyberpunk city street setting at night.",
  },
  {
    category: "Abstract / Creative",
    label: "Surreal Dreamscape",
    prompt:
      "Floating in a surreal, dreamlike landscape with pastel-colored clouds.",
  },
  {
    category: "Abstract / Creative",
    label: "Geometric Background",
    prompt:
      "Against a clean, abstract background with soft geometric shapes and shadows.",
  },
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });

interface ModelPreviewerProps {
  file: File;
  onGenerate: (
    snapshots: string[],
    objectSize: string,
    objectType: string,
    sceneDescription: string,
    inspirationImage: string | null
  ) => void;
  onCancel: () => void;
}

const ModelPreviewer: React.FC<ModelPreviewerProps> = ({
  file,
  onGenerate,
  onCancel,
}) => {
  const modelViewerRef = useRef<HTMLElement>(null);
  const [objectSize, setObjectSize] = useState("");
  const [objectType, setObjectType] = useState("");
  const [modelDimensions, setModelDimensions] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [sceneDescription, setSceneDescription] = useState(
    scenePresets[0].prompt
  );
  const [isCustomScene, setIsCustomScene] = useState(false);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [inspirationImageUrl, setInspirationImageUrl] = useState<string | null>(
    null
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({
    current: 0,
    total: 3,
  });
  const [currentAngle, setCurrentAngle] = useState<string | null>(null);
  const [isTestingAngles, setIsTestingAngles] = useState(false);
  const [testAngleIndex, setTestAngleIndex] = useState(0);

  // Create blob URL only once when file changes
  useEffect(() => {
    // Clean up previous URL
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }

    try {
      console.log(
        "Creating object URL for file:",
        file.name,
        file.type,
        file.size
      );
      const url = URL.createObjectURL(file);
      console.log("Created object URL:", url);
      setFileUrl(url);
      setIsModelLoading(true);
      setModelError(null);
    } catch (error) {
      console.error("Error creating object URL:", error);
      setFileUrl(null);
    }
  }, [file]);

  // Debug fileUrl changes
  useEffect(() => {
    console.log("fileUrl changed:", fileUrl);
  }, [fileUrl]);

  // Add timeout fallback for loading
  useEffect(() => {
    if (isModelLoading && fileUrl && modelViewerLoaded) {
      const timeout = setTimeout(() => {
        console.warn("Model loading timeout, forcing loading to complete");
        setIsModelLoading(false);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isModelLoading, fileUrl, modelViewerLoaded]);

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      if (inspirationImageUrl) {
        URL.revokeObjectURL(inspirationImageUrl);
      }
    };
  }, [fileUrl, inspirationImageUrl]);

  // Handle model-viewer load event to get dimensions
  useEffect(() => {
    if (modelViewerRef.current && fileUrl && modelViewerLoaded) {
      const modelViewer = modelViewerRef.current as any;

      const handleLoad = () => {
        try {
          // Get model dimensions from model-viewer
          const model = modelViewer.model;
          if (model) {
            const box = model.boundingBox;
            if (box) {
              const size = box.getSize();
              setModelDimensions({
                x: size.x,
                y: size.y,
                z: size.z,
              });
              const sizeString = `Width: ${size.x.toFixed(2)}m, Height: ${size.y.toFixed(2)}m, Depth: ${size.z.toFixed(2)}m.`;
              setObjectSize(sizeString);
            } else {
              setModelDimensions({ x: 0, y: 0, z: 0 });
              setObjectSize("Could not determine object dimensions.");
            }
          }
          setIsModelLoading(false);
        } catch (error) {
          console.error("Error getting model dimensions:", error);
          setModelDimensions({ x: 0, y: 0, z: 0 });
          setObjectSize("Could not determine object dimensions.");
          setIsModelLoading(false);
        }
      };

      const handleError = (event: CustomEvent) => {
        console.error("Model loading error:", event.detail);
        setModelError("Failed to load 3D model. Please try a different file.");
        setIsModelLoading(false);
      };

      modelViewer.addEventListener("load", handleLoad);
      modelViewer.addEventListener("error", handleError);

      return () => {
        modelViewer.removeEventListener("load", handleLoad);
        modelViewer.removeEventListener("error", handleError);
      };
    }
  }, [fileUrl, modelViewerLoaded]);

  const testCameraAngles = async () => {
    const modelViewer = modelViewerRef.current as any;
    if (!modelViewer) return;

    const cameraAngles = [
      { orbit: "0deg 75deg 0deg", name: "Front" },
      { orbit: "45deg 75deg 0deg", name: "Front Right" },
      { orbit: "-45deg 75deg 0deg", name: "Front Left" },
    ];

    setIsTestingAngles(true);
    setTestAngleIndex(0);

    try {
      for (let i = 0; i < cameraAngles.length; i++) {
        const angle = cameraAngles[i];
        setTestAngleIndex(i);
        setCurrentAngle(angle.name);

        // Set camera position
        modelViewer.cameraOrbit = angle.orbit;

        // Force a re-render
        modelViewer.dispatchEvent(new CustomEvent("camera-change"));

        // Wait for camera to settle
        await new Promise((resolve) => {
          const checkCamera = () => {
            const currentOrbit = modelViewer.cameraOrbit;
            if (currentOrbit === angle.orbit) {
              resolve(undefined);
            } else {
              setTimeout(checkCamera, 100);
            }
          };
          setTimeout(checkCamera, 200);
          setTimeout(resolve, 2000);
        });

        // Wait between angles for better visibility
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      setIsTestingAngles(false);
      setCurrentAngle(null);
      setTestAngleIndex(0);
    }
  };

  const handleCapture = async () => {
    if (!objectType.trim()) return;

    const modelViewer = modelViewerRef.current as any;
    if (modelViewer) {
      setIsCapturing(true);
      setCaptureProgress({ current: 0, total: 5 });

      // Short delay to allow any UI updates to render before taking snapshot
      await new Promise((resolve) => setTimeout(resolve, 50));

      const finalObjectSize =
        objectSize || "The object's scale is unknown. Use common sense.";

      // Define 3 different camera angles
      const cameraAngles = [
        { orbit: "0deg 75deg 0deg", name: "Front" },
        { orbit: "45deg 75deg 0deg", name: "Front Right" },
        { orbit: "-45deg 75deg 0deg", name: "Front Left" },
      ];

      const snapshots: string[] = [];

      try {
        // Capture each angle
        for (let i = 0; i < cameraAngles.length; i++) {
          const angle = cameraAngles[i];

          // Update progress and current angle
          setCaptureProgress({ current: i + 1, total: cameraAngles.length });
          setCurrentAngle(angle.name);

          // Set camera position
          modelViewer.cameraOrbit = angle.orbit;

          // Force a re-render by updating the model-viewer element
          modelViewer.dispatchEvent(new CustomEvent("camera-change"));

          // Wait for the camera to actually move to the new position
          await new Promise((resolve) => {
            // Check if camera has moved by comparing current orbit
            const checkCamera = () => {
              const currentOrbit = modelViewer.cameraOrbit;
              if (currentOrbit === angle.orbit) {
                resolve(undefined);
              } else {
                setTimeout(checkCamera, 100);
              }
            };
            // Start checking after a short delay
            setTimeout(checkCamera, 200);
            // Fallback timeout
            setTimeout(resolve, 2000);
          });

          // Additional wait to ensure rendering is complete
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Capture screenshot
          const snapshotDataUrl = await modelViewer.toDataURL();
          const snapshotBase64 = snapshotDataUrl.split(",")[1];
          snapshots.push(snapshotBase64);

          console.log(`Captured ${angle.name} angle (${i + 1}/5)`);
        }

        let inspirationBase64: string | null = null;
        if (inspirationImage) {
          inspirationBase64 = await fileToBase64(inspirationImage);
        }

        onGenerate(
          snapshots,
          finalObjectSize,
          objectType,
          sceneDescription,
          inspirationBase64
        );
      } finally {
        setIsCapturing(false);
        setCaptureProgress({ current: 0, total: 5 });
        setCurrentAngle(null);
      }
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "custom") {
      setIsCustomScene(true);
      setSceneDescription("");
    } else {
      setIsCustomScene(false);
      setSceneDescription(value);
    }
  };

  const handleInspirationImageChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setInspirationImage(file);
      setInspirationImageUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveInspirationImage = () => {
    if (inspirationImageUrl) {
      URL.revokeObjectURL(inspirationImageUrl);
    }
    setInspirationImage(null);
    setInspirationImageUrl(null);
  };

  const presetCategories = [...new Set(scenePresets.map((p) => p.category))];
  const productPresets = [
    "Furniture",
    "Electronics",
    "Apparel",
    "Decor",
    "Kitchenware",
  ];

  // Don't render if fileUrl is empty
  if (!fileUrl) {
    return (
      <div className="w-full flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
        <div className="text-center p-8">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            File Error
          </div>
          <div className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            Unable to create file URL. Please try uploading the file again.
          </div>
          <button onClick={onCancel} className="btn btn-primary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
      {/* Load model-viewer script */}
      <Script
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
        type="module"
        onLoad={() => {
          console.log("Model-viewer script loaded");
          setModelViewerLoaded(true);
        }}
        onError={() => {
          console.error("Failed to load model-viewer script");
          setModelError("Failed to load 3D viewer. Please refresh the page.");
        }}
      />

      <div className="w-full h-96 rounded-lg overflow-hidden bg-gray-900/50 mb-6 relative cursor-grab active:cursor-grabbing border border-white/10">
        {/* Capture Progress Overlay */}
        {(isCapturing || isTestingAngles) && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">
                  {isTestingAngles
                    ? "Testing angles..."
                    : "Capturing angles..."}
                </span>
              </div>
              <div className="text-sm text-gray-300">
                {isTestingAngles
                  ? `${testAngleIndex + 1} of 3`
                  : `${captureProgress.current} of ${captureProgress.total}`}
              </div>
            </div>
            {currentAngle && (
              <div className="text-center text-lg font-semibold text-blue-400">
                Current: {currentAngle}
              </div>
            )}
          </div>
        )}
        {modelError ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div>
              <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
                Model Loading Error
              </div>
              <div className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                {modelError}
              </div>
              <button
                onClick={() => {
                  setModelError(null);
                  setIsModelLoading(true);
                  // Force re-render by updating fileUrl
                  if (fileUrl) {
                    URL.revokeObjectURL(fileUrl);
                    setFileUrl(null);
                    // This will trigger a re-render
                    setTimeout(() => {
                      const url = URL.createObjectURL(file);
                      setFileUrl(url);
                    }, 100);
                  }
                }}
                className="btn btn-primary text-sm"
              >
                Retry Loading
              </button>
            </div>
          </div>
        ) : !fileUrl ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div>
              <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
                File Error
              </div>
              <div className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                Unable to create file URL. Please try uploading the file again.
              </div>
              <button onClick={onCancel} className="btn btn-primary">
                Cancel
              </button>
            </div>
          </div>
        ) : !modelViewerLoaded ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div>
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-gray-600 dark:text-gray-400">
                Loading 3D viewer...
              </div>
            </div>
          </div>
        ) : isModelLoading ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div>
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-gray-600 dark:text-gray-400">
                Loading 3D model...
              </div>
            </div>
          </div>
        ) : (
          // @ts-expect-error -- model-viewer is a custom element
          <model-viewer
            ref={modelViewerRef}
            src={fileUrl}
            alt="3D Model Preview"
            camera-controls
            shadow-intensity="0.5"
            environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
            exposure="1.2"
            tone-mapping="aces"
            shadow-softness="1"
            min-field-of-view="5deg"
            max-field-of-view="35deg"
            camera-orbit="0deg 75deg 0deg"
            max-camera-orbit="auto 100deg auto"
            touch-action="pan-y"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#fafafa",
            }}
            onLoad={() => {
              console.log("Model loaded successfully");
            }}
            onError={(event: CustomEvent) => {
              console.error("Model loading error:", event.detail);
              setModelError(
                "Failed to load 3D model. Please try a different file."
              );
            }}
          />
        )}
      </div>
      <div className="w-full max-w-md text-center mb-6 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            1. Position Your Model
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Left-click to rotate, middle-click to pan, and scroll to zoom. The
            system will automatically capture 3 different angles (Front, Front
            Right, Front Left) when you generate scenes.
          </p>
        </div>
        <div>
          <label className="block text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            2. Detected Dimensions
          </label>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            These measurements ensure your object is scaled correctly.
          </p>
          <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 transition text-center min-h-[48px] flex items-center justify-center">
            {modelDimensions ? (
              <code className="text-base">{`W: ${modelDimensions.x.toFixed(2)}m  H: ${modelDimensions.y.toFixed(2)}m  D: ${modelDimensions.z.toFixed(2)}m`}</code>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                Calculating...
              </span>
            )}
          </div>
        </div>
        <div>
          <label
            htmlFor="object-type"
            className="block text-xl font-bold text-gray-900 dark:text-gray-100 mb-2"
          >
            3. What type of product is this?
          </label>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Select a category or describe the object below. This helps generate
            place it realistically.
          </p>
          <div className="flex flex-wrap gap-2 mb-3 justify-center">
            {productPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setObjectType(preset)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${objectType === preset ? "bg-blue-600 text-white" : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"}`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            id="object-type"
            type="text"
            value={objectType}
            onChange={(e) => setObjectType(e.target.value)}
            placeholder="e.g., 'a leather armchair', 'a ceramic vase'"
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center"
            required
          />
        </div>
        <div>
          <label
            htmlFor="scene-preset"
            className="block text-xl font-bold text-gray-900 dark:text-gray-100 mb-2"
          >
            4. Describe the Scene
          </label>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Select a preset or write your own description.
          </p>
          <select
            id="scene-preset"
            value={isCustomScene ? "custom" : sceneDescription}
            onChange={handlePresetChange}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center appearance-none"
          >
            <option value="custom">-- Write a Custom Description --</option>
            {presetCategories.map((category) => (
              <optgroup key={category} label={category}>
                {scenePresets
                  .filter((p) => p.category === category)
                  .map((preset) => (
                    <option key={preset.label} value={preset.prompt}>
                      {preset.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          {isCustomScene && (
            <textarea
              id="scene-description"
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder="e.g., 'a studio with soft, natural light', 'an outdoor scene with dappled sunlight'"
              className="w-full mt-3 px-4 py-3 bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center h-24 resize-none"
            />
          )}
        </div>
        <div>
          <label className="block text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            5. Add Inspiration (Optional)
          </label>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Upload an image to guide the style.
          </p>
          {inspirationImageUrl ? (
            <div className="relative group w-full h-32">
              <Image
                src={inspirationImageUrl}
                alt="Inspiration preview"
                className="w-full h-full object-cover rounded-lg border border-gray-600"
                width={640}
                height={360}
              />
              <button
                onClick={handleRemoveInspirationImage}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                aria-label="Remove inspiration image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="inspiration-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 mb-2 text-gray-500"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 16"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    />
                  </svg>
                  <p className="text-sm text-gray-400">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, or WEBP</p>
                </div>
                <input
                  id="inspiration-upload"
                  type="file"
                  className="hidden"
                  onChange={handleInspirationImageChange}
                  accept="image/png, image/jpeg, image/webp"
                />
              </label>
            </div>
          )}
        </div>
      </div>
      <div className="flex space-x-4 mt-4">
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button
          onClick={testCameraAngles}
          className="btn btn-outline"
          disabled={isCapturing || isTestingAngles}
          title="Test camera angles without generating scenes"
        >
          {isTestingAngles
            ? `Testing... (${testAngleIndex + 1}/3)`
            : "Test Angles"}
        </button>
        <button
          onClick={handleCapture}
          className="btn btn-primary"
          disabled={!objectType.trim() || isCapturing || isTestingAngles}
          title={
            !objectType.trim()
              ? "Please describe the object first"
              : isCapturing
                ? "Capturing angles..."
                : isTestingAngles
                  ? "Please wait for angle testing to complete"
                  : "Generate scenes from 3 different angles"
          }
        >
          {isCapturing
            ? `Capturing... (${captureProgress.current}/${captureProgress.total})`
            : "Generate Scenes"}
        </button>
      </div>
    </div>
  );
};

export default ModelPreviewer;
