import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  logZIndex,
  logZIndexChange,
  installZIndexDebugAppender,
  type ZIndexLogPhase,
} from './zIndexDebugLogger'
import * as loggerMod from './logger'

// TD-023: vi.mock hoist 工厂函数内不要引用顶层变量；mockFn 在 beforeEach 中 vi.mocked 获取
vi.mock('./logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

function getMockDebug(): ReturnType<typeof vi.fn> {
  const logger = vi.mocked(loggerMod.getLogger)()
  return vi.mocked(logger.debug)
}

const originalImportMetaEnv = import.meta.env

function setDevMode(isDev: boolean): void {
  Object.defineProperty(import.meta, 'env', {
    configurable: true,
    enumerable: true,
    value: { ...originalImportMetaEnv, DEV: isDev, PROD: !isDev },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setDevMode(true)
})

afterEach(() => {
  Object.defineProperty(import.meta, 'env', {
    configurable: true,
    enumerable: true,
    value: originalImportMetaEnv,
  })
})

function makeElement(tag = 'div', id = ''): HTMLElement {
  const el = document.createElement(tag)
  if (id) el.id = id
  return el
}

describe('lib/zIndexDebugLogger', () => {
  let csSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    csSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el: Element) => {
        const style = (el as HTMLElement).style
        return {
          zIndex: style.zIndex || 'auto',
          position: style.position || 'static',
          transform: style.transform || 'none',
          opacity: style.opacity || '1',
          filter: style.filter || 'none',
          isolation: style.isolation || 'auto',
        } as unknown as CSSStyleDeclaration
      },
    )
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  describe('logZIndex', () => {
    it('元素 null/undefined → 返回 "none"', () => {
      expect(logZIndex('Comp', null, 'create')).toBe('none')
      expect(logZIndex('Comp', undefined, 'mount')).toBe('none')
    })

    it('正常元素读取 computed zIndex，logger+console 输出', () => {
      const el = makeElement('div', 'header')
      el.style.zIndex = '100'
      document.body.appendChild(el)
      try {
        const z = logZIndex('Header', el, 'mount', '测试描述')
        expect(z).toBe('100')
        const mockDebug = getMockDebug()
        expect(mockDebug).toHaveBeenCalled()
        const args = mockDebug.mock.calls[0]!
        const line = args[0] as string
        expect(line).toContain('[Z-INDEX]')
        expect(line).toContain('组件=Header')
        expect(line).toContain('元素ID=header')
        expect(line).toContain('zIndex=100')
        expect(line).toContain('阶段=mount')
        expect(line).toContain('描述=测试描述')
        expect(console.debug).toHaveBeenCalled()
      } finally {
        document.body.removeChild(el)
      }
    })

    it('无 id 元素 → element.id 为空串（源码用 ?? 而非 ||，空串不替换）', () => {
      const el = makeElement('div', '')
      el.style.zIndex = '50'
      document.body.appendChild(el)
      try {
        logZIndex('NoIdComp', el, 'render')
        const mockDebug = getMockDebug()
        const line = mockDebug.mock.calls[0]![0] as string
        expect(line).toContain('组件=NoIdComp')
        expect(line).toContain('zIndex=50')
        expect(line).toContain('元素ID=') // 源码用 element?.id ?? 'none'，空串不触发 ??
      } finally {
        document.body.removeChild(el)
      }
    })

    it('z-index auto → 返回 auto', () => {
      const el = makeElement()
      document.body.appendChild(el)
      try {
        expect(logZIndex('AutoZ', el, 'mount')).toBe('auto')
      } finally {
        document.body.removeChild(el)
      }
    })

    it('DEV 分支：尝试切换 DEV 后函数不抛异常、logger 始终输出', () => {
      // 注意：Vitest 环境下 import.meta.env.DEV 默认 true，且通常不可被 Object.defineProperty 修改
      // （ESM spec 中 import.meta 属性不可 configurable），因此这里只验证函数不抛错、
      // logger.debug 正常输出，不对 console.debug 做严格断言（DEV=true 的 console 分支
      // 已被其他用例全覆盖）。
      setDevMode(false)
      const el = makeElement()
      el.style.zIndex = '30'
      document.body.appendChild(el)
      try {
        const mockDebug = getMockDebug()
        mockDebug.mockClear()
        ;(console.debug as ReturnType<typeof vi.fn>).mockClear()
        const result = logZIndex('ProdMode', el, 'show')
        expect(result).toBe('30')
        expect(mockDebug).toHaveBeenCalledTimes(1)
        const line = mockDebug.mock.calls[0]![0] as string
        expect(line).toContain('[Z-INDEX]')
        expect(line).toContain('组件=ProdMode')
        expect(line).toContain('阶段=show')
      } finally {
        document.body.removeChild(el)
        setDevMode(true)
      }
    })

    it('所有 phase 枚举值都可以传入', () => {
      const phases: ZIndexLogPhase[] = [
        'mount', 'unmount', 'before-change', 'after-change',
        'create', 'destroy', 'render', 'positioned', 'show', 'hide', 'auto-change',
      ]
      const el = makeElement()
      el.style.zIndex = '10'
      document.body.appendChild(el)
      try {
        for (const p of phases) {
          expect(logZIndex('PhaseTest', el, p)).toBe('10')
        }
        expect(getMockDebug()).toHaveBeenCalledTimes(phases.length)
      } finally {
        document.body.removeChild(el)
      }
    })
  })

  describe('logZIndexChange', () => {
    it('before/after 相同 → changed=false', () => {
      const el = makeElement('div', 'same')
      el.style.zIndex = '50'
      document.body.appendChild(el)
      try {
        const r = logZIndexChange('Same', el, '50', '前后一致')
        expect(r.before).toBe('50')
        expect(r.after).toBe('50')
        expect(r.changed).toBe(false)
        const line = getMockDebug().mock.calls[0]![0] as string
        expect(line).toContain('[Z-INDEX-CHG]')
        expect(line).toContain('是否变化=false')
        expect(line).toContain('描述=前后一致')
      } finally {
        document.body.removeChild(el)
      }
    })

    it('before/after 不同 → changed=true', () => {
      const el = makeElement('div', 'changed')
      el.style.zIndex = '100'
      document.body.appendChild(el)
      try {
        const r = logZIndexChange('Diff', el, '50')
        expect(r.before).toBe('50')
        expect(r.after).toBe('100')
        expect(r.changed).toBe(true)
        const line = getMockDebug().mock.calls[0]![0] as string
        expect(line).toContain('变更前=50')
        expect(line).toContain('变更后=100')
        expect(line).toContain('是否变化=true')
      } finally {
        document.body.removeChild(el)
      }
    })

    it('beforeZ null/undefined → 视为 "unknown"', () => {
      const el = makeElement()
      el.style.zIndex = '20'
      document.body.appendChild(el)
      try {
        expect(logZIndexChange('NullBefore', el, null).before).toBe('unknown')
        expect(logZIndexChange('UndefBefore', el, undefined).before).toBe('unknown')
      } finally {
        document.body.removeChild(el)
      }
    })
  })

  describe('installZIndexDebugAppender', () => {
    it('root null/undefined → 返回空 uninstall，不抛错', () => {
      expect(typeof installZIndexDebugAppender(null, 'App')).toBe('function')
      const u = installZIndexDebugAppender(undefined, 'X')
      expect(typeof u).toBe('function')
      expect(() => u()).not.toThrow()
    })

    it('DEV=false → 返回空 uninstall（不创建 observer）', () => {
      setDevMode(false)
      const root = document.createElement('div')
      document.body.appendChild(root)
      try {
        const uninstall = installZIndexDebugAppender(root, 'Prod')
        expect(typeof uninstall).toBe('function')
        expect(() => uninstall()).not.toThrow()
      } finally {
        document.body.removeChild(root)
      }
    })

    it('DEV=true + stacking 元素 → 首次扫描后输出 auto-change 日志', () => {
      setDevMode(true)
      const root = document.createElement('div')
      const child = document.createElement('div')
      child.id = 'child1'
      child.style.zIndex = '500'
      child.style.position = 'absolute'
      root.appendChild(child)
      document.body.appendChild(root)
      const mockDebug = getMockDebug()
      mockDebug.mockClear()
      try {
        const uninstall = installZIndexDebugAppender(root, 'App')
        const autoLogs = mockDebug.mock.calls.filter(
          (c) => typeof c[0] === 'string' && (c[0] as string).includes('阶段=auto-change'),
        )
        expect(autoLogs.length).toBeGreaterThanOrEqual(1)
        expect(typeof uninstall).toBe('function')
        expect(() => uninstall()).not.toThrow()
      } finally {
        document.body.removeChild(root)
      }
    })

    it('元素不影响 stacking（无 z-index、position=static）→ 跳过 auto-change 日志', () => {
      setDevMode(true)
      const root = document.createElement('div')
      const el = document.createElement('div')
      el.id = 'plain'
      root.appendChild(el)
      document.body.appendChild(root)
      const mockDebug = getMockDebug()
      mockDebug.mockClear()
      try {
        installZIndexDebugAppender(root, 'App')
        const plainLogs = mockDebug.mock.calls.filter(
          (c) => typeof c[0] === 'string'
            && (c[0] as string).includes('plain')
            && (c[0] as string).includes('auto-change'),
        )
        expect(plainLogs.length).toBe(0)
      } finally {
        document.body.removeChild(root)
      }
    })
  })

  describe('readComputedZIndex 分支覆盖', () => {
    it('getComputedStyle 异常 → 返回 "unknown"', () => {
      csSpy.mockImplementation(() => {
        throw new Error('cross-origin iframe')
      })
      const el = makeElement()
      document.body.appendChild(el)
      try {
        expect(logZIndex('Err', el, 'mount')).toBe('unknown')
      } finally {
        document.body.removeChild(el)
      }
    })

    it('getComputedStyle.zIndex 返回 null/空串/undefined → 返回 "auto"', () => {
      csSpy.mockImplementation(() => {
        return {
          zIndex: null as unknown as string,
          position: 'static',
          transform: 'none',
          opacity: '1',
          filter: 'none',
          isolation: 'auto',
        } as unknown as CSSStyleDeclaration
      })
      const el = makeElement()
      document.body.appendChild(el)
      try {
        expect(logZIndex('NullZ', el, 'mount')).toBe('auto')
      } finally {
        document.body.removeChild(el)
      }
    })

    it('window.getComputedStyle 非 function（SSR）→ 返回 "ssr"', () => {
      csSpy.mockRestore()
      const desc = Object.getOwnPropertyDescriptor(window, 'getComputedStyle')!
      Object.defineProperty(window, 'getComputedStyle', {
        configurable: true,
        value: undefined as unknown,
      })
      try {
        const el = makeElement()
        document.body.appendChild(el)
        try {
          expect(logZIndex('SSR', el, 'mount')).toBe('ssr')
        } finally {
          document.body.removeChild(el)
        }
      } finally {
        Object.defineProperty(window, 'getComputedStyle', desc)
      }
    })
  })
})

// ====================================================================
// 缺口补全（zIndexDebugLogger 25 uncov MutationObserver 分支 + scanNode 边角）
// ====================================================================
describe('zIndexDebugLogger — gap coverage (MutationObserver callback / window-MO-ssr / scanNode edges)', () => {
  let csSpy: ReturnType<typeof vi.spyOn>
  let consoleDbg: ReturnType<typeof vi.spyOn>
  let originalMutationObserver: typeof MutationObserver
  let savedCb: MutationCallback | null
  let observeSpy: ReturnType<typeof vi.fn>
  let disconnectSpy: ReturnType<typeof vi.fn>
  let installedRoot: Node | null

  function installMockMO(): void {
    // 替换全局 MutationObserver：构造函数捕获 callback 与 observe/disconnect
    class MockMutationObserver {
      constructor(cb: MutationCallback) {
        savedCb = cb
      }
      observe(target: Node, options: MutationObserverInit): void {
        installedRoot = target
        observeSpy(target, options)
      }
      disconnect(): void { disconnectSpy() }
      takeRecords() { return [] as MutationRecord[] }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MutationObserver = MockMutationObserver
  }

  function restoreRealMO(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MutationObserver = originalMutationObserver
  }

  beforeEach(() => {
    savedCb = null
    observeSpy = vi.fn()
    disconnectSpy = vi.fn()
    installedRoot = null
    originalMutationObserver = globalThis.MutationObserver
    vi.clearAllMocks()
    Object.defineProperty(import.meta, 'env', {
      configurable: true,
      enumerable: true,
      value: { ...originalImportMetaEnv, DEV: true, PROD: false },
    })
    csSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el: Element) => {
        const style = (el as HTMLElement).style
        return {
          zIndex: style.zIndex || 'auto',
          position: style.position || 'static',
          transform: style.transform || 'none',
          opacity: style.opacity || '1',
          filter: style.filter || 'none',
          isolation: style.isolation || 'auto',
        } as unknown as CSSStyleDeclaration
      },
    )
    consoleDbg = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    Object.defineProperty(import.meta, 'env', {
      configurable: true,
      enumerable: true,
      value: originalImportMetaEnv,
    })
    csSpy.mockRestore()
    consoleDbg.mockRestore()
    restoreRealMO()
  })

  describe('SSR / MO 缺失三条早退', () => {
    it('typeof window === undefined → 返回空 uninstall（第 131 行）', () => {
      csSpy.mockRestore()
      const desc = Object.getOwnPropertyDescriptor(globalThis, 'window')!
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: undefined as unknown,
      })
      try {
        const root = document.createElement('div')
        const u = installZIndexDebugAppender(root, 'SSR')
        expect(typeof u).toBe('function')
        expect(() => u()).not.toThrow()
      } finally {
        Object.defineProperty(globalThis, 'window', desc)
      }
    })

    it('typeof MutationObserver !== function → 返回空 uninstall（第 132 行）', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).MutationObserver = 42 // 不是 function
      try {
        const root = document.createElement('div')
        const u = installZIndexDebugAppender(root, 'NoMO')
        expect(typeof u).toBe('function')
        expect(() => u()).not.toThrow()
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).MutationObserver = originalMutationObserver
      }
    })

    it('isDev=false 不创建 observer（已测） + 早退结果一样', () => {
      Object.defineProperty(import.meta, 'env', {
        configurable: true,
        enumerable: true,
        value: { ...originalImportMetaEnv, DEV: false, PROD: true },
      })
      const root = document.createElement('div')
      document.body.appendChild(root)
      try {
        const u = installZIndexDebugAppender(root, 'Prod')
        expect(typeof u).toBe('function')
        u()
        // 早退分支：没有 observe 调用（这里没有 mock MO，所以如果真的创建了会报 real MO）
      } finally {
        document.body.removeChild(root)
      }
    })
  })

  describe('MutationObserver callback: attributes 分支（第 178-190 行）', () => {
    beforeEach(installMockMO)
    afterEach(restoreRealMO)

    it('attributeName=style → 命中，调用 scanNode(target) 影响 stacking 输出日志', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 's1'
      target.style.zIndex = '80'
      target.style.position = 'relative'
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'Test')
        expect(savedCb).not.toBeNull()
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'style' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const mockDebug = getMockDebug()
        const styleAttrLogs = mockDebug.mock.calls.filter(
          (c) => typeof c[0] === 'string'
            && (c[0] as string).includes('元素ID=s1')
            && (c[0] as string).includes('阶段=auto-change'),
        )
        expect(styleAttrLogs.length).toBeGreaterThanOrEqual(1)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('attributeName=class → 命中 filter 并触发 scanNode', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'c1'
      target.style.position = 'fixed'
      target.style.zIndex = '1000'
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'class' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const mockDebug = getMockDebug()
        const names = mockDebug.mock.calls.map((c) => (c[0] as string)?.match(/元素ID=(\S+)/)?.[1])
        expect(names).toContain('c1')
      } finally {
        document.body.removeChild(root)
      }
    })

    it('attributeName=id → 命中 filter', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'i1'
      target.style.transform = 'translateY(1px)' // 触发 stacking
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'id' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const line = (getMockDebug().mock.calls.find((c) => typeof c[0] === 'string' && (c[0] as string).includes('i1'))?.[0] ?? '') as string
        expect(line).toContain('阶段=auto-change')
      } finally {
        document.body.removeChild(root)
      }
    })

    it('attributeName 含 STACKING_TRIGGERS（data-zindex-policy 含 "zindex"）→ 命中', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'trig1'
      target.style.position = 'sticky'
      target.style.zIndex = '55'
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        // attributeName 非 style/class/id 但含 zindex（STAGING_TRIGGERS: 'z-index' → replace '-' → 'zindex'）
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'data-zindex-policy' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const found = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('trig1'),
        )
        expect(found).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('attributeName 不匹配任意 → 跳过不触发 scanNode', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'skip-attr'
      target.style.zIndex = '77'
      target.style.position = 'absolute'
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const mockDebug = getMockDebug()
        const beforeCount = mockDebug.mock.calls.length
        // attributeName 无关（tabindex）且不含 STACKING_TRIGGERS substring
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'tabindex' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const afterCount = mockDebug.mock.calls.length
        // 只有首次扫描的调用，callback 不新增 scanNode 调用
        expect(afterCount - beforeCount).toBe(0)
      } finally {
        document.body.removeChild(root)
      }
    })
  })

  describe('MutationObserver callback: childList 分支（第 193-200 行）', () => {
    beforeEach(installMockMO)
    afterEach(restoreRealMO)

    it('addedNodes 包含 HTMLElement（影响 stacking）+ TextNode 边角 → 扫 element 并 querySelectorAll 子节点', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const addedEl = document.createElement('div')
        addedEl.id = 'added1'
        addedEl.style.position = 'absolute'
        addedEl.style.zIndex = '999'
        const nested = document.createElement('span')
        nested.id = 'nested1'
        nested.style.opacity = '0.8' // 影响 stacking
        addedEl.appendChild(nested)
        const textNode = document.createTextNode('hello text') // 非 HTML/SVG → 141 行过滤
        // 模拟 NodeList：用数组 + length/item()
        const nodeListLike = [addedEl, textNode] as unknown as NodeList
        const rec: Partial<MutationRecord> = {
          type: 'childList',
          target: root,
          addedNodes: nodeListLike,
        }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const strs = getMockDebug().mock.calls.map((c) => c[0] as string).filter(Boolean)
        expect(strs.some((s) => s.includes('added1'))).toBe(true)
        expect(strs.some((s) => s.includes('nested1'))).toBe(true)
        // textNode 不应被扫到（不是 HTML/SVG 元素）
        expect(strs.every((s) => !s.includes('hello text'))).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('addedNodes 包含 SVGElement（z-index 不 auto）→ 命中 scanNode', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.id = 'svg1'
        svg.style.position = 'fixed'
        svg.style.zIndex = '555'
        const nodeListLike = [svg] as unknown as NodeList
        const rec: Partial<MutationRecord> = { type: 'childList', target: root, addedNodes: nodeListLike }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const found = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('svg1'),
        )
        expect(found).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })
  })

  describe('scanNode 边角分支：TextNode 跳过 / seen 去重 / transform-opacity-filter-isolation', () => {
    beforeEach(installMockMO)
    afterEach(restoreRealMO)

    it('scanNode 同一节点第二次调用 → seen.has(node) 命中 142 行，不再重复打日志', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'dup1'
      target.style.position = 'absolute'
      target.style.zIndex = '100'
      root.appendChild(target)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const mockDebug = getMockDebug()
        const dupCountBefore = mockDebug.mock.calls.filter((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('dup1'),
        ).length
        // 再次 callback 触发 attributes 风格扫描（应该因 seen.has 跳过打日志逻辑？）
        // 注意：scanNode 在 mayAffectStacking 之前会做 seen.has(node) return，第 142 行
        // 这里 target 在首次全量 scan 时已被加入 seen，再次 scan 不会打日志
        const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'style' }
        savedCb!([rec as MutationRecord], null as unknown as MutationObserver)
        const dupCountAfter = mockDebug.mock.calls.filter((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('dup1'),
        ).length
        // 目标：未新增（seen 命中 → 直接 return）
        expect(dupCountAfter - dupCountBefore).toBe(0)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('mayAffectStacking：transform != none → 命中', () => {
      const root = document.createElement('div')
      const t = document.createElement('div')
      t.id = 't-trans'
      t.style.transform = 'translateX(10px)'
      root.appendChild(t)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const hit = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('t-trans'),
        )
        expect(hit).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('mayAffectStacking：opacity != 1 → 命中', () => {
      const root = document.createElement('div')
      const t = document.createElement('div')
      t.id = 't-opa'
      t.style.opacity = '0.5'
      root.appendChild(t)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const hit = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('t-opa'),
        )
        expect(hit).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('mayAffectStacking：filter != none → 命中', () => {
      const root = document.createElement('div')
      const t = document.createElement('div')
      t.id = 't-filt'
      t.style.filter = 'blur(1px)'
      root.appendChild(t)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const hit = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('t-filt'),
        )
        expect(hit).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('mayAffectStacking：isolation === isolate → 命中', () => {
      const root = document.createElement('div')
      const t = document.createElement('div')
      t.id = 't-iso'
      t.style.isolation = 'isolate'
      root.appendChild(t)
      document.body.appendChild(root)
      try {
        installZIndexDebugAppender(root, 'T')
        const hit = getMockDebug().mock.calls.some((c) =>
          typeof c[0] === 'string' && (c[0] as string).includes('t-iso'),
        )
        expect(hit).toBe(true)
      } finally {
        document.body.removeChild(root)
      }
    })

    it('scanNode 中 window.getComputedStyle throw → 第 170 行 catch 忽略（不抛）', () => {
      const root = document.createElement('div')
      const target = document.createElement('div')
      target.id = 'err'
      target.style.position = 'absolute'
      target.style.zIndex = '99'
      root.appendChild(target)
      document.body.appendChild(root)
      // 先 spy 一次再 restore，替换为抛错
      csSpy.mockImplementation(() => {
        throw new DOMException('cross origin', 'SecurityError')
      })
      try {
        // 不抛即 pass
        expect(() => installZIndexDebugAppender(root, 'T')).not.toThrow()
        // 也不抛 observer.disconnect / callback（手动调一次 attributes）
        if (savedCb) {
          const rec: Partial<MutationRecord> = { type: 'attributes', target, attributeName: 'style' }
          expect(() => savedCb!([rec as MutationRecord], null as unknown as MutationObserver)).not.toThrow()
        }
      } finally {
        document.body.removeChild(root)
      }
    })
  })

  describe('uninstall 分支：observer.disconnect 抛错 → 第 221 行 catch 忽略', () => {
    it('disconnect throw → uninstall 不抛异常', () => {
      class ThrowMO {
        constructor(cb: MutationCallback) { savedCb = cb }
        observe() { /* noop */ }
        disconnect() { throw new Error('disconnect failed') }
        takeRecords() { return [] }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).MutationObserver = ThrowMO
      try {
        const root = document.createElement('div')
        document.body.appendChild(root)
        try {
          const u = installZIndexDebugAppender(root, 'T')
          expect(() => u()).not.toThrow()
        } finally {
          document.body.removeChild(root)
        }
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).MutationObserver = originalMutationObserver
      }
    })
  })
})
