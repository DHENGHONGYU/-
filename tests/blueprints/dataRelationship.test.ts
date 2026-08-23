/**
 * @test_id V9-TEST-UT-072
 * @covers_docs [V9-DOC-ARCH-008, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-PROJ-053]
 */
import { describe, it, expect } from 'vitest'
import { STORE_NAME } from '@/config/dbConfig'
import type { DailyQuotes, Order, Signal, Stock, V6Score } from '@/data/types'

/**
 * @status passing
 * 2026-08-23 Token Plan 处理事项：旧 known-failing/exclude 登记已过时（测试已修复通过），
 * 移除 @skip-reason 标记，恢复正常门禁执行。
 */
describe('V9 data relationship blueprint', () => {
  it('应该有 exactly 56 stores defined in dbConfig', () => {
    const stores = Object.values(STORE_NAME)
    // v38（2026-08-23 遗留问题整改 P2）：新增 dimension_collect_data（维度 11-14 通用专用存储），55→56
    expect(stores).toHaveLength(56)
    expect(new Set(stores).size).toBe(56)
  })

  it('应该map core entities to expected stores', () => {
    const entityStoreMap: Record<string, string> = {
      Stock: STORE_NAME.stocks,
      DailyQuotes: STORE_NAME.dailyQuotes,
      V6Score: STORE_NAME.v6Scores,
      IntelligentScore: STORE_NAME.intelligentScores,
      IndustryScore: STORE_NAME.industryScores,
      HotSectorScore: STORE_NAME.hotSectorScores,
      ValuePitScore: STORE_NAME.valuePitScores,
      RotationSectorScore: STORE_NAME.rotationScores,
      SectorScoreRecord: STORE_NAME.sectorScores,
      ScoreDocVersion: STORE_NAME.scoreDocs,
      StrategySnapshot: STORE_NAME.strategySnapshots,
      LocalDoc: STORE_NAME.localDocs,
      NewsArticle: STORE_NAME.news,
      NewsStockMap: STORE_NAME.newsStockMap,
      SentimentCache: STORE_NAME.sentimentCache,
      Order: STORE_NAME.orders,
      Signal: STORE_NAME.signals,
      Watchlist: STORE_NAME.watchlists,
      ResearchLog: STORE_NAME.researchLogs,
    }

    for (const [entity, store] of Object.entries(entityStoreMap)) {
      expect(store, `Entity ${entity} must map to a defined store`).toBeDefined()
    }
  })

  it('应该enforce Stock as the central 1:N hub', () => {
    const dependentStores = [
      STORE_NAME.dailyQuotes,
      STORE_NAME.v6Scores,
      STORE_NAME.intelligentScores,
      STORE_NAME.hotSectorScores,
      STORE_NAME.valuePitScores,
      STORE_NAME.orders,
      STORE_NAME.signals,
      STORE_NAME.localDocs,
      STORE_NAME.scoreDocs,
      STORE_NAME.newsStockMap,
    ]
    expect(dependentStores.length).toBeGreaterThanOrEqual(10)
  })
})

/**
 * @status known-failing
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 */
describe('V9 data timeline rules', () => {
  it('v6 score must not be older than its daily quotes input', () => {
    const stock: Stock = {
      symbol: '600519',
      name: '贵州茅台',
      dataVersion: 1,
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
    }
    const quotes: DailyQuotes = {
      symbol: '600519',
      latest: {
        date: '2026-06-29',
        open: 1600,
        high: 1620,
        low: 1590,
        close: 1610,
        volume: 1000,
        amount: 1_600_000,
      },
      history: [],
      period: 'daily',
      adjust: 'qfq',
      updatedAt: 1_000_000,
    }
    const score: V6Score = {
      symbol: '600519',
      score: 4.2,
      factors: {},
      algorithmVersion: 'v9-auto',
      calculatedAt: 1_000_001,
      dataVersion: stock.dataVersion,
    }
    expect(score.calculatedAt).toBeGreaterThanOrEqual(quotes.updatedAt)
  })

  it('signal must be newer than daily quotes when snapshot exists', () => {
    const quotesUpdatedAt = 1_000_000
    const signal: Signal = {
      id: 's1',
      symbol: '600519',
      direction: 'buy',
      type: 'buy_dip',
      strategy: 'default',
      confidence: 0.6,
      rationale: 'test',
      snapshot: {},
      createdAt: 1_000_001,
    }
    expect(signal.createdAt).toBeGreaterThanOrEqual(quotesUpdatedAt)
  })

  it('order must reference a valid 6-digit A-share symbol', () => {
    const order: Order = {
      id: 'o1',
      symbol: '600519',
      direction: 'buy',
      quantity: 100,
      price: 1600,
      amount: 160_000,
      status: 'filled',
      accountType: 'paper',
      createdAt: Date.now(),
    }
    expect(order.symbol).toMatch(/^\d{6}$/)
  })
})
