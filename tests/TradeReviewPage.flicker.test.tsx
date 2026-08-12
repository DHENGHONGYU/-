/**
 * @fileoverview TradeReviewPage 深色模式闪烁检测运行时检查测试
 * @description 模拟 MutationObserver 捕获 class 频繁变化、延迟同步、
 *              颜色令牌不一致等闪烁场景，验证运行时检查机制能正确报警。
 *
 * 测试策略：
 *   1. Mock MutationObserver — 跟踪所有实例，通过 observe target 区分
 *      组件 observer 与 @testing-library 内部 observer
 *   2. Mock performance.now — 模拟切换耗时超过阈值
 *   3. Mock logger.warn — 捕获告警调用用于断言
 *   4. Mock useThemeStore — 控制 resolvedMode 变化触发 useEffect
 *
 * 注意：@testing-library 的 waitFor 内部使用 MutationObserver，会与全局 mock 冲突。
 *      因此本测试避免使用 waitFor，改用 act() + setTimeout 同步等待 effect 执行。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import React from 'react'

// ============================================================
// Mock: logger — 捕获 warn/debug 调用
// ============================================================
const mockWarn = vi.hoisted(() => vi.fn())
const mockDebug = vi.hoisted(() => vi.fn())
const mockInfo = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: mockInfo,
    error: vi.fn(),
    warn: mockWarn,
    debug: mockDebug,
  }),
}))

// ============================================================
// 使用真实 useThemeStore — 通过 setState 触发重渲染
// 不 mock themeStore，让 Zustand 的 useSyncExternalStore 机制正常工作
// ============================================================
import { useThemeStore } from '@/store/themeStore'

// ============================================================
// Mock: 其他依赖（与 TradeReviewPage.test.tsx 一致）
// ============================================================
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/hooks/usePageGuard', () => ({
  usePageGuard: () => ({ guardProps: { disabled: false } }),
}))
vi.mock('@/components/organisms/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/organisms/output/ReviewArtifactModal', () => ({
  ReviewArtifactModal: () => null,
}))
vi.mock('@/components/organisms/output/BuySellPointReviewPanel', () => ({
  BuySellPointReviewPanel: () => null,
}))
vi.mock('@/components/chart', () => ({
  CandlestickChart: () => null,
}))
vi.mock('@/services/fetcher/fetcherClient', () => ({
  collectKline: vi.fn().mockResolvedValue({ success: false, data: null }),
}))
// 使用稳定引用避免每次渲染创建新对象导致无限重渲染
const mockDisciplineState = vi.hoisted(() => ({
  value: {
    latestReport: null as unknown,
    loadOrders: vi.fn().mockResolvedValue([]),
    generateReviewReport: vi.fn(),
    refresh: vi.fn(),
  },
}))
vi.mock('@/store/disciplineStore', () => ({
  useDisciplineStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockDisciplineState.value) : mockDisciplineState.value
  },
}))

// ============================================================
// Mock: MutationObserver — 跟踪所有实例，通过 observe target 区分
// ============================================================
interface MockObserverInstance {
  callback: (mutations: MutationRecord[]) => void
  observeTarget: Node | null
  observeOptions: MutationObserverInit | null
  disconnected: boolean
}

let observerInstances: MockObserverInstance[]
const OriginalMutationObserver = global.MutationObserver

beforeEach(() => {
  observerInstances = []
  global.MutationObserver = vi.fn().mockImplementation((callback: (mutations: MutationRecord[]) => void) => {
    const instance: MockObserverInstance = {
      callback,
      observeTarget: null,
      observeOptions: null,
      disconnected: false,
    }
    observerInstances.push(instance)
    return {
      observe: vi.fn((target: Node, options: MutationObserverInit) => {
        instance.observeTarget = target
        instance.observeOptions = options
      }),
      disconnect: vi.fn(() => {
        instance.disconnected = true
      }),
    }
  }) as unknown as typeof MutationObserver
})

afterEach(() => {
  global.MutationObserver = OriginalMutationObserver
})

/** 找到组件创建的 MutationObserver（观察 document.documentElement 的 class 属性） */
function findComponentObserver(): MockObserverInstance | undefined {
  return observerInstances.find(
    (o) =>
      o.observeTarget === document.documentElement &&
      o.observeOptions?.attributeFilter?.includes('class'),
  )
}

