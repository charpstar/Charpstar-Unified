declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "interaction-prompt"?: string;
          ar?: boolean;
          "ar-modes"?: string;
          "ar-scale"?: string;
          "environment-image"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "alpha-channel"?: string;
          "background-color"?: string;
          "field-of-view"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
