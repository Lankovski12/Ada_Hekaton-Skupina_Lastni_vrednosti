/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_USE_MOCK?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
