"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Loader2, AlertCircle, Smartphone } from "lucide-react";
import { triggerAR, detectPlatform, isMobile } from "@/lib/arUtils";

interface AssetData {
  id: string;
  product_name: string;
  glb_link: string;
  article_id: string;
  preview_image?: string;
}

export default function ARViewPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arLaunched, setArLaunched] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const response = await fetch(`/api/assets/public/${assetId}`);
        
        if (!response.ok) {
          throw new Error("Failed to load asset");
        }

        const data = await response.json();
        setAsset(data);
      } catch (err) {
        console.error("Error fetching asset:", err);
        setError("Failed to load asset. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [assetId]);

  useEffect(() => {
    // Auto-trigger AR on mobile devices once asset is loaded
    if (asset && !arLaunched && isMobile()) {
      setArLaunched(true);
      
      // Small delay to ensure the page has loaded
      setTimeout(() => {
        triggerAR(asset.glb_link, asset.product_name);
      }, 500);
    }
  }, [asset, arLaunched]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading AR experience...</p>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Unable to Load AR</h1>
          <p className="text-muted-foreground">
            {error || "Asset not found. Please check the link and try again."}
          </p>
        </div>
      </div>
    );
  }

  const platform = detectPlatform();
  const mobile = isMobile();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Product Preview */}
        {asset.preview_image && (
          <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border relative">
            <Image
              src={asset.preview_image}
              alt={asset.product_name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 448px"
            />
          </div>
        )}

        {/* Product Info */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{asset.product_name}</h1>
          {asset.article_id && (
            <p className="text-sm text-muted-foreground">
              Article ID: {asset.article_id}
            </p>
          )}
        </div>

        {/* AR Status / Instructions */}
        {mobile ? (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Smartphone className="h-5 w-5" />
              <p className="font-medium">AR Viewer Launching...</p>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              {platform === "ios"
                ? "Opening AR Quick Look..."
                : platform === "android"
                ? "Opening Scene Viewer..."
                : "Please use a mobile device to view in AR"}
            </p>
            {arLaunched && (
              <button
                onClick={() => triggerAR(asset.glb_link, asset.product_name)}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Retry AR Launch
              </button>
            )}
          </div>
        ) : (
          <div className="bg-muted border border-border rounded-lg p-6 space-y-3 text-center">
            <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Mobile Device Required</h2>
            <p className="text-sm text-muted-foreground">
              AR viewing is only available on mobile devices. Please open this
              page on your smartphone or tablet.
            </p>
            <div className="pt-2 text-xs text-muted-foreground space-y-1">
              <p>Supported platforms:</p>
              <p>• iOS with AR Quick Look</p>
              <p>• Android with ARCore support</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground">
          Powered by Charpstar 3D Asset Library
        </p>
      </div>
    </div>
  );
}

