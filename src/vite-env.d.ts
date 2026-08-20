/**
 * @doc []
 */
/// <reference types="vite/client" />

// P3-2 PWA：vite-plugin-pwa 注入的虚拟模块 TS 类型声明
//   vite-plugin-pwa 会在构建时真实提供 `virtual:pwa-register` 导出的 registerSW()，
//   开发模式（devOptions.enabled=false）下 src/pwa/registerSW.ts 内部 try/catch 已降级兼容。
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }
  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>
}

interface ImportMetaEnv {
  readonly VITE_LLM_BASE_URL?: string
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_MODEL?: string
  readonly VITE_AKSHARE_BASE_URL?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_QWEN_API_KEY?: string
  readonly VITE_DATA_SOURCE_TYPE?: string
  readonly VITE_TUSHARE_TOKEN?: string
  readonly VITE_LOG_LEVEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
