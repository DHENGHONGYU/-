import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import type { RotationSectorScore, Stock, V6Score } from '@/data/types'
import {
  buildChangeLog,
  buildGroupSnapshot,
  classifyStocks,
  getLatestSnapshot,
  listSnapshots,
  saveStrategySnapshot,
  type StrategyGroupItem,
} from '@/services/trading/strategySnapshotService'

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
    id: `${sectorCode}__2026-06-25`,
    sectorCode,
    sectorName: sectorCode,
    scoreDate: '2026-06-25',
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

describe('strategySnapshotService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  })

  describe('classifyStocks', () => {
    it('classifies core, hot and value stocks using V6 and rotation scores', () => {
      const stocks: Stock[] = [
        makeStock('000001', 'Core Bank', 'BANK', 'SW801780'),
        makeStock('000002', 'Hot Tech', 'TECH', 'SW801080'),
        makeStock('000568', 'Value Food', 'FOOD', 'SW801200'),
        makeStock('000063', 'Excluded', 'OTHER', 'SW801000'),
      ]

      const v6Scores: V6Score[] = [
        makeV6Score('000001', 4.5, { L1: 4.0, L7: 4.0, L3V: 4.0 }),
        makeV6Score('000002', 3.5, { L1: 3.0, L7: 3.0, L3V: 2.0, L3F: 3.5 }),
        makeV6Score('000568', 3.2, { L1: 3.0, L7: 3.0, L3V: 2.8, L3F: 3.5 }),
        makeV6Score('000063', 2.5, { L1: 3.0, L7: 3.0, L3V: 3.5, L3F: 3.5 }),
      ]

      const rotationScores: RotationSectorScore[] = [
        makeRotationScore('BANK', 70, { swLevel1: 'SW801780' }),
        makeRotationScore('TECH', 70, { swLevel1: 'SW801080' }),
        makeRotationScore('FOOD', 40, { swLevel1: 'SW801200' }),
      ]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })
      const bySymbol = new Map(items.map((item) => [item.symbol, item]))

      expect(items).toHaveLength(3)
      expect(bySymbol.get('000001')?.classification).toBe('core')
      expect(bySymbol.get('000002')?.classification).toBe('hot')
      expect(bySymbol.get('000568')?.classification).toBe('value')
      expect(bySymbol.get('000063')).toBeUndefined()
    })

    it('supports Chinese factor aliases and includes layer scores in items', () => {
      const stocks: Stock[] = [makeStock('000001', 'Core Bank', 'BANK')]
      const v6Scores: V6Score[] = [makeV6Score('000001', 4.5, { 估值: 4.0, 情绪: 4.0, 质量: 4.0 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('BANK', 70)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })

      expect(items).toHaveLength(1)
      const item = items[0]!
      expect(item.classification).toBe('core')
      expect(item.l1Score).toBe(4.0)
      expect(item.l7Score).toBe(4.0)
      expect(item.l3v).toBe(4.0)
      expect(item.reasons.length).toBeGreaterThan(0)
    })

    it('defaults resonance to 0 when no sector or industry matches', () => {
      const stocks: Stock[] = [makeStock('999999', 'Orphan', 'UNKNOWN')]
      const v6Scores: V6Score[] = [makeV6Score('999999', 3.5, { L1: 3.0, L7: 3.0, L3V: 2.8, L3F: 3.5 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('BANK', 70)]

      const items = classifyStocks({ stocks, v6Scores, rotationScores })

      expect(items).toHaveLength(1)
      const item = items[0]!
      expect(item.classification).toBe('value')
      expect(item.resonance).toBe(0)
    })
  })

  describe('buildGroupSnapshot', () => {
    it('produces correct count, avgComposite and maxComposite', () => {
      const items: StrategyGroupItem[] = [
        { symbol: 'A', name: 'Alpha', composite: 4.5, l3v: 2.0, l1Score: 4.0, l7Score: 4.0, resonance: 70, classification: 'core', reasons: [] },
        { symbol: 'B', name: 'Beta', composite: 3.5, l3v: 2.0, l1Score: 3.0, l7Score: 3.0, resonance: 70, classification: 'core', reasons: [] },
      ]

      const snapshot = buildGroupSnapshot(items)

      expect(snapshot.count).toBe(2)
      expect(snapshot.avgComposite).toBe(4.0)
      expect(snapshot.maxComposite).toBe(4.5)
      expect(snapshot.symbols).toEqual(['A', 'B'])
      expect(snapshot.items).toHaveLength(2)
      expect(snapshot.items[0]!.classification).toBe('core')
    })
  })

  describe('buildChangeLog', () => {
    it('marks all current symbols as added when previous snapshot is undefined', () => {
      const current = {
        core: buildGroupSnapshot([
          { symbol: 'A', name: 'Alpha', composite: 4.5, l3v: 2.0, classification: 'core', reasons: [] },
        ]),
        hot: buildGroupSnapshot([]),
        value: buildGroupSnapshot([
          { symbol: 'B', name: 'Beta', composite: 3.2, l3v: 2.8, classification: 'value', reasons: [] },
        ]),
        stockCount: 2,
      }

      const changeLog = buildChangeLog(undefined, current)

      expect(changeLog.totalChange).toBe(2)
      expect(changeLog.coreChange.added).toEqual(['A'])
      expect(changeLog.valueChange.added).toEqual(['B'])
      expect(changeLog.coreChange.removed).toEqual([])
    })

    it('detects removed symbols and score changes above threshold', () => {
      const prev = {
        id: 'snapshot_prev',
        version: 1,
        timestamp: Date.now() - 1000,
        date: '2026-06-24',
        time: '10:00:00',
        stockCount: 2,
        scoreCount: 2,
        rotationCount: 2,
        core: buildGroupSnapshot([
          { symbol: 'A', name: 'Alpha', composite: 4.0, l3v: 2.0, classification: 'core', reasons: [] },
          { symbol: 'C', name: 'Gamma', composite: 4.2, l3v: 2.0, classification: 'core', reasons: [] },
        ]),
        hot: buildGroupSnapshot([]),
        value: buildGroupSnapshot([]),
        trigger: 'manual',
      }

      const current = {
        core: buildGroupSnapshot([
          { symbol: 'A', name: 'Alpha', composite: 4.5, l3v: 2.0, classification: 'core', reasons: [] },
          { symbol: 'B', name: 'Beta', composite: 4.1, l3v: 2.0, classification: 'core', reasons: [] },
        ]),
        hot: buildGroupSnapshot([]),
        value: buildGroupSnapshot([]),
        stockCount: 2,
      }

      const changeLog = buildChangeLog(prev, current)

      expect(changeLog.coreChange.added).toEqual(['B'])
      expect(changeLog.coreChange.removed).toEqual(['C'])
      expect(changeLog.scoreChanges).toHaveLength(1)
      expect(changeLog.scoreChanges![0]!.symbol).toBe('A')
      expect(changeLog.scoreChanges![0]!.delta).toBe(0.5)
    })
  })

  describe('saveStrategySnapshot', () => {
    it('saves a snapshot with version 1 and persists counts', async () => {
      const stocks: Stock[] = [makeStock('000001', 'Core Bank', 'BANK')]
      const v6Scores: V6Score[] = [makeV6Score('000001', 4.5, { L1: 4.0, L7: 4.0 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('BANK', 70)]

      const result = await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, 'test-trigger')

      expect(result.success).toBe(true)
      expect(result.data?.version).toBe(1)
      expect(result.data?.stockCount).toBe(1)
      expect(result.data?.scoreCount).toBe(1)
      expect(result.data?.rotationCount).toBe(1)
      expect(result.data?.trigger).toBe('test-trigger')
      expect(result.data?.core.count).toBe(1)
      expect(result.data?.core.symbols).toContain('000001')
      expect(result.data?.changeFromPrev?.totalChange).toBe(1)
    })

    it('increments version on second save', async () => {
      const stocks: Stock[] = [makeStock('000001', 'Core Bank', 'BANK')]
      const v6Scores: V6Score[] = [makeV6Score('000001', 4.5, { L1: 4.0, L7: 4.0 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('BANK', 70)]

      await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      const second = await saveStrategySnapshot({ stocks, v6Scores, rotationScores })

      expect(second.success).toBe(true)
      expect(second.data?.version).toBe(2)
    })
  })

  describe('getLatestSnapshot and listSnapshots', () => {
    it('returns undefined when no snapshots exist', async () => {
      const result = await getLatestSnapshot()
      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('lists snapshots sorted by timestamp descending', async () => {
      const stocks: Stock[] = [makeStock('000001', 'Core Bank', 'BANK')]
      const v6Scores: V6Score[] = [makeV6Score('000001', 4.5, { L1: 4.0, L7: 4.0 })]
      const rotationScores: RotationSectorScore[] = [makeRotationScore('BANK', 70)]

      await saveStrategySnapshot({ stocks, v6Scores, rotationScores })
      await new Promise((resolve) => setTimeout(resolve, 10))
      await saveStrategySnapshot({ stocks, v6Scores, rotationScores })

      const list = await listSnapshots()
      expect(list.success).toBe(true)
      expect(list.data).toHaveLength(2)

      const first = list.data![0]!
      const second = list.data![1]!
      expect(first.timestamp).toBeGreaterThan(second.timestamp)

      const limited = await listSnapshots(1)
      expect(limited.data).toHaveLength(1)

      const latest = await getLatestSnapshot()
      expect(latest.success).toBe(true)
      expect(latest.data?.id).toBe(first.id)
    })
  })
})
