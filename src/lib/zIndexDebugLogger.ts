/**
 * zIndexDebugLogger.ts — 全局 z-index 调试日志工具
 *
 * 设计目标：
 *  - 在组件挂载/卸载、状态变化、弹窗显隐等阶段，快速记录真实 z-index 值
 *  - 日志格式严格对齐需求：[ISO时间戳] [Z-INDEX] 组件= 元素ID= zIndex= 阶段= 描述=?
 *  - MutationObserver 追加器：监控 root 下所有元素的 style/class 变化，
 *    若变化涉及 stacking context（zIndex / position / transform / opacity / filter / isolation）
 *    自动打日志，无需每个组件手动埋点。
 *
 * 用法（埋点示例）：
 *   import { logZIndex, logZIndexChange, installZIndexDebugAppender } from '@/lib/zIndexDebugLogger'
 *
 *   useEffect(() => {
 *     logZIndex('PortalShell', shellRef.current, 'create', 'Portal 根容器创建')
 *     const beforeZ = logZIndex('PortalShell.Header', headerRef.current, 'create')
 *     const uninstall = installZIndexDebugAppender(shellRef.current, 'PortalShell')
 *     return () => {
 *       uninstall?.()
 *       logZIndexChange('PortalShell.Header', headerRef.current, beforeZ, 'Header 生命周期 z-index 对比')
 *       logZIndex('PortalShell', shellRef.current, 'destroy')
 *     }
 *   }, [])
 */
import { getLogger } from './logger'

const logger = getLogger()

/** @internal 测试专用：覆盖 DEV 环境检测，null 表示使用真实 import.meta.env.DEV */
let _devModeOverride: boolean | null = null

/** @internal 测试专用：设置 DEV 模式覆盖 */
export function _setDevModeOverride(val: boolean | null): void {
  _devModeOverride = val
}

export type ZIndexLogPhase =
  | 'mount'
  | 'unmount'
  | 'before-change'
  | 'after-change'
  | 'create'
  | 'destroy'
  | 'render'
  | 'positioned'
  | 'show'
  | 'hide'
  | 'auto-change' // MutationObserver 自动检测的变更

const STACKING_TRIGGERS: ReadonlyArray<string> = [
  'z-index',
  'position',
  'transform',
  'opacity',
  'filter',
  'isolation',
  'contain',
  'will-change',
  'backdrop-filter',
  'mix-blend-mode',
  'overflow-scrolling',
]

/* ============================================================
 * 辅助：从元素读取最终 z-index（auto / 数字字符串 / unknown）
 * ========================================================== */
function readComputedZIndex(
  element: HTMLElement | SVGElement | null | undefined,
): number | string {
  if (!element) return 'none'
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 'ssr'
  try {
    const cs = window.getComputedStyle(element)
    const z = cs.zIndex
    if (z === '' || z === null || z === undefined) return 'auto'
    return z
  } catch {
    return 'unknown'
  }
}

/* ============================================================
 * 核心 1：记录单点 z-index 快照
 * ========================================================== */
export function logZIndex(
  component: string,
  element: HTMLElement | SVGElement | null | undefined,
  phase: ZIndexLogPhase,
  description = '',
): number | string {
  const ts = new Date().toISOString()
  const id = element?.id ?? 'none'
  const zIndex = readComputedZIndex(element)
  const line =
    `[${ts}] [Z-INDEX] 组件=${component} 元素ID=${id} zIndex=${zIndex} 阶段=${phase}` +
    (description ? ` 描述=${description}` : '')
  logger.debug(line, { component, elementId: id, zIndex, phase, description })
  // 避免生产环境噪音：仅在 DEV 打 console
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug(line)
  }
  return zIndex
}

/* ============================================================
 * 核心 2：记录 z-index 变更前后对比
 * ========================================================== */
export function logZIndexChange(
  component: string,
  element: HTMLElement | SVGElement | null | undefined,
  beforeZ: number | string | null | undefined,
  description = '',
): { before: number | string; after: number | string; changed: boolean } {
  const after = readComputedZIndex(element)
  const before = beforeZ === null || beforeZ === undefined ? 'unknown' : beforeZ
  const changed = String(before) !== String(after)
  const ts = new Date().toISOString()
  const id = element?.id ?? 'none'
  const line =
    `[${ts}] [Z-INDEX-CHG] 组件=${component} 元素ID=${id} 变更前=${before} 变更后=${after} 是否变化=${changed}` +
    (description ? ` 描述=${description}` : '')
  logger.debug(line, { component, elementId: id, before, after, changed, description })
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug(line)
  }
  return { before, after, changed }
}

