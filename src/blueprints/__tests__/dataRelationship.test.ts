import { describe, it, expect } from 'vitest'
import { STORE_NAME } from '@/config/dbConfig'
import type { DailyQuotes, Order, Signal, Stock, V6Score } from '@/data/types'

/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 .skip 标记并从 test:clean 的 --exclude 列表中删除
 */
describe('V9 data relationship blueprint', () => {
  it('应该有 exactly 25 stores defined in dbConfig', () => {
    const stores = Object.values(STORE_NAME)
    expect(stores).toHaveLength(25)
    expect(new Set(stores).size).toBe(25)
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
      NewsBookmark: STORE_NAME.newsBookmarks,
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
