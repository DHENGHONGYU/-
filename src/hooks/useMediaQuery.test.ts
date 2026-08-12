// @vitest-environment jsdom
/**
 * useMediaQuery.test.ts — 响应式媒体查询 Hook 与订阅器工厂 P0 单测
 *
 * 覆盖要点：
 *  1. 常量导出正确性（BREAKPOINT_* 单源）
 *  2. createMediaQuerySubscriber：
 *     - 浏览器环境：初始快照、订阅变化、取消订阅、addListener fallback
 *     - SSR 环境：显式注入 window=undefined → 返回默认值、不崩
 *     - 边界：options={} 不覆盖全局 window（回归 bug 场景）
 *  3. useMediaQuery Hook：
 *     - 初始渲染返回真实 matchMedia.matches
 *     - 变化触发 re-render 并更新值
 *     - 卸载后取消订阅（防内存泄漏）
 *     - defaultValue 在 SSR 场景生效
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { act, renderHook, cleanup } from '@testing-library/react'
import {
  BREAKPOINT_MOBILE,
  BREAKPOINT_TABLET,
  BREAKPOINT_DESKTOP,
  BREAKPOINT_WIDE,
  BREAKPOINT_ULTRAWIDE,
  BREAKPOINT_PREFERS_DARK,
  BREAKPOINT_PREFERS_REDUCED_MOTION,
  createMediaQuerySubscriber,
  useMediaQuery,
  type MediaQuerySubscriber,
} from './useMediaQuery'

/* ------------------------------------------------------------
 * mock：可调度 matchMedia（支持 addEventListener/removeEventListener，也支持手动触发 change）
 * ---------------------------------------------------------- */
interface MockMediaQueryList {
  matches: boolean
  media: string
  addEventListener: MockInstance
  removeEventListener: MockInstance
  addListener: MockInstance
  removeListener: MockInstance
  _dispatchChange: (nextMatches: boolean) => void
  onchange?: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null
  dispatchEvent?(event: Event): boolean
}

function makeMockMql(media: string, initialMatches = false): MockMediaQueryList {
  let currentMatches = initialMatches
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const addEventListener = vi.fn((_type: 'change', cb: (e: MediaQueryListEvent) => void) => {
    listeners.add(cb)
  })
  const removeEventListener = vi.fn((_type: 'change', cb: (e: MediaQueryListEvent) => void) => {
    listeners.delete(cb)
  })
  const addListener = vi.fn((cb: (e: MediaQueryListEvent) => void) => {
    listeners.add(cb)
  })
  const removeListener = vi.fn((cb: (e: MediaQueryListEvent) => void) => {
    listeners.delete(cb)
  })
  return {
    get matches() {
      return currentMatches
    },
    media,
    addEventListener,
    removeEventListener,
    addListener,
    removeListener,
    onchange: null,
    _dispatchChange(nextMatches: boolean) {
      currentMatches = nextMatches
      // 构造伪 MediaQueryListEvent（只用到 matches 字段）
      const evt = { matches: currentMatches, media } as MediaQueryListEvent
      for (const cb of Array.from(listeners)) cb(evt)
    },
    dispatchEvent() {
      return false
    },
  }
}

let origMatchMedia: typeof window.matchMedia | undefined
let mockMqlStore: Record<string, MockMediaQueryList> = {}
let useAddListenerFallback = false // 打开后 addEventListener 不存在，走 addListener 分支

