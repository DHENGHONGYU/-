import { describe, test, expect, beforeEach } from 'vitest'
import { useHotSectorStore, topScores, buySignals, bySector } from './hotSectorStore'

describe('hotSectorStore', () => {
  beforeEach(() => {
    useHotSectorStore.getState().clearScores()
  })

  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态为空', () => {
    const state = useHotSectorStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // fetchScores
  // ============================================================

  test('fetchScores 使用默认样本数据', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const state = useHotSectorStore.getState()
    expect(state.scores.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  test('fetchScores 按评分降序排列', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const { scores } = useHotSectorStore.getState()
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.score).toBeGreaterThanOrEqual(scores[i]!.score)
    }
  })

  test('fetchScores 中每个评分的 dimensions 完整', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const { scores } = useHotSectorStore.getState()
    for (const score of scores) {
      expect(score.symbol).toBeTruthy()
      expect(score.name).toBeTruthy()
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(5)
      expect(score.action).toMatch(/^(immediate|probe|ignore)$/)
      expect(score.dimensions.momentum).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.sentiment).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.technical).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.valuation).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.composite).toBeGreaterThanOrEqual(0)
      expect(score.calculatedAt).toBeGreaterThan(0)
    }
  })

  test('fetchScores 支持自定义输入', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores([
      {
        symbol: 'TEST',
        sectorName: '测试板块',
        momentum: { sectorStrengthScore: 5, priceChangeRank: 1, volumeExpansion: 3, consecutiveInflow: 5, relativeStrength: 90 },
        sentiment: { sentimentRank: 1, retailSentiment: 0.5, institutionBuyCount: 10, limitUpCount: 10 },
        breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish', rsi: 60, priceAboveMA20: true, priceAboveMA60: true },
        valuationRisk: { pe: 10, pbPercentile: 10, marketCap: 5000, dividendYield: 2 },
        marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
      },
    ])

    const { scores } = useHotSectorStore.getState()
    expect(scores).toHaveLength(1)
    expect(scores[0]!.symbol).toBe('TEST')
  })

  // ============================================================
  // refreshScore
  // ============================================================

  test('refreshScore 更新指定标的', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const before = useHotSectorStore.getState().scores.find((s) => s.symbol === 'AI_算力')
    expect(before).toBeDefined()

    store.refreshScore('AI_算力')
    const after = useHotSectorStore.getState().scores.find((s) => s.symbol === 'AI_算力')
    // 使用相同输入，评分应相同
    expect(after!.score).toBe(before!.score)
  })

  test('refreshScore 不存在的标的无影响', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()
    const beforeCount = useHotSectorStore.getState().scores.length

    store.refreshScore('不存在的标的')
    const afterCount = useHotSectorStore.getState().scores.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearScores
  // ============================================================

  test('clearScores 清空所有数据', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()
    expect(useHotSectorStore.getState().scores.length).toBeGreaterThan(0)

    store.clearScores()
    const state = useHotSectorStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // Getters
  // ============================================================

  test('topScores 返回前 N 条', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const top = topScores(2)
    expect(top.length).toBeLessThanOrEqual(2)
    if (top.length >= 2) {
      expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score)
    }
  })

  test('buySignals 只返回买入信号', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const buys = buySignals()
    for (const score of buys) {
      expect(score.action).toBe('immediate')
    }
  })

  test('bySector 按符号查找', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const found = bySector('AI_算力')
    expect(found).toBeDefined()
    expect(found!.symbol).toBe('AI_算力')

    const notFound = bySector('不存在的')
    expect(notFound).toBeUndefined()
  })
})