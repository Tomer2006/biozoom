/**
 * Vite and module type declarations: CSS/SVG module types and Window extensions
 * used for React integration (canvas ref, loading/progress callbacks).
 */
/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

interface Window {
  gc?: () => void;
}

