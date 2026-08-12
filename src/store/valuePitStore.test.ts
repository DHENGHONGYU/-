/**
 * @test_id V9-TEST-ST-162
 * @covers_docs [V9-DOC-ARCH-007, V9-DOC-BACK-015]
 */
import { describe, test, expect, beforeEach, vi } from 'vitest'

// ============================================================
// Mock: logger —— 允许单测覆盖 warn/info 使其抛异常以触发 catch
// ============================================================

const mockVPLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockVPLogger }))

// ============================================================
// Mock: valuePitAnalyzer —— 默认委托到真实实现，允许单测覆盖为 throw
// ============================================================

const { mockAnalyze } = vi.hoisted(() => ({
  mockAnalyze: vi.fn(),
}))

vi.mock('@/services/scoring/valuePitAnalyzer', async () => {
  const actual = await vi.importActual<typeof import('@/services/scoring/valuePitAnalyzer')>(
    '@/services/scoring/valuePitAnalyzer',
  )
  // 默认委托到真实 analyze，保证已有测试不受影响
  mockAnalyze.mockImplementation(actual.analyze)
  return { ...actual, analyze: mockAnalyze }
})

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

describe('valuePitStore clearScores', () => {
  test('clearScores 清空 scores/rotationSignals/combinedResults 并恢复初始状态', () => {
    // 先填充数据
    loadTestScores()
    const now = Date.now()
    useValuePitStore.setState({
      rotationSignals: [
        {
          sectorId: '测试板块',
          triggered: true,
          conditions: { volumeBreakthrough: true, capitalInflow: true, goldenCross: false },
          strength: 'strong',
          detectedAt: now,
        },
      ],
      combinedResults: [
        {
          score: useValuePitStore.getState().scores[0]!,
          rotation: {
            sectorId: '测试板块',
            triggered: true,
            conditions: { volumeBreakthrough: true, capitalInflow: true, goldenCross: false },
            strength: 'strong',
            detectedAt: now,
          },
        },
      ],
      loading: true,
      error: 'test error',
      lastUpdated: now,
    })

    // 验证状态已填充
    const before = useValuePitStore.getState()
    expect(before.scores.length).toBeGreaterThan(0)
    expect(before.rotationSignals).toHaveLength(1)
    expect(before.combinedResults).toHaveLength(1)
    expect(before.loading).toBe(true)
    expect(before.error).toBe('test error')
    expect(before.lastUpdated).toBe(now)

    // 执行 clearScores
    useValuePitStore.getState().clearScores()

    const after = useValuePitStore.getState()
    expect(after.scores).toHaveLength(0)
    expect(after.rotationSignals).toHaveLength(0)
    expect(after.combinedResults).toHaveLength(0)
    expect(after.loading).toBe(false)
    expect(after.error).toBeNull()
    expect(after.lastUpdated).toBe(0)
  })
})

// ============================================================
// refreshScore - 空输入 & 异常路径（覆盖 133-134, 155-157）
// ============================================================

describe('valuePitStore refreshScore - 边界与异常路径', () => {
  beforeEach(() => {
    useValuePitStore.getState().clearScores()
  })

  /**
   * @test_id V9-TEST-ST-162-REFRESH-01
   * inputs 为 undefined 时直接返回，不执行分析
   * 覆盖行 132-134
   */
  test('refreshScore inputs 为 undefined 时提前返回', () => {
    loadTestScores()
    const scoresBefore = useValuePitStore.getState().scores

    // 不传 inputs 参数
    useValuePitStore.getState().refreshScore('银行')

    // scores 不变
    expect(useValuePitStore.getState().scores).toEqual(scoresBefore)
  })

  /**
   * @test_id V9-TEST-ST-162-REFRESH-02
   * inputs 为空数组时直接返回，不执行分析
   * 覆盖行 132-134
   */
  test('refreshScore inputs 为空数组时提前返回', () => {
    loadTestScores()
    const scoresBefore = useValuePitStore.getState().scores

    useValuePitStore.getState().refreshScore('银行', [])

    // scores 不变
    expect(useValuePitStore.getState().scores).toEqual(scoresBefore)
  })

  /**
   * @test_id V9-TEST-ST-162-REFRESH-03
   * analyze 抛出 Error 时设置 error 字段
   * 覆盖行 155-157
   */
  test('refreshScore analyze 抛出 Error 时设置 error', () => {
    loadTestScores()
    // 单次覆盖为抛出异常
    mockAnalyze.mockImplementationOnce(() => {
      throw new Error('分析引擎异常')
    })

    useValuePitStore.getState().refreshScore('银行', TEST_INPUTS as any)

    expect(useValuePitStore.getState().error).toBe('分析引擎异常')
  })

  /**
   * @test_id V9-TEST-ST-162-REFRESH-04
   * analyze 抛出非 Error 值时，String(err) 转换后设置 error
   * 覆盖行 155（String(err) 分支）
   */
  test('refreshScore analyze 抛出非 Error 值时设置 String(err)', () => {
    loadTestScores()
    // 抛出字符串而非 Error 对象
    mockAnalyze.mockImplementationOnce(() => {
      throw '字符串错误'
    })

    useValuePitStore.getState().refreshScore('银行', TEST_INPUTS as any)

    expect(useValuePitStore.getState().error).toBe('字符串错误')
  })
})

