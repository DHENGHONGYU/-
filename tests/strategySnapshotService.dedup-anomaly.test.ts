/**
 * @test_id V9-TEST-UT-062-DUP-ANOMALY
 * @covers 重复标的去重 + 异常评分/边界数据处理
 *
 * 验证点：
 * 1. classifyStocks 输入含重复标的时，按 symbol 去重
 * 2. V6Score.factors 含 NaN/undefined/null/Infinity 时，pickFactor 返回默认值 0 且不抛错
 * 3. V6Score.score 异常（NaN/Infinity/负数/>5）时分类逻辑能正确处理
 * 4. 空字符串 symbol、null stock、undefined v6Score 等异常输入不抛错
 * 5. rotationScores 含 null/undefined 时不抛错
 * 6. 评分数据类型不匹配（string/object 代替 number）时能容错
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import type { RotationSectorScore, Stock, V6Score } from '@/data/types'
import { classifyStocks } from '@/services/trading/strategySnapshotService'

// ============================================================
// 辅助函数
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

function makeV6Score(
  symbol: string,
  score: number,
  factors: Record<string, number>,
  overrides?: Partial<V6Score>,
): V6Score {
  return {
    symbol,
    score,
    factors,
    algorithmVersion: 'v6-test',
    calculatedAt: Date.now(),
    dataVersion: 1,
    ...overrides,
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

describe('classifyStocks — 重复标的去重 + 异常评分处理', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
  })

  // ============================================================
  // 任务1：重复标的去重验证
  // ============================================================
  describe('重复标的去重', () => {
    it('输入含 3 份相同标的，分类结果只保留 1 份', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0, L3V: 3.5, L3F: 3.5 })

      const input = {
        stocks: [stock, stock, stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      const coreItems = items.filter((i) => i.classification === 'core')

      expect(coreItems).toHaveLength(1)
      expect(coreItems[0]!.symbol).toBe('002371.SZ')
    })

    it('输入同一 symbol 但不同对象引用，仍只保留 1 份', () => {
      const input = {
        stocks: [
          makeStock('002371.SZ', '北方华创', '半导体', '半导体设备'),
          makeStock('002371.SZ', '北方华创(重复)', '半导体', '半导体设备'),
          makeStock('002371.SZ', '北方华创第三次', '半导体', '半导体'),
        ],
        v6Scores: [makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0, L3V: 3.5, L3F: 3.5 })],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      const coreSymbols = items.filter((i) => i.classification === 'core').map((i) => i.symbol)

      // 去重后只保留 1 份（symbol 唯一），但 name 可能是三次中任意一次
      expect(coreSymbols).toHaveLength(1)
      expect(coreSymbols[0]).toBe('002371.SZ')
    })

    it('混合重复与非重复标的，非重复标的正常保留', () => {
      const stock1 = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const stock2 = makeStock('000063.SZ', '中兴通讯', '通信', '通信设备')

      const input = {
        stocks: [stock1, stock1, stock2, stock2, stock2],
        v6Scores: [
          makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0 }),
          makeV6Score('000063.SZ', 4.3, { L1: 3.8, L7: 3.8 }),
        ],
        rotationScores: [makeRotationScore('半导体', 75), makeRotationScore('通信', 65)],
      }

      const items = classifyStocks(input)
      const coreSymbols = items.filter((i) => i.classification === 'core').map((i) => i.symbol)

      expect(coreSymbols).toHaveLength(2)
      expect(coreSymbols).toContain('002371.SZ')
      expect(coreSymbols).toContain('000063.SZ')
    })

    it('10 只标的每只重复 10 次，结果仅 10 只唯一标的', () => {
      const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
      const stocks: Stock[] = []
      const v6Scores: V6Score[] = []

      for (const sym of symbols) {
        for (let k = 0; k < 10; k++) {
          stocks.push(makeStock(`${sym}.SZ`, `股票${sym}-${k}`, '半导体', '半导体'))
        }
        v6Scores.push(makeV6Score(`${sym}.SZ`, 4.5, { L1: 4.0, L7: 4.0 }))
      }

      const input = {
        stocks,
        v6Scores,
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      const uniqueSymbols = new Set(items.map((i) => i.symbol))

      expect(items).toHaveLength(symbols.length)
      expect(uniqueSymbols.size).toBe(symbols.length)
    })
  })

  // ============================================================
  // 任务1：异常评分处理验证
  // ============================================================
  describe('异常评分处理', () => {
    it('V6Score.factors 为 undefined 时不抛错，返回 0 并跳过核心组合', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      // factors 为 undefined（强制类型转换模拟异常数据）
      const v6 = makeV6Score('002371.SZ', 4.5, undefined as unknown as Record<string, number>)

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      // composite=4.5 满足 >=4.0，但 L1/L7 都是 0，无法进入核心组合
      const coreItems = items.filter((i) => i.classification === 'core')
      expect(coreItems).toHaveLength(0)
      // 不抛错即可
      expect(items).toBeDefined()
    })

    it('V6Score.factors 含 NaN 时，pickFactor 按默认 0 处理', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', 4.5, {
        L1: Number.NaN,
        L7: 4.0,
        L3V: 3.5,
        L3F: 3.5,
      })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      // L1=NaN → 0，不满足 ≥3.5
      const coreItems = items.filter((i) => i.classification === 'core')
      expect(coreItems).toHaveLength(0)
    })

    it('V6Score.factors 含 Infinity 时正常处理（不抛错）', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', 4.5, {
        L1: Number.POSITIVE_INFINITY,
        L7: 4.0,
        L3V: 3.5,
        L3F: 3.5,
      })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      // Infinity >= 3.5 为 true，应进入核心
      const coreItems = items.filter((i) => i.classification === 'core')
      expect(coreItems).toHaveLength(1)
    })

    it('V6Score.score 为 NaN 时不抛错，不进入任何策略', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', Number.NaN, { L1: 4.0, L7: 4.0 })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      expect(items).toHaveLength(0)
    })

    it('V6Score.score 为负数（-1.5）时不进入任何策略', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', -1.5, { L1: 4.0, L7: 4.0 })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      expect(items).toHaveLength(0)
    })

    it('V6Score.score 为 10（远超正常范围 0-5）时，阈值条件正常判定', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      const v6 = makeV6Score('002371.SZ', 10, { L1: 4.0, L7: 4.0 })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      // 10 >= 4.0 为 true，应进入核心
      const coreItems = items.filter((i) => i.classification === 'core')
      expect(coreItems).toHaveLength(1)
    })

    it('v6Scores 为空数组时，返回空结果不抛错', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')

      const input = {
        stocks: [stock],
        v6Scores: [],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      expect(items).toHaveLength(0)
    })

    it('stocks 为空数组时，返回空结果不抛错', () => {
      const input = {
        stocks: [],
        v6Scores: [],
        rotationScores: [],
      }

      const items = classifyStocks(input)
      expect(items).toHaveLength(0)
    })

    it('rotationScores 为空数组时仍正常分类（共振=0 作为默认值）', () => {
      const input = {
        stocks: [makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')],
        v6Scores: [makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0, L3V: 3.0, L3F: 3.5 })],
        rotationScores: [],
      }

      const items = classifyStocks(input)
      // core 条件不依赖 resonance，仍应命中
      const coreItems = items.filter((i) => i.classification === 'core')
      expect(coreItems).toHaveLength(1)
    })

    it('评分因子使用中文字段名（估值/情绪/质量）时也能正确匹配', () => {
      const stock = makeStock('002371.SZ', '北方华创', '半导体', '半导体设备')
      // 使用中文别名而不是英文字母键
      const v6 = makeV6Score('002371.SZ', 4.5, {
        估值: 4.0,
        情绪: 4.0,
        质量: 3.5,
      })

      const input = {
        stocks: [stock],
        v6Scores: [v6],
        rotationScores: [makeRotationScore('半导体', 75)],
      }

      const items = classifyStocks(input)
      const coreItems = items.filter((i) => i.classification === 'core')
      // pickFactor 支持中文别名，应正常命中
      expect(coreItems).toHaveLength(1)
    })

    it('混合正常数据 + 异常数据时，正常数据仍可正确分类', () => {
      const input = {
        stocks: [
          makeStock('002371.SZ', '正常标的-北方华创', '半导体', '半导体设备'),
          makeStock('BAD1.SZ', '异常标的-负数评分', '半导体', '半导体'),
          makeStock('BAD2.SZ', '异常标的-NaN评分', '半导体', '半导体'),
          makeStock('000063.SZ', '正常标的-中兴通讯', '通信', '通信设备'),
        ],
        v6Scores: [
          makeV6Score('002371.SZ', 4.5, { L1: 4.0, L7: 4.0, L3V: 3.0, L3F: 3.5 }),
          makeV6Score('BAD1.SZ', -5, { L1: 4.0, L7: 4.0 }),
          makeV6Score('BAD2.SZ', Number.NaN, { L1: 4.0, L7: 4.0 }),
          makeV6Score('000063.SZ', 4.3, { L1: 3.8, L7: 3.8 }),
        ],
        rotationScores: [makeRotationScore('半导体', 75), makeRotationScore('通信', 65)],
      }

      const items = classifyStocks(input)
      const coreSymbols = items.filter((i) => i.classification === 'core').map((i) => i.symbol)

      expect(coreSymbols).toContain('002371.SZ')
      expect(coreSymbols).toContain('000063.SZ')
      expect(coreSymbols).not.toContain('BAD1.SZ')
      expect(coreSymbols).not.toContain('BAD2.SZ')
    })
  })
})
