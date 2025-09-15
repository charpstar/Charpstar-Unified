"use client";

import React from "react";

// 3D Editor Context
interface Editor3DContextType {
  onExportGLB?: () => void;
  onExportGLTF?: () => void;
  onExportUSDZ?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  modelViewerRef?: React.RefObject<any>;
}

const Editor3DContext = React.createContext<Editor3DContextType | undefined>(
  undefined
);

export function Editor3DProvider({
  children,
  ...props
}: {
  children: React.ReactNode;
} & Editor3DContextType) {
  return (
    <Editor3DContext.Provider value={props}>
      {children}
    </Editor3DContext.Provider>
  );
}

export function useEditor3D() {
  const context = React.useContext(Editor3DContext);
  if (context === undefined) {
    return {};
  }
  return context;
}