// ============================================================
// runAnalysis & fetchScores 异常路径（覆盖行 85-93, 124-126）
// ============================================================

describe('valuePitStore runAnalysis & fetchScores 异常路径', () => {
  beforeEach(async () => {
    useValuePitStore.getState().clearScores()
    vi.clearAllMocks()
    // 恢复 mockAnalyze 默认委托到真实实现
    const actual = await vi.importActual<typeof import('@/services/scoring/valuePitAnalyzer')>(
      '@/services/scoring/valuePitAnalyzer',
    )
    mockAnalyze.mockImplementation(actual.analyze)
  })

  /**
   * @test_id V9-TEST-ST-162-RUN-01
   * runAnalysis 无输入数据时设置 loading=false（覆盖行 85-89）
   */
  test('runAnalysis: 无输入数据时设置 loading=false', () => {
    useValuePitStore.getState().runAnalysis()

    expect(useValuePitStore.getState().loading).toBe(false)
    expect(useValuePitStore.getState().error).toBeNull()
  })

  /**
   * @test_id V9-TEST-ST-162-RUN-02
   * runAnalysis try 块内 logger.warn 抛出 Error 时进入 catch 设置 error（覆盖行 90-93）
   */
  test('runAnalysis: try 块抛出 Error 时设置 error', () => {
    mockVPLogger.warn.mockImplementationOnce(() => {
      throw new Error('logger 内部错误')
    })

    useValuePitStore.getState().runAnalysis()

    expect(useValuePitStore.getState().error).toBe('logger 内部错误')
    expect(useValuePitStore.getState().loading).toBe(false)
  })

  /**
   * @test_id V9-TEST-ST-162-RUN-03
   * runAnalysis try 块内抛出非 Error 值时 String(err) 转换（覆盖分支 91）
   */
  test('runAnalysis: try 块抛出非 Error 值时转为字符串', () => {
    mockVPLogger.warn.mockImplementationOnce(() => {
      throw '字符串异常'
    })

    useValuePitStore.getState().runAnalysis()

    expect(useValuePitStore.getState().error).toBe('字符串异常')
  })

  /**
   * @test_id V9-TEST-ST-162-FETCH-ERR-01
   * fetchScores: analyze 抛出 Error 时设置 error（覆盖行 124-126）
   */
  test('fetchScores: analyze 抛出 Error 时设置 error', () => {
    mockAnalyze.mockImplementationOnce(() => {
      throw new Error('分析引擎崩溃')
    })

    useValuePitStore.getState().fetchScores(TEST_INPUTS as any)

    expect(useValuePitStore.getState().error).toBe('分析引擎崩溃')
    expect(useValuePitStore.getState().loading).toBe(false)
  })

  /**
   * @test_id V9-TEST-ST-162-FETCH-ERR-02
   * fetchScores: analyze 抛出非 Error 值时转为字符串（覆盖分支 124）
   */
  test('fetchScores: analyze 抛出非 Error 值时转为字符串', () => {
    mockAnalyze.mockImplementationOnce(() => {
      throw '字符串错误'
    })

    useValuePitStore.getState().fetchScores(TEST_INPUTS as any)

    expect(useValuePitStore.getState().error).toBe('字符串错误')
    expect(useValuePitStore.getState().loading).toBe(false)
  })
})