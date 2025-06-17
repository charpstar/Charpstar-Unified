// src/components/layout/Header.tsx
"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Save, Download, ArrowLeft } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { isValidClient } from "@/config/clientConfig";

interface HeaderProps {
  onExportGLB?: () => void;
  onExportGLTF?: () => void;
  onExportUSDZ?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  modelViewerRef?: React.RefObject<any>;
}

const Header: React.FC<HeaderProps> = ({
  onExportGLB,
  onExportGLTF,
  onExportUSDZ,
  onSave,
  isSaving = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  modelViewerRef,
}) => {
  const params = useParams();
  const pathname = usePathname();
  const clientName = params?.id as string;
  const isClientView = isValidClient(clientName);
  const isDemoView = pathname?.includes(`/3d-editor/${clientName}/demo`);

  // Determine if in editor or demo mode
  const isEditorMode = isClientView && !isDemoView;
  const isDemoMode = isClientView && isDemoView;

  return (
    <header className="h-12 bg-card text-foreground flex items-center justify-between px-6 border-b border-border shadow-sm w-full">
      <div className="flex items-center space-x-4">
        {/* Navigation between editor and demo */}
        {isClientView && (
          <div className="mr-4">
            {isDemoMode ? (
              <Link href={`/3d-editor/${clientName}`}>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  <ArrowLeft size={14} className="mr-2" />
                  Back to Editor
                </Button>
              </Link>
            ) : (
              <Link href={`/3d-editor/${clientName}/demo`}>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  View Demo Catalog
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Export/Save Buttons */}
        <div className="flex space-x-3">
          {isEditorMode ? (
            // Show Save button for client editor view
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="text-xs h-7 px-3"
            >
              <Save size={14} className="mr-2" />
              {isSaving ? "Saving..." : "Save Changes to Live"}
            </Button>
          ) : (
            !isDemoMode && (
              // Show Export buttons for regular view (not demo)
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportGLB}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  GLB
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportGLTF}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  GLTF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportUSDZ}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  USDZ
                </Button>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
