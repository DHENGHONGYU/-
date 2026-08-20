/**
 * @module core/freshnessGuard
 * @description 数据 Freshness 校验核心工具
 *
 * 原位于 services/analysis/dataFreshnessGuard，因被 trading/execution/portfolio
 * 等多个子域调用，下沉到 core/ 层以符合分层约定。
  * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
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
  /** 高风险场景白名单：指定哪些检查函数默认启用阻断模式 */
  highRiskBlockingTargets: string[]
}

let globalConfig: FreshnessConfig = {
  blocking: false,
  highRiskBlockingTargets: [
    'signal',
    'order_price',
    'execution_plan',
    'execution_log',
    'portfolio_rebalance',
  ],
}

/** 设置全局 freshness 配置 */
export function setFreshnessConfig(config: Partial<FreshnessConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/** 获取当前 freshness 配置 */
export function getFreshnessConfig(): FreshnessConfig {
  return { ...globalConfig }
}

/**
 * 批量启用高风险场景的阻断模式。
 * 启用后，交易信号、订单价格、执行计划、执行日志、组合再平衡
 * 这五类关键业务场景的 freshness 校验将直接阻断而非仅记录日志。
 */
export function enableBlockingForHighRisk(): void {
  globalConfig = { ...globalConfig, blocking: true }
  const logger = getLogger()
  logger.warn(
    `[freshnessGuard] Blocking mode enabled for high-risk targets: ${globalConfig.highRiskBlockingTargets.join(', ')}`,
  )
}

/**
 * 关闭高风险场景的阻断模式，恢复为仅记录日志。
 */
export function disableBlockingForHighRisk(): void {
  globalConfig = { ...globalConfig, blocking: false }
  const logger = getLogger()
  logger.info('[freshnessGuard] Blocking mode disabled, reverting to warn-only mode')
}

/**
 * 查询指定 target 是否处于阻断模式。
 * 优先级：per-call blocking 参数 > 全局 blocking + 白名单匹配
 */
export function shouldBlock(target: string, perCallBlocking?: boolean): boolean {
  if (perCallBlocking !== undefined) return perCallBlocking
  return globalConfig.blocking && globalConfig.highRiskBlockingTargets.includes(target)
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
 * 当 blocking 模式开启时（全局配置或 per-call 覆盖），违规将抛出 FreshnessError。
 *
 * @param rule 数据流向规则
 * @param target 业务场景标识（用于白名单匹配和日志定位）
 * @param perCallBlocking 可选的 per-call 阻断覆盖，优先级高于全局配置
 */
export function checkFreshness(
  rule: FreshnessRule,
  target: string = 'generic',
  perCallBlocking?: boolean,
): FreshnessCheck {
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
    const willBlock = shouldBlock(target, perCallBlocking)
    logger.warn(
      `[freshnessGuard] Freshness violation: ${outputName}(${outputTime}) is older than ${inputName}(${inputTime}) [target=${target}, willBlock=${willBlock}]`,
      result as unknown as LogContext,
    )
    if (willBlock) {
      throw new FreshnessError(result)
    }
  } else {
    logger.debug(
      `[freshnessGuard] Freshness ok: ${outputName}(${outputTime}) >= ${inputName}(${inputTime}) [target=${target}]`,
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
  return checkFreshness(
    {
      outputName: 'v6_score.calculatedAt',
      outputTime: calculatedAt,
      inputName: 'daily_quotes.updatedAt',
      inputTime: quotesUpdatedAt,
    },
    'v6_score',
  )
}

/** 策略评分 freshness */
export function checkStrategyScoreFreshness(
  strategyCalculatedAt: number,
  v6CalculatedAt: number,
  strategyName: string,
): FreshnessCheck {
  return checkFreshness(
    {
      outputName: `${strategyName}.calculatedAt`,
      outputTime: strategyCalculatedAt,
      inputName: 'v6_score.calculatedAt',
      inputTime: v6CalculatedAt,
    },
    'strategy_score',
  )
}

/** 交易信号 freshness —— 高风险场景，支持阻断 */
export function checkSignalFreshness(
  signalCreatedAt: number,
  quotesUpdatedAt: number,
  blocking?: boolean,
): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'signal.createdAt',
      outputTime: signalCreatedAt,
      inputName: 'daily_quotes.updatedAt',
      inputTime: quotesUpdatedAt,
    },
    'signal',
    blocking,
  )
}