/* ============================================================
 * 核心 3：MutationObserver 追加器（仅 DEV 启用）
 *   监控 subtree：style / class / id 属性变化 → 若影响 stacking → 自动 log
 *   返回 uninstall 函数（空函数在非 DEV 环境，方便调用方不用判断）
 * ========================================================== */
export function installZIndexDebugAppender(
  root: HTMLElement | SVGElement | null | undefined,
  componentPrefix = 'App',
): () => void {
  if (!root) return () => {}
  if (typeof window === 'undefined') return () => {}
  if (typeof MutationObserver !== 'function') return () => {}
  const isDev = _devModeOverride ?? (
    typeof import.meta !== 'undefined' &&
    !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  )
  if (!isDev) return () => {}

  const seen = new WeakSet<Node>()

  const scanNode = (node: Node): void => {
    if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return
    if (seen.has(node)) return
    seen.add(node)
    // 只记录可能影响 stacking 的元素：有 z-index 或 有 position 非 static
    try {
      const cs = window.getComputedStyle(node)
      const position = cs.position || 'static'
      const zIndex = cs.zIndex || 'auto'
      // 5 条扩展 stacking 条件（CSS Stacking Context 规范补全）
      const contain = (cs as unknown as Record<string, string>).contain || 'none'
      const willChange = (cs as unknown as Record<string, string>).willChange || 'auto'
      const backdropFilter =
        (cs as unknown as Record<string, string>).backdropFilter || 'none'
      const mixBlendMode =
        (cs as unknown as Record<string, string>).mixBlendMode || 'normal'
      const webkitOverflowScrolling =
        cs.getPropertyValue('-webkit-overflow-scrolling') || 'auto'
      const mayAffectStacking =
        zIndex !== 'auto' ||
        position !== 'static' ||
        (cs.transform && cs.transform !== 'none') ||
        (cs.opacity && cs.opacity !== '1') ||
        (cs.filter && cs.filter !== 'none') ||
        cs.isolation === 'isolate' ||
        // 扩展条件 1-5
        /layout|paint|strict|content/.test(contain) ||
        willChange !== 'auto' ||
        backdropFilter !== 'none' ||
        mixBlendMode !== 'normal' ||
        webkitOverflowScrolling === 'touch'
      if (!mayAffectStacking) return
      const id = node.id || node.tagName.toLowerCase()
      const line = `[${new Date().toISOString()}] [Z-INDEX] 组件=${componentPrefix}.Auto 元素ID=${id} zIndex=${zIndex} 阶段=auto-change 描述=MutationObserver 检测到 stacking 相关属性变化`
      // eslint-disable-next-line no-console
      console.debug(line)
      logger.debug(line, {
        component: `${componentPrefix}.Auto`,
        elementId: id,
        zIndex,
        phase: 'auto-change',
        position,
        transform: cs.transform,
        opacity: cs.opacity,
      })
    } catch {
      /* 忽略计算样式异常（例如跨域 iframe）*/
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // 属性变化：直接检查 target
      if (m.type === 'attributes') {
        const name = m.attributeName || ''
        const lower = name.toLowerCase()
        // 只有 style/class/id 相关变化才可能影响 stacking
        if (
          lower === 'style' ||
          lower === 'class' ||
          lower === 'id' ||
          STACKING_TRIGGERS.some((t) => lower.includes(t.replace('-', '')))
        ) {
          scanNode(m.target)
        }
        continue
      }
      // 子节点增减：扫一下新增节点的子树
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          scanNode(n)
          if (n instanceof Element) {
            n.querySelectorAll<HTMLElement | SVGElement>('*').forEach(scanNode)
          }
        })
      }
    }
  })

  observer.observe(root, {
    attributes: true,
    attributeFilter: ['style', 'class', 'id'],
    childList: true,
    subtree: true,
    characterData: false,
  })

  // 首次全量扫一次
  scanNode(root)
  if (root instanceof Element) {
    root.querySelectorAll<HTMLElement | SVGElement>('*').forEach(scanNode)
  }

  return (): void => {
    try {
      observer.disconnect()
    } catch {
      /* ignore */
    }
  }
}
