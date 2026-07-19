import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeState {
  /** 用户选择的主题模式 */
  mode: ThemeMode
  /** 实际解析后的主题（system 会被解析为 light/dark） */
  resolvedMode: 'light' | 'dark'
  /** 是否已完成 hydrate（避免 SSR/首屏闪烁） */
  hydrated: boolean
  /** 设置主题模式 */
  setMode: (mode: ThemeMode) => void
  /** 在 light / dark 之间切换（system 按 resolvedMode 切换） */
  toggleTheme: () => void
  /** 按 light → dark → system 循环切换 */
  cycleMode: () => void
  /** 标记 hydrate 完成 */
  markHydrated: () => void
}

const STORAGE_KEY = 'v9-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyTheme(resolvedMode: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedMode)
  if (resolvedMode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  logger.info('[themeStore] 主题已应用', { theme: resolvedMode })
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    logger.info('[themeStore] 从 localStorage 恢复主题设置', { mode: stored })
    return stored
  }
  logger.info('[themeStore] 未找到持久化主题，使用 system')
  return 'system'
}

function applyStoredThemeOnLoad(): ThemeMode {
  const mode = readStoredMode()
  applyTheme(resolveMode(mode))
  return mode
}

/**
 * useThemeStore
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: applyStoredThemeOnLoad(),
      resolvedMode: resolveMode(applyStoredThemeOnLoad()),
      hydrated: false,
      setMode: (mode) => {
        const resolvedMode = resolveMode(mode)
        applyTheme(resolvedMode)
        logger.info('[themeStore] setMode', { mode, resolvedMode })
        set({ mode, resolvedMode })
      },
      toggleTheme: () => {
        const { resolvedMode } = get()
        const mode = resolvedMode === 'light' ? 'dark' : 'light'
        applyTheme(mode)
        logger.info('[themeStore] toggleTheme', { from: resolvedMode, to: mode })
        set({ mode, resolvedMode: mode })
      },
      cycleMode: () => {
        const { mode } = get()
        const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
        const resolvedMode = resolveMode(next)
        applyTheme(resolvedMode)
        logger.info('[themeStore] cycleMode', { from: mode, to: next, resolvedMode })
        set({ mode: next, resolvedMode })
      },
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ mode: state.mode }),
      storage: {
        getItem: (name) => {
          const value = localStorage.getItem(name)
          return value === 'light' || value === 'dark' || value === 'system'
            ? { state: { mode: value }, version: 0 }
            : null
        },
        setItem: (name, value) => {
          const mode = (value as { state?: { mode?: ThemeMode } }).state?.mode
          if (mode) {
            localStorage.setItem(name, mode)
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolvedMode = resolveMode(state.mode)
          applyTheme(resolvedMode)
          state.resolvedMode = resolvedMode
          state.hydrated = true
          logger.info('[themeStore] rehydrate 完成', { mode: state.mode, resolvedMode })
        }
      },
    },
  ),
)

/**
 * 监听系统主题变化（仅当 mode === 'system' 时生效）
 */
export function initSystemThemeListener(): () => void {
  if (typeof window === 'undefined') return () => {}
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = (): void => {
    const { mode } = useThemeStore.getState()
    if (mode !== 'system') return
    const resolvedMode = getSystemTheme()
    applyTheme(resolvedMode)
    useThemeStore.setState({ resolvedMode })
    logger.info('[themeStore] 系统主题变化', { resolvedMode })
  }
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
