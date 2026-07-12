/**
 * @module tradeErrorClassifier
 * @description 交易错误自动分类器主入口（PR-7 拆分后的编排器）。
 *
 * 从原 767 行单文件拆分为 4 文件（PR-7 方案 A，2026-07-08）：
 * - tradeErrorClassifier.ts（本文件，~150 行）：主编排器，保留 4 个公共 API
 * - tradeErrorDefinitions.ts（~200 行）：5 个类型 + 12 类错误定义 + SEVERITY_PENALTY
 * - tradeErrorUtils.ts（~100 行）：TradePair + buildTradePairs + groupOrdersByDay
 * - tradeErrorDetectors.ts（~414 行）：12 个检测器函数
 *
 * 拆分原则：
 * - 公共 API 完全向后兼容（12 处调用点零修改，含 5 个测试文件的 vi.mock）
 * - 行为等价性：1:1 迁移，不改任何算法、阈值、字段、公式
 * - 依赖方向单向：definitions → utils → detectors → classifier
 *
 * 12 类常见交易错误自动检测，每类错误包含：
 *   - 名称、严重等级(critical/major/minor)、心理根源、检测逻辑
 *
 * 纪律评分公式：100 - critical×15 - major×8 - minor×3
 *
 * 导出 classifyErrors(orders: Order[]) 方法
 *
 * @see tradeErrorDefinitions.ts — 类型与常量
 * @see tradeErrorUtils.ts — 辅助函数
 * @see tradeErrorDetectors.ts — 12 个检测器
 */

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import { MAX_SCORE, MIN_SCORE } from '@/constants/trade.constants'
import {
  ERROR_DEFINITIONS,
  SEVERITY_PENALTY,
  type ErrorSeverity,
  type TradeErrorDef,
  type DetectedError,
  type ErrorClassificationResult,
} from './tradeErrorDefinitions'
import { groupOrdersByDay } from './tradeErrorUtils'
import {
  detectChaseHighSellLow,
  detectEarlyProfitTaking,
  detectNoStopLoss,
  detectAgainstTrendAdding,
  detectGreedyTailChasing,
  detectPlanViolation,
  detectHeavyGambling,
  detectRevengeTrading,
  detectFomoEntry,
  detectIgnoreStopLoss,
  detectHesitationMiss,
  detectOvertrading,
} from './tradeErrorDetectors'

// ============================================================
// re-export 子模块公共 API（保持向后兼容，12 处调用点零修改）
// ============================================================

// 类型 re-export
export type {
  ErrorSeverity,
  TradeErrorDef,
  DetectedError,
  ErrorClassificationResult,
} from './tradeErrorDefinitions'

// 常量与 enum re-export（TradeErrorType 是 enum，必须用 export 而非 export type）
export { ERROR_DEFINITIONS, SEVERITY_PENALTY, TradeErrorType } from './tradeErrorDefinitions'

// 工具函数与类型 re-export
export { buildTradePairs, groupOrdersByDay } from './tradeErrorUtils'
export type { TradePair } from './tradeErrorUtils'

// 12 个检测器 re-export
export {
  detectChaseHighSellLow,
  detectEarlyProfitTaking,
  detectNoStopLoss,
  detectAgainstTrendAdding,
  detectGreedyTailChasing,
  detectPlanViolation,
  detectHeavyGambling,
  detectRevengeTrading,
  detectFomoEntry,
  detectIgnoreStopLoss,
  detectHesitationMiss,
  detectOvertrading,
} from './tradeErrorDetectors'

const logger = getLogger()

// ============================================================
// 主入口：分类检测
// ============================================================

/**
 * 对订单列表进行 12 类错误自动检测
 *
 * @param orders 订单列表
 * @returns 错误分类结果，包含纪律评分
 */
export function classifyErrors(orders: Order[]): ErrorClassificationResult {
  logger.info(`[TradeErrorClassifier] 开始分类检测: 订单数=${orders.length}`)

  if (orders.length === 0) {
    logger.info('[TradeErrorClassifier] 无订单数据，返回满分')
    return {
      errors: [],
      disciplineScore: 100,
      totalPenalty: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      totalErrors: 0,
    }
  }

  const dayGroups = groupOrdersByDay(orders)
  const detectedErrors: DetectedError[] = []

  const detectors: Array<{
    fn: (orders: Order[], dayGroups: Map<string, Order[]>) => DetectedError | null
  }> = [
    { fn: (o, dg) => detectChaseHighSellLow(o, dg) },
    { fn: (o) => detectEarlyProfitTaking(o) },
    { fn: (o) => detectNoStopLoss(o) },
    { fn: (o) => detectAgainstTrendAdding(o) },
    { fn: (o) => detectGreedyTailChasing(o) },
    { fn: (o) => detectPlanViolation(o) },
    { fn: (o) => detectHeavyGambling(o) },
    { fn: (o) => detectRevengeTrading(o) },
    { fn: (o) => detectFomoEntry(o) },
    { fn: (o) => detectIgnoreStopLoss(o) },
    { fn: (o) => detectHesitationMiss(o) },
    { fn: (o, dg) => detectOvertrading(o, dg) },
  ]

  for (const detector of detectors) {
    try {
      const result = detector.fn(orders, dayGroups)
      if (!result) continue
      detectedErrors.push(result)
      logger.info(`[TradeErrorClassifier] 检测到错误: ${result.name} (${result.severity}), count=${result.count}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[TradeErrorClassifier] 检测器执行异常`, { error: message })
    }
  }

  // 计算纪律评分
  let totalPenalty = 0
  let criticalCount = 0
  let majorCount = 0
  let minorCount = 0

  for (const error of detectedErrors) {
    totalPenalty += error.penalty
    if (error.severity === 'critical') criticalCount++
    else if (error.severity === 'major') majorCount++
    else minorCount++
  }

  const disciplineScore = Math.max(MIN_SCORE, MAX_SCORE - totalPenalty)

  logger.info(
    `[TradeErrorClassifier] 分类完成: 纪律评分=${disciplineScore}, ` +
    `critical=${criticalCount}, major=${majorCount}, minor=${minorCount}, ` +
    `总错误=${detectedErrors.length}`,
  )

  return {
    errors: detectedErrors,
    disciplineScore,
    totalPenalty,
    criticalCount,
    majorCount,
    minorCount,
    totalErrors: detectedErrors.length,
  }
}

/**
 * 获取 12 类错误定义列表
 */
export function getErrorDefinitions(): TradeErrorDef[] {
  return [...ERROR_DEFINITIONS]
}

/**
 * 获取各严重等级的扣分标准
 */
export function getSeverityPenalties(): Record<ErrorSeverity, number> {
  return { ...SEVERITY_PENALTY }
}

/**
 * 计算纪律评分（可直接传入统计数据）
 */
export function calculateDisciplineScore(stats: {
  criticalCount: number
  majorCount: number
  minorCount: number
}): number {
  const penalty =
    stats.criticalCount * SEVERITY_PENALTY.critical +
    stats.majorCount * SEVERITY_PENALTY.major +
    stats.minorCount * SEVERITY_PENALTY.minor
  return Math.max(0, 100 - penalty)
}
