/**
 * @module core/freshnessGuard
 * @description 数据 Freshness 校验核心工具
 *
 * 原位于 services/analysis/dataFreshnessGuard，因被 trading/execution/portfolio
 * 等多个子域调用，下沉到 core/ 层以符合分层约定。
 */

import { getLogger, type LogContext } from '@/lib/logger'

export interface FreshnessCheck {
  output: string
  input: string
  outputTime: number
  inputTime: number
  valid: boolean
}

export interface FreshnessRule {
  outputName: string
  outputTime: number
  inputName: string
  inputTime: number
}

/** 全局 freshness 配置 */
export interface FreshnessConfig {
  /** 当 freshness 校验失败时是否抛出错误（默认 false，仅记录 warn 日志） */
  blocking: boolean
}

let globalConfig: FreshnessConfig = { blocking: false }

/** 设置全局 freshness 配置 */
export function setFreshnessConfig(config: Partial<FreshnessConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/** 获取当前 freshness 配置 */
export function getFreshnessConfig(): FreshnessConfig {
  return { ...globalConfig }
}

/** Freshness 违规错误 */
export class FreshnessError extends Error {
  public readonly check: FreshnessCheck

  constructor(check: FreshnessCheck) {
    super(
      `[freshnessGuard] Freshness violation: ${check.output}(${check.outputTime}) is older than ${check.input}(${check.inputTime})`,
    )
    this.name = 'FreshnessError'
    this.check = check
  }
}

/**
 * 检查输出数据的时间戳是否不早于输入数据。
 * 若输出时间早于输入时间，则视为 freshness 违规，记录 warn 日志。
 * 当 blocking 模式开启时，违规将抛出 FreshnessError。
 */
export function checkFreshness(rule: FreshnessRule): FreshnessCheck {
  const logger = getLogger()
  const { outputName, outputTime, inputName, inputTime } = rule
  const valid = outputTime >= inputTime

  const result: FreshnessCheck = {
    output: outputName,
    input: inputName,
    outputTime,
    inputTime,
    valid,
  }

  if (!valid) {
    logger.warn(
      `[freshnessGuard] Freshness violation: ${outputName}(${outputTime}) is older than ${inputName}(${inputTime})`,
      result as unknown as LogContext,
    )
    if (globalConfig.blocking) {
      throw new FreshnessError(result)
    }
  } else {
    logger.debug(
      `[freshnessGuard] Freshness ok: ${outputName}(${outputTime}) >= ${inputName}(${inputTime})`,
    )
  }

  return result
}

/**
 * 批量检查一组 freshness 规则，返回是否全部通过。
 */
export function checkAllFreshness(rules: FreshnessRule[]): { allValid: boolean; checks: FreshnessCheck[] } {
  const logger = getLogger()
  const checks = rules.map((rule) => checkFreshness(rule))
  const allValid = checks.every((c) => c.valid)

  if (!allValid) {
    const violations = checks.filter((c) => !c.valid).map((c) => `${c.output}<${c.input}`)
    logger.warn(`[freshnessGuard] ${violations.length} freshness violation(s): ${violations.join(', ')}`)
  }

  return { allValid, checks }
}

/** V6 评分 freshness */
export function checkV6ScoreFreshness(calculatedAt: number, quotesUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'v6_score.calculatedAt',
    outputTime: calculatedAt,
    inputName: 'daily_quotes.updatedAt',
    inputTime: quotesUpdatedAt,
  })
}

/** 策略评分 freshness */
export function checkStrategyScoreFreshness(
  strategyCalculatedAt: number,
  v6CalculatedAt: number,
  strategyName: string,
): FreshnessCheck {
  return checkFreshness({
    outputName: `${strategyName}.calculatedAt`,
    outputTime: strategyCalculatedAt,
    inputName: 'v6_score.calculatedAt',
    inputTime: v6CalculatedAt,
  })
}

/** 交易信号 freshness */
export function checkSignalFreshness(signalCreatedAt: number, quotesUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'signal.createdAt',
    outputTime: signalCreatedAt,
    inputName: 'daily_quotes.updatedAt',
    inputTime: quotesUpdatedAt,
  })
}

/** 订单价格 freshness */
export function checkOrderPriceFreshness(orderCreatedAt: number, stockUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'order.createdAt',
    outputTime: orderCreatedAt,
    inputName: 'stock.updatedAt',
    inputTime: stockUpdatedAt,
  })
}

/** 复盘报告 freshness */
export function checkReviewFreshness(generatedAt: number, latestOrderCreatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'trade_review.generatedAt',
    outputTime: generatedAt,
    inputName: 'latest_order.createdAt',
    inputTime: latestOrderCreatedAt,
  })
}

/** 资讯情绪缓存 freshness */
export function checkSentimentCacheFreshness(analyzedAt: number, publishTime: string): FreshnessCheck {
  return checkFreshness({
    outputName: 'sentiment_cache.analyzedAt',
    outputTime: analyzedAt,
    inputName: 'news.publishTime',
    inputTime: new Date(publishTime).getTime(),
  })
}

/** 策略快照 freshness */
export function checkSnapshotFreshness(snapshotCreatedAt: number, v6CalculatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'strategy_snapshot.createdAt',
    outputTime: snapshotCreatedAt,
    inputName: 'v6_score.calculatedAt',
    inputTime: v6CalculatedAt,
  })
}

/** 组合构建 freshness */
export function checkPortfolioFreshness(builtAt: number, latestScoredAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'portfolio.builtAt',
    outputTime: builtAt,
    inputName: 'composite_score.scoredAt',
    inputTime: latestScoredAt,
  })
}

/** 执行计划 freshness */
export function checkExecutionPlanFreshness(
  planCreatedAt: number,
  signalCreatedAt: number,
  planId: string = 'unknown',
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'execution_plan.createdAt',
    outputTime: planCreatedAt,
    inputName: 'signal.createdAt',
    inputTime: signalCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkExecutionPlanFreshness: planId="${planId}" valid=${check.valid}`,
  )
  return check
}

/** 执行日志 freshness */
export function checkExecutionLogFreshness(
  logTimestamp: number,
  planCreatedAt: number,
  planId: string = 'unknown',
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'execution_log.timestamp',
    outputTime: logTimestamp,
    inputName: 'execution_plan.createdAt',
    inputTime: planCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkExecutionLogFreshness: planId="${planId}" valid=${check.valid}`,
  )
  return check
}

/** 投资组合再平衡 freshness */
export function checkPortfolioRebalanceFreshness(
  portfolioUpdatedAt: number,
  latestOrderCreatedAt: number,
  portfolioId: string = 'unknown',
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'portfolio.updatedAt',
    outputTime: portfolioUpdatedAt,
    inputName: 'latest_order.createdAt',
    inputTime: latestOrderCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkPortfolioRebalanceFreshness: portfolioId="${portfolioId}" valid=${check.valid}`,
  )
  return check
}

/** 缺失报告 freshness */
export function checkMissingReportFreshness(
  detectedAt: number,
  referenceTime: number,
  symbol: string = 'unknown',
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'missing_report.detectedAt',
    outputTime: detectedAt,
    inputName: 'reference_time',
    inputTime: referenceTime,
  })
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkMissingReportFreshness: symbol="${symbol}" valid=${check.valid}`,
  )
  return check
}
