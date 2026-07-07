/**
 * @fileoverview 通用测试辅助工具
 * @description 提供 renderWithProviders、resetStoreState 等高频工具函数
 *
 * 设计原则：
 * - 工具函数纯函数化，避免全局副作用
 * - resetStoreState 采用"按需导入"模式，避免 setup.ts 引入所有 Store
 * - renderWithProviders 默认包装 ThemeProvider，支持按需扩展
 *
 * 使用示例：
 * ```typescript
 * import { renderWithProviders, resetStoreState } from '../utils/testHelpers'
 * import { useAnalysisStore } from '@/store/analysisStore'
 *
 * beforeEach(() => {
 *   resetStoreState(useAnalysisStore, { isLoading: false, data: [] })
 * })
 *
 * it('应渲染标题', () => {
 *   const { getByText } = renderWithProviders(<MyPage />)
 *   expect(getByText('标题')).toBeInTheDocument()
 * })
 * ```
 */

import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'

// ============================================================
// renderWithProviders：带 ThemeProvider 的渲染辅助
// ============================================================

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** 是否启用暗色主题（默认 false） */
  darkMode?: boolean
}

/**
 * 带默认 Provider 的 render 包装
 *
 * @param ui 待渲染的 React 元素
 * @param options 渲染选项（含 darkMode 主题切换）
 * @returns Testing Library 的 render 返回值
 *
 * @example
 * ```typescript
 * const { getByText } = renderWithProviders(<MyPage />, { darkMode: true })
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { darkMode = false, ...renderOptions } = options

  // 通过 data-theme 属性模拟主题切换（避免引入 ThemeProvider 复杂依赖）
  const wrapper = ({ children }: { children: ReactNode }) => (
    <div data-theme={darkMode ? 'dark' : 'light'}>{children}</div>
  )

  return render(ui, { wrapper, ...renderOptions })
}

// ============================================================
// resetStoreState：Zustand Store 状态重置工具
// ============================================================

/**
 * 重置单个 Zustand Store 的状态
 *
 * 解决 Zustand store 状态跨测试持久化导致的 isRefreshing 锁等问题（memory lesson）
 *
 * @param store Zustand store hook（如 useAnalysisStore）
 * @param partialState 需要重置的字段（与 setState 合并语义）
 *
 * @example
 * ```typescript
 * import { useAnalysisStore } from '@/store/analysisStore'
 *
 * beforeEach(() => {
 *   resetStoreState(useAnalysisStore, { isLoading: false, data: [], error: null })
 * })
 * ```
 */
export function resetStoreState<T extends object>(
  store: UseBoundStore<StoreApi<T>>,
  partialState: Partial<T>,
): void {
  store.setState(partialState, false)
}

/**
 * 批量重置多个 Zustand Store 的状态
 *
 * @param stores 待重置的 store 配置数组
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetStores([
 *     { store: useAnalysisStore, state: { isLoading: false, data: [] } },
 *     { store: useTradingStore, state: { orders: [], isRefreshing: false } },
 *   ])
 * })
 */
export function resetStores<T extends object>(
  stores: Array<{ store: UseBoundStore<StoreApi<T>>; state: Partial<T> }>,
): void {
  for (const { store, state } of stores) {
    resetStoreState(store, state)
  }
}

// ============================================================
// waitForMockCall：等待 mock 函数被调用
// ============================================================

import { waitFor } from '@testing-library/react'

/**
 * 等待 mock 函数被调用至少 N 次
 *
 * @param mockFn vi.fn() 创建的 mock 函数
 * @param callCount 期望的调用次数（默认 1）
 * @param timeout 超时毫秒（默认 1000）
 *
 * @example
 * ```typescript
 * await waitForMockCall(vi.mocked(myService.fetch), 1, 2000)
 * ```
 */
export async function waitForMockCall(
  mockFn: { mock: { calls: unknown[] } },
  callCount: number = 1,
  timeout: number = 1000,
): Promise<void> {
  await waitFor(
    () => {
      if (mockFn.mock.calls.length < callCount) {
        throw new Error(`Expected ${callCount} calls, got ${mockFn.mock.calls.length}`)
      }
    },
    { timeout },
  )
}

// ============================================================
// suppressConsoleError：抑制特定 console.error（用于错误边界测试）
// ============================================================

/**
 * 临时抑制 console.error，返回恢复函数
 *
 * 用于测试预期会触发 console.error 的场景（如错误边界、try-catch 错误日志）
 *
 * @param pattern 需要抑制的错误消息正则（不传则抑制所有）
 * @returns 恢复函数，在 afterEach 中调用
 *
 * @example
 * ```typescript
 * const restore = suppressConsoleError(/Network error/)
 * try {
 *   render(<ThrowingComponent />)
 * } finally {
 *   restore()
 * }
 * ```
 */
