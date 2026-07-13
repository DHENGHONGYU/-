import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkFreshness,
  checkAllFreshness,
  checkV6ScoreFreshness,
  checkStrategyScoreFreshness,
  checkSignalFreshness,
  checkOrderPriceFreshness,
  checkReviewFreshness,
  checkSentimentCacheFreshness,
  checkSnapshotFreshness,
  checkPortfolioFreshness,
  checkExecutionPlanFreshness,
  checkExecutionLogFreshness,
  checkPortfolioRebalanceFreshness,
  checkMissingReportFreshness,
  setFreshnessConfig,
  getFreshnessConfig,
  FreshnessError,
} from '@/core/freshnessGuard'

describe('dataFreshnessGuard', () => {
  it('returns valid when output time equals input time', () => {
    const result = checkFreshness({
      outputName: 'score',
      outputTime: 1_000,
      inputName: 'quotes',
      inputTime: 1_000,
    })
    expect(result.valid).toBe(true)
  })

  it('returns valid when output time is newer than input time', () => {
    const result = checkFreshness({
      outputName: 'score',
      outputTime: 1_001,
      inputName: 'quotes',
      inputTime: 1_000,
    })
    expect(result.valid).toBe(true)
  })

  it('returns invalid when output is older than input', () => {
    const result = checkFreshness({
      outputName: 'score',
      outputTime: 999,
      inputName: 'quotes',
      inputTime: 1_000,
    })
    expect(result.valid).toBe(false)
  })

  it('checkAllFreshness returns allValid true when all rules pass', () => {
    const { allValid, checks } = checkAllFreshness([
      { outputName: 'a', outputTime: 2, inputName: 'b', inputTime: 1 },
      { outputName: 'c', outputTime: 3, inputName: 'd', inputTime: 2 },
    ])
    expect(allValid).toBe(true)
    expect(checks).toHaveLength(2)
  })

  it('checkAllFreshness returns allValid false when any rule fails', () => {
    const { allValid, checks } = checkAllFreshness([
      { outputName: 'a', outputTime: 2, inputName: 'b', inputTime: 1 },
      { outputName: 'c', outputTime: 1, inputName: 'd', inputTime: 2 },
    ])
    expect(allValid).toBe(false)
    expect(checks.some((c) => !c.valid)).toBe(true)
  })

  it('checkV6ScoreFreshness validates score against quotes', () => {
    const result = checkV6ScoreFreshness(1_001, 1_000)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('v6_score.calculatedAt')
    expect(result.input).toBe('daily_quotes.updatedAt')
  })

  it('checkStrategyScoreFreshness validates strategy against v6 score', () => {
    const result = checkStrategyScoreFreshness(1_002, 1_001, 'hot_sector_score')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('hot_sector_score.calculatedAt')
    expect(result.input).toBe('v6_score.calculatedAt')
  })

  it('checkSignalFreshness validates signal against quotes', () => {
    const result = checkSignalFreshness(1_001, 1_000)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('signal.createdAt')
    expect(result.input).toBe('daily_quotes.updatedAt')
  })

  it('checkOrderPriceFreshness validates order against stock', () => {
    const result = checkOrderPriceFreshness(1_001, 1_000)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('order.createdAt')
    expect(result.input).toBe('stock.updatedAt')
  })

  it('checkReviewFreshness validates review against latest order', () => {
    const result = checkReviewFreshness(1_002, 1_001)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('trade_review.generatedAt')
    expect(result.input).toBe('latest_order.createdAt')
  })

  it('checkSentimentCacheFreshness validates sentiment against publish time', () => {
    const result = checkSentimentCacheFreshness(Date.now(), '2020-01-01T00:00:00Z')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('sentiment_cache.analyzedAt')
    expect(result.input).toBe('news.publishTime')
  })

  it('checkSentimentCacheFreshness returns invalid when analyzed before publish', () => {
    const result = checkSentimentCacheFreshness(
      new Date('2020-01-01T00:00:00Z').getTime(),
      '2020-01-02T00:00:00Z',
    )
    expect(result.valid).toBe(false)
  })

  it('checkSnapshotFreshness validates snapshot against v6 score', () => {
    const result = checkSnapshotFreshness(1_002, 1_001)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('strategy_snapshot.createdAt')
    expect(result.input).toBe('v6_score.calculatedAt')
  })

  it('checkPortfolioFreshness validates portfolio against composite score', () => {
    const result = checkPortfolioFreshness(1_002, 1_001)
    expect(result.valid).toBe(true)
    expect(result.output).toBe('portfolio.builtAt')
    expect(result.input).toBe('composite_score.scoredAt')
  })
})

