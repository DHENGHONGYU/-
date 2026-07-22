/**
 * @test_id V9-TEST-ST-138
 * @covers_docs [V9-DOC-ARCH-007, V9-DOC-BACK-015]
 */
import { describe, test, expect, beforeEach } from 'vitest'
import { useHotSectorStore, topScores, buySignals, bySector } from './hotSectorStore'

/** 测试用输入数据（独立于 fixtures/Mock 数据） */
const TEST_INPUTS = [
  {
    symbol: 'AI_算力',
    sectorName: 'AI 算力',
    momentum: { sectorStrengthScore: 4.5, priceChangeRank: 1, volumeExpansion: 2.5, consecutiveInflow: 8, relativeStrength: 85 },
    sentiment: { sentimentRank: 1, retailSentiment: 0.85, institutionBuyCount: 12, limitUpCount: 5 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish' as const, rsi: 65, priceAboveMA20: true, priceAboveMA60: true },
    valuationRisk: { pe: 65, pbPercentile: 80, marketCap: 8000, dividendYield: 0.5 },
    marketEnv: { marketTrend: 'bull' as const, systemicRisk: 'low' as const },
  },
  {
    symbol: '半导体',
    sectorName: '半导体',
    momentum: { sectorStrengthScore: 4.0, priceChangeRank: 3, volumeExpansion: 1.8, consecutiveInflow: 5, relativeStrength: 72 },
    sentiment: { sentimentRank: 4, retailSentiment: 0.7, institutionBuyCount: 8, limitUpCount: 3 },
    breakout: { hasBreakoutPattern: true, rsiSignal: 'bullish' as const, rsi: 58, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
    marketEnv: { marketTrend: 'bull' as const, systemicRisk: 'low' as const },
  },
  {
    symbol: '新能源',
    sectorName: '新能源',
    momentum: { sectorStrengthScore: 2.5, priceChangeRank: 8, volumeExpansion: 0.8, consecutiveInflow: 1, relativeStrength: 45 },
    sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'bearish' as const, rsi: 35, priceAboveMA20: false, priceAboveMA60: false },
    valuationRisk: { pe: 18, pbPercentile: 20, marketCap: 2000, dividendYield: 2.0 },
    marketEnv: { marketTrend: 'sideways' as const, systemicRisk: 'medium' as const },
  },
  {
    symbol: '白酒',
    sectorName: '白酒',
    momentum: { sectorStrengthScore: 3.2, priceChangeRank: 5, volumeExpansion: 1.2, consecutiveInflow: 3, relativeStrength: 58 },
    sentiment: { sentimentRank: 6, retailSentiment: 0.55, institutionBuyCount: 5, limitUpCount: 1 },
    breakout: { hasBreakoutPattern: false, rsiSignal: 'neutral' as const, rsi: 48, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 32, pbPercentile: 50, marketCap: 3000, dividendYield: 1.5 },
    marketEnv: { marketTrend: 'sideways' as const, systemicRisk: 'medium' as const },
  },
] as const

/** 辅助函数：加载测试数据并返回评分结果 */
function loadTestScores() {
  const store = useHotSectorStore.getState()
  store.fetchScores(TEST_INPUTS as unknown as Parameters<typeof store.fetchScores>[0])
  return useHotSectorStore.getState().scores
}

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

  test('fetchScores 无输入返回空结果（不 fallback 到 Mock 数据）', () => {
    const store = useHotSectorStore.getState()
    store.fetchScores()

    const state = useHotSectorStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    // lastUpdated 不变，因为无数据写入
  })

  test('fetchScores 按评分降序排列', () => {
    const scores = loadTestScores()
    expect(scores.length).toBeGreaterThan(0)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.score).toBeGreaterThanOrEqual(scores[i]!.score)
    }
  })

  test('fetchScores 中每个评分的 dimensions 完整', () => {
    const scores = loadTestScores()
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
    loadTestScores()
    const before = useHotSectorStore.getState().scores.find((s) => s.symbol === 'AI_算力')
    expect(before).toBeDefined()

    useHotSectorStore.getState().refreshScore('AI_算力')
    const after = useHotSectorStore.getState().scores.find((s) => s.symbol === 'AI_算力')
    // 使用相同输入，评分应相同
    expect(after!.score).toBe(before!.score)
  })

  test('refreshScore 不存在的标的无影响', () => {
    loadTestScores()
    const beforeCount = useHotSectorStore.getState().scores.length

    useHotSectorStore.getState().refreshScore('不存在的标的')
    const afterCount = useHotSectorStore.getState().scores.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearScores
  // ============================================================

  test('clearScores 清空所有数据', () => {
    loadTestScores()
    expect(useHotSectorStore.getState().scores.length).toBeGreaterThan(0)

    useHotSectorStore.getState().clearScores()
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
    loadTestScores()
    const top = topScores(2)
    expect(top.length).toBeLessThanOrEqual(2)
    if (top.length >= 2) {
      expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score)
    }
  })

  test('buySignals 只返回买入信号', () => {
    loadTestScores()
    const buys = buySignals()
    for (const score of buys) {
      expect(score.action).toBe('immediate')
    }
  })

  test('bySector 按符号查找', () => {
    loadTestScores()
    const found = bySector('AI_算力')
    expect(found).toBeDefined()
    expect(found!.symbol).toBe('AI_算力')

    const notFound = bySector('不存在的')
    expect(notFound).toBeUndefined()
  })
})

describe('hotSectorStore reset', () => {
  test('reset 将所有状态恢复到初始值', () => {
    // 先填充数据
    const scores = loadTestScores()
    const now = Date.now()
    useHotSectorStore.setState({
      scores,
      loading: true,
      error: 'err',
      isRefreshing: true,
      lastUpdated: now,
    })

    // 验证状态已填充
    const before = useHotSectorStore.getState()
    expect(before.scores.length).toBeGreaterThan(0)
    expect(before.loading).toBe(true)
    expect(before.error).toBe('err')
    expect(before.isRefreshing).toBe(true)
    expect(before.lastUpdated).toBe(now)

    // 执行 reset
    useHotSectorStore.getState().reset()

    const after = useHotSectorStore.getState()
    expect(after.scores).toHaveLength(0)
    expect(after.loading).toBe(false)
    expect(after.error).toBeNull()
    expect(after.isRefreshing).toBe(false)
    expect(after.lastUpdated).toBe(0)
  })
})

describe('hotSectorStore clearScores', () => {
  test('clearScores 将所有状态恢复到初始值', () => {
    // 先填充数据
    const scores = loadTestScores()
    const now = Date.now()
    useHotSectorStore.setState({
      scores,
      loading: true,
      error: 'err',
      isRefreshing: true,
      lastUpdated: now,
    })

    // 验证状态已填充
    const before = useHotSectorStore.getState()
    expect(before.scores.length).toBeGreaterThan(0)
    expect(before.loading).toBe(true)
    expect(before.error).toBe('err')
    expect(before.isRefreshing).toBe(true)
    expect(before.lastUpdated).toBe(now)

    // 执行 clearScores
    useHotSectorStore.getState().clearScores()

    const after = useHotSectorStore.getState()
    expect(after.scores).toHaveLength(0)
    expect(after.loading).toBe(false)
    expect(after.error).toBeNull()
    expect(after.isRefreshing).toBe(false)
    expect(after.lastUpdated).toBe(0)
  })
})