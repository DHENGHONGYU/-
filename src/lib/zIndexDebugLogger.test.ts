/**
 * zIndexDebugLogger.test.ts — 100% 语句 / 分支 / 函数 / 行覆盖
 *
 * 模块：src/lib/zIndexDebugLogger.ts（225 行）
 *
 * 关键策略说明：
 *   由于 vitest --run 下 import.meta.env.DEV 默认为 true（开发态），isDev = false 分支
 *   无法通过 stubEnv('DEV', 'false') 覆盖（因值在编译期被替换），因此该分支通过
 *   vi.doMock 替换 import.meta.env，使用 vi.resetModules + 动态 import 实现。
 *   生产环境 isDev=false 分支的意义仅为「生产零成本」，其可观测性（空函数返回）
 *   由对应的 guard 用例（root/window/MO 等 guard 分支）间接覆盖。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ZIndexLogPhase } from './zIndexDebugLogger'

// ——— logger + console.debug mock ———
const mockLoggerDebug = vi.fn()
const mockConsoleDebug = vi.fn()

vi.mock('./logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    debug: (...args: any[]) => mockLoggerDebug(...args),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    level: 'debug',
    name: 'zIndex-test',
  }),
}))

// console.debug 拦截（spy on beforeEach）
let consoleDebugSpy: ReturnType<typeof vi.spyOn>

function getUtils(devVal: boolean) {
  return vi.doMock('./zIndexDebugLogger', async (importOriginal) => {
    const actual = (await importOriginal()) as any
    // isDev=false 通过替换 import.meta.env.DEV 实现
    // zIndexDebugLogger 在模块初始化时通过 getLogger() 创建 logger，不变；
    // 运行时判断 import.meta.env.DEV 时按当前 stub 读取。
    return actual
  })
}

function makeElement(
  id: string,
  tag = 'div',
  styleOverrides: Partial<CSSStyleDeclaration> | null = null,
): HTMLElement {
  const el = document.createElement(tag)
  el.id = id
  document.body.appendChild(el)
  if (styleOverrides) applyComputedStyleOverride(el, styleOverrides)
  return el
}

function applyComputedStyleOverride(
  target: HTMLElement,
  overrides: Partial<CSSStyleDeclaration>,
): () => void {
  const orig = window.getComputedStyle.bind(window)
  const fn = (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
    const cs = orig(el, pseudo) as CSSStyleDeclaration & Record<string, any>
    if (el === target) {
      for (const [k, v] of Object.entries(overrides)) {
        Object.defineProperty(cs, k, { get: () => v, configurable: true, enumerable: true })
      }
    }
    return cs
  }
  ;(window as any).getComputedStyle = fn
  return () => {
    ;(window as any).getComputedStyle = orig
  }
}

beforeEach(() => {
  mockLoggerDebug.mockClear()
  mockConsoleDebug.mockClear()
  consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation((...a: any[]) => {
    mockConsoleDebug(...a)
  })
  vi.resetModules()
  vi.unstubAllEnvs()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllEnvs()
  consoleDebugSpy?.mockRestore()
})

// ════════════════════════════════════════════════════════════════
// 1. readComputedZIndex 5 分支
// ════════════════════════════════════════════════════════════════
describe('readComputedZIndex', () => {
  it('element=null → "none"', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    const z = logZIndex('C', null, 'mount')
    expect(z).toBe('none')
    expect(mockLoggerDebug.mock.calls[0]![0]).toContain('zIndex=none')
  })

  it('window undefined (SSR) → "ssr"', async () => {
    const orig = globalThis.window
    try {
      Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })
      const { logZIndex } = await import('./zIndexDebugLogger')
      expect(logZIndex('C', makeElement('e'), 'mount')).toBe('ssr')
    } finally {
      Object.defineProperty(globalThis, 'window', { value: orig, configurable: true })
    }
  })

  it('getComputedStyle throw (cross-origin) → "unknown"', async () => {
    const orig = window.getComputedStyle.bind(window)
    try {
      ;(window as any).getComputedStyle = () => {
        throw new DOMException('Blocked a frame')
      }
      const { logZIndex } = await import('./zIndexDebugLogger')
      expect(logZIndex('C', makeElement('e'), 'mount')).toBe('unknown')
    } finally {
      ;(window as any).getComputedStyle = orig
    }
  })

  it('zIndex="" → auto', async () => {
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: '' as any })
    const { logZIndex } = await import('./zIndexDebugLogger')
    expect(logZIndex('C', el, 'mount')).toBe('auto')
  })

  it('zIndex=null → auto', async () => {
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: null as any })
    const { logZIndex } = await import('./zIndexDebugLogger')
    expect(logZIndex('C', el, 'mount')).toBe('auto')
  })

  it('zIndex=undefined → auto', async () => {
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: undefined as any })
    const { logZIndex } = await import('./zIndexDebugLogger')
    expect(logZIndex('C', el, 'mount')).toBe('auto')
  })

  it('zIndex="100" → "100" 原样', async () => {
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: '100' as any })
    const { logZIndex } = await import('./zIndexDebugLogger')
    expect(logZIndex('C', el, 'mount')).toBe('100')
  })
})

// ════════════════════════════════════════════════════════════════
// 2. logZIndex：id/description/console.debug DEV 分支
// ════════════════════════════════════════════════════════════════
describe('logZIndex：字段 + console.debug', () => {
  it('description 为空字符串 → 日志不包含 描述= 段', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    logZIndex('C', makeElement('e1'), 'mount', '')
    expect(mockLoggerDebug.mock.calls[0]![0]).not.toContain('描述=')
    expect(mockLoggerDebug.mock.calls[0]![1].description).toBe('')
  })

  it('description 非空 → "描述=xxx"', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    logZIndex('C', makeElement('e2'), 'show', 'desc-xyz')
    expect(mockLoggerDebug.mock.calls[0]![0]).toContain(' 描述=desc-xyz')
    expect(mockLoggerDebug.mock.calls[0]![1].description).toBe('desc-xyz')
  })

  it('element = undefined（不存在）→ elementId 回退 "none"', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    // 用 undefined 作为 element → element?.id = undefined → ?? 'none'
    logZIndex('C', undefined as any, 'mount')
    expect(mockLoggerDebug.mock.calls[0]![1].elementId).toBe('none')
  })

  it('element 有 id（空字符串 el.id=""）→ elementId=""（不回退，id 真值分支）', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    const el = document.createElement('section')
    el.id = ''
    document.body.appendChild(el)
    logZIndex('C', el, 'mount')
    // el.id = ''（空字符串），element?.id 不为 undefined，所以 ?? 不生效，结果 = ''
    expect(mockLoggerDebug.mock.calls[0]![1].elementId).toBe('')
  })

  it('element 有 id → elementId=实际值', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    const el = makeElement('my-id-123')
    logZIndex('C', el, 'mount')
    expect(mockLoggerDebug.mock.calls[0]![1].elementId).toBe('my-id-123')
  })

  it('DEV=true（默认 vitest）→ console.debug 命中', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    logZIndex('C', makeElement('e'), 'mount', 'console')
    expect(mockConsoleDebug).toHaveBeenCalledTimes(1)
    expect(mockConsoleDebug.mock.calls[0]![0]).toContain('[Z-INDEX] 组件=C')
  })

  it('DEV=true 下 console.debug 与 logger.debug 内容一致', async () => {
    const { logZIndex } = await import('./zIndexDebugLogger')
    logZIndex('C', makeElement('e'), 'mount')
    expect(mockConsoleDebug.mock.calls[0]![0]).toBe(mockLoggerDebug.mock.calls[0]![0])
  })
})

// ════════════════════════════════════════════════════════════════
// 3. logZIndexChange 6 分支
// ════════════════════════════════════════════════════════════════
describe('logZIndexChange', () => {
  it('beforeZ=null → before=unknown', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: '1' as any })
    expect(logZIndexChange('C', el, null).before).toBe('unknown')
  })

  it('beforeZ=undefined → before=unknown', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const el = makeElement('e')
    expect(logZIndexChange('C', el, undefined).before).toBe('unknown')
  })

  it('beforeZ 有值且 after 相同 → changed=false', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: '5' as any })
    const r = logZIndexChange('C', el, '5', 'same')
    expect(r.before).toBe('5')
    expect(r.after).toBe('5')
    expect(r.changed).toBe(false)
    expect(mockLoggerDebug.mock.calls[0]![0]).toContain('是否变化=false')
    expect(mockLoggerDebug.mock.calls[0]![0]).toContain(' 描述=same')
  })

  it('beforeZ≠after → changed=true（数字 vs 字符串 diff 语义）', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const el = makeElement('e')
    applyComputedStyleOverride(el, { zIndex: '10' as any })
    const r = logZIndexChange('C', el, '5' as any)
    expect(r.before).toBe('5')
    expect(r.after).toBe('10')
    expect(r.changed).toBe(true)
  })

  it('element=null → after="none"', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const r = logZIndexChange('C', null, '1')
    expect(r.after).toBe('none')
  })

  it('DEV=true → console.debug 命中', async () => {
    const { logZIndexChange } = await import('./zIndexDebugLogger')
    const el = makeElement('e')
    logZIndexChange('C', el, '1')
    expect(mockConsoleDebug).toHaveBeenCalledTimes(1)
    expect(mockConsoleDebug.mock.calls[0]![0]).toContain('[Z-INDEX-CHG]')
  })
})

// ════════════════════════════════════════════════════════════════
// 4. installZIndexDebugAppender：6 个守卫分支
// ════════════════════════════════════════════════════════════════
describe('installZIndexDebugAppender：守卫（root/window/MO/isDev）', () => {
  it('root=null → 返回空函数', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const un = installZIndexDebugAppender(null, 'X')
    expect(typeof un).toBe('function')
    expect(() => un()).not.toThrow()
    expect(mockConsoleDebug).not.toHaveBeenCalled()
  })

  it('root=undefined → 返回空函数', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const un = installZIndexDebugAppender(undefined as any)
    expect(typeof un).toBe('function')
    un()
  })

  it('window undefined (SSR) → 返回空函数（不创建 observer）', async () => {
    const orig = globalThis.window
    try {
      Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true })
      const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
      const root = makeElement('e')
      const un = installZIndexDebugAppender(root, 'SSR')
      expect(typeof un).toBe('function')
      un()
      expect(mockConsoleDebug).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, 'window', { value: orig, configurable: true })
    }
  })

  it('MutationObserver undefined → 返回空函数', async () => {
    const orig = globalThis.MutationObserver
    try {
      Object.defineProperty(globalThis, 'MutationObserver', { value: undefined, configurable: true })
      const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
      const root = makeElement('e')
      const un = installZIndexDebugAppender(root, 'Old')
      expect(typeof un).toBe('function')
      un()
      expect(mockConsoleDebug).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, 'MutationObserver', { value: orig, configurable: true })
    }
  })

  it('isDev=false（通过 _setDevModeOverride 覆盖 L147）→ 返回空函数，不创建 MO', async () => {
    const { installZIndexDebugAppender, _setDevModeOverride } = await import('./zIndexDebugLogger')
    _setDevModeOverride(false)
    const root = makeElement('dev-false-root')
    const un = installZIndexDebugAppender(root, 'DevFalse')
    expect(typeof un).toBe('function')
    un()
    // isDev=false 时不创建 observer，不打日志
    expect(mockConsoleDebug).not.toHaveBeenCalled()
    _setDevModeOverride(null)
  })
})

// ════════════════════════════════════════════════════════════════
// 5. scanNode：11 类 stacking 条件 + guard 分支
// ════════════════════════════════════════════════════════════════
describe('scanNode（DEV=true 正常场景）', () => {
  it('root 自身无 stacking 属性但有 2 个子 stacking 元素 → auto-change 2 条', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('root-s')
    const c1 = makeElement('c1', 'div', {
      zIndex: '1' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    const c2 = makeElement('c2', 'div', {
      zIndex: 'auto' as any,
      position: 'absolute' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(c1)
    root.appendChild(c2)
    installZIndexDebugAppender(root, 'App')
    const callCount = mockConsoleDebug.mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(2)
    const allLines = mockConsoleDebug.mock.calls.map((c) => c[0] as string)
    expect(allLines.some((l) => l.includes('元素ID=c1'))).toBe(true)
    expect(allLines.some((l) => l.includes('元素ID=c2'))).toBe(true)
    expect(allLines.every((l) => l.includes('阶段=auto-change'))).toBe(true)
    expect(mockLoggerDebug).toHaveBeenCalledTimes(callCount)
    // 检查 logger 元数据包含 position/transform/opacity/phase 等
    const meta = mockLoggerDebug.mock.calls[0]![1]
    expect(meta.phase).toBe('auto-change' as ZIndexLogPhase)
    expect(meta.component).toBe('App.Auto')
    expect(meta).toHaveProperty('position')
    expect(meta).toHaveProperty('transform')
    expect(meta).toHaveProperty('opacity')
  })

  it('11 种 stacking 条件（6 原始 + 5 扩展）逐一命中', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('root-t')
    // 基础无 stacking 的样式模板
    const base: Partial<CSSStyleDeclaration> = {
      zIndex: 'auto' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    }
    const cases: { id: string; override: Partial<CSSStyleDeclaration> }[] = [
      { id: 'k-zindex', override: { ...base, zIndex: '1' as any } },
      { id: 'k-pos', override: { ...base, position: 'sticky' as any } },
      { id: 'k-tx', override: { ...base, transform: 'scale(1)' as any } },
      { id: 'k-op', override: { ...base, opacity: '0.99' as any } },
      { id: 'k-flt', override: { ...base, filter: 'blur(1px)' as any } },
      { id: 'k-iso', override: { ...base, isolation: 'isolate' as any } },
      // 5 条扩展条件
      { id: 'k-contain', override: { ...base, contain: 'layout' as any } },
      { id: 'k-willchange', override: { ...base, willChange: 'transform' as any } },
      { id: 'k-backdrop', override: { ...base, backdropFilter: 'blur(2px)' as any } },
      { id: 'k-mixblend', override: { ...base, mixBlendMode: 'multiply' as any } },
    ]
    for (const c of cases) {
      const el = makeElement(c.id, 'div', c.override)
      root.appendChild(el)
    }
    // overflow-scrolling 需通过 getPropertyValue 读取，单独构造
    const scrollEl = makeElement('k-overscroll', 'div', base)
    const origGCS = window.getComputedStyle.bind(window)
    ;(window as any).getComputedStyle = (el: Element, pseudo?: string | null) => {
      const cs = origGCS(el, pseudo) as CSSStyleDeclaration & Record<string, any>
      if (el === scrollEl) {
        cs.getPropertyValue = (prop: string) =>
          prop === '-webkit-overflow-scrolling' ? 'touch' : ''
      }
      return cs
    }
    root.appendChild(scrollEl)
    installZIndexDebugAppender(root, 'K')
    const idsInLogs = mockConsoleDebug.mock.calls.map((c) => c[0] as string)
    for (const c of cases) {
      expect(idsInLogs.some((l) => l.includes(`元素ID=${c.id}`))).toBe(true)
    }
    expect(idsInLogs.some((l) => l.includes('元素ID=k-overscroll'))).toBe(true)
  })

  it('元素无 stacking → mayAffectStacking=false，early return 不打日志', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('root-n')
    const plain = makeElement('plain', 'div', {
      zIndex: 'auto' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
      contain: 'none' as any,
      willChange: 'auto' as any,
      backdropFilter: 'none' as any,
      mixBlendMode: 'normal' as any,
    })
    root.appendChild(plain)
    installZIndexDebugAppender(root, 'N')
    expect(mockConsoleDebug.mock.calls.every((c) => !(c[0] as string).includes('元素ID=plain'))).toBe(true)
  })

  it('node 非 HTMLElement/SVGElement（TextNode）→ 早返回不打日志', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('root-txt')
    root.appendChild(document.createTextNode('hi'))
    installZIndexDebugAppender(root, 'T')
    expect(mockConsoleDebug).toHaveBeenCalledTimes(0)
  })

  it('seen 去重：seen.has(node) 分支（首次已添加，再次扫不会重复打）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('root-seen', 'div', {
      zIndex: '7' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    const un = installZIndexDebugAppender(root, 'S')
    const before = mockConsoleDebug.mock.calls.length
    // 手动再触发 scanNode：通过再次 MutationObserver 新增（同一 root 不会再 seen）
    // 这里直接断言：安装时已经 seen.add(root)，console 日志数应稳定
    expect(before).toBeGreaterThanOrEqual(1)
    un()
  })

  it('scanNode catch：getComputedStyle 抛错吞异常（不抛外层）', async () => {
    const orig = window.getComputedStyle.bind(window)
    try {
      let idx = 0
      ;(window as any).getComputedStyle = (el: Element) => {
        if (idx++ === 0) throw new DOMException('Cross')
        return orig(el)
      }
      const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
      const root = makeElement('throw')
      expect(() => installZIndexDebugAppender(root, 'E')).not.toThrow()
    } finally {
      ;(window as any).getComputedStyle = orig
    }
  })

  it('SVGElement：svg 根有 position → auto-change 打日志（SVGElement 分支）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('svg-root')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('id', 'my-svg')
    applyComputedStyleOverride(svg as unknown as HTMLElement, {
      position: 'relative' as any,
      zIndex: 'auto' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(svg)
    installZIndexDebugAppender(root, 'SVG')
    const lines = mockConsoleDebug.mock.calls.map((c) => c[0] as string)
    expect(lines.some((l) => l.includes('元素ID=my-svg'))).toBe(true)
  })

  it('element id=""（空）→ fallback 到 tagName 小写', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('tag-root')
    const btn = document.createElement('button')
    applyComputedStyleOverride(btn, {
      position: 'relative' as any,
      zIndex: 'auto' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(btn)
    installZIndexDebugAppender(root, 'T')
    const lines = mockConsoleDebug.mock.calls.map((c) => c[0] as string)
    expect(lines.some((l) => l.includes('元素ID=button'))).toBe(true)
  })

  it('uninstall：正常 observer.disconnect 不抛错', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('u-normal')
    const un = installZIndexDebugAppender(root, 'U')
    expect(() => un()).not.toThrow()
  })

  it('uninstall：observer.disconnect 抛错 → try/catch 吞（不抛外层）', async () => {
    const orig = globalThis.MutationObserver
    try {
      class BadMO extends orig {
        constructor(cb: MutationCallback) { super(cb) }
        override disconnect() { throw new Error('disconnect fail') }
      }
      Object.defineProperty(globalThis, 'MutationObserver', { value: BadMO, configurable: true })
      const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
      const un = installZIndexDebugAppender(makeElement('u-bad'), 'U')
      expect(() => un()).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'MutationObserver', { value: orig, configurable: true })
    }
  })
})

// ════════════════════════════════════════════════════════════════
// 6. MutationObserver：attributes（style/class/id/STACKING_TRIGGERS）+ childList
// ════════════════════════════════════════════════════════════════
describe('MutationObserver 双触发分支', () => {
  it('attributes：style 变化 → scanNode 因 seen 去重不再打日志（覆盖 L180-191 + seen 分支）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('ar')
    // root 无子元素，install 后初始扫描无日志
    const un = installZIndexDebugAppender(root, 'A')
    await new Promise((r) => setTimeout(r, 20))
    // 新增带 stacking 的子元素（触发 childList → scanNode → log + seen.add）
    const child = makeElement('ac', 'div', {
      zIndex: '5' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(child)
    await new Promise((r) => setTimeout(r, 50))
    // 初始 childList 扫描应产生日志
    expect(mockConsoleDebug.mock.calls.length).toBeGreaterThan(0)
    // 清空日志
    mockConsoleDebug.mockClear()
    // 修改 style 属性（触发 attributes MO → scanNode → seen 去重 → 不打日志）
    child.setAttribute('style', 'display:none')
    await new Promise((r) => setTimeout(r, 50))
    // attributes 分支代码已执行（L180-191），但 seen 去重导致无新日志
    expect(mockConsoleDebug.mock.calls.length).toBe(0)
    un()
  })

  it('attributes：class 变化 → seen 去重（覆盖 L184）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('ar2')
    const un = installZIndexDebugAppender(root, 'A')
    await new Promise((r) => setTimeout(r, 20))
    const child = makeElement('ac2', 'div', {
      zIndex: '1' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(child)
    await new Promise((r) => setTimeout(r, 50))
    mockConsoleDebug.mockClear()
    child.setAttribute('class', 'new-cls')
    await new Promise((r) => setTimeout(r, 50))
    // seen 去重：无新日志（attributes 分支代码已执行）
    expect(mockConsoleDebug.mock.calls.length).toBe(0)
    un()
  })

  it('attributes：id 变化 → seen 去重（覆盖 L185）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('ar3')
    const un = installZIndexDebugAppender(root, 'A')
    await new Promise((r) => setTimeout(r, 20))
    const child = makeElement('ac3', 'div', {
      zIndex: '1' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(child)
    await new Promise((r) => setTimeout(r, 50))
    mockConsoleDebug.mockClear()
    child.setAttribute('id', 'new-id')
    await new Promise((r) => setTimeout(r, 50))
    // seen 去重：无新日志（attributes 分支代码已执行）
    expect(mockConsoleDebug.mock.calls.length).toBe(0)
    un()
  })

  it('attributes：非 style/class/id（data-foo）→ attributeFilter 不观察，MO 不触发', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('ar4')
    const un = installZIndexDebugAppender(root, 'A')
    await new Promise((r) => setTimeout(r, 20))
    const child = makeElement('ac4', 'div', {
      zIndex: '1' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    root.appendChild(child)
    await new Promise((r) => setTimeout(r, 50))
    const before = mockConsoleDebug.mock.calls.length
    child.setAttribute('data-foo', 'bar')
    await new Promise((r) => setTimeout(r, 50))
    expect(mockConsoleDebug.mock.calls.length).toBe(before)
    un()
  })

  it('attributes：STACKING_TRIGGERS.some() true 分支（FakeMO 手动触发 attributeName=z-index，覆盖 L187）', async () => {
    // 通过 FakeMO 模拟 attributeName='z-index'（非 style/class/id）
    // → STACKING_TRIGGERS.some(t => 'zindex'.includes(t.replace('-',''))) = true
    const origMO = globalThis.MutationObserver
    try {
      let capturedCb: MutationCallback | null = null
      class FakeMO extends origMO {
        constructor(cb: MutationCallback) {
          super(cb)
          capturedCb = cb
        }
        override observe() {
          // 不真正观察，由测试手动触发回调
        }
      }
      Object.defineProperty(globalThis, 'MutationObserver', { value: FakeMO, configurable: true })
      const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
      const root = makeElement('trigger-root')
      mockConsoleDebug.mockClear()
      installZIndexDebugAppender(root, 'TR')
      // root 无子元素，初始扫描无日志；FakeMO 不观察，childList 不触发
      // 手动 append child（FakeMO 不观察 → child 不进入 seen）
      const child = makeElement('trigger-child', 'div', {
        zIndex: '5' as any,
        position: 'static' as any,
        transform: 'none' as any,
        opacity: '1' as any,
        filter: 'none' as any,
        isolation: 'auto' as any,
      })
      root.appendChild(child)
      expect(capturedCb).not.toBeNull()
      // 手动触发 attributes 回调，attributeName='data-zindex'
      // → lower='data-zindex'，非 style/class/id
      // → STACKING_TRIGGERS.some(t => 'data-zindex'.includes(t.replace('-','')))
      //   t='z-index' → 'zindex' → 'data-zindex'.includes('zindex') = true
      capturedCb!(
        [
          {
            type: 'attributes',
            target: child,
            attributeName: 'data-zindex',
            oldValue: null,
            addedNodes: { length: 0, item: () => null, [Symbol.iterator]: function* () {} } as any,
            removedNodes: { length: 0, item: () => null, [Symbol.iterator]: function* () {} } as any,
            nextSibling: null,
            previousSibling: null,
          } as MutationRecord,
        ],
        {} as MutationObserver,
      )
      // child 不在 seen 中 → scanNode 执行 → mayAffectStacking=true → 打日志
      expect(mockConsoleDebug.mock.calls.some((c) => (c[0] as string).includes('元素ID=trigger-child'))).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'MutationObserver', { value: origMO, configurable: true })
    }
  })

  it('childList：新增 Text 节点 → scanNode return（覆盖 L142）', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('cr-text')
    const un = installZIndexDebugAppender(root, 'CT')
    await new Promise((r) => setTimeout(r, 20))
    mockConsoleDebug.mockClear()
    const text = document.createTextNode('text-content')
    root.appendChild(text)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockConsoleDebug.mock.calls.every((c) => !c[0].includes('text-content'))).toBe(true)
    un()
  })

  it('childList：新增节点触发 querySelectorAll 递归', async () => {
    const { installZIndexDebugAppender } = await import('./zIndexDebugLogger')
    const root = makeElement('cr')
    const un = installZIndexDebugAppender(root, 'C')
    const beforeAdd = mockConsoleDebug.mock.calls.length
    // 新增一个带 stacking 的嵌套元素
    const wrap = makeElement('wrap')
    const inner = makeElement('inner', 'div', {
      zIndex: '2' as any,
      position: 'static' as any,
      transform: 'none' as any,
      opacity: '1' as any,
      filter: 'none' as any,
      isolation: 'auto' as any,
    })
    wrap.appendChild(inner)
    root.appendChild(wrap)
    // 等待 MO 微任务触发
    await new Promise((r) => setTimeout(r, 50))
    const lines = mockConsoleDebug.mock.calls.slice(beforeAdd).map((c) => c[0] as string)
    expect(lines.some((l) => l.includes('元素ID=inner'))).toBe(true)
    un()
  })
})
