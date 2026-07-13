import { describe, test, expect, beforeEach } from 'vitest'
import { useValuePitStore, topScores, buildCandidates, waitSignalList } from './valuePitStore'

describe('valuePitStore', () => {
  beforeEach(() => {
    useValuePitStore.getState().clearScores()
  })

  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态为空', () => {
    const state = useValuePitStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // fetchScores
  // ============================================================

  test('fetchScores 使用默认样本数据', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const state = useValuePitStore.getState()
    expect(state.scores.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  test('fetchScores 按评分降序排列', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const { scores } = useValuePitStore.getState()
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.score).toBeGreaterThanOrEqual(scores[i]!.score)
    }
  })

  test('fetchScores 中每个评分的 dimensions 完整', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const { scores } = useValuePitStore.getState()
    for (const score of scores) {
      expect(score.symbol).toBeTruthy()
      expect(score.name).toBeTruthy()
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(5)
      expect(score.action).toMatch(/^(immediate|probe|wait|ignore)$/)
      expect(score.dimensions.catalyst).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.valuation).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.chip).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.rotation).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.liquidity).toBeGreaterThanOrEqual(0)
      expect(score.dimensions.composite).toBeGreaterThanOrEqual(0)
      expect(score.calculatedAt).toBeGreaterThan(0)
    }
  })

  test('fetchScores 支持自定义输入', () => {
    const store = useValuePitStore.getState()
    store.fetchScores([
      {
        symbol: 'TEST_VP',
        sectorName: '测试价值板块',
        catalyst: { policyCatalyst: 5, cycleTurningPoint: 5, techBreakthrough: 5, orderSurge: 5 },
        valuationMargin: { pePercentile: 5, pbPercentile: 5, dividendYield: 5, peg: 0.4 },
        chipStructure: { northBoundChange: 3, fundPositionChange: 6, shareholderChange: -12 },
        rotationPosition: { sectorVolumePercentile: 10, capitalInflowStrength: 5, hasGoldenCross: true },
        liquidity: { avgDailyAmount: 100000, turnoverRate: 2, marketCap: 1000 },
      },
    ])

    const { scores } = useValuePitStore.getState()
    expect(scores).toHaveLength(1)
    expect(scores[0]!.symbol).toBe('TEST_VP')
    expect(scores[0]!.action).toBe('immediate')
  })

  // ============================================================
  // refreshScore
  // ============================================================

  test('refreshScore 更新指定标的', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const before = useValuePitStore.getState().scores.find((s) => s.symbol === '银行')
    expect(before).toBeDefined()

    store.refreshScore('银行')
    const after = useValuePitStore.getState().scores.find((s) => s.symbol === '银行')
    expect(after!.score).toBe(before!.score)
  })

  test('refreshScore 不存在的标的无影响', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()
    const beforeCount = useValuePitStore.getState().scores.length

    store.refreshScore('不存在的')
    const afterCount = useValuePitStore.getState().scores.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearScores
  // ============================================================

  test('clearScores 清空所有数据', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()
    expect(useValuePitStore.getState().scores.length).toBeGreaterThan(0)

    store.clearScores()
    const state = useValuePitStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // ============================================================
  // Getters
  // ============================================================

  test('topScores 返回前 N 条', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const top = topScores(2)
    expect(top.length).toBeLessThanOrEqual(2)
    if (top.length >= 2) {
      expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score)
    }
  })

  test('buildCandidates 只返回 action=immediate 的标的', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const candidates = buildCandidates()
    for (const score of candidates) {
      expect(score.action).toBe('immediate')
    }
  })

  test('waitSignalList 只返回 action=wait 的标的', () => {
    const store = useValuePitStore.getState()
    store.fetchScores()

    const waiting = waitSignalList()
    for (const score of waiting) {
      expect(score.action).toBe('wait')
    }
  })
})