/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USAR_EMULADORES?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_DOMINIO_PERMITIDO?: string
  readonly VITE_MICROSOFT_TENANT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
