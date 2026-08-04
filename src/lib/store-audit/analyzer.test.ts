import { describe, it, expect } from 'vitest'
import {
  isTestFile,
  markFacadeStores,
  computeTransitiveReachability,
  classifyConsumers,
} from './analyzer'
import type { StoreMeta, ConsumerRef } from './types'

// ── 辅助：构造 StoreMeta ──
function makeMeta(overrides: Partial<StoreMeta> & { fileName: string }): StoreMeta {
  return {
    filePath: `src/store/${overrides.fileName}.ts`,
    hookName: `use${overrides.fileName}`,
    deprecated: false,
    isFacade: false,
    aggregates: [],
    ...overrides,
  }
}

// ── 辅助：构造 ConsumerRef ──
function makeConsumer(overrides: Partial<ConsumerRef> & { file: string }): ConsumerRef {
  return {
    line: 1,
    importType: 'absolute',
    testOnly: false,
    commentOnly: false,
    isStoreDir: false,
    ...overrides,
  }
}

describe('store-audit/analyzer', () => {
  // ══════════════════════════════════════════════════════════════
  // 1. isTestFile
  // ══════════════════════════════════════════════════════════════
  describe('isTestFile()', () => {
    it('.test.ts 文件 → true', () => {
      expect(isTestFile('src/store/tradingStore.test.ts')).toBe(true)
    })

    it('.test.tsx 文件 → true', () => {
      expect(isTestFile('src/components/Widget.test.tsx')).toBe(true)
    })

    it('__tests__/ 目录 → true', () => {
      expect(isTestFile('src/store/__tests__/tradingStore.ts')).toBe(true)
    })

    it('__tests__\\ 目录（Windows 反斜杠）→ true', () => {
      expect(isTestFile('src\\store\\__tests__\\tradingStore.ts')).toBe(true)
    })

    it('普通源文件 → false', () => {
      expect(isTestFile('src/store/tradingStore.ts')).toBe(false)
    })

    it('spec.ts 文件 → false（非 .test.）', () => {
      expect(isTestFile('src/store/tradingStore.spec.ts')).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 2. markFacadeStores
  // ══════════════════════════════════════════════════════════════
  describe('markFacadeStores()', () => {
    it('有依赖的 Store 标记为 Facade + 记录 aggregates', () => {
      const metas = [
        makeMeta({ fileName: 'facadeStore' }),
        makeMeta({ fileName: 'leafStore' }),
      ]
      const graph = new Map<string, string[]>([
        ['facadeStore', ['leafStore']],
        ['leafStore', []],
      ])
      markFacadeStores(metas, graph)
      expect(metas[0].isFacade).toBe(true)
      expect(metas[0].aggregates).toEqual(['leafStore'])
      expect(metas[1].isFacade).toBe(false)
      expect(metas[1].aggregates).toEqual([])
    })

    it('无依赖的 Store 不标记为 Facade', () => {
      const metas = [makeMeta({ fileName: 'standaloneStore' })]
      const graph = new Map<string, string[]>([['standaloneStore', []]])
      markFacadeStores(metas, graph)
      expect(metas[0].isFacade).toBe(false)
      expect(metas[0].aggregates).toEqual([])
    })

    it('graph 中不存在的 Store → deps=[] → 不标记', () => {
      const metas = [makeMeta({ fileName: 'orphanStore' })]
      const graph = new Map<string, string[]>()
      markFacadeStores(metas, graph)
      expect(metas[0].isFacade).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 3. computeTransitiveReachability
  // ══════════════════════════════════════════════════════════════
  describe('computeTransitiveReachability()', () => {
    it('BFS 起点：有 UI 层直接消费者的 Store 加入起点', () => {
      const metas = [makeMeta({ fileName: 'storeA' })]
      const graph = new Map<string, string[]>([['storeA', []]])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['storeA', [makeConsumer({ file: 'src/pages/Home.tsx' })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('storeA')).toBe(true)
      expect(diagnostics.startingPoints).toContain('storeA')
      expect(diagnostics.transitiveOnly).toEqual([])
    })

    it('仅有 Store 层消费者的 Store 不作为 BFS 起点', () => {
      const metas = [makeMeta({ fileName: 'storeB' })]
      const graph = new Map<string, string[]>([['storeB', []]])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['storeB', [makeConsumer({ file: 'src/store/otherStore.ts', isStoreDir: true })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('storeB')).toBe(false)
      expect(diagnostics.startingPoints).not.toContain('storeB')
    })

    it('仅有测试消费者的 Store 不作为 BFS 起点', () => {
      const metas = [makeMeta({ fileName: 'storeC' })]
      const graph = new Map<string, string[]>([['storeC', []]])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['storeC', [makeConsumer({ file: 'src/store/storeC.test.ts', testOnly: true })]],
      ])
      const { reachable } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('storeC')).toBe(false)
    })

    it('传递可达性：facadeStore → leafStore', () => {
      const metas = [
        makeMeta({ fileName: 'facadeStore' }),
        makeMeta({ fileName: 'leafStore' }),
      ]
      const graph = new Map<string, string[]>([
        ['facadeStore', ['leafStore']],
        ['leafStore', []],
      ])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['facadeStore', [makeConsumer({ file: 'src/pages/Home.tsx' })]],
        ['leafStore', []],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('facadeStore')).toBe(true)
      expect(reachable.has('leafStore')).toBe(true)
      expect(diagnostics.startingPoints).toEqual(['facadeStore'])
      expect(diagnostics.transitiveOnly).toEqual(['leafStore'])
      expect(diagnostics.traversalPath).toEqual([
        { current: 'facadeStore', newReachable: ['leafStore'] },
      ])
    })

    it('钻石依赖：leafStore 只入队一次', () => {
      const metas = [
        makeMeta({ fileName: 'facadeA' }),
        makeMeta({ fileName: 'facadeB' }),
        makeMeta({ fileName: 'leafStore' }),
      ]
      const graph = new Map<string, string[]>([
        ['facadeA', ['leafStore']],
        ['facadeB', ['leafStore']],
        ['leafStore', []],
      ])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['facadeA', [makeConsumer({ file: 'src/pages/A.tsx' })]],
        ['facadeB', [makeConsumer({ file: 'src/pages/B.tsx' })]],
        ['leafStore', []],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('leafStore')).toBe(true)
      // leafStore 只在 traversalPath 中出现一次（第一个处理它的 facade）
      const leafAppearances = diagnostics.traversalPath.filter(
        p => p.newReachable.includes('leafStore'),
      )
      expect(leafAppearances.length).toBe(1)
    })

    it('自环依赖：A→A 不死循环', () => {
      const metas = [makeMeta({ fileName: 'selfRefStore' })]
      const graph = new Map<string, string[]>([['selfRefStore', ['selfRefStore']]])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['selfRefStore', [makeConsumer({ file: 'src/pages/X.tsx' })]],
      ])
      const { reachable } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('selfRefStore')).toBe(true)
    })

    it('双向循环：A→B→A 不死循环', () => {
      const metas = [
        makeMeta({ fileName: 'storeA' }),
        makeMeta({ fileName: 'storeB' }),
      ]
      const graph = new Map<string, string[]>([
        ['storeA', ['storeB']],
        ['storeB', ['storeA']],
      ])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['storeA', [makeConsumer({ file: 'src/pages/Home.tsx' })]],
        ['storeB', []],
      ])
      const { reachable } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('storeA')).toBe(true)
      expect(reachable.has('storeB')).toBe(true)
    })

    it('5 层深度链：BFS 按层级遍历', () => {
      const metas = ['s1', 's2', 's3', 's4', 's5'].map(n => makeMeta({ fileName: n }))
      const graph = new Map<string, string[]>([
        ['s1', ['s2']],
        ['s2', ['s3']],
        ['s3', ['s4']],
        ['s4', ['s5']],
        ['s5', []],
      ])
      const consumersMap = new Map<string, ConsumerRef[]>([
        ['s1', [makeConsumer({ file: 'src/pages/X.tsx' })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.size).toBe(5)
      expect(diagnostics.startingPoints).toEqual(['s1'])
      expect(diagnostics.transitiveOnly).toEqual(['s2', 's3', 's4', 's5'])
    })

    it('无消费者的空 Store → 不可达', () => {
      const metas = [makeMeta({ fileName: 'deadStore' })]
      const graph = new Map<string, string[]>([['deadStore', []]])
      const consumersMap = new Map<string, ConsumerRef[]>()
      const { reachable } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.has('deadStore')).toBe(false)
    })

    it('consumersMap 中无条目 → 不可达', () => {
      const metas = [makeMeta({ fileName: 'isolated' })]
      const graph = new Map<string, string[]>([['isolated', []]])
      const consumersMap = new Map<string, ConsumerRef[]>()
      const { reachable } = computeTransitiveReachability(metas, graph, consumersMap)
      expect(reachable.size).toBe(0)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 4. classifyConsumers
  // ══════════════════════════════════════════════════════════════
  describe('classifyConsumers()', () => {
    it('空列表 → ui=[], storeDir=[], testOnly=[], hasUiConsumer=false', () => {
      const result = classifyConsumers([])
      expect(result.ui).toEqual([])
      expect(result.storeDir).toEqual([])
      expect(result.testOnly).toEqual([])
      expect(result.hasUiConsumer).toBe(false)
    })

    it('UI 层消费者 → ui 分类 + hasUiConsumer=true', () => {
      const consumers = [makeConsumer({ file: 'src/pages/Home.tsx' })]
      const result = classifyConsumers(consumers)
      expect(result.ui).toHaveLength(1)
      expect(result.ui[0].file).toBe('src/pages/Home.tsx')
      expect(result.hasUiConsumer).toBe(true)
    })

    it('Store 层消费者 → storeDir 分类', () => {
      const consumers = [makeConsumer({ file: 'src/store/otherStore.ts', isStoreDir: true })]
      const result = classifyConsumers(consumers)
      expect(result.storeDir).toHaveLength(1)
      expect(result.storeDir[0].isStoreDir).toBe(true)
      expect(result.hasUiConsumer).toBe(false)
    })

    it('测试文件消费者 → testOnly 分类', () => {
      const consumers = [makeConsumer({ file: 'src/store/x.test.ts', testOnly: true })]
      const result = classifyConsumers(consumers)
      expect(result.testOnly).toHaveLength(1)
      expect(result.testOnly[0].testOnly).toBe(true)
      expect(result.hasUiConsumer).toBe(false)
    })

    it('混合消费者 → 三类各归其位', () => {
      const consumers = [
        makeConsumer({ file: 'src/pages/A.tsx' }),
        makeConsumer({ file: 'src/store/bStore.ts', isStoreDir: true }),
        makeConsumer({ file: 'src/store/c.test.ts', testOnly: true }),
      ]
      const result = classifyConsumers(consumers)
      expect(result.ui).toHaveLength(1)
      expect(result.storeDir).toHaveLength(1)
      expect(result.testOnly).toHaveLength(1)
      expect(result.hasUiConsumer).toBe(true)
    })

    it('testOnly=true + isStoreDir=true → 归入 testOnly（testOnly 优先）', () => {
      const consumers = [makeConsumer({ file: 'src/store/x.test.ts', testOnly: true, isStoreDir: true })]
      const result = classifyConsumers(consumers)
      expect(result.testOnly).toHaveLength(1)
      expect(result.storeDir).toHaveLength(0)
      expect(result.ui).toHaveLength(0)
    })
  })
})