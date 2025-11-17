/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ID: string
  readonly VITE_API_HASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
