import { useSyncExternalStore } from 'react'

/* ============================================================
 * 断点常量（5 种常见屏幕尺寸）
 * ------------------------------------------------------------
 * 设计：
 *   BREAKPOINT_MOBILE  = max-width 767px  ← 移动端
 *   BREAKPOINT_TABLET  = 768 ~ 1023px     ← 平板
 *   BREAKPOINT_LAPTOP  = 1024 ~ 1279px    ← 笔记本
 *   BREAKPOINT_DESKTOP = 1280 ~ 1919px    ← 桌面
 *   BREAKPOINT_WIDE    = min-width 1920px ← 宽屏
 *   另加两个常用组合：
 *   BREAKPOINT_SMALL_UP  = 768px+  (平板及以上)
 *   BREAKPOINT_LARGE_UP  = 1280px+ (桌面及以上)
 *
 * 这些常量必须与 CockpitShell / PortalShell 的 Tailwind 断点
 * （md:hidden、lg:flex 等）一一对应，消费方引用常量而非硬编码字符串。
 * ========================================================== */
export const BREAKPOINT_MOBILE = '(max-width: 767px)'
export const BREAKPOINT_TABLET = '(min-width: 768px) and (max-width: 1023px)'
export const BREAKPOINT_LAPTOP = '(min-width: 1024px) and (max-width: 1279px)'
export const BREAKPOINT_DESKTOP = '(min-width: 1280px) and (max-width: 1919px)'
export const BREAKPOINT_WIDE = '(min-width: 1920px)'
export const BREAKPOINT_ULTRAWIDE = '(min-width: 2560px)'
export const BREAKPOINT_SMALL_UP = '(min-width: 768px)'
export const BREAKPOINT_LARGE_UP = '(min-width: 1280px)'
export const BREAKPOINT_PREFERS_DARK = '(prefers-color-scheme: dark)'
export const BREAKPOINT_PREFERS_REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** 所有命名断点的顺序数组 —— 用于批量测试与遍历。 */
export const BREAKPOINTS: readonly string[] = [
  BREAKPOINT_MOBILE,
  BREAKPOINT_TABLET,
  BREAKPOINT_LAPTOP,
  BREAKPOINT_DESKTOP,
  BREAKPOINT_WIDE,
  BREAKPOINT_ULTRAWIDE,
  BREAKPOINT_SMALL_UP,
  BREAKPOINT_LARGE_UP,
  BREAKPOINT_PREFERS_DARK,
  BREAKPOINT_PREFERS_REDUCED_MOTION,
] as const

/** useMediaQuery Hook options 类型 */
export interface UseMediaQueryOptions {
  /** 当 SSR 快照无法计算真实值时的默认返回值（默认 false） */
  defaultValue?: boolean
  /** 显式注入 window 引用 —— 用于 jsdom 测试、SSR 场景注入 undefined。
   *  注意：只有 options 里显式出现 `window` 属性时才使用注入值；
   *       空 options 或不含该属性则走全局 window（兼容历史用法）。
   */
  window?: Window
}

/** createMediaQuerySubscriber 返回的订阅器接口 —— 与 useSyncExternalStore 签名对齐 */
export interface MediaQuerySubscriber {
  /**
   * 订阅变化；返回取消订阅函数。
   * SSR / 无 matchMedia 环境下返回空操作函数（但可被安全调用，不抛异常）
   */
  subscribe(callback: () => void): () => void
  /** 同步当前客户端快照（用于浏览器路径） */
  getSnapshot(): boolean
  /** 同步 SSR 快照（用于服务端渲染路径，不访问 DOM） */
  getServerSnapshot(fallback?: boolean): boolean
}

/** 旧版 MediaQueryList API（已弃用但 pre-2020 浏览器仍可用） */
interface LegacyMediaQueryList {
  addListener(cb: (e: MediaQueryListEvent) => void): void
  removeListener(cb: (e: MediaQueryListEvent) => void): void
}

/** 运行时探测用的 MQL 类型 —— 所有监听方法可选，确保 typeof 守卫不被 TS 视为冗余 */
interface RuntimeMediaQueryList {
  matches: boolean
  addEventListener?(type: 'change', listener: (e: MediaQueryListEvent) => void): void
  removeEventListener?(type: 'change', listener: (e: MediaQueryListEvent) => void): void
  addListener?(cb: (e: MediaQueryListEvent) => void): void
  removeListener?(cb: (e: MediaQueryListEvent) => void): void
}

