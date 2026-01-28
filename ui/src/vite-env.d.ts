/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATSIG_CLIENT_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
