/**
 * @test_id V9-TEST-UT-061-INTEGRITY
 * @covers 策略快照 IndexedDB 数据完整性与重复写入检查
 *
 * 验证点：
 * 1. 保存多个快照后，所有快照 id 唯一（无重复写入）
 * 2. 版本号单调递增且不重复
 * 3. 每个快照的字段完整（core/hot/value/changeFromPrev/trigger 等）
 * 4. 快照数据可正确序列化/反序列化（无数据损坏）
 * 5. 连续保存相同数据不会产生重复标的
 * 6. 时间戳唯一性
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import type { RotationSectorScore, Stock, V6Score, StrategySnapshot } from '@/data/types'
import {
  saveStrategySnapshot,
  getLatestSnapshot,
  listSnapshots,
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

function makeRotationScore(sectorCode: string, resonance: number): RotationSectorScore {
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
  }
}

function buildDataset(): { stocks: Stock[]; v6Scores: V6Score[]; rotationScores: RotationSectorScore[] } {
  const stocks: Stock[] = [
    makeStock('002371.SZ', '北方华创', '半导体', '半导体设备'),
    makeStock('000063.SZ', '中兴通讯', '通信', '通信设备'),
    makeStock('601138.SH', '工业富联', '电子', '电子制造'),
    makeStock('002230.SZ', '科大讯飞', '计算机', '人工智能'),
    makeStock('002415.SZ', '海康威视', '电子', '机器视觉'),
  ]
  const v6Scores: V6Score[] = [
    makeV6Score('002371.SZ', 4.2, { L1: 3.6, L7: 3.7, L3V: 3.0, L3F: 3.5 }),
    makeV6Score('000063.SZ', 4.32, { L1: 3.8, L7: 4.0, L3V: 3.5, L3F: 3.7 }),
    makeV6Score('601138.SH', 4.44, { L1: 4.0, L7: 3.7, L3V: 3.0, L3F: 3.9 }),
    makeV6Score('002230.SZ', 4.56, { L1: 3.6, L7: 4.0, L3V: 3.5, L3F: 3.5 }),
    makeV6Score('002415.SZ', 4.68, { L1: 4.0, L7: 3.7, L3V: 3.0, L3F: 3.9 }),
  ]
  const rotationScores: RotationSectorScore[] = [
    makeRotationScore('半导体', 75),
    makeRotationScore('通信', 65),
    makeRotationScore('电子', 70),
    makeRotationScore('计算机', 60),
  ]
  return { stocks, v6Scores, rotationScores }
}

/** 验证单个快照的字段完整性 */
function assertSnapshotIntegrity(snapshot: StrategySnapshot, expectedStockCount: number): void {
  // 元数据字段
  expect(snapshot.id).toBeTruthy()
  expect(snapshot.id).toMatch(/^snapshot_\d+$/)
  expect(snapshot.version).toBeGreaterThan(0)
  expect(snapshot.timestamp).toBeGreaterThan(0)
  expect(snapshot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(snapshot.time).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  expect(snapshot.trigger).toBeTruthy()

  // 计数字段
  expect(snapshot.stockCount).toBe(expectedStockCount)
  expect(snapshot.scoreCount).toBeGreaterThan(0)
  expect(snapshot.rotationCount).toBeGreaterThan(0)

  // 三策略分组结构完整性
  for (const group of [snapshot.core, snapshot.hot, snapshot.value]) {
    expect(group).toHaveProperty('count')
    expect(group).toHaveProperty('avgComposite')
    expect(group).toHaveProperty('maxComposite')
    expect(group).toHaveProperty('symbols')
    expect(group).toHaveProperty('items')
    expect(Array.isArray(group.symbols)).toBe(true)
    expect(Array.isArray(group.items)).toBe(true)
    expect(group.count).toBe(group.symbols.length)
    expect(group.count).toBe(group.items.length)

    // 每个 item 的字段完整性
    for (const item of group.items) {
      expect(item).toHaveProperty('symbol')
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('composite')
      expect(item).toHaveProperty('classification')
      expect(typeof item.symbol).toBe('string')
      expect(typeof item.composite).toBe('number')
    }
  }

  // 变更日志结构完整性
  expect(snapshot.changeFromPrev).toBeDefined()
  expect(snapshot.changeFromPrev).toHaveProperty('totalChange')
  expect(snapshot.changeFromPrev).toHaveProperty('coreChange')
  expect(snapshot.changeFromPrev).toHaveProperty('hotChange')
  expect(snapshot.changeFromPrev).toHaveProperty('valueChange')
  expect(snapshot.changeFromPrev).toHaveProperty('scoreChanges')
  expect(snapshot.changeFromPrev!.coreChange).toHaveProperty('added')
  expect(snapshot.changeFromPrev!.coreChange).toHaveProperty('removed')
}

describe('strategySnapshotService — IndexedDB 数据完整性检查', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  })

  // ============================================================
  // 1. id 唯一性检查（无重复写入）
  // ============================================================
  describe('快照 id 唯一性', () => {
    it('连续保存 3 次快照，所有 id 唯一无重复', async () => {
      const dataset = buildDataset()

      for (let i = 0; i < 3; i++) {
        const result = await saveStrategySnapshot(dataset, 'manual')
        expect(result.success).toBe(true)
        // 每次保存间隔 10ms 确保时间戳不同
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const list = await listSnapshots(20)
      expect(list.success).toBe(true)
      expect(list.data).toHaveLength(3)

      const ids = list.data!.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
      expect(ids.length).toBe(uniqueIds.size)
    })

    it('快速连续保存（最小间隔）不会产生重复 id', async () => {
      const dataset = buildDataset()

      // 顺序保存 3 次，最小间隔 15ms 确保时间戳不同
      // 注意：saveStrategySnapshot 非原子操作（getLatest→getNextVersion→put），不支持并发
      const versions: number[] = []
      for (let i = 0; i < 3; i++) {
        const result = await saveStrategySnapshot(dataset, 'manual')
        expect(result.success).toBe(true)
        versions.push(result.data!.version)
        await new Promise((resolve) => setTimeout(resolve, 15))
      }

      const list = await listSnapshots(20)
      expect(list.success).toBe(true)
      expect(list.data).toHaveLength(3)

      // 检查所有 id 唯一
      const ids = list.data!.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)

      // 版本号递增且唯一
      const uniqueVersions = new Set(versions)
      expect(uniqueVersions.size).toBe(versions.length)
    })
  })

  // ============================================================
  // 2. 版本号单调递增且不重复
  // ============================================================
  describe('版本号递增', () => {
    it('连续保存 5 次，版本号严格单调递增', async () => {
      const dataset = buildDataset()

      const versions: number[] = []
      for (let i = 0; i < 5; i++) {
        const result = await saveStrategySnapshot(dataset, 'manual')
        expect(result.success).toBe(true)
        versions.push(result.data!.version)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // 严格递增
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBeGreaterThan(versions[i - 1])
      }

      // 无重复
      const uniqueVersions = new Set(versions)
      expect(uniqueVersions.size).toBe(versions.length)
    })
  })

  // ============================================================
  // 3. 字段完整性检查
  // ============================================================
  describe('快照字段完整性', () => {
    it('保存的快照包含所有必需字段且类型正确', async () => {
      const dataset = buildDataset()
      const result = await saveStrategySnapshot(dataset, 'manual')

      expect(result.success).toBe(true)
      assertSnapshotIntegrity(result.data!, dataset.stocks.length)
    })

    it('从 IndexedDB 加载的快照字段与保存时一致（无数据损坏）', async () => {
      const dataset = buildDataset()
      const saveResult = await saveStrategySnapshot(dataset, 'manual')
      const saved = saveResult.data!

      const loadResult = await getLatestSnapshot()
      expect(loadResult.success).toBe(true)
      const loaded = loadResult.data!

      // 逐字段对比
      expect(loaded.id).toBe(saved.id)
      expect(loaded.version).toBe(saved.version)
      expect(loaded.timestamp).toBe(saved.timestamp)
      expect(loaded.date).toBe(saved.date)
      expect(loaded.time).toBe(saved.time)
      expect(loaded.stockCount).toBe(saved.stockCount)
      expect(loaded.scoreCount).toBe(saved.scoreCount)
      expect(loaded.rotationCount).toBe(saved.rotationCount)
      expect(loaded.trigger).toBe(saved.trigger)

      // 核心组合对比
      expect(loaded.core.count).toBe(saved.core.count)
      expect(loaded.core.avgComposite).toBe(saved.core.avgComposite)
      expect(loaded.core.maxComposite).toBe(saved.core.maxComposite)
      expect(loaded.core.symbols).toEqual(saved.core.symbols)
      expect(loaded.core.items).toEqual(saved.core.items)
    })

    it('快照可正确 JSON 序列化与反序列化（无循环引用、无数据损坏）', async () => {
      const dataset = buildDataset()
      const result = await saveStrategySnapshot(dataset, 'manual')
      const snapshot = result.data!

      // 序列化
      const jsonStr = JSON.stringify(snapshot)
      expect(jsonStr.length).toBeGreaterThan(0)

      // 反序列化
      const parsed = JSON.parse(jsonStr) as StrategySnapshot

      // 关键字段验证
      expect(parsed.id).toBe(snapshot.id)
      expect(parsed.version).toBe(snapshot.version)
      expect(parsed.core.symbols).toEqual(snapshot.core.symbols)
      expect(parsed.core.items).toEqual(snapshot.core.items)
      expect(parsed.changeFromPrev).toEqual(snapshot.changeFromPrev)
    })
  })

  // ============================================================
  // 4. 标的去重检查
  // ============================================================
  describe('标的去重', () => {
    it('连续保存相同数据，核心组合标的不重复', async () => {
      const dataset = buildDataset()

      await saveStrategySnapshot(dataset, 'manual')
      await new Promise((resolve) => setTimeout(resolve, 10))
      await saveStrategySnapshot(dataset, 'manual')

      const list = await listSnapshots(20)
      const latest = list.data![0]!

      // 核心组合中每个 symbol 只出现一次
      const symbols = latest.core.symbols
      const uniqueSymbols = new Set(symbols)
      expect(uniqueSymbols.size).toBe(symbols.length)
      expect(symbols).toHaveLength(5)
    })

    it('输入含重复标的时，分类结果中标的不重复', async () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0, L3V: 3.5, L3F: 3.5 })

      // stocks 数组中包含重复的同一标的
      const dataset = {
        stocks: [stock, stock, stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const result = await saveStrategySnapshot(dataset, 'manual')
      expect(result.success).toBe(true)

      // 核心组合中该标的只出现一次
      const coreSymbols = result.data!.core.symbols.filter((s) => s === '002371.SZ')
      expect(coreSymbols).toHaveLength(1)
    })
  })

  // ============================================================
  // 5. 时间戳唯一性
  // ============================================================
  describe('时间戳与版本', () => {
    it('多次保存后，每条快照的 timestamp 唯一', async () => {
      const dataset = buildDataset()

      for (let i = 0; i < 4; i++) {
        await saveStrategySnapshot(dataset, 'manual')
        await new Promise((resolve) => setTimeout(resolve, 15))
      }

      const list = await listSnapshots(20)
      const timestamps = list.data!.map((s) => s.timestamp)
      const uniqueTimestamps = new Set(timestamps)
      expect(uniqueTimestamps.size).toBe(timestamps.length)
    })
  })

  // ============================================================
  // 6. 变更日志完整性
  // ============================================================
  describe('变更日志完整性', () => {
    it('首次保存 changeFromPrev 标记全部新增', async () => {
      const dataset = buildDataset()
      const result = await saveStrategySnapshot(dataset, 'manual')

      const change = result.data!.changeFromPrev!
      expect(change.totalChange).toBe(5)
      expect(change.coreChange.added).toHaveLength(5)
      expect(change.coreChange.removed).toHaveLength(0)
      expect(change.hotChange.added).toHaveLength(0)
      expect(change.valueChange.added).toHaveLength(0)
      expect(change.scoreChanges).toHaveLength(0)
    })

    it('第二次保存相同数据 changeFromPrev 标记无变化', async () => {
      const dataset = buildDataset()

      await saveStrategySnapshot(dataset, 'manual')
      await new Promise((resolve) => setTimeout(resolve, 10))
      const second = await saveStrategySnapshot(dataset, 'manual')

      const change = second.data!.changeFromPrev!
      expect(change.totalChange).toBe(0)
      expect(change.coreChange.added).toHaveLength(0)
      expect(change.coreChange.removed).toHaveLength(0)
      expect(change.scoreChanges).toHaveLength(0)
    })

    it('标的数据变化时 changeFromPrev 正确记录增减', async () => {
      const dataset1 = buildDataset()
      await saveStrategySnapshot(dataset1, 'manual')
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 第二次保存：移除一只标的，添加一只新标的
      const dataset2 = {
        stocks: [
          ...dataset1.stocks.slice(0, 4), // 移除 002415.SZ 海康威视
          makeStock('600519.SH', '贵州茅台', '食品饮料', '白酒'),
        ],
        v6Scores: [
          ...dataset1.v6Scores.slice(0, 4),
          makeV6Score('600519.SH', 4.1, { L1: 3.8, L7: 3.6, L3V: 3.2, L3F: 3.4 }),
        ],
        rotationScores: dataset1.rotationScores,
      }
      const second = await saveStrategySnapshot(dataset2, 'manual')

      const change = second.data!.changeFromPrev!
      // 002415.SZ 被移除
      expect(change.coreChange.removed).toContain('002415.SZ')
      // 600519.SH 新增（如果满足核心条件）
      // 600519.SH composite=4.1>=4.0, L1=3.8>=3.5, L7=3.6>=3.5 → 应进入核心
      expect(change.coreChange.added).toContain('600519.SH')
    })
  })
})
