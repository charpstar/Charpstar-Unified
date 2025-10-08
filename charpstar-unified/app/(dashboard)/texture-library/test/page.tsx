"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";

export default function ModelViewerTestPage() {
  const [modelExists, setModelExists] = useState<boolean | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load model-viewer script
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    script.onload = () => {
      console.log("✅ model-viewer script loaded");
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("❌ Failed to load model-viewer script");
      setScriptLoaded(false);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    // Check if model file exists
    fetch("https://maincdn.b-cdn.net/Adam_AB/QC/orb.glb", { method: "HEAD" })
      .then((response) => {
        console.log("Model file check response:", response.status);
        setModelExists(response.ok);
      })
      .catch((error) => {
        console.error("Error checking model file:", error);
        setModelExists(false);
      });
  }, []);

  useEffect(() => {
    if (scriptLoaded) {
      const viewer = document.getElementById("testViewer") as any;
      if (viewer) {
        console.log("✅ Test viewer found");

        viewer.addEventListener("load", () => {
          console.log("✅ Test model loaded!");
        });

        viewer.addEventListener("error", (event: any) => {
          console.error("❌ Test model error:", event);
        });
      }
    }
  }, [scriptLoaded]);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Model Viewer Test Page</h1>

        <Card>
          <CardHeader>
            <CardTitle>Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">Model Viewer Script:</p>
              <p
                className={scriptLoaded ? "text-green-600" : "text-yellow-600"}
              >
                {scriptLoaded ? "✅ Loaded" : "⏳ Loading..."}
              </p>
            </div>

            <div>
              <p className="font-medium">Model File (orb.glb):</p>
              <p
                className={
                  modelExists === null
                    ? "text-yellow-600"
                    : modelExists
                      ? "text-green-600"
                      : "text-red-600"
                }
              >
                {modelExists === null
                  ? "⏳ Checking..."
                  : modelExists
                    ? "✅ Found at https://maincdn.b-cdn.net/Adam_AB/QC/orb.glb"
                    : "❌ NOT FOUND - CDN model unavailable"}
              </p>
            </div>

            <div>
              <p className="font-medium">Browser Console:</p>
              <p className="text-sm text-muted-foreground">
                Check your browser console (F12) for detailed logs
              </p>
            </div>
          </CardContent>
        </Card>

        {modelExists === false && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-600">
                Missing 3D Model File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                The orb.glb file is missing. You need to create or download a
                simple sphere model.
              </p>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Quick Fix Options:</p>
                <ol className="list-decimal ml-6 space-y-1">
                  <li>
                    Create in Blender: UV Sphere → Export as GLB → Save to
                    public/models/orb.glb
                  </li>
                  <li>
                    Download from:{" "}
                    <a
                      href="https://github.com/KhronosGroup/glTF-Sample-Models"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      glTF Sample Models
                    </a>
                  </li>
                  <li>
                    Use online tool:{" "}
                    <a
                      href="https://gltf.pmnd.rs/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      gltf.pmnd.rs
                    </a>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>3D Viewer Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
              {scriptLoaded ? (
                // @ts-expect-error -- model-viewer is a custom element
                <model-viewer
                  id="testViewer"
                  src="https://maincdn.b-cdn.net/Adam_AB/QC/orb.glb"
                  alt="Test 3D model"
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  environment-image="neutral"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground">
                    Waiting for model-viewer script...
                  </p>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              If you see a rotating sphere above, model-viewer is working
              correctly!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ol className="space-y-2">
              <li>Check the diagnostics above to see what's working</li>
              <li>
                If the model file is missing, add orb.glb to public/models/
              </li>
              <li>
                If the script isn't loading, check that model-viewer.js exists
                in public/
              </li>
              <li>Open browser console (F12) to see detailed logs</li>
              <li>Once everything is green, go back to the texture library</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
