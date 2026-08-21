/**
 * lib/store-audit/index (re-export) + 核心算法 — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量 Round 3）：新增独立测试文件，不编辑/不删除已有测试。
 *
 * 被测入口：src/lib/store-audit/index.ts
 *   - stmt_miss = 1 （唯一 miss：import 导入 ./analyzer 后通过 re-export 导出语句）
 *   - 策略：通过 @/lib/store-audit 入口导入 4 个函数并调用（不是直接 import ./analyzer），
 *     让 V8 记录 index.ts L60-L64 的 re-export 执行路径。
 *
 * 同步覆盖 analyzer.ts 的关键分支（computeTransitiveReachability BFS 分支：
 *   while 空/非空、some hasUiConsumer、newReachable.length>0、continue 去重、
 *   transitiveOnly 过滤等），markFacadeStores 的 deps.length>0 分支，
 *   classifyConsumers 三段 filter，isTestFile 的 || 双分支。
 */
import { describe, it, expect } from 'vitest'
import {
  computeTransitiveReachability,
  markFacadeStores,
  isTestFile,
  classifyConsumers,
} from './index'
import type { StoreMeta, ConsumerRef } from './types'

function meta(fileName: string, overrides: Partial<StoreMeta> = {}): StoreMeta {
  return {
    fileName,
    filePath: `/src/store/${fileName}.ts`,
    hookName: 'use' + fileName[0]!.toUpperCase() + fileName.slice(1),
    deprecated: false,
    isFacade: false,
    aggregates: [],
    ...overrides,
  }
}

function consumer(opts: Partial<ConsumerRef> = {}): ConsumerRef {
  return {
    file: opts.file ?? 'src/pages/Dashboard.tsx',
    line: opts.line ?? 1,
    importType: opts.importType ?? 'absolute',
    testOnly: opts.testOnly ?? false,
    commentOnly: opts.commentOnly ?? false,
    isStoreDir: opts.isStoreDir ?? false,
    ...opts,
  }
}

