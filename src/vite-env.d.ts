/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MESHY_API_KEY?: string;
  readonly VITE_MESHY_API_BASE?: string;
  readonly VITE_WORLDLABS_API_KEY?: string;
  readonly VITE_WORLDLABS_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
