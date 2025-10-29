"use client";

import React, { useState } from "react";
import { View as ViewIcon } from "lucide-react";
import { Button } from "@/components/ui/display";
import { ARQRModal } from "./ARQRModal";
import { triggerAR, isMobile } from "@/lib/arUtils";

interface ARButtonProps {
  assetId: string;
  glbUrl: string;
  productName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ARButton({
  assetId,
  glbUrl,
  productName,
  variant = "outline",
  size = "sm",
  className = "",
}: ARButtonProps) {
  const [showQRModal, setShowQRModal] = useState(false);

  const handleARClick = () => {
    // Desktop users get QR code modal
    if (!isMobile()) {
      setShowQRModal(true);
      return;
    }

    // Mobile users directly launch AR
    triggerAR(glbUrl, productName);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleARClick}
        className={`cursor-pointer font-semibold ${className}`}
      >
        <ViewIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
        <span className="hidden sm:inline">View in AR</span>
        <span className="inline sm:hidden">AR</span>
      </Button>

      {/* QR Modal for desktop users */}
      <ARQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        assetId={assetId}
        productName={productName}
      />
    </>
  );
}