beforeEach(() => {
  mockMqlStore = {}
  useAddListenerFallback = false
  origMatchMedia = window.matchMedia
  window.matchMedia = vi.fn((query: string): MediaQueryList => {
    if (!mockMqlStore[query]) mockMqlStore[query] = makeMockMql(query, false)
    const mql = mockMqlStore[query]!
    if (useAddListenerFallback) {
      // 模拟旧浏览器：addEventListener/removeEventListener 不存在
      return {
        ...(mql as unknown as Record<string, unknown>),
        addEventListener: undefined as unknown as MediaQueryList['addEventListener'],
        removeEventListener: undefined as unknown as MediaQueryList['removeEventListener'],
      } as unknown as MediaQueryList
    }
    return mql as unknown as MediaQueryList
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (origMatchMedia !== undefined) {
    window.matchMedia = origMatchMedia
    origMatchMedia = undefined
  }
})

/* ============================================================
 * TC-HOOK-1：断点常量（7 个 BREAKPOINT_*）导出正确性
 * ========================================================== */
describe('TC-HOOK-1 BREAKPOINT 常量导出', () => {
  it('TC-HOOK-1.1 7 个常见断点存在且为有效 media query 字符串', () => {
    const breakpoints = [
      BREAKPOINT_MOBILE,
      BREAKPOINT_TABLET,
      BREAKPOINT_DESKTOP,
      BREAKPOINT_WIDE,
      BREAKPOINT_ULTRAWIDE,
      BREAKPOINT_PREFERS_DARK,
      BREAKPOINT_PREFERS_REDUCED_MOTION,
    ]
    for (const bp of breakpoints) {
      expect(typeof bp).toBe('string')
      expect(bp.length).toBeGreaterThan(0)
      // 断点必须带括号（media query 语法）
      expect(bp.startsWith('(') || bp.includes('(')).toBe(true)
    }
  })

  it('TC-HOOK-1.2 BREAKPOINT_MOBILE 为预期的 767px 上限（与 CockpitShell 消费对齐）', () => {
    expect(BREAKPOINT_MOBILE).toBe('(max-width: 767px)')
  })
})

/* ============================================================
 * TC-HOOK-2：createMediaQuerySubscriber 浏览器环境
 * ========================================================== */
describe('TC-HOOK-2 createMediaQuerySubscriber (浏览器环境)', () => {
  it('TC-HOOK-2.1 初始快照 = matchMedia.matches 的真实值', () => {
    mockMqlStore[BREAKPOINT_MOBILE] = makeMockMql(BREAKPOINT_MOBILE, true) // 初始 matches = true
    const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE)
    expect(sub.getSnapshot()).toBe(true)
  })

  it('TC-HOOK-2.2 订阅后触发 change → snapshot 更新并执行 callback', () => {
    const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE)
    expect(sub.getSnapshot()).toBe(false)
    let cbCalled = 0
    const unsub = sub.subscribe(() => {
      cbCalled++
    })
    expect(typeof unsub).toBe('function')

    const mql = mockMqlStore[BREAKPOINT_MOBILE]!
    act(() => mql._dispatchChange(true))
    expect(cbCalled).toBe(1)
    expect(sub.getSnapshot()).toBe(true)
  })

  it('TC-HOOK-2.3 取消订阅后，再触发 change → callback 不再执行', () => {
    const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE)
    let cbCalled = 0
    const unsub = sub.subscribe(() => {
      cbCalled++
    })
    unsub()
    const mql = mockMqlStore[BREAKPOINT_MOBILE]!
    act(() => mql._dispatchChange(true))
    act(() => mql._dispatchChange(false))
    expect(cbCalled).toBe(0)
  })

  it('TC-HOOK-2.4 addEventListener 不存在 → fallback 到 addListener/removeListener', () => {
    useAddListenerFallback = true
    const sub = createMediaQuerySubscriber(BREAKPOINT_WIDE)
    const unsub = sub.subscribe(() => {})
    expect(typeof unsub).toBe('function')
    const mql = mockMqlStore[BREAKPOINT_WIDE]!
    expect(mql.addListener).toHaveBeenCalledTimes(1)
    // 未调用 addEventListener（因为它被设置为 undefined）
    expect(mql.addEventListener).toHaveBeenCalledTimes(0)
    unsub()
    expect(mql.removeListener).toHaveBeenCalledTimes(1)
  })

  it('TC-HOOK-2.5 getServerSnapshot(fallback) 不依赖浏览器状态', () => {
    const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE)
    expect(sub.getServerSnapshot()).toBe(false) // 默认 false
    expect(sub.getServerSnapshot(true)).toBe(true)
    expect(sub.getServerSnapshot(false)).toBe(false)
  })

  it('TC-HOOK-2.6 多 subscriber 互不干扰（独立回调，独立取消）', () => {
    const subA = createMediaQuerySubscriber(BREAKPOINT_DESKTOP)
    const subB = createMediaQuerySubscriber(BREAKPOINT_DESKTOP) // 同一 query，不同工厂实例
    let callsA = 0
    let callsB = 0
    const unsubA = subA.subscribe(() => {
      callsA++
    })
    subB.subscribe(() => {
      callsB++
    })
    const mql = mockMqlStore[BREAKPOINT_DESKTOP]!
    act(() => mql._dispatchChange(true))
    expect(callsA).toBe(1)
    expect(callsB).toBe(1)
    unsubA()
    act(() => mql._dispatchChange(false))
    expect(callsA).toBe(1) // A 已取消，不再加
    expect(callsB).toBe(2) // B 还在继续
  })

  it('TC-HOOK-2.7 options={} → 不覆盖全局 window（关键回归：空 options 仍可读到 jsdom window）', () => {
    // 若 bug：把 options={} 当成 SSR，getSnapshot 会返回 false 而不是真实 matchMedia.matches
    mockMqlStore[BREAKPOINT_TABLET] = makeMockMql(BREAKPOINT_TABLET, true)
    const sub = createMediaQuerySubscriber(BREAKPOINT_TABLET, {})
    expect(sub.getSnapshot()).toBe(true) // 真实匹配状态，不是 SSR 默认 false
  })
})

