declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        "disable-pan"?: boolean;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string;
        "environment-image"?: string;
        exposure?: string;
        "tone-mapping"?: string;
        "camera-orbit"?: string;
        "camera-controls"?: boolean;
        "ar-status"?: string;
        "shadow-softness"?: string;
        "min-field-of-view"?: string;
        "max-field-of-view"?: string;
        onLoad?: (event: any) => void;
        onClick?: (event: any) => void;
        ref?: React.RefObject<any>;
        resetCamera?: () => void;
      },
      HTMLElement
    >;
  }
}

interface ModelViewerElement extends HTMLElement {
  src: string;
  autoRotate: boolean;
  cameraOrbit: string;
  loaded: boolean;
  exportGLB: () => void;
  exportGLTF: () => void;
  exportUSDZ: () => void;
  getModelStructure: () => any;
  requestRender: () => void;
  toDataURL: () => Promise<string>;
  resetCamera: () => void;
}

declare global {
  interface Window {
    modelViewerElement: any;
    currentFileName: string;
  }
}

export {};