// ============================================================
// Mock: performance.now — 可控制耗时
// ============================================================
const originalPerformanceNow = performance.now
let mockTimeValue = 0
let perfCallCount = 0

function setMockTime(ms: number): void {
  mockTimeValue = ms
}

beforeEach(() => {
  mockTimeValue = 0
  perfCallCount = 0
  performance.now = vi.fn(() => {
    perfCallCount++
    // 奇数次调用返回 startTime（0），偶数次返回 mockTimeValue
    return perfCallCount % 2 === 1 ? 0 : mockTimeValue
  }) as typeof performance.now
})

afterEach(() => {
  performance.now = originalPerformanceNow
})

// ============================================================
// 辅助函数
// ============================================================

/** 构造 class 属性变化 MutationRecord */
function createClassMutation(): MutationRecord {
  return {
    type: 'attributes',
    attributeName: 'class',
    oldValue: null,
    target: document.documentElement,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    nextSibling: null,
    previousSibling: null,
  } as MutationRecord
}

/** 等待微任务 + 定时器刷新（避免 act 导致无限重渲染） */
function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

/** 延迟导入，确保 mock 生效 */
const TradeReviewPage = (await import('@/pages/output/TradeReviewPage')).default

// ============================================================
// 测试用例
// ============================================================

describe('TradeReviewPage - 深色模式闪烁检测', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置真实 store 状态
    useThemeStore.setState({ resolvedMode: 'light', mode: 'light', hydrated: false })
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
    setMockTime(0)
  })

  // ----------------------------------------------------------
  // 场景 1：class 频繁变化导致闪烁
  // 模拟 dark → 移除 → 重新添加 的频繁切换
  // 预期：classChangeCount > 1，logger.warn 捕获"多次 class 变化"
  // ----------------------------------------------------------
  it('模拟 class 频繁变化导致闪烁：应捕获多次 class 变化警告', async () => {
    // 初始渲染 resolvedMode='light'
    render(
      <MemoryRouter>
        <TradeReviewPage />
      </MemoryRouter>,
    )
    await flushEffects()

    // 初始渲染时 prevMode === resolvedMode，不触发检查 → 无组件 observer
    expect(findComponentObserver()).toBeUndefined()

    // 模拟主题切换：resolvedMode 从 'light' 变为 'dark'
    // 使用真实 store 的 setState，Zustand 会自动触发组件重渲染
    useThemeStore.setState({ resolvedMode: 'dark', mode: 'dark' })
    await flushEffects()

    // 组件应已创建 MutationObserver
    const observer = findComponentObserver()
    expect(observer).toBeDefined()

    // 模拟 class 频繁变化：第 1 次变化（添加 dark）
    document.documentElement.classList.add('dark')
    observer!.callback([createClassMutation()])

    // 第 1 次回调：classChangeCount=1，不触发 >1 警告
    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('多次 class 变化'),
      expect.anything(),
    )

    // 模拟 class 频繁变化：第 2 次变化（移除 dark → 闪烁！）
    document.documentElement.classList.remove('dark')
    observer!.callback([createClassMutation()])

    // 第 2 次回调：classChangeCount=2，触发闪烁警告
    expect(mockWarn).toHaveBeenCalledWith(
      '[TradeReviewPage] 深色模式颜色令牌切换检测到多次 class 变化，存在视觉闪烁',
      expect.objectContaining({
        resolvedMode: 'dark',
        classChangeCount: 2,
      }),
    )
  })

  // ----------------------------------------------------------
  // 场景 2：切换耗时超过阈值（50ms）
  // 模拟 class 变化在 50ms 后才发生
  // 预期：elapsed > FLICKER_THRESHOLD_MS，logger.warn 捕获"耗时过长"
  // ----------------------------------------------------------
  it('模拟切换耗时过长：应捕获延迟同步警告', async () => {
    render(
      <MemoryRouter>
        <TradeReviewPage />
      </MemoryRouter>,
    )
    await flushEffects()

    // 模拟主题切换
    useThemeStore.setState({ resolvedMode: 'dark', mode: 'dark' })
    await flushEffects()

    const observer = findComponentObserver()
    expect(observer).toBeDefined()

    // 模拟 class 变化耗时 80ms（超过 50ms 阈值）
    document.documentElement.classList.add('dark')
    setMockTime(80)
    observer!.callback([createClassMutation()])

    expect(mockWarn).toHaveBeenCalledWith(
      '[TradeReviewPage] 深色模式颜色令牌切换耗时过长，可能存在视觉闪烁',
      expect.objectContaining({
        resolvedMode: 'dark',
        elapsedMs: 80,
        threshold: 50,
      }),
    )
  })

  // ----------------------------------------------------------
  // 场景 3：颜色令牌 class 与预期主题不一致
  // 切换到 dark 但 class 未包含 dark → 颜色令牌未正确切换
  // 预期：hasDarkClass !== expectedHasDark，logger.warn 捕获"不一致"
  // ----------------------------------------------------------
  it('颜色令牌 class 与预期不一致：应捕获同步性警告', async () => {
    render(
      <MemoryRouter>
        <TradeReviewPage />
      </MemoryRouter>,
    )
    await flushEffects()

    // 模拟主题切换到 dark
    useThemeStore.setState({ resolvedMode: 'dark', mode: 'dark' })
    await flushEffects()

    const observer = findComponentObserver()
    expect(observer).toBeDefined()

    // 确保暗色样式类未添加（模拟颜色令牌未切换）
    document.documentElement.classList.remove('dark')
    setMockTime(10)
    observer!.callback([createClassMutation()])

    expect(mockWarn).toHaveBeenCalledWith(
      '[TradeReviewPage] 颜色令牌 class 与预期主题不一致',
      expect.objectContaining({
        resolvedMode: 'dark',
        expectedHasDark: true,
        actualHasDarkClass: false,
      }),
    )
  })

  // ----------------------------------------------------------
  // 场景 4：正常切换无闪烁
  // 切换到 dark 且 class 正确添加，耗时 < 50ms
  // 预期：无 warn 调用
  // ----------------------------------------------------------
  it('正常切换无闪烁：不应触发任何警告', async () => {
    render(
      <MemoryRouter>
        <TradeReviewPage />
      </MemoryRouter>,
    )
    await flushEffects()

    // 模拟正常主题切换
    useThemeStore.setState({ resolvedMode: 'dark', mode: 'dark' })
    await flushEffects()

    const observer = findComponentObserver()
    expect(observer).toBeDefined()

    // 正常切换：class 正确添加，耗时 < 50ms
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    setMockTime(10)
    observer!.callback([createClassMutation()])

    // 等待可能的微任务
    await flushEffects()

    // 不应有任何 warn 调用
    expect(mockWarn).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // 场景 5：主题未实际变化时不触发检查
  // resolvedMode 保持不变 → useEffect 提前 return
  // 预期：MutationObserver 未创建
  // ----------------------------------------------------------
  it('主题未变化时不触发闪烁检查：不应创建组件 MutationObserver', async () => {
    render(
      <MemoryRouter>
        <TradeReviewPage />
      </MemoryRouter>,
    )
    await flushEffects()

    // 初始渲染时 resolvedMode='light'，prevMode 也='light'，不触发检查
    // 应无组件 observer（观察 document.documentElement class 属性的）
    expect(findComponentObserver()).toBeUndefined()
  })
})