/** 订单价格 freshness —— 高风险场景，支持阻断 */
export function checkOrderPriceFreshness(
  orderCreatedAt: number,
  stockUpdatedAt: number,
  blocking?: boolean,
): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'order.createdAt',
      outputTime: orderCreatedAt,
      inputName: 'stock.updatedAt',
      inputTime: stockUpdatedAt,
    },
    'order_price',
    blocking,
  )
}

/** 复盘报告 freshness */
export function checkReviewFreshness(generatedAt: number, latestOrderCreatedAt: number): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'trade_review.generatedAt',
      outputTime: generatedAt,
      inputName: 'latest_order.createdAt',
      inputTime: latestOrderCreatedAt,
    },
    'review',
  )
}

/** 资讯情绪缓存 freshness */
export function checkSentimentCacheFreshness(analyzedAt: number, publishTime: string): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'sentiment_cache.analyzedAt',
      outputTime: analyzedAt,
      inputName: 'news.publishTime',
      inputTime: new Date(publishTime).getTime(),
    },
    'sentiment_cache',
  )
}

/** 策略快照 freshness */
export function checkSnapshotFreshness(snapshotCreatedAt: number, v6CalculatedAt: number): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'strategy_snapshot.createdAt',
      outputTime: snapshotCreatedAt,
      inputName: 'v6_score.calculatedAt',
      inputTime: v6CalculatedAt,
    },
    'strategy_snapshot',
  )
}

/** 组合构建 freshness */
export function checkPortfolioFreshness(builtAt: number, latestScoredAt: number): FreshnessCheck {
  return checkFreshness(
    {
      outputName: 'portfolio.builtAt',
      outputTime: builtAt,
      inputName: 'composite_score.scoredAt',
      inputTime: latestScoredAt,
    },
    'portfolio_build',
  )
}

/** 执行计划 freshness —— 高风险场景，支持阻断 */
export function checkExecutionPlanFreshness(
  planCreatedAt: number,
  signalCreatedAt: number,
  planId: string = 'unknown',
  blocking?: boolean,
): FreshnessCheck {
  const check = checkFreshness(
    {
      outputName: 'execution_plan.createdAt',
      outputTime: planCreatedAt,
      inputName: 'signal.createdAt',
      inputTime: signalCreatedAt,
    },
    'execution_plan',
    blocking,
  )
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkExecutionPlanFreshness: planId="${planId}" valid=${check.valid}`,
  )
  return check
}

/** 执行日志 freshness —— 高风险场景，支持阻断 */
export function checkExecutionLogFreshness(
  logTimestamp: number,
  planCreatedAt: number,
  planId: string = 'unknown',
  blocking?: boolean,
): FreshnessCheck {
  const check = checkFreshness(
    {
      outputName: 'execution_log.timestamp',
      outputTime: logTimestamp,
      inputName: 'execution_plan.createdAt',
      inputTime: planCreatedAt,
    },
    'execution_log',
    blocking,
  )
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkExecutionLogFreshness: planId="${planId}" valid=${check.valid}`,
  )
  return check
}

/** 投资组合再平衡 freshness —— 高风险场景，支持阻断 */
export function checkPortfolioRebalanceFreshness(
  portfolioUpdatedAt: number,
  latestOrderCreatedAt: number,
  portfolioId: string = 'unknown',
  blocking?: boolean,
): FreshnessCheck {
  const check = checkFreshness(
    {
      outputName: 'portfolio.updatedAt',
      outputTime: portfolioUpdatedAt,
      inputName: 'latest_order.createdAt',
      inputTime: latestOrderCreatedAt,
    },
    'portfolio_rebalance',
    blocking,
  )
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
  const check = checkFreshness(
    {
      outputName: 'missing_report.detectedAt',
      outputTime: detectedAt,
      inputName: 'reference_time',
      inputTime: referenceTime,
    },
    'missing_report',
  )
  const logger = getLogger()
  logger.info(
    `[freshnessGuard] checkMissingReportFreshness: symbol="${symbol}" valid=${check.valid}`,
  )
  return check
}
