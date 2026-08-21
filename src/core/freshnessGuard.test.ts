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
} from './freshnessGuard'

describe('freshnessGuard', () => {
  beforeEach(() => {
    setFreshnessConfig({ blocking: false })
  })

  describe('配置管理', () => {
    it('默认配置 blocking=false', () => {
      const config = getFreshnessConfig()
      expect(config.blocking).toBe(false)
    })

    it('setFreshnessConfig 更新配置', () => {
      setFreshnessConfig({ blocking: true })
      expect(getFreshnessConfig().blocking).toBe(true)
    })

    it('getFreshnessConfig 返回副本而非引用', () => {
      const config = getFreshnessConfig()
      config.blocking = true
      expect(getFreshnessConfig().blocking).toBe(false)
    })
  })

  describe('checkFreshness()', () => {
    it('outputTime >= inputTime 时 valid=true', () => {
      const result = checkFreshness({
        outputName: 'out',
        outputTime: 2000,
        inputName: 'in',
        inputTime: 1000,
      })
      expect(result.valid).toBe(true)
      expect(result.output).toBe('out')
      expect(result.input).toBe('in')
      expect(result.outputTime).toBe(2000)
      expect(result.inputTime).toBe(1000)
    })

    it('outputTime == inputTime 时 valid=true', () => {
      const result = checkFreshness({
        outputName: 'out',
        outputTime: 1000,
        inputName: 'in',
        inputTime: 1000,
      })
      expect(result.valid).toBe(true)
    })

    it('outputTime < inputTime 时 valid=false', () => {
      const result = checkFreshness({
        outputName: 'out',
        outputTime: 500,
        inputName: 'in',
        inputTime: 1000,
      })
      expect(result.valid).toBe(false)
    })

    it('blocking 模式下违规抛出 FreshnessError', () => {
      setFreshnessConfig({ blocking: true })
      expect(() => checkFreshness({
        outputName: 'out',
        outputTime: 500,
        inputName: 'in',
        inputTime: 1000,
      }, 'generic', true)).toThrow(FreshnessError)
    })

    it('FreshnessError 包含 check 信息', () => {
      setFreshnessConfig({ blocking: true })
      try {
        checkFreshness({
          outputName: 'score',
          outputTime: 500,
          inputName: 'quotes',
          inputTime: 1000,
        })
      } catch (err) {
        expect(err).toBeInstanceOf(FreshnessError)
        if (err instanceof FreshnessError) {
          expect(err.check.output).toBe('score')
          expect(err.check.input).toBe('quotes')
          expect(err.check.valid).toBe(false)
          expect(err.name).toBe('FreshnessError')
        }
      }
    })

    it('非 blocking 模式下违规不抛出', () => {
      setFreshnessConfig({ blocking: false })
      expect(() => checkFreshness({
        outputName: 'out',
        outputTime: 500,
        inputName: 'in',
        inputTime: 1000,
      })).not.toThrow()
    })
  })

  describe('checkAllFreshness()', () => {
    it('全部通过时 allValid=true', () => {
      const { allValid, checks } = checkAllFreshness([
        { outputName: 'a', outputTime: 2000, inputName: 'in1', inputTime: 1000 },
        { outputName: 'b', outputTime: 3000, inputName: 'in2', inputTime: 2000 },
      ])
      expect(allValid).toBe(true)
      expect(checks).toHaveLength(2)
      expect(checks.every(c => c.valid)).toBe(true)
    })

    it('有违规时 allValid=false', () => {
      const { allValid, checks } = checkAllFreshness([
        { outputName: 'ok', outputTime: 2000, inputName: 'in1', inputTime: 1000 },
        { outputName: 'bad', outputTime: 500, inputName: 'in2', inputTime: 1000 },
      ])
      expect(allValid).toBe(false)
      expect(checks).toHaveLength(2)
      expect(checks[0]!.valid).toBe(true)
      expect(checks[1]!.valid).toBe(false)
    })

    it('空数组返回 allValid=true', () => {
      const { allValid, checks } = checkAllFreshness([])
      expect(allValid).toBe(true)
      expect(checks).toHaveLength(0)
    })
  })

  describe('专项 freshness 检查', () => {
    it('checkV6ScoreFreshness', () => {
      const result = checkV6ScoreFreshness(2000, 1000)
      expect(result.valid).toBe(true)
      expect(result.output).toBe('v6_score.calculatedAt')
      expect(result.input).toBe('daily_quotes.updatedAt')
    })

    it('checkStrategyScoreFreshness', () => {
      const result = checkStrategyScoreFreshness(3000, 2000, 'hotSector')
      expect(result.valid).toBe(true)
      expect(result.output).toBe('hotSector.calculatedAt')
      expect(result.input).toBe('v6_score.calculatedAt')
    })

    it('checkSignalFreshness', () => {
      const result = checkSignalFreshness(2000, 1000)
      expect(result.output).toBe('signal.createdAt')
      expect(result.input).toBe('daily_quotes.updatedAt')
    })

    it('checkOrderPriceFreshness', () => {
      const result = checkOrderPriceFreshness(2000, 1000)
      expect(result.output).toBe('order.createdAt')
      expect(result.input).toBe('stock.updatedAt')
    })

    it('checkReviewFreshness', () => {
      const result = checkReviewFreshness(3000, 2000)
      expect(result.output).toBe('trade_review.generatedAt')
      expect(result.input).toBe('latest_order.createdAt')
    })

    it('checkSentimentCacheFreshness', () => {
      const result = checkSentimentCacheFreshness(
        new Date('2026-01-02').getTime(),
        '2026-01-01T00:00:00Z',
      )
      expect(result.valid).toBe(true)
      expect(result.output).toBe('sentiment_cache.analyzedAt')
      expect(result.input).toBe('news.publishTime')
    })

    it('checkSnapshotFreshness', () => {
      const result = checkSnapshotFreshness(3000, 2000)
      expect(result.output).toBe('strategy_snapshot.createdAt')
      expect(result.input).toBe('v6_score.calculatedAt')
    })

    it('checkPortfolioFreshness', () => {
      const result = checkPortfolioFreshness(3000, 2000)
      expect(result.output).toBe('portfolio.builtAt')
      expect(result.input).toBe('composite_score.scoredAt')
    })

    it('checkExecutionPlanFreshness', () => {
      const result = checkExecutionPlanFreshness(3000, 2000, 'plan-001')
      expect(result.output).toBe('execution_plan.createdAt')
      expect(result.input).toBe('signal.createdAt')
      expect(result.valid).toBe(true)
    })

    it('checkExecutionPlanFreshness 默认 planId=unknown', () => {
      const result = checkExecutionPlanFreshness(3000, 2000)
      expect(result.valid).toBe(true)
    })

    it('checkExecutionLogFreshness', () => {
      const result = checkExecutionLogFreshness(4000, 3000, 'plan-001')
      expect(result.output).toBe('execution_log.timestamp')
      expect(result.input).toBe('execution_plan.createdAt')
    })

    it('checkPortfolioRebalanceFreshness', () => {
      const result = checkPortfolioRebalanceFreshness(4000, 3000, 'port-1')
      expect(result.output).toBe('portfolio.updatedAt')
      expect(result.input).toBe('latest_order.createdAt')
    })

    it('checkMissingReportFreshness', () => {
      const result = checkMissingReportFreshness(3000, 2000, '600519')
      expect(result.output).toBe('missing_report.detectedAt')
      expect(result.input).toBe('reference_time')
    })
  })
})
