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
      `[dataFreshnessGuard] Freshness violation: ${check.output}(${check.outputTime}) is older than ${check.input}(${check.inputTime})`,
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
      `[dataFreshnessGuard] Freshness violation: ${outputName}(${outputTime}) is older than ${inputName}(${inputTime})`,
      result as unknown as LogContext,
    )
    if (globalConfig.blocking) {
      throw new FreshnessError(result)
    }
  } else {
    logger.debug(
      `[dataFreshnessGuard] Freshness ok: ${outputName}(${outputTime}) >= ${inputName}(${inputTime})`,
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
    logger.warn(`[dataFreshnessGuard] ${violations.length} freshness violation(s): ${violations.join(', ')}`)
  }

  return { allValid, checks }
}

/**
 * V6 评分 freshness：评分计算时间必须晚于行情更新时间。
 */
export function checkV6ScoreFreshness(calculatedAt: number, quotesUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'v6_score.calculatedAt',
    outputTime: calculatedAt,
    inputName: 'daily_quotes.updatedAt',
    inputTime: quotesUpdatedAt,
  })
}

/**
 * 策略评分 freshness：策略评分计算时间必须晚于 V6 评分计算时间。
 */
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

/**
 * 交易信号 freshness：信号创建时间必须晚于行情更新时间。
 */
export function checkSignalFreshness(signalCreatedAt: number, quotesUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'signal.createdAt',
    outputTime: signalCreatedAt,
    inputName: 'daily_quotes.updatedAt',
    inputTime: quotesUpdatedAt,
  })
}

/**
 * 订单价格 freshness：订单创建时间应晚于股票价格更新时间。
 */
export function checkOrderPriceFreshness(orderCreatedAt: number, stockUpdatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'order.createdAt',
    outputTime: orderCreatedAt,
    inputName: 'stock.updatedAt',
    inputTime: stockUpdatedAt,
  })
}

/**
 * 复盘报告 freshness：报告生成时间必须晚于最新订单创建时间。
 */
export function checkReviewFreshness(generatedAt: number, latestOrderCreatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'trade_review.generatedAt',
    outputTime: generatedAt,
    inputName: 'latest_order.createdAt',
    inputTime: latestOrderCreatedAt,
  })
}

/**
 * 资讯情绪缓存 freshness：情绪分析时间必须晚于文章发布时间。
 */
export function checkSentimentCacheFreshness(analyzedAt: number, publishTime: string): FreshnessCheck {
  return checkFreshness({
    outputName: 'sentiment_cache.analyzedAt',
    outputTime: analyzedAt,
    inputName: 'news.publishTime',
    inputTime: new Date(publishTime).getTime(),
  })
}

/**
 * 策略快照 freshness：快照创建时间必须晚于最新的 V6 评分计算时间。
 */
export function checkSnapshotFreshness(snapshotCreatedAt: number, v6CalculatedAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'strategy_snapshot.createdAt',
    outputTime: snapshotCreatedAt,
    inputName: 'v6_score.calculatedAt',
    inputTime: v6CalculatedAt,
  })
}

/**
 * 组合构建 freshness：组合构建时间必须晚于最新综合评分时间。
 */
export function checkPortfolioFreshness(builtAt: number, latestScoredAt: number): FreshnessCheck {
  return checkFreshness({
    outputName: 'portfolio.builtAt',
    outputTime: builtAt,
    inputName: 'composite_score.scoredAt',
    inputTime: latestScoredAt,
  })
}

// ============================================================
// E-3 批次新增：v15/v16 新 Store 的 Freshness 校验
// ============================================================

/**
 * 执行计划 freshness：执行计划创建时间必须晚于信号创建时间。
 * 规则：executionPlans.createdAt >= signals.createdAt
 */
export function checkExecutionPlanFreshness(
  planCreatedAt: number,
  signalCreatedAt: number,
  planId?: string,
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'execution_plan.createdAt',
    outputTime: planCreatedAt,
    inputName: 'signal.createdAt',
    inputTime: signalCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[dataFreshnessGuard] checkExecutionPlanFreshness: planId="${planId ?? 'unknown'}" valid=${check.valid}`,
  )
  return check
}

/**
 * 执行日志 freshness：日志时间戳必须晚于关联计划的创建时间。
 * 规则：execution_logs.timestamp >= executionPlans.createdAt
 */
export function checkExecutionLogFreshness(
  logTimestamp: number,
  planCreatedAt: number,
  planId?: string,
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'execution_log.timestamp',
    outputTime: logTimestamp,
    inputName: 'execution_plan.createdAt',
    inputTime: planCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[dataFreshnessGuard] checkExecutionLogFreshness: planId="${planId ?? 'unknown'}" valid=${check.valid}`,
  )
  return check
}

/**
 * 投资组合再平衡 freshness：组合更新时间必须晚于最新订单创建时间。
 * 规则：portfolios.updatedAt >= max(orders.createdAt)
 */
export function checkPortfolioRebalanceFreshness(
  portfolioUpdatedAt: number,
  latestOrderCreatedAt: number,
  portfolioId?: string,
): FreshnessCheck {
  const check = checkFreshness({
    outputName: 'portfolio.updatedAt',
    outputTime: portfolioUpdatedAt,
    inputName: 'latest_order.createdAt',
    inputTime: latestOrderCreatedAt,
  })
  const logger = getLogger()
  logger.info(
    `[dataFreshnessGuard] checkPortfolioRebalanceFreshness: portfolioId="${portfolioId ?? 'unknown'}" valid=${check.valid}`,
  )
  return check
}

/**
 * 缺失报告 freshness：检测时间必须不晚于当前时间（防止未来时间戳回填），
 * 且不早于参考时间（防止误登记历史已解决问题）。
 * 规则：detectedAt <= currentTime && detectedAt >= referenceTime
 */
export function checkMissingReportFreshness(
  detectedAt: number,
  referenceTime: number,
  symbol?: string,
): FreshnessCheck {
  // 使用 checkFreshness 校验 detectedAt >= referenceTime
  const check = checkFreshness({
    outputName: 'missing_report.detectedAt',
    outputTime: detectedAt,
    inputName: 'reference_time',
    inputTime: referenceTime,
  })
  const logger = getLogger()
  logger.info(
    `[dataFreshnessGuard] checkMissingReportFreshness: symbol="${symbol ?? 'unknown'}" valid=${check.valid}`,
  )
  return check
}
