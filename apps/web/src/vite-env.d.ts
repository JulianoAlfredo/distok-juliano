/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API em produção (ex.: https://api.distok.com.br/api/v1). Opcional. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
