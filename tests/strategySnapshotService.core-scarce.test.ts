/**
 * @test_id V9-TEST-UT-060-CORE
 * @covers V6 评分≥4.0 的核心稀缺组合分类与快照持久化
 *
 * 验证点：
 * 1. 构造 V6 评分≥4.0、L1≥3.5、L7≥3.5 的模拟数据，验证核心稀缺组合正确显示标的
 * 2. 边界条件：综合分≥4.0 但 L1/L7 不达标的标的不应进入核心组合
 * 3. 快照保存功能：写入 IndexedDB 后可通过 getLatestSnapshot / listSnapshots 正确加载
 * 4. 版本递增：连续保存版本号单调递增
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import {
  CORE_RESOURCE_DEFAULT_CORE_SYMBOLS,
  CORE_RESOURCE_SYMBOL_WHITELIST,
} from '@/config/symbols'
import type { RotationSectorScore, Stock, V6Score } from '@/data/types'
import {
  buildGroupSnapshot,
  classifyStocks,
  getLatestSnapshot,
  listSnapshots,
  saveStrategySnapshot,
} from '@/services/trading/strategySnapshotService'

// ============================================================
// 测试辅助函数
// ============================================================

function makeStock(symbol: string, name: string, sector?: string, industryCode?: string): Stock {
  return {
    symbol,
    name,
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
    sector,
    industryCode,
  }
}

function makeV6Score(symbol: string, score: number, factors: Record<string, number>): V6Score {
  return {
    symbol,
    score,
    factors,
    algorithmVersion: 'v6-test',
    calculatedAt: Date.now(),
    dataVersion: 1,
  }
}

function makeRotationScore(
  sectorCode: string,
  resonance: number,
  overrides?: Partial<RotationSectorScore>,
): RotationSectorScore {
  return {
    id: `${sectorCode}__2026-08-09`,
    sectorCode,
    sectorName: sectorCode,
    scoreDate: '2026-08-09',
    f1Jingqi: 30,
    f2Zijin: 20,
    f3Guzhi: 10,
    f4Beta: 5,
    f5Nengliang: 2,
    total: 67,
    resonance,
    signal: '中信号',
    alertLevel: '常态锁仓',
    declineType: '杀估值',
    poolStocks: [],
    modelUsed: 'rotation-test',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * 构造一组第四次工业革命稀缺核心资源主题的标的：
 * - symbol 取自 CORE_RESOURCE_SYMBOL_WHITELIST
 * - V6 综合评分 ≥ 4.0
 * - 估值因子(L1) ≥ 3.5
 * - 情绪因子(L7) ≥ 3.5
 */
function buildCoreScarceDataset(): { stocks: Stock[]; v6Scores: V6Score[]; rotationScores: RotationSectorScore[] } {
  // 选取白名单中前 5 只 A 股标的构造核心稀缺数据
  const coreSymbols = CORE_RESOURCE_DEFAULT_CORE_SYMBOLS.slice(0, 5)

  const stockMeta: Record<string, { name: string; sector: string; industryCode: string }> = {
    '002371.SZ': { name: '北方华创', sector: '半导体', industryCode: '半导体设备' },
    '000063.SZ': { name: '中兴通讯', sector: '通信', industryCode: '通信设备' },
    '601138.SH': { name: '工业富联', sector: '电子', industryCode: '电子制造' },
    '002230.SZ': { name: '科大讯飞', sector: '计算机', industryCode: '人工智能' },
    '002415.SZ': { name: '海康威视', sector: '电子', industryCode: '机器视觉' },
  }

  const stocks: Stock[] = coreSymbols.map((symbol) => {
    const meta = stockMeta[symbol] ?? { name: symbol, sector: '半导体', industryCode: '集成电路' }
    return makeStock(symbol, meta.name, meta.sector, meta.industryCode)
  })

  // V6 评分：综合分 4.2~4.8，L1 估值 3.6~4.2，L7 情绪 3.6~4.2（均 ≥ 3.5）
  const v6Scores: V6Score[] = coreSymbols.map((symbol, idx) =>
    makeV6Score(symbol, 4.2 + idx * 0.12, {
      L1: 3.6 + (idx % 3) * 0.2,
      L7: 3.7 + (idx % 2) * 0.3,
      L3V: 3.0 + (idx % 2) * 0.5,
      L3F: 3.5 + (idx % 3) * 0.2,
    }),
  )

  const rotationScores: RotationSectorScore[] = [
    makeRotationScore('半导体', 75, { swLevel1: '半导体设备' }),
    makeRotationScore('通信', 65, { swLevel1: '通信设备' }),
    makeRotationScore('电子', 70, { swLevel1: '电子制造' }),
    makeRotationScore('计算机', 60, { swLevel1: '人工智能' }),
  ]

  return { stocks, v6Scores, rotationScores }
}

