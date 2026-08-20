import { describe, it, expect } from 'vitest'
import {
  isTestFile,
  markFacadeStores,
  computeTransitiveReachability,
  classifyConsumers,
} from './analyzer'
import type { StoreMeta, ConsumerRef } from './types'

function makeMeta(fileName: string): StoreMeta {
  return {
    fileName,
    filePath: `/src/store/${fileName}.ts`,
    hookName: `use${fileName.charAt(0).toUpperCase() + fileName.slice(1)}`,
    deprecated: false,
    isFacade: false,
    aggregates: [],
  }
}

function makeConsumer(partial: Partial<ConsumerRef> & { file: string }): ConsumerRef {
  return {
    line: 1,
    importType: 'absolute',
    testOnly: false,
    commentOnly: false,
    isStoreDir: false,
    ...partial,
  }
}

describe('lib/store-audit/analyzer', () => {
  describe('isTestFile', () => {
    it('识别 .test.ts 文件', () => {
      expect(isTestFile('src/lib/foo.test.ts')).toBe(true)
      expect(isTestFile('src/store/bar.test.tsx')).toBe(true)
    })

    it('识别 __tests__/ 目录', () => {
      expect(isTestFile('tests/__tests__/integration/foo.spec.ts')).toBe(true)
      expect(isTestFile('src\\__tests__\\bar.test.ts')).toBe(true)
    })

    it('正常代码文件返回 false', () => {
      expect(isTestFile('src/lib/foo.ts')).toBe(false)
      expect(isTestFile('src/store/bar.tsx')).toBe(false)
      expect(isTestFile('tests/e2e/spec.ts')).toBe(false)
    })
  })

  describe('markFacadeStores', () => {
    it('空依赖图 → 无 Facade 标记', () => {
      const metas = [makeMeta('a'), makeMeta('b')]
      const graph = new Map<string, string[]>()
      markFacadeStores(metas, graph)
      expect(metas.every((m) => m.isFacade === false)).toBe(true)
      expect(metas.every((m) => m.aggregates.length === 0)).toBe(true)
    })

    it('有依赖的 Store 被标记为 Facade', () => {
      const metas = [makeMeta('root'), makeMeta('leaf')]
      const graph = new Map<string, string[]>([['root', ['leaf']]])
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(true)
      expect(metas[0]!.aggregates).toEqual(['leaf'])
      expect(metas[1]!.isFacade).toBe(false)
      expect(metas[1]!.aggregates).toEqual([])
    })

    it('多子 Store 的 Facade 聚合正确', () => {
      const metas = [makeMeta('super'), makeMeta('a'), makeMeta('b')]
      const graph = new Map<string, string[]>([['super', ['a', 'b']]])
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(true)
      expect(metas[0]!.aggregates).toEqual(['a', 'b'])
    })
  })

  describe('computeTransitiveReachability', () => {
    it('无消费者 → 起点为空，reachable 为空', () => {
      const metas = [makeMeta('a')]
      const graph = new Map<string, string[]>()
      const consumers = new Map<string, ConsumerRef[]>()
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(reachable.size).toBe(0)
      expect(diagnostics.startingPoints).toEqual([])
      expect(diagnostics.transitiveOnly).toEqual([])
      expect(diagnostics.traversalPath).toEqual([])
    })

    it('仅 UI 消费者作为起点，Store-to-Store 导入不计为起点', () => {
      const metas = [makeMeta('usedStore'), makeMeta('privateStore')]
      const graph = new Map<string, string[]>([['usedStore', ['privateStore']]])
      const consumers = new Map<string, ConsumerRef[]>([
        ['usedStore', [makeConsumer({ file: 'src/pages/Home.tsx', isStoreDir: false, testOnly: false })]],
        // privateStore 仅被 Store 层导入 → 不应成为起点
        ['privateStore', [makeConsumer({ file: 'src/store/usedStore.ts', isStoreDir: true, testOnly: false })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(diagnostics.startingPoints).toEqual(['usedStore'])
      expect(reachable.has('usedStore')).toBe(true)
      expect(reachable.has('privateStore')).toBe(true)
      expect(diagnostics.transitiveOnly).toEqual(['privateStore'])
      expect(diagnostics.traversalPath.length).toBe(1)
      expect(diagnostics.traversalPath[0]!.current).toBe('usedStore')
      expect(diagnostics.traversalPath[0]!.newReachable).toEqual(['privateStore'])
    })

    it('仅被 Store 导入的 Store（UI 不使用 Facade）→ 不应该可达', () => {
      const metas = [makeMeta('facadeA'), makeMeta('leafStore')]
      const graph = new Map<string, string[]>([['facadeA', ['leafStore']]])
      const consumers = new Map<string, ConsumerRef[]>([
        // facadeA 仅被 Store 层导入
        ['facadeA', [makeConsumer({ file: 'src/store/otherStore.ts', isStoreDir: true, testOnly: false })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(diagnostics.startingPoints).toEqual([])
      expect(reachable.size).toBe(0)
      expect(reachable.has('leafStore')).toBe(false)
    })

    it('自环依赖 A→A，BFS 不死循环', () => {
      const metas = [makeMeta('a')]
      const graph = new Map<string, string[]>([['a', ['a']]])
      const consumers = new Map<string, ConsumerRef[]>([
        ['a', [makeConsumer({ file: 'src/pages/P.tsx', isStoreDir: false, testOnly: false })]],
      ])
      const { reachable } = computeTransitiveReachability(metas, graph, consumers)
      expect(reachable.size).toBe(1)
      expect(reachable.has('a')).toBe(true)
    })

    it('钻石依赖：leafStore 只入队一次', () => {
      const metas = [makeMeta('ui'), makeMeta('f1'), makeMeta('f2'), makeMeta('leaf')]
      const graph = new Map<string, string[]>([
        ['ui', ['f1', 'f2']],
        ['f1', ['leaf']],
        ['f2', ['leaf']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([
        ['ui', [makeConsumer({ file: 'src/pages/P.tsx', testOnly: false, isStoreDir: false })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(reachable.size).toBe(4)
      // traversalPath 中 leaf 只出现一次 newReachable
      const leafOccurrences = diagnostics.traversalPath.filter((p) => p.newReachable.includes('leaf'))
      expect(leafOccurrences.length).toBe(1)
    })

    it('双向循环 A↔B，BFS 不死循环', () => {
      const metas = [makeMeta('a'), makeMeta('b')]
      const graph = new Map<string, string[]>([
        ['a', ['b']],
        ['b', ['a']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([
        ['a', [makeConsumer({ file: 'src/pages/P.tsx', testOnly: false, isStoreDir: false })]],
      ])
      const { reachable } = computeTransitiveReachability(metas, graph, consumers)
      expect(reachable.size).toBe(2)
    })

    it('5 层深度链：BFS 按层级顺序遍历', () => {
      const order = ['l0', 'l1', 'l2', 'l3', 'l4']
      const metas = order.map(makeMeta)
      const graph = new Map<string, string[]>([
        ['l0', ['l1']],
        ['l1', ['l2']],
        ['l2', ['l3']],
        ['l3', ['l4']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([
        ['l0', [makeConsumer({ file: 'src/pages/P.tsx', testOnly: false, isStoreDir: false })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(reachable.size).toBe(5)
      expect(diagnostics.traversalPath.map((p) => p.current)).toEqual(['l0', 'l1', 'l2', 'l3'])
      expect(diagnostics.traversalPath.map((p) => p.newReachable.join(''))).toEqual(['l1', 'l2', 'l3', 'l4'])
    })

    it('testOnly 消费者不计为起点', () => {
      const metas = [makeMeta('testOnlyStore')]
      const graph = new Map<string, string[]>()
      const consumers = new Map<string, ConsumerRef[]>([
        ['testOnlyStore', [makeConsumer({ file: 'src/lib/foo.test.ts', testOnly: true, isStoreDir: false })]],
      ])
      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, consumers)
      expect(diagnostics.startingPoints).toEqual([])
      expect(reachable.size).toBe(0)
    })
  })

  describe('classifyConsumers', () => {
    it('空列表 → 三类全空，hasUiConsumer=false', () => {
      const r = classifyConsumers([])
      expect(r.ui).toEqual([])
      expect(r.storeDir).toEqual([])
      expect(r.testOnly).toEqual([])
      expect(r.hasUiConsumer).toBe(false)
    })

    it('正确分类三类消费者', () => {
      const consumers: ConsumerRef[] = [
        makeConsumer({ file: 'src/pages/H.tsx', testOnly: false, isStoreDir: false }), // UI
        makeConsumer({ file: 'src/store/A.ts', testOnly: false, isStoreDir: true }), // Store
        makeConsumer({ file: 'src/store/B.test.ts', testOnly: true, isStoreDir: true }), // Test
        makeConsumer({ file: 'src/lib/C.test.ts', testOnly: true, isStoreDir: false }), // Test
      ]
      const r = classifyConsumers(consumers)
      expect(r.ui.length).toBe(1)
      expect(r.storeDir.length).toBe(1)
      expect(r.testOnly.length).toBe(2)
      expect(r.hasUiConsumer).toBe(true)
    })

    it('无 UI 消费者时 hasUiConsumer=false', () => {
      const consumers: ConsumerRef[] = [
        makeConsumer({ file: 'src/store/A.ts', testOnly: false, isStoreDir: true }),
        makeConsumer({ file: 'tests/spec.ts', testOnly: true, isStoreDir: false }),
      ]
      const r = classifyConsumers(consumers)
      expect(r.hasUiConsumer).toBe(false)
    })
  })
})
