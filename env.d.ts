/// <reference types="vite/client" />

// `vite/client` declares ImportMetaEnv with an `[key: string]: any` index
// signature, so without this every VITE_* read compiles as `any`.
interface ImportMetaEnv {
  /** Full API base URL including the global prefix and version, no trailing slash. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
