"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";

interface ARQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  productName: string;
}

export function ARQRModal({
  isOpen,
  onClose,
  assetId,
  productName,
}: ARQRModalProps) {
  // Generate the public AR URL
  const arUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/ar/${assetId}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            View in AR
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg border-2 border-border">
            <QRCodeSVG
              value={arUrl}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              {productName}
            </p>
            <p className="text-xs text-muted-foreground">
              Scan this QR code with your mobile device to view this product in
              Augmented Reality
            </p>
          </div>

          {/* Platform Support Info */}
          <div className="w-full bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">
              Supported Platforms:
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• iOS: AR Quick Look (iPhone/iPad)</li>
              <li>• Android: Scene Viewer (ARCore devices)</li>
            </ul>
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

