/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSCRIPTION_LANGUAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