describe('strategySnapshotService — 核心稀缺组合验证', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  })

  // ============================================================
  // 任务1：构造 V6 评分≥4.0 的模拟数据，验证核心稀缺组合显示
  // ============================================================
  describe('核心稀缺组合分类', () => {
    it('V6 评分≥4.0 且 L1/L7≥3.5 的标的全部进入核心稀缺组合', () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')

      // 全部 5 只标的都应进入核心组合
      expect(coreItems).toHaveLength(stocks.length)

      // 验证每只标的的分类与评分
      const coreSymbolSet = new Set(coreItems.map((i) => i.symbol))
      for (const stock of stocks) {
        expect(coreSymbolSet.has(stock.symbol)).toBe(true)
      }

      // 验证核心组合的 reasons 包含阈值说明
      const firstItem = coreItems[0]!
      expect(firstItem.reasons[0]).toMatch(/综合分.*≥ 4\.0/)
      expect(firstItem.reasons[0]).toMatch(/估值\(L1\).*≥ 3\.5/)
      expect(firstItem.reasons[0]).toMatch(/情绪\(L7\).*≥ 3\.5/)
    })

    it('buildGroupSnapshot 正确汇总核心组合的 count/avg/max/symbols', () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')
      const snapshot = buildGroupSnapshot(coreItems)

      expect(snapshot.count).toBe(stocks.length)
      expect(snapshot.symbols).toEqual(expect.arrayContaining(stocks.map((s) => s.symbol)))
      expect(snapshot.maxComposite).toBeGreaterThanOrEqual(4.0)
      expect(snapshot.avgComposite).toBeGreaterThanOrEqual(4.0)
      expect(snapshot.items).toHaveLength(stocks.length)

      // 验证 snapshot.items 包含 symbol/name/composite/classification
      const firstEntry = snapshot.items[0]!
      expect(firstEntry).toHaveProperty('symbol')
      expect(firstEntry).toHaveProperty('name')
      expect(firstEntry).toHaveProperty('composite')
      expect(firstEntry.classification).toBe('core')
    })

    it('核心组合标的来源于 CORE_RESOURCE_SYMBOL_WHITELIST 白名单', () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreSymbols = items.filter((i) => i.classification === 'core').map((i) => i.symbol)

      // 验证所有核心标的均在白名单内
      for (const symbol of coreSymbols) {
        expect(CORE_RESOURCE_SYMBOL_WHITELIST).toContain(symbol)
      }
    })
  })

  // ============================================================
  // 边界条件验证
  // ============================================================
  describe('核心稀缺边界条件', () => {
    it('综合分≥4.0 但 L7<3.5 的标的不应进入核心组合', () => {
      const stocks: Stock[] = [makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')]
      const v6Scores: V6Score[] = [makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 3.4, L3V: 3.5 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('半导体', 75)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')

      expect(coreItems).toHaveLength(0)
    })

    it('综合分≥4.0 但 L1<3.5 的标的不应进入核心组合', () => {
      const stocks: Stock[] = [makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')]
      const v6Scores: V6Score[] = [makeV6Score('002371.SZ', 4.5, { L1: 3.4, L7: 4.0, L3V: 3.5 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('半导体', 75)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')

      expect(coreItems).toHaveLength(0)
    })

    it('综合分<4.0 的标的不应进入核心组合', () => {
      const stocks: Stock[] = [makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')]
      const v6Scores: V6Score[] = [makeV6Score('002371.SZ', 3.9, { L1: 4.0, L7: 4.0, L3V: 3.5 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('半导体', 75)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')

      expect(coreItems).toHaveLength(0)
    })

    it('综合分刚好 4.0 且 L1/L7 刚好 3.5 应进入核心组合（边界包含）', () => {
      const stocks: Stock[] = [makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')]
      const v6Scores: V6Score[] = [makeV6Score('002371.SZ', 4.0, { L1: 3.5, L7: 3.5, L3V: 3.5 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('半导体', 75)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const coreItems = items.filter((i) => i.classification === 'core')

      expect(coreItems).toHaveLength(1)
      expect(coreItems[0]!.composite).toBe(4.0)
      expect(coreItems[0]!.l1Score).toBe(3.5)
      expect(coreItems[0]!.l7Score).toBe(3.5)
    })

    it('无 V6 评分的标的应被跳过且不影响其他标的分类', () => {
      const stocks: Stock[] = [
        makeStock('002371.SZ', '北方华创', '半导体', '半导体设备'),
        makeStock('999999.SZ', 'NoScore', '其他', '其他'),
      ]
      const v6Scores: V6Score[] = [makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('半导体', 75)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })

      expect(items).toHaveLength(1)
      expect(items[0]!.symbol).toBe('002371.SZ')
      expect(items[0]!.classification).toBe('core')
    })
  })

  // ============================================================
  // 任务3：检查策略快照保存功能
  // ============================================================
  describe('快照保存与加载', () => {
    it('saveStrategySnapshot 将核心稀缺组合写入 IndexedDB 并可通过 getLatestSnapshot 加载', async () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const saveResult = await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, 'manual')

      expect(saveResult.success).toBe(true)
      expect(saveResult.data).toBeDefined()
      expect(saveResult.data!.version).toBe(1)
      expect(saveResult.data!.core.count).toBe(stocks.length)
      expect(saveResult.data!.core.symbols).toEqual(expect.arrayContaining(stocks.map((s) => s.symbol)))
      expect(saveResult.data!.trigger).toBe('manual')
      expect(saveResult.data!.stockCount).toBe(stocks.length)
      expect(saveResult.data!.scoreCount).toBe(v6Scores.length)
      expect(saveResult.data!.rotationCount).toBe(rotationScores.length)

      // 通过 getLatestSnapshot 加载验证
      const latest = await getLatestSnapshot()
      expect(latest.success).toBe(true)
      expect(latest.data).toBeDefined()
      expect(latest.data!.id).toBe(saveResult.data!.id)
      expect(latest.data!.core.count).toBe(stocks.length)
      expect(latest.data!.core.symbols).toEqual(expect.arrayContaining(stocks.map((s) => s.symbol)))

      // 验证加载的快照 items 包含完整的 symbol/name/composite
      const loadedCoreItem = latest.data!.core.items.find((i) => i.symbol === '002371.SZ')
      expect(loadedCoreItem).toBeDefined()
      expect(loadedCoreItem!.name).toBe('北方华创')
      expect(loadedCoreItem!.composite).toBeGreaterThanOrEqual(4.0)
      expect(loadedCoreItem!.classification).toBe('core')
    })

    it('listSnapshots 返回已保存的快照列表（按时间倒序）', async () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, 'first')
      await new Promise((resolve) => setTimeout(resolve, 10))
      await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, 'second')

      const list = await listSnapshots(20)
      expect(list.success).toBe(true)
      expect(list.data).toHaveLength(2)

      // 最新快照排在前面
      expect(list.data![0]!.version).toBe(2)
      expect(list.data![1]!.version).toBe(1)
      expect(list.data![0]!.timestamp).toBeGreaterThan(list.data![1]!.timestamp)

      // 两次保存的核心组合一致
      expect(list.data![0]!.core.count).toBe(stocks.length)
      expect(list.data![1]!.core.count).toBe(stocks.length)
    })

    it('连续保存版本号单调递增', async () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const r1 = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      expect(r1.data!.version).toBe(1)

      await new Promise((resolve) => setTimeout(resolve, 10))
      const r2 = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      expect(r2.data!.version).toBe(2)

      await new Promise((resolve) => setTimeout(resolve, 10))
      const r3 = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      expect(r3.data!.version).toBe(3)
    })

    it('changeFromPrev 记录首次保存时全部标的为新增', async () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      const result = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })

      expect(result.success).toBe(true)
      expect(result.data!.changeFromPrev).toBeDefined()
      expect(result.data!.changeFromPrev!.totalChange).toBe(stocks.length)
      expect(result.data!.changeFromPrev!.coreChange.added).toEqual(
        expect.arrayContaining(stocks.map((s) => s.symbol)),
      )
      expect(result.data!.changeFromPrev!.coreChange.removed).toEqual([])
    })

    it('第二次保存相同数据时 changeFromPrev 标记无新增无移除', async () => {
      const { stocks, v6Scores, rotationScores } = buildCoreScarceDataset()

      await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const second = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })

      expect(second.success).toBe(true)
      expect(second.data!.changeFromPrev!.totalChange).toBe(0)
      expect(second.data!.changeFromPrev!.coreChange.added).toEqual([])
      expect(second.data!.changeFromPrev!.coreChange.removed).toEqual([])
    })

    it('空股票池时 saveSnapshot 不抛错且返回版本 1', async () => {
      const result = await saveStrategySnapshot({ stocks: [], v6Scores: [], rotationScores: [] })

      expect(result.success).toBe(true)
      expect(result.data!.version).toBe(1)
      expect(result.data!.core.count).toBe(0)
      expect(result.data!.hot.count).toBe(0)
      expect(result.data!.value.count).toBe(0)
      expect(result.data!.stockCount).toBe(0)
    })
  })
})
