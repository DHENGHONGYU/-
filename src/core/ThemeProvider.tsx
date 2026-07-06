import React, { createContext, useContext, useEffect, useState } from 'react'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 主题类型
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * 主题上下文值
 */
interface ThemeContextValue {
  /** 当前主题模式 */
  mode: ThemeMode
  /** 实际应用的主题（解析 system 后） */
  resolvedMode: 'light' | 'dark'
  /** 设置主题模式 */
  setMode: (mode: ThemeMode) => void
  /** 切换主题 */
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * 获取系统主题偏好
 */
function getSystemThemePreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 从 localStorage 读取保存的主题
 */
function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null
  }
  const stored = localStorage.getItem('v9-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return null
}

/**
 * 保存主题到 localStorage
 */
function storeTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem('v9-theme', mode)
}

/**
 * 应用主题到 DOM
 */
function applyTheme(resolvedMode: 'light' | 'dark'): void {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedMode)
  
  // 同时设置 class 以兼容 Tailwind darkMode: 'class'
  if (resolvedMode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  
  logger.info('[ThemeProvider] 主题已应用', { theme: resolvedMode })
}

/**
 * ThemeProvider 属性
 */
interface ThemeProviderProps {
  children: React.ReactNode
  /** 默认主题模式 */
  defaultMode?: ThemeMode
}

/**
 * 主题提供者组件
 * 
 * @description
 * 提供主题上下文，管理 light/dark/system 主题切换。
 * 主题偏好保存在 localStorage 中，支持系统主题检测。
 * 
 * @example
 * ```tsx
 * <ThemeProvider defaultMode="system">
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children, defaultMode = 'system' }: ThemeProviderProps): React.JSX.Element {
  // 初始化主题状态
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return getStoredTheme() ?? defaultMode
  })

  // 解析实际主题模式
  const resolvedMode = mode === 'system' ? getSystemThemePreference() : mode

  // 应用主题到 DOM
  useEffect(() => {
    applyTheme(resolvedMode)
    storeTheme(mode)
  }, [mode, resolvedMode])

  // 监听系统主题变化
  useEffect(() => {
    if (mode !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (): void => {
      const newSystemTheme = mediaQuery.matches ? 'dark' : 'light'
      applyTheme(newSystemTheme)
      logger.info('[ThemeProvider] 系统主题变化', { theme: newSystemTheme })
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mode])

  // 设置主题模式
  const setMode = (newMode: ThemeMode): void => {
    logger.info('[ThemeProvider] 设置主题模式', { mode: newMode })
    setModeState(newMode)
  }

  // 切换主题（light <-> dark）
  const toggleTheme = (): void => {
    const newMode = resolvedMode === 'light' ? 'dark' : 'light'
    logger.info('[ThemeProvider] 切换主题', { from: resolvedMode, to: newMode })
    setModeState(newMode)
  }

  const contextValue: ThemeContextValue = {
    mode,
    resolvedMode,
    setMode,
    toggleTheme,
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * 使用主题上下文 Hook
 * 
 * @throws Error 如果在 ThemeProvider 外部使用
 * 
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { mode, resolvedMode, toggleTheme } = useTheme()
 *   return (
 *     <button onClick={toggleTheme}>
 *       当前主题: {resolvedMode}
 *     </button>
 *   )
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme 必须在 ThemeProvider 内部使用')
  }
  return context
}

/**
 * 主题切换按钮组件（可选）
 */
interface ThemeToggleProps {
  /** 自定义渲染函数 */
  children?: (context: ThemeContextValue) => React.ReactNode
}

export function ThemeToggle({ children }: ThemeToggleProps): React.JSX.Element {
  const themeContext = useTheme()

  if (children) {
    return <>{children(themeContext)}</>
  }

  return (
    <button
      type="button"
      onClick={themeContext.toggleTheme}
      className="inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={`切换到${themeContext.resolvedMode === 'light' ? '暗色' : '亮色'}模式`}
    >
      {themeContext.resolvedMode === 'light' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  )
}
