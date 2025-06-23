"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { Save, Download, ArrowLeft } from "lucide-react";

interface HeaderProps {
  onSave?: () => void;
  isSaving?: boolean;
  onExportGLB?: () => void;
  onExportGLTF?: () => void;
  onExportUSDZ?: () => void;
}

export function Header({
  onSave,
  isSaving = false,
  onExportGLB,
  onExportGLTF,
  onExportUSDZ,
}: HeaderProps) {
  const pathname = usePathname();
  const params = useParams();
  const clientName = params?.id as string;

  const isDemoView = pathname?.includes(`/3d-editor/${clientName}/demo`);
  const isEditorMode = !isDemoView;

  return (
    <header className="bg-background flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <div className="flex w-full items-center gap-2">
        {/* Navigation and Action Buttons */}
        <div className="flex items-center space-x-2 ml-4">
          {isDemoView ? (
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

          {/* Export/Save Buttons */}
          {isEditorMode && (
            <>
              {/* Show Save button for client editor view */}
              {onSave && (
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
              )}

              {/* Show Export buttons for regular view (not demo) */}
              {onExportGLB && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportGLB}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  GLB
                </Button>
              )}
              {onExportGLTF && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportGLTF}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  GLTF
                </Button>
              )}
              {onExportUSDZ && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportUSDZ}
                  className="text-xs h-9"
                >
                  <Download size={14} className="mr-2" />
                  USDZ
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
