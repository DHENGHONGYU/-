/**
 * @fileoverview 全局测试 setup 文件
 * @description 在所有测试文件执行前自动加载（vite.config.ts test.setupFiles 配置）
 *
 * 职责：
 * 1. 注入 fake-indexeddb（避免真实 IndexedDB 操作）
 * 2. 注册 jest-dom 断言扩展（toBeVisible、toHaveClass 等）
 * 3. 全局 mock jsdom 缺失的 Browser API（matchMedia/IntersectionObserver/ResizeObserver/URL.createObjectURL）
 * 4. 每个测试后自动清理 React 渲染树
 *
 * 全局隔离策略（afterEach 兜底，消除 forks 池 + fileParallelism=false 下的跨文件状态污染 TD-013）：
 * - 重置 IndexedDB 数据 + db 单例：db.reset() + resetDbInstance()
 * - 清空 DataBridge 读缓存：dataBridge.invalidateAll()
 * - 清空 EventBus 监听：eventBus.clearAll()
 * 不在此处做的事（避免全局副作用）：
 * - 不重置 Zustand Store（按需在测试文件中使用 tests/utils/storeReset）
 * - 不启动 vi.useFakeTimers（按需在测试文件中启用，并在 afterEach 中 useRealTimers）
 * - 不 mock 具体业务模块（使用 tests/__mocks__/ 或测试内 vi.mock）
 */

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { resetDbInstance } from '@/data/db-connection'
import { eventBus } from '@/lib/eventBus'

// 为每个测试文件生成独立的 IndexedDB 名称，避免并行运行时的状态污染与事务竞争
process.env.TEST_DB_NAME = `V6ProDB-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// ============================================================
// 全局 Browser API Mock
// jsdom 不实现以下 API，需提供 no-op 默认实现
// 测试中可用 vi.spyOn 覆盖具体行为
// ============================================================

/**
 * matchMedia mock
 * 用于主题切换、响应式断点、暗色模式检测等场景
 *
 * 注意：仅在 jsdom 环境下注入（node 环境下 window 未定义，
 * 如审计脚本测试使用 // @vitest-environment node）。
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

/**
 * IntersectionObserver mock
 * 用于懒加载、无限滚动、元素可见性检测等场景
 */
if (!('IntersectionObserver' in globalThis)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver
}

/**
 * ResizeObserver mock
 * 用于图表组件、自适应布局、Widget 尺寸监听等场景
 */
if (!('ResizeObserver' in globalThis)) {
  class MockResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = MockResizeObserver
}

/**
 * URL.createObjectURL / revokeObjectURL mock
 * 用于文件下载、Blob 处理、图片预览等场景
 *
 * 使用 Object.defineProperty 而非 vi.spyOn（jsdom 限制，memory lesson）
 */
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:mock-url',
    writable: true,
    configurable: true,
  })
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => {},
    writable: true,
    configurable: true,
  })
}

// ============================================================
// 全局清理
// ============================================================

// 每个测试后清理 React 渲染树，避免 DOM 残留与事件监听累积
afterEach(async () => {
  cleanup()

  // 跨文件隔离：消除 forks 池 + fileParallelism=false 下共享单例造成的状态污染（TD-013）
  // 同一 TEST_DB_NAME / dataBridge 缓存 / eventBus 监听在所有测试文件间串行共享，
  // 若某文件未彻底清理，脏状态会泄漏到后续文件。统一在 afterEach 兜底隔离。
  try {
    await db.reset()
  } catch {
    /* db 未初始化或无需重置时跳过 */
  }
  try {
    resetDbInstance()
  } catch {
    /* noop */
  }
  try {
    dataBridge.invalidateAll()
  } catch {
    /* noop */
  }
  try {
    eventBus.clearAll()
  } catch {
    /* noop */
  }
})
