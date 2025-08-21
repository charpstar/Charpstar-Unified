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
        "auto-rotate"?: boolean;
        "ar-status"?: string;
        "shadow-softness"?: string;
        "min-field-of-view"?: string;
        "max-field-of-view"?: string;
        onLoad?: (event: any) => void;
        onClick?: (event: any) => void;
        ref?: React.RefObject<any>;
      },
      HTMLElement
    >;
  }
}

interface ModelViewerElement extends HTMLElement {
  src: string;
  exportGLB: () => void;
  exportGLTF: () => void;
  exportUSDZ: () => void;
  getModelStructure: () => any;
  requestRender: () => void;
}

declare global {
  interface Window {
    modelViewerElement: any;
    currentFileName: string;
  }
}

export {};
