import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useThemeStore, initSystemThemeListener } from './themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({
      mode: 'system',
      resolvedMode: 'light',
      hydrated: false,
    })
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
  })

  it('默认模式应为 system', () => {
    const state = useThemeStore.getState()
    expect(state.mode).toBe('system')
  })

  it('setMode 应更新 mode 和 resolvedMode 并应用 DOM 属性', () => {
    useThemeStore.getState().setMode('dark')
    const state = useThemeStore.getState()
    expect(state.mode).toBe('dark')
    expect(state.resolvedMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggleTheme 应在 light/dark 之间切换', () => {
    useThemeStore.setState({ mode: 'light', resolvedMode: 'light' })
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(useThemeStore.getState().resolvedMode).toBe('dark')

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().mode).toBe('light')
    expect(useThemeStore.getState().resolvedMode).toBe('light')
  })

  it('cycleMode 应按 light → dark → system 循环', () => {
    useThemeStore.setState({ mode: 'light', resolvedMode: 'light' })
    useThemeStore.getState().cycleMode()
    expect(useThemeStore.getState().mode).toBe('dark')

    useThemeStore.getState().cycleMode()
    expect(useThemeStore.getState().mode).toBe('system')

    useThemeStore.getState().cycleMode()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('应持久化 mode 到 localStorage', () => {
    useThemeStore.getState().setMode('dark')
    expect(localStorage.getItem('v9-theme')).toBe('dark')
  })

  it('markHydrated 应设置 hydrated 为 true', () => {
    useThemeStore.getState().markHydrated()
    expect(useThemeStore.getState().hydrated).toBe(true)
  })

  it('system 模式下应监听系统主题变化', () => {
    const addEventListenerSpy = vi.fn()
    const removeEventListenerSpy = vi.fn()
    const originalMatchMedia = window.matchMedia

    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const unsubscribe = initSystemThemeListener()
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))

    unsubscribe()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))

    window.matchMedia = originalMatchMedia
  })

  it('system 模式下解析应遵循 prefers-color-scheme', () => {
    const darkMatcher = vi.fn(() => ({ matches: true } as MediaQueryList))
    window.matchMedia = darkMatcher as unknown as typeof window.matchMedia

    useThemeStore.getState().setMode('system')
    expect(useThemeStore.getState().resolvedMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList)) as unknown as typeof window.matchMedia
  })
})