describe('lib/store-audit/index (re-exported from @/lib/store-audit)', () => {
  // ============== isTestFile ==============
  describe('isTestFile(filePath)', () => {
    it('|| 左分支命中：文件名 .test.ts 结尾', () => {
      expect(isTestFile('src/lib/safeFs.test.ts')).toBe(true)
    })
    it('|| 左分支命中：文件名 .test.tsx 结尾', () => {
      expect(isTestFile('src/pages/Home.test.tsx')).toBe(true)
    })
    it('|| 右分支命中：路径含 __tests__/ 目录', () => {
      expect(isTestFile('src/components/__tests__/Table.spec.tsx')).toBe(true)
    })
    it('|| 右分支命中：Windows 反斜杠 __tests__\\ 路径', () => {
      expect(isTestFile('src\\components\\__tests__\\Table.spec.ts')).toBe(true)
    })
    it('两分支都不命中：普通生产代码文件', () => {
      expect(isTestFile('src/lib/safeFs.ts')).toBe(false)
    })
    it('.spec 后缀不算（规则限定 .test.）', () => {
      expect(isTestFile('src/lib/foo.spec.ts')).toBe(false)
    })
  })

  // ============== markFacadeStores ==============
  describe('markFacadeStores(metas, graph)', () => {
    it('deps.length > 0 → isFacade = true + aggregates 写入', () => {
      const metas = [meta('parentStore'), meta('childStore')]
      const graph = new Map<string, string[]>([
        ['parentStore', ['childStore']],
      ])
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(true)
      expect(metas[0]!.aggregates).toEqual(['childStore'])
    })

    it('deps.length = 0（graph.get 返回 []，空数组分支）→ 保持原样', () => {
      const metas = [meta('solitaryStore')]
      const graph = new Map<string, string[]>([['solitaryStore', []]])
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(false)
      expect(metas[0]!.aggregates).toEqual([])
    })

    it('graph 中不存在对应 key → ?? [] 分支命中，保持原样', () => {
      const metas = [meta('orphanStore')]
      const graph = new Map<string, string[]>()
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(false)
      expect(metas[0]!.aggregates).toEqual([])
    })

    it('多 Store 混合：部分 Facade，部分 Leaf，互不干扰', () => {
      const metas = [
        meta('aggStore'),
        meta('leafStore1'),
        meta('leafStore2'),
      ]
      const graph = new Map<string, string[]>([
        ['aggStore', ['leafStore1', 'leafStore2']],
      ])
      markFacadeStores(metas, graph)
      expect(metas[0]!.isFacade).toBe(true)
      expect(metas[1]!.isFacade).toBe(false)
      expect(metas[2]!.isFacade).toBe(false)
    })
  })

  // ============== classifyConsumers ==============
  describe('classifyConsumers(consumers)', () => {
    it('UI 层消费者（!testOnly && !isStoreDir）→ ui 桶命中 + hasUiConsumer=true', () => {
      const c = consumer()
      const r = classifyConsumers([c])
      expect(r.ui).toHaveLength(1)
      expect(r.storeDir).toHaveLength(0)
      expect(r.testOnly).toHaveLength(0)
      expect(r.hasUiConsumer).toBe(true)
    })

    it('Store 层消费者（isStoreDir=true && !testOnly）→ storeDir 桶命中', () => {
      const c = consumer({ isStoreDir: true, file: 'src/store/other.ts' })
      const r = classifyConsumers([c])
      expect(r.ui).toHaveLength(0)
      expect(r.storeDir).toHaveLength(1)
      expect(r.testOnly).toHaveLength(0)
      expect(r.hasUiConsumer).toBe(false)
    })

    it('纯测试消费者（testOnly=true）→ testOnly 桶命中', () => {
      const c = consumer({ testOnly: true, file: 'src/lib/foo.test.ts' })
      const r = classifyConsumers([c])
      expect(r.ui).toHaveLength(0)
      expect(r.storeDir).toHaveLength(0)
      expect(r.testOnly).toHaveLength(1)
      expect(r.hasUiConsumer).toBe(false)
    })

    it('混合三类消费者 → 各自进各自桶，hasUiConsumer 跟随 ui.length>0', () => {
      const ui1 = consumer({ file: 'pages/a.tsx' })
      const store1 = consumer({ isStoreDir: true, file: 'store/x.ts' })
      const test1 = consumer({ testOnly: true, file: 'a.test.ts' })
      const test2 = consumer({ testOnly: true, isStoreDir: true, file: 'store/x.test.ts' })
      const r = classifyConsumers([ui1, store1, test1, test2])
      expect(r.ui.length).toBe(1)
      expect(r.storeDir.length).toBe(1)
      expect(r.testOnly.length).toBe(2)
      expect(r.hasUiConsumer).toBe(true)
    })

    it('空数组 → 三个桶都空，hasUiConsumer=false', () => {
      const r = classifyConsumers([])
      expect(r.ui).toEqual([])
      expect(r.storeDir).toEqual([])
      expect(r.testOnly).toEqual([])
      expect(r.hasUiConsumer).toBe(false)
    })
  })

  // ============== computeTransitiveReachability ==============
  describe('computeTransitiveReachability BFS', () => {
    it('UI 直接消费的 Store 进入 BFS 起点（hasUiConsumer = true 分支）', () => {
      const metas = [meta('usedStore'), meta('unusedStore')]
      const graph = new Map<string, string[]>()
      const consumers = new Map<string, ConsumerRef[]>([
        ['usedStore', [consumer()]],
        ['unusedStore', []],
      ])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(r.diagnostics.startingPoints).toEqual(['usedStore'])
      expect(r.reachable.has('usedStore')).toBe(true)
      expect(r.reachable.has('unusedStore')).toBe(false)
    })

    it('仅 testOnly=true 的消费者 → 不进入 BFS 起点', () => {
      const metas = [meta('testOnlyStore')]
      const graph = new Map()
      const consumers = new Map([['testOnlyStore', [consumer({ testOnly: true })]]])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(r.diagnostics.startingPoints).toEqual([])
      expect(r.reachable.size).toBe(0)
    })

    it('仅 isStoreDir=true 的消费者（Store-to-Store）→ 不进入 BFS 起点', () => {
      const metas = [meta('internalStore')]
      const graph = new Map()
      const consumers = new Map([['internalStore', [consumer({ isStoreDir: true })]]])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(r.diagnostics.startingPoints).toEqual([])
      expect(r.reachable.size).toBe(0)
    })

    it('BFS 正向遍历：UI 用 A，A 依赖 B → B 也可达（传递分支）', () => {
      const metas = [meta('A'), meta('B')]
      const graph = new Map<string, string[]>([['A', ['B']]])
      const consumers = new Map<string, ConsumerRef[]>([['A', [consumer()]]])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(r.diagnostics.startingPoints).toEqual(['A'])
      expect(Array.from(r.reachable).sort()).toEqual(['A', 'B'])
      expect(r.diagnostics.transitiveOnly).toEqual(['B'])
      expect(r.diagnostics.traversalPath).toHaveLength(1)
      expect(r.diagnostics.traversalPath[0]).toEqual({ current: 'A', newReachable: ['B'] })
    })

    it('BFS 去重分支 reachable.has(imported)：A→C，B→C（钻石依赖）→ C 只进队一次', () => {
      const metas = [meta('A'), meta('B'), meta('C')]
      const graph = new Map<string, string[]>([
        ['A', ['C']],
        ['B', ['C']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([
        ['A', [consumer()]],
        ['B', [consumer()]],
      ])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(Array.from(r.reachable).sort()).toEqual(['A', 'B', 'C'])
      // traversalPath 中 C 只能出现一次 newReachable
      const cAppearances = r.diagnostics.traversalPath
        .flatMap(n => n.newReachable)
        .filter(n => n === 'C').length
      expect(cAppearances).toBe(1)
    })

    it('自环依赖：A→A → 不会死循环（continue 分支命中）', () => {
      const metas = [meta('A')]
      const graph = new Map<string, string[]>([['A', ['A']]])
      const consumers = new Map<string, ConsumerRef[]>([['A', [consumer()]]])
      expect(() => {
        const r = computeTransitiveReachability(metas, graph, consumers)
        expect(Array.from(r.reachable)).toEqual(['A'])
        expect(r.diagnostics.traversalPath).toHaveLength(0) // 无 newReachable
      }).not.toThrow()
    })

    it('while queue 空分支：0 起点直接 return，traversalPath=[] transitiveOnly=[]', () => {
      const metas = [meta('neverUsed')]
      const graph = new Map<string, string[]>([['neverUsed', ['other']]])
      const consumers = new Map<string, ConsumerRef[]>()
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(r.reachable.size).toBe(0)
      expect(r.diagnostics.startingPoints).toEqual([])
      expect(r.diagnostics.traversalPath).toEqual([])
      expect(r.diagnostics.transitiveOnly).toEqual([])
    })

    it('newReachable.length = 0（某节点导入都已 reachable）→ traversalPath 不 push 该节点', () => {
      // A → [B, C], start: A, B, C；A 处理时 B、C 都已存在 → A 的 newReachable 空
      const metas = [meta('A'), meta('B'), meta('C')]
      const graph = new Map<string, string[]>([['A', ['B', 'C']]])
      const consumers = new Map<string, ConsumerRef[]>([
        ['A', [consumer()]],
        ['B', [consumer()]],
        ['C', [consumer()]],
      ])
      const r = computeTransitiveReachability(metas, graph, consumers)
      // 遍历过程中，A 出队时 B、C 都已 reachable → newReachable.length=0 → 不 push
      const hasAInPath = r.diagnostics.traversalPath.some(n => n.current === 'A')
      expect(hasAInPath).toBe(false)
    })

    it('5 层链 BFS：A→B→C→D→E，每层独立入队，路径顺序 = 层级序', () => {
      const metas = [meta('A'), meta('B'), meta('C'), meta('D'), meta('E')]
      const graph = new Map<string, string[]>([
        ['A', ['B']], ['B', ['C']], ['C', ['D']], ['D', ['E']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([['A', [consumer()]]])
      const r = computeTransitiveReachability(metas, graph, consumers)
      expect(Array.from(r.reachable).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
      // 顺序：A→B, B→C, C→D, D→E
      expect(r.diagnostics.traversalPath.map(n => n.current)).toEqual(['A', 'B', 'C', 'D'])
      expect(r.diagnostics.traversalPath.map(n => n.newReachable[0])).toEqual(['B', 'C', 'D', 'E'])
    })

    it('双向循环 A↔B：A 起点 → B 首次访问添加，后续 B→A 命中 has（continue 分支）不死循环', () => {
      const metas = [meta('A'), meta('B')]
      const graph = new Map<string, string[]>([
        ['A', ['B']], ['B', ['A']],
      ])
      const consumers = new Map<string, ConsumerRef[]>([['A', [consumer()]]])
      expect(() => {
        const r = computeTransitiveReachability(metas, graph, consumers)
        expect(Array.from(r.reachable).sort()).toEqual(['A', 'B'])
        // B 新增时 newReachable=[A]，但 A 已 reachable → newReachable 空
        expect(r.diagnostics.traversalPath.map(n => n.current)).toEqual(['A'])
      }).not.toThrow()
    })
  })
})