export function suppressConsoleError(pattern?: RegExp): () => void {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const message = args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
    if (pattern && !pattern.test(message)) {
      originalError.apply(console, args as never)
    }
  }
  return () => {
    console.error = originalError
  }
}

// ============================================================
// 颜色令牌断言工具（AGENTS.md §3.5.5 推荐断言语义属性，颜色断言为过渡方案）
// ============================================================

interface ColorToken {
  tailwind: string
}

interface BgColorToken {
  bgClass: string
}

/**
 * 断言元素包含指定颜色令牌的 tailwind 类名
 *
 * @param element 待断言的 DOM 元素
 * @param token 颜色令牌对象（须含 tailwind 字段，如 COLOR_TOKENS.success）
 *
 * @example
 * ```typescript
 * expectToHaveColorClass(el, COLOR_TOKENS.success)
 * // 等价于 expect(el.className).toContain(COLOR_TOKENS.success.tailwind)
 * ```
 */
export function expectToHaveColorClass(element: HTMLElement, token: ColorToken): void {
  expect(element.className).toContain(token.tailwind)
}

/**
 * 断言元素包含指定背景颜色令牌的 tailwind 类名
 *
 * @param element 待断言的 DOM 元素
 * @param token 背景颜色令牌对象（须含 bgClass 字段，如 COLOR_TOKENS.scoreHigh）
 *
 * @example
 * ```typescript
 * expectToHaveColorBg(el, COLOR_TOKENS.scoreHigh)
 * ```
 */
export function expectToHaveColorBg(element: HTMLElement, token: BgColorToken): void {
  expect(element.className).toContain(token.bgClass)
}

// ============================================================
// 测试 DB 重置工具（补充 tests/setup.ts 的 IndexedDB 隔离）
// ============================================================

/**
 * 重置测试 IndexedDB 的指定 stores
 *
 * 用于个别需要彻底清空 DB 数据的测试场景。
 * 日常测试建议依赖 setup.ts 的 TEST_DB_NAME 隔离 + db.reset()，
 * 仅在跨测试文件状态污染或缓存失效测试中使用此工具。
 *
 * @param stores 需要清空的 store 名称数组（如 ['stocks', 'orders']）
 *
 * @example
 * ```typescript
 * import { resetTestDb } from '../utils/testHelpers'
 *
 * afterEach(async () => {
 *   await resetTestDb(['stocks', 'orders'])
 * })
 * ```
 */
export async function resetTestDb(stores: readonly string[]): Promise<void> {
  // 动态导入避免在 setup 阶段加载 db 模块
  const { db } = await import('@/data/db')
  for (const store of stores) {
    try {
      await db.clear(store)
    } catch {
      // store 不存在或 DB 未初始化时忽略
    }
  }
}

// ============================================================
// 自动缓存清理工具（解决 db.reset() 不触发 invalidateCache 问题）
// ============================================================

/**
 * 自动重置数据库并清理 DataBridge 缓存
 *
 * 解决 db.reset() 只清空 IndexedDB 但不清理 DataBridge 内存缓存的问题。
 * 该工具会自动清理所有已知 store 的缓存，避免跨测试用例的数据污染。
 *
 * @param additionalStores 额外需要清理的 store 名称数组（可选）
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * import { resetDbWithCache } from '../utils/testHelpers'
 *
 * beforeEach(async () => {
 *   await resetDbWithCache()
 * })
 *
 * // 或指定额外需要清理的 store
 * beforeEach(async () => {
 *   await resetDbWithCache(['custom_store'])
 * })
 * ```
 */
export async function resetDbWithCache(additionalStores: readonly string[] = []): Promise<void> {
  const { db } = await import('@/data/db')
  const { dataBridge } = await import('@/core/databridge')
  const { STORE_NAME } = await import('@/config/dbConfig')

  // 重置数据库
  await db.init()
  await db.reset()

  // 清理所有已知 store 的缓存
  const allStores = Object.values(STORE_NAME) as string[]
  for (const store of allStores) {
    dataBridge.invalidateCache(store)
  }

  // 清理额外指定的 store
  for (const store of additionalStores) {
    dataBridge.invalidateCache(store)
  }
}

/**
 * 创建自动缓存清理的 beforeEach 钩子
 *
 * 返回一个可以在 beforeEach 中直接调用的异步函数。
 *
 * @param additionalStores 额外需要清理的 store 名称数组（可选）
 * @returns 可在 beforeEach 中调用的函数
 *
 * @example
 * ```typescript
 * import { createCacheResetHook } from '../utils/testHelpers'
 *
 * beforeEach(createCacheResetHook())
 *
 * // 或指定额外需要清理的 store
 * beforeEach(createCacheResetHook(['custom_store']))
 * ```
 */
export function createCacheResetHook(additionalStores: readonly string[] = []): () => Promise<void> {
  return async () => {
    await resetDbWithCache(additionalStores)
  }
}
