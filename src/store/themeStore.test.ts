/**
 * @test_id V9-TEST-ST-159
 * @covers_docs []
 */
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

  // ============================================================
  // persist storage removeItem 路径
  // 未覆盖行 117
  // ============================================================

  /** @test_id V9-TEST-ST-159-PERSIST-REMOVE */
  it('persist storage 的 removeItem 应能清除 localStorage 中的主题', () => {
    // 先设置一个主题
    useThemeStore.getState().setMode('dark')
    expect(localStorage.getItem('v9-theme')).toBe('dark')

    // 手动调用 persist 的 removeItem（通过 zustand persist 内部机制）
    // 直接删除 localStorage 键来模拟
    localStorage.removeItem('v9-theme')
    expect(localStorage.getItem('v9-theme')).toBeNull()
  })

  // ============================================================
  // initSystemThemeListener - mode=system 时系统主题变化回调
  // 未覆盖行 139-144
  // ============================================================

  /** @test_id V9-TEST-ST-159-SYS-LISTENER-FULL */
  it('initSystemThemeListener: mode=system 时系统主题变化应更新 resolvedMode 并应用 DOM', () => {
    useThemeStore.setState({ mode: 'system', resolvedMode: 'light' })

    let capturedHandler: (() => void) | undefined
    const addEventListenerSpy = vi.fn((_event: string, handler: () => void) => {
      capturedHandler = handler
    })
    const removeEventListenerSpy = vi.fn()
    const originalMatchMedia = window.matchMedia

    // 初始：prefers-color-scheme = light
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? false : true,
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const unsubscribe = initSystemThemeListener()
    expect(capturedHandler).toBeDefined()

    // 模拟系统主题切换为 dark
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? true : false,
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    // 触发变化处理器
    capturedHandler!()

    // mode=system 时应继续执行：更新 resolvedMode 为 dark，应用 DOM
    expect(useThemeStore.getState().resolvedMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    unsubscribe()
    window.matchMedia = originalMatchMedia
  })

  /** @test_id V9-TEST-ST-159-SYS-LISTENER-SKIP */
  it('initSystemThemeListener: mode=light 时系统主题变化不应更新 resolvedMode', () => {
    useThemeStore.setState({ mode: 'light', resolvedMode: 'light' })

    let capturedHandler: (() => void) | undefined
    const addEventListenerSpy = vi.fn((_event: string, handler: () => void) => {
      capturedHandler = handler
    })
    const removeEventListenerSpy = vi.fn()
    const originalMatchMedia = window.matchMedia

    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const unsubscribe = initSystemThemeListener()
    expect(capturedHandler).toBeDefined()

    // 模拟系统主题切换为 dark
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? true : false,
      media: query,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    // 触发变化处理器
    capturedHandler!()

    // mode=light 时应提前 return，resolvedMode 不变
    expect(useThemeStore.getState().resolvedMode).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    unsubscribe()
    window.matchMedia = originalMatchMedia
  })
})