/* ============================================================
 * TC-HOOK-3：createMediaQuerySubscriber SSR（无 window）场景
 * ========================================================== */
describe('TC-HOOK-3 createMediaQuerySubscriber SSR（window undefined）', () => {
  it('TC-HOOK-3.1 显式 { window: undefined } → getSnapshot 返回 false、getServerSnapshot 支持 fallback', () => {
    const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE, { window: undefined })
    expect(sub.getSnapshot()).toBe(false)
    expect(sub.getServerSnapshot(true)).toBe(true)
    expect(sub.getServerSnapshot(false)).toBe(false)
  })

  it('TC-HOOK-3.2 SSR 路径 subscribe 返回可执行 unsub，不抛异常（防 crash）', () => {
    const sub: MediaQuerySubscriber = createMediaQuerySubscriber(BREAKPOINT_WIDE, { window: undefined })
    const unsub = sub.subscribe(() => {
      // SSR 路径没订阅源，这里永远不会触发；测试只确保 subscribe/unsubscribe 都能安全执行
    })
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('TC-HOOK-3.3 window.matchMedia 不存在 → 走 SSR 路径，不抛异常（极端环境）', () => {
    // 临时把 matchMedia 删掉
    const saved = window.matchMedia
    ;(window as unknown as { matchMedia?: unknown }).matchMedia = undefined
    try {
      // 注意：这里传 options 不能带 window 属性，否则会走"显式注入 undefined"分支
      // 我们想测试的是：即使没有显式注入，全局 window.matchMedia 不存在也要安全回退
      // 因为 createMediaQuerySubscriber 内部会先取 globalThis.window，再检查 typeof matchMedia
      // 这里 window 对象存在，但 matchMedia 属性不存在
      const sub = createMediaQuerySubscriber(BREAKPOINT_MOBILE)
      expect(sub.getSnapshot()).toBe(false)
      expect(() => sub.subscribe(() => {})()).not.toThrow()
    } finally {
      window.matchMedia = saved
    }
  })
})

/* ============================================================
 * TC-HOOK-4：useMediaQuery Hook（结合 @testing-library/react）
 * ========================================================== */
describe('TC-HOOK-4 useMediaQuery Hook', () => {
  it('TC-HOOK-4.1 初始渲染 = matchMedia.matches', () => {
    mockMqlStore[BREAKPOINT_MOBILE] = makeMockMql(BREAKPOINT_MOBILE, true)
    const { result } = renderHook(() => useMediaQuery(BREAKPOINT_MOBILE))
    expect(result.current).toBe(true)
  })

  it('TC-HOOK-4.2 变化触发 → re-render 更新值', () => {
    const { result } = renderHook(() => useMediaQuery(BREAKPOINT_MOBILE))
    expect(result.current).toBe(false)
    const mql = mockMqlStore[BREAKPOINT_MOBILE]!
    act(() => mql._dispatchChange(true))
    expect(result.current).toBe(true)
    act(() => mql._dispatchChange(false))
    expect(result.current).toBe(false)
  })

  it('TC-HOOK-4.3 卸载后 → 取消订阅（内存泄漏检查）', () => {
    const { unmount } = renderHook(() => useMediaQuery(BREAKPOINT_WIDE))
    const mql = mockMqlStore[BREAKPOINT_WIDE]!
    expect(mql.removeEventListener).toHaveBeenCalledTimes(0)
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('TC-HOOK-4.4 defaultValue 仅影响 SSR 快照，不影响浏览器路径初始化（回归验证）', () => {
    // 初始 matches = false，但用户传 defaultValue=true
    // 在 jsdom（浏览器环境），getSnapshot 会读到真实 matchMedia.matches = false，所以 result.current 应该是 false
    // defaultValue 只在 SSR（无 window）路径 getServerSnapshot 时用
    mockMqlStore[BREAKPOINT_DESKTOP] = makeMockMql(BREAKPOINT_DESKTOP, false)
    const { result } = renderHook(() =>
      useMediaQuery(BREAKPOINT_DESKTOP, { defaultValue: true }),
    )
    // 有真实 window 时，返回真实状态（不受 defaultValue 影响）
    expect(result.current).toBe(false)
  })

  it('TC-HOOK-4.5 Hook 可读取断点常量（和裸字符串等效）', () => {
    const { result: r1 } = renderHook(() => useMediaQuery(BREAKPOINT_ULTRAWIDE))
    const { result: r2 } = renderHook(() => useMediaQuery('(min-width: 1920px)'))
    expect(r1.current).toBe(r2.current)
  })
})
