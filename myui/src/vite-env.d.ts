/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the backend (BFF), used by the deployed build. When
   * unset (local dev) requests use the relative `/bff` prefix served through
   * the Vite dev proxy.
   */
  readonly VITE_BACKEND_URL?: string;
  /** Optional override for the backend path prefix (defaults to /bff). */
  readonly VITE_BFF_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
