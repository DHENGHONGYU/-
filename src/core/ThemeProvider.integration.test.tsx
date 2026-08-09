/**
 * ThemeProvider 集成测试
 *
 * 覆盖真实主题切换链路：
 *   ThemeProvider(React Context) ↔ applyTheme(DOM) ↔ localStorage ↔ matchMedia
 *
 * 配合颜色令牌系统，验证 light ↔ dark 主题切换时颜色令牌的正确工作。
 *
 * @module core/ThemeProvider.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import React from 'react'
import { ThemeProvider, useTheme, ThemeToggle } from './ThemeProvider'
import { twText, twBg, twBorder, COLOR_SHADES } from '@/constants/theme.tokens'

// ── DOM 清理 ──
function resetDOM(): void {
  document.documentElement.classList.remove('dark')
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
  // 清理 matchMedia mock
  vi.restoreAllMocks()
}

beforeEach(resetDOM)
afterEach(resetDOM)

// ============================================================
// ThemeProvider 初始化
// ============================================================

describe('ThemeProvider 初始化', () => {
  it('defaultMode=light 时应初始化为亮色模式', () => {
    render(
      <ThemeProvider defaultMode="light">
        <div data-testid="child">content</div>
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('child').textContent).toBe('content')
  })

  it('defaultMode=dark 时应初始化为暗色模式', () => {
    render(
      <ThemeProvider defaultMode="dark">
        <div data-testid="child">content</div>
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('defaultMode=system 且 prefers-color-scheme=light 时应应用亮色', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false, // prefers-color-scheme: dark = false → light
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    render(
      <ThemeProvider defaultMode="system">
        <div />
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('defaultMode=system 且 prefers-color-scheme=dark 时应应用暗色', () => {
    window.matchMedia = vi.fn(() => ({
      matches: true, // prefers-color-scheme: dark = true → dark
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    render(
      <ThemeProvider defaultMode="system">
        <div />
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('localStorage 已存 theme 时优先从存储读取', () => {
    localStorage.setItem('v9-theme', 'dark')
    render(
      <ThemeProvider defaultMode="light">
        <div />
      </ThemeProvider>,
    )
    // 初始时应读取 localStorage 的 dark（不是 defaultMode=light）
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

// ============================================================
// setMode / toggleTheme 功能
// ============================================================

describe('主题切换（setMode / toggleTheme）', () => {
  function Consumer(): React.JSX.Element {
    const ctx = useTheme()
    return (
      <div data-testid="mode">
        <span data-testid="resolved">{ctx.resolvedMode}</span>
        <button data-testid="set-dark" onClick={() => ctx.setMode('dark')}>Set Dark</button>
        <button data-testid="set-light" onClick={() => ctx.setMode('light')}>Set Light</button>
        <button data-testid="set-system" onClick={() => ctx.setMode('system')}>Set System</button>
        <button data-testid="toggle" onClick={ctx.toggleTheme}>Toggle</button>
      </div>
    )
  }
  function makeConsumer() {
    return (
      <ThemeProvider defaultMode="light">
        <Consumer />
      </ThemeProvider>
    )
  }

  it('setMode(dark) 应切换为暗色并更新 DOM', () => {
    render(makeConsumer())
    fireEvent.click(screen.getByTestId('set-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setMode(light) 应切换为亮色并更新 DOM', () => {
    render(makeConsumer())
    fireEvent.click(screen.getByTestId('set-dark'))
    fireEvent.click(screen.getByTestId('set-light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggleTheme 应在 light ↔ dark 之间切换', () => {
    render(makeConsumer())
    // 初始 light
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    // toggle → dark
    fireEvent.click(screen.getByTestId('toggle'))
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    // toggle → light
    fireEvent.click(screen.getByTestId('toggle'))
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setMode 应持久化到 localStorage', () => {
    render(makeConsumer())
    fireEvent.click(screen.getByTestId('set-dark'))
    expect(localStorage.getItem('v9-theme')).toBe('dark')
    fireEvent.click(screen.getByTestId('set-light'))
    expect(localStorage.getItem('v9-theme')).toBe('light')
    fireEvent.click(screen.getByTestId('set-system'))
    expect(localStorage.getItem('v9-theme')).toBe('system')
  })
})

// ============================================================
// useTheme 边界
// ============================================================

describe('useTheme 边界条件', () => {
  it('在 Provider 外部使用时应抛错', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme 必须在 ThemeProvider 内部使用')
  })

  it('renderHook with wrapper: mode/resolvedMode 可用', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultMode="light">{children}</ThemeProvider>,
    })
    expect(result.current.mode).toBe('light')
    expect(result.current.resolvedMode).toBe('light')
  })

  it('renderHook with wrapper: toggleTheme 后 state 更新', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultMode="light">{children}</ThemeProvider>,
    })
    act(() => result.current.toggleTheme())
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolvedMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

// ============================================================
// 真实场景：ThemeToggle 按钮组件
// ============================================================

describe('ThemeToggle 按钮组件（真实场景）', () => {
  it('初始 light → 点击应切换为 dark', () => {
    render(
      <ThemeProvider defaultMode="light">
        <ThemeToggle />
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: /切换到暗色/i })
    fireEvent.click(btn)
    // aria-label 应变为"切换到亮色模式"
    const newBtn = screen.getByRole('button', { name: /切换到亮色/i })
    expect(newBtn).toBeDefined()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('初始 dark → 点击应切换为 light', () => {
    render(
      <ThemeProvider defaultMode="dark">
        <ThemeToggle />
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: /切换到亮色/i })
    fireEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('children render prop 可自定义渲染', () => {
    render(
      <ThemeProvider defaultMode="dark">
        <ThemeToggle>
          {(ctx) => (
            <div data-testid="custom">
              <span data-testid="ctx-mode">{ctx.mode}</span>
              <button data-testid="ctx-toggle" onClick={ctx.toggleTheme}>
                Click
              </button>
            </div>
          )}
        </ThemeToggle>
      </ThemeProvider>,
    )
    expect(screen.getByTestId('ctx-mode').textContent).toBe('dark')
    fireEvent.click(screen.getByTestId('ctx-toggle'))
    expect(screen.getByTestId('ctx-mode').textContent).toBe('light')
  })
})

// ============================================================
// 系统主题变化监听（mode=system）
// ============================================================

describe('系统主题变化监听（mode=system）', () => {
  it('mode=system 时 matchMedia change 事件应更新 DOM', () => {
    let capturedHandler: (() => void) | undefined
    const addEventListenerSpy = vi.fn((_event: string, handler: () => void) => {
      capturedHandler = handler
    })
    let matches = false // 初始 light
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return matches
      },
      media: '(prefers-color-scheme: dark)',
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    render(
      <ThemeProvider defaultMode="system">
        <div />
      </ThemeProvider>,
    )
    // 初始 light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(capturedHandler).toBeDefined()

    // 模拟系统切换为 dark：matchMedia 从外部变化
    matches = true
    act(() => capturedHandler!())
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // 再切换回 light
    matches = false
    act(() => capturedHandler!())
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

// ============================================================
// 真实场景：颜色令牌 + 主题切换联动
// ============================================================

describe('颜色令牌系统 + 主题切换联动（集成）', () => {
  /**
   * 模拟 TradeReviewPage 修复场景：
   * 绿色=真实行情（dataSource=real），琥珀色=模拟行情（dataSource=demo）
   * 组件同时使用基础类名和 dark 变体
   */
  function DataSourceBadge(): React.JSX.Element {
    const ctx = useTheme()
    const realClass = twText('green', 500)
    const demoClass = twText('amber', 500)
    const darkVariant = COLOR_SHADES.green?.['200Dark'] ?? 'dark:text-green-200'
    return (
      <div data-testid="badge">
        <span data-testid="theme-mode">{ctx.resolvedMode}</span>
        <span data-testid="real-class" className={`${realClass} ${darkVariant}`}>
          真实行情
        </span>
        <span data-testid="demo-class" className={demoClass}>
          模拟数据（采集失败降级）
        </span>
        <button data-testid="toggle-theme" onClick={ctx.toggleTheme}>
          Toggle
        </button>
      </div>
    )
  }

  it('light mode 下 className 包含基础类名 + dark 变体', () => {
    render(
      <ThemeProvider defaultMode="light">
        <DataSourceBadge />
      </ThemeProvider>,
    )
    const realEl = screen.getByTestId('real-class')
    const demoEl = screen.getByTestId('demo-class')
    expect(realEl.className).toContain('text-green-500')
    expect(realEl.className).toContain('dark:text-green-')
    expect(demoEl.className).toContain('text-amber-500')
  })

  it('切换到 dark mode 后：基础类名保持不变，dark 变体可同时生效', () => {
    render(
      <ThemeProvider defaultMode="light">
        <DataSourceBadge />
      </ThemeProvider>,
    )
    // 记录切换前的基础类名
    const realClassBefore = screen.getByTestId('real-class').className
    expect(realClassBefore).toContain('text-green-500')
    expect(screen.getByTestId('theme-mode').textContent).toBe('light')

    // 通过按钮切换 theme（避免 unmount 触发 beforeEach 清 DOM）
    fireEvent.click(screen.getByTestId('toggle-theme'))

    // DOM 属性确认 dark
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByTestId('theme-mode').textContent).toBe('dark')
    // 组件内基础类名不变
    expect(screen.getByTestId('real-class').className).toContain('text-green-500')
    expect(screen.getByTestId('real-class').className).toContain('dark:text-green-')
    // demo 类名不变
    expect(screen.getByTestId('demo-class').className).toContain('text-amber-500')
  })

  it('切换到 dark mode 后：dark 变体类名应与 Tailwind dark: 前缀一致', () => {
    render(
      <ThemeProvider defaultMode="dark">
        <DataSourceBadge />
      </ThemeProvider>,
    )
    const realEl = screen.getByTestId('real-class')
    // dark 变体必须包含 'dark:text-' 前缀
    expect(realEl.className).toMatch(/dark:text-green-\d+/)
  })

  it('twText/twBg/twBorder 在 Provider 内部使用时返回正确类名', () => {
    function UsageCheck() {
      return (
        <div
          data-testid="usage"
          className={`${twText('green', 500)} ${twBg('red', 600)} ${twBorder('red', 200)}`}
        />
      )
    }
    render(
      <ThemeProvider defaultMode="light">
        <UsageCheck />
      </ThemeProvider>,
    )
    const el = screen.getByTestId('usage')
    expect(el.className).toContain('text-green-500')
    expect(el.className).toContain('bg-red-600')
    expect(el.className).toContain('border-red-200')
  })
})