/* ============================================================
 * createMediaQuerySubscriber(query, options?)
 * ------------------------------------------------------------
 * 纯订阅器工厂，不依赖 React Hook 规则 —— 可直接在 services / agents
 * 等非 React 层订阅屏幕变化。
 *
 * 三步防御（从硬到软）：
 *   1. SSR（无 window）→ 空订阅，getSnapshot 恒等于 fallback（默认 false）
 *   2. 有 window 但无 matchMedia（极老浏览器）→ 同 SSR 路径
 *   3. 有 matchMedia 但无 addEventListener（老 Safari 2019 前）→
 *      回退 deprecated addListener / removeListener（断言兼容）
 * ========================================================== */
export function createMediaQuerySubscriber(
  query: string,
  options: { window?: Window } = {},
): MediaQuerySubscriber {
  // 只有 options 显式含 window key（值可以是 undefined 表示 SSR）才用注入值
  const win: Window | undefined = 'window' in options ? options.window : (globalThis as { window?: Window }).window

  if (win === undefined || typeof win.matchMedia !== 'function') {
    // --- SSR / 极端环境：只读订阅器 -------------------------------------
    return {
      subscribe() {
        return function noop() {}
      },
      getSnapshot() {
        return false
      },
      getServerSnapshot(fallback = false) {
        return fallback
      },
    }
  }

  // --- 浏览器环境 -------------------------------------------------------
  // win 已通过上方守卫收窄为 Window；转 RuntimeMediaQueryList 以运行时探测监听 API
  const mql = win.matchMedia(query) as unknown as RuntimeMediaQueryList
  let snapshot = mql.matches
  const listeners = new Set<() => void>()

  const onChange = (e: MediaQueryListEvent): void => {
    if (snapshot === e.matches) return
    snapshot = e.matches
    listeners.forEach((cb) => {
      try { cb() } catch {
        /* 单个回调异常不影响其他订阅者 */
      }
    })
  }

  // 两种注册方式：优先 addEventListener，回退 deprecated addListener（老 Safari 2019 前）
  let attached = false
  const ensureListening = (): void => {
    if (attached) return
    attached = true
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else {
      // deprecated addListener fallback for pre-2020 browsers
      const legacy = mql as unknown as LegacyMediaQueryList
      legacy.addListener(onChange)
    }
  }
  const ensureStopped = (): void => {
    if (!attached) return
    attached = false
    if (typeof mql.removeEventListener === 'function') {
      mql.removeEventListener('change', onChange)
    } else {
      const legacy = mql as unknown as LegacyMediaQueryList
      legacy.removeListener(onChange)
    }
  }

  return {
    subscribe(callback: () => void): () => void {
      if (typeof callback !== 'function') return () => {}
      listeners.add(callback)
      if (listeners.size === 1) ensureListening()
      return function unsubscribe() {
        listeners.delete(callback)
        if (listeners.size === 0) ensureStopped()
      }
    },
    getSnapshot(): boolean {
      // 每次快照与 DOM 最新值对齐（避免 MQ 同步变化但 onChange 没走完导致读旧值）
      snapshot = mql.matches
      return snapshot
    },
    getServerSnapshot(fallback = false): boolean {
      return fallback
    },
  }
}

/* ============================================================
 * useMediaQuery(query, options?)  ← 主要 React Hook
 * ------------------------------------------------------------
 * 使用 useSyncExternalStore 实现：
 *   · React 18 官方推荐的外部订阅 Hook（避免 useEffect 二阶段渲染）
 *   · SSR 安全：getServerSnapshot 使用 defaultValue 不访问 window
 *   · 无 hydration mismatch：首帧客户端快照与 SSR 快照可以不一致，
 *     React 会在 effect 后重绘，用户只看到最终正确值。
 *
 * 示例（对应 5 种屏幕尺寸测试用例）：
 *   const isMobile  = useMediaQuery(BREAKPOINT_MOBILE)
 *   const isTablet  = useMediaQuery(BREAKPOINT_TABLET)
 *   const isLaptop  = useMediaQuery(BREAKPOINT_LAPTOP)
 *   const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP)
 *   const isWide    = useMediaQuery(BREAKPOINT_WIDE)
 *
 * 或任意合法 media query：
 *   const dark = useMediaQuery('(prefers-color-scheme: dark)')
 * ========================================================== */
export function useMediaQuery(query: string, options: UseMediaQueryOptions = {}): boolean {
  const { defaultValue = false, window: winInject } = options
  const subscriberOptions: { window?: Window } | undefined =
    'window' in options ? { window: winInject } : undefined
  const subscriber = createMediaQuerySubscriber(query, subscriberOptions)
  const matched = useSyncExternalStore(
    subscriber.subscribe.bind(subscriber),
    subscriber.getSnapshot.bind(subscriber),
    () => subscriber.getServerSnapshot(defaultValue),
  )
  return matched
}