describe('dataFreshnessGuard blocking mode', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  it('default config is non-blocking', () => {
    expect(getFreshnessConfig().blocking).toBe(false)
  })

  it('setFreshnessConfig updates config', () => {
    setFreshnessConfig({ blocking: true })
    expect(getFreshnessConfig().blocking).toBe(true)
  })

  it('does not throw when blocking is false', () => {
    expect(() =>
      checkFreshness({ outputName: 'a', outputTime: 1, inputName: 'b', inputTime: 2 }),
    ).not.toThrow()
  })

  it('throws FreshnessError when blocking is true and violation occurs', () => {
    setFreshnessConfig({ blocking: true })
    expect(() =>
      checkFreshness({ outputName: 'a', outputTime: 1, inputName: 'b', inputTime: 2 }),
    ).toThrow(FreshnessError)
  })

  it('does not throw when blocking is true but no violation', () => {
    setFreshnessConfig({ blocking: true })
    expect(() =>
      checkFreshness({ outputName: 'a', outputTime: 2, inputName: 'b', inputTime: 1 }),
    ).not.toThrow()
  })

  it('FreshnessError contains the check details', () => {
    setFreshnessConfig({ blocking: true })
    try {
      checkFreshness({ outputName: 'a', outputTime: 1, inputName: 'b', inputTime: 2 })
    } catch (err) {
      expect(err).toBeInstanceOf(FreshnessError)
      expect((err as FreshnessError).check.valid).toBe(false)
      expect((err as FreshnessError).check.output).toBe('a')
      expect((err as FreshnessError).check.input).toBe('b')
    }
  })
})

// ============================================================
// E-3-6: v15/v16 新增 4 个 check 函数的单元测试（8 用例）
// ============================================================

describe('checkExecutionPlanFreshness', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  it('returns valid when plan createdAt >= signal createdAt', () => {
    const result = checkExecutionPlanFreshness(2_000, 1_000, 'plan_001')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('execution_plan.createdAt')
    expect(result.input).toBe('signal.createdAt')
  })

  it('returns invalid when plan createdAt < signal createdAt', () => {
    const result = checkExecutionPlanFreshness(999, 1_000, 'plan_002')
    expect(result.valid).toBe(false)
  })
})

describe('checkExecutionLogFreshness', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  it('returns valid when log timestamp >= plan createdAt', () => {
    const result = checkExecutionLogFreshness(3_000, 2_000, 'plan_003')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('execution_log.timestamp')
    expect(result.input).toBe('execution_plan.createdAt')
  })

  it('returns invalid when log timestamp < plan createdAt', () => {
    const result = checkExecutionLogFreshness(1_999, 2_000, 'plan_004')
    expect(result.valid).toBe(false)
  })
})

describe('checkPortfolioRebalanceFreshness', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  it('returns valid when portfolio updatedAt >= latest order createdAt', () => {
    const result = checkPortfolioRebalanceFreshness(5_000, 4_000, 'portfolio_001')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('portfolio.updatedAt')
    expect(result.input).toBe('latest_order.createdAt')
  })

  it('returns invalid when portfolio updatedAt < latest order createdAt', () => {
    const result = checkPortfolioRebalanceFreshness(3_999, 4_000, 'portfolio_002')
    expect(result.valid).toBe(false)
  })
})

describe('checkMissingReportFreshness', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  it('returns valid when detectedAt >= referenceTime', () => {
    const result = checkMissingReportFreshness(6_000, 6_000, '600000')
    expect(result.valid).toBe(true)
    expect(result.output).toBe('missing_report.detectedAt')
    expect(result.input).toBe('reference_time')
  })

  it('returns invalid when detectedAt < referenceTime', () => {
    const result = checkMissingReportFreshness(5_999, 6_000, '600001')
    expect(result.valid).toBe(false)
  })
})
