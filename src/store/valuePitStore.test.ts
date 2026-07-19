import { describe, test, expect, beforeEach } from 'vitest'
import { useValuePitStore, topScores, buildCandidates, waitSignalList } from './valuePitStore'

/** 测试用输入数据（独立于 Mock 数据） */
const TEST_INPUTS = [
  {
    symbol: '银行',
    sectorName: '银行',
    catalyst: { policyCatalyst: 4.0, cycleTurningPoint: 3.5, techBreakthrough: 2.0, orderSurge: 2.5 },
    valuationMargin: { pePercentile: 5, pbPercentile: 8, dividendYield: 4.5, peg: 0.6 },
    chipStructure: { northBoundChange: 2.5, fundPositionChange: 3.0, shareholderChange: -1.5 },
    rotationPosition: { sectorVolumePercentile: 15, capitalInflowStrength: 4.0, hasGoldenCross: true },
    liquidity: { avgDailyAmount: 80000, turnoverRate: 1.5, marketCap: 1500 },
  },
  {
    symbol: '钢铁',
    sectorName: '钢铁',
    catalyst: { policyCatalyst: 3.0, cycleTurningPoint: 3.0, techBreakthrough: 2.0, orderSurge: 2.0 },
    valuationMargin: { pePercentile: 15, pbPercentile: 20, dividendYield: 3.0, peg: 0.8 },
    chipStructure: { northBoundChange: 1.0, fundPositionChange: 1.5, shareholderChange: -0.5 },
    rotationPosition: { sectorVolumePercentile: 40, capitalInflowStrength: 3.0, hasGoldenCross: false },
    liquidity: { avgDailyAmount: 30000, turnoverRate: 2.5, marketCap: 500 },
  },
]

/** 辅助函数：加载测试数据 */
function loadTestScores() {
  useValuePitStore.getState().fetchScores(TEST_INPUTS as any)
}

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

  test('fetchScores 无输入返回空结果（不 fallback 到 Mock）', () => {
    useValuePitStore.getState().fetchScores()
    const state = useValuePitStore.getState()
    expect(state.scores).toHaveLength(0)
    expect(state.loading).toBe(false)
  })

  test('fetchScores 按评分降序排列', () => {
    loadTestScores()
    const { scores } = useValuePitStore.getState()
    expect(scores.length).toBeGreaterThan(0)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!.score).toBeGreaterThanOrEqual(scores[i]!.score)
    }
  })

  test('fetchScores 中每个评分的 dimensions 完整', () => {
    loadTestScores()
    const { scores } = useValuePitStore.getState()
    for (const score of scores) {
      expect(score.symbol).toBeTruthy()
      expect(score.name).toBeTruthy()
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(5)
      expect(score.action).toMatch(/^(immediate|probe|wait|ignore)$/)
      expect(score.calculatedAt).toBeGreaterThan(0)
    }
  })

  test('fetchScores 支持自定义输入', () => {
    useValuePitStore.getState().fetchScores([
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
  })

  // ============================================================
  // refreshScore
  // ============================================================

  test('refreshScore 更新指定标的', () => {
    loadTestScores()
    const before = useValuePitStore.getState().scores.find((s) => s.symbol === '银行')
    expect(before).toBeDefined()

    useValuePitStore.getState().refreshScore('银行', TEST_INPUTS as any)
    const after = useValuePitStore.getState().scores.find((s) => s.symbol === '银行')
    expect(after!.score).toBe(before!.score)
  })

  test('refreshScore 不存在的标的无影响', () => {
    loadTestScores()
    const beforeCount = useValuePitStore.getState().scores.length
    useValuePitStore.getState().refreshScore('不存在的', TEST_INPUTS as any)
    const afterCount = useValuePitStore.getState().scores.length
    expect(afterCount).toBe(beforeCount)
  })

  // ============================================================
  // clearScores
  // ============================================================

  test('clearScores 清空所有数据', () => {
    loadTestScores()
    expect(useValuePitStore.getState().scores.length).toBeGreaterThan(0)
    useValuePitStore.getState().clearScores()
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
    loadTestScores()
    const top = topScores(2)
    expect(top.length).toBeLessThanOrEqual(2)
    if (top.length >= 2) {
      expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score)
    }
  })

  test('buildCandidates & waitSignalList', () => {
    loadTestScores()
    const candidates = buildCandidates()
    const waiters = waitSignalList()
    expect(Array.isArray(candidates)).toBe(true)
    expect(Array.isArray(waiters)).toBe(true)
  })
})