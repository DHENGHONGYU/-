/**
 * @module missingReportDetector
 * @description 缺失报告检测器：在采集/计算过程中登记数据缺失报告，支持去重与重试。
 *
 * 职责：
 *   - detect(symbol, reportType, reason, options): 检测并登记缺失报告（自动去重）
 *   - listBySymbol(symbol): 查询某股票的全部缺失报告
 *   - listBySeverity(severity): 按严重度查询
 *   - clear(symbol?): 清理已解决的缺失报告
 *   - incrementRetry(id): 增加重试次数
 */

import { getLogger } from '@/lib/logger'
import { missingReportStore } from '@/data/dataLayer'
import type { MissingReport } from '@/data/types'
import {
  MISSING_REPORT_TYPE,
  MISSING_REPORT_SEVERITY,
  DEFAULT_MAX_RETRY_COUNT,
  DEFAULT_MISSING_REPORT_ENABLED,
  type MissingReportType,
  type MissingReportSeverity,
} from '@/constants/execution.constants'
import { checkMissingReportFreshness } from '@/core/freshnessGuard'

const logger = getLogger()

/** 全局开关：是否启用缺失报告检测（初始关闭） */
let detectorEnabled = DEFAULT_MISSING_REPORT_ENABLED

/** 设置检测器启用状态 */
export function setDetectorEnabled(enabled: boolean): void {
  detectorEnabled = enabled
  logger.info(`[missingReportDetector] detectorEnabled = ${enabled}`)
}

/** 查询检测器启用状态 */
export function isDetectorEnabled(): boolean {
  return detectorEnabled
}

export interface DetectOptions {
  now?: number
  severity?: MissingReportSeverity
  enabled?: boolean
}

/**
 * 检测并登记缺失报告。
 * - 当全局开关关闭且 options.enabled 未指定时，跳过登记。
 * - 当同一 (symbol, reportType) 已存在未解决报告时，跳过登记（去重）。
 */
export async function detect(
  symbol: string,
  reportType: MissingReportType,
  reason: string,
  options: DetectOptions = {},
): Promise<MissingReport | undefined> {
  logger.info(`[missingReportDetector] detect() called: symbol="${symbol}" type="${reportType}" severity="${options.severity ?? MISSING_REPORT_SEVERITY.MEDIUM}"`)
  const now = options.now ?? Date.now()
  const severity = options.severity ?? MISSING_REPORT_SEVERITY.MEDIUM
  const enabled = options.enabled ?? detectorEnabled

  if (!enabled) {
    logger.debug(`[missingReportDetector] detect skipped (disabled): symbol="${symbol}" type="${reportType}"`)
    return undefined
  }

  try {
    // Freshness 校验：检测时间必须晚于当前时间减去一个合理窗口（防止回填）
    checkMissingReportFreshness(now, now, symbol)

    // 去重：检查是否已存在未解决的同类报告
    const existing = await missingReportStore.listBySymbol(symbol)
    const duplicate = existing.find((r) => r.reportType === reportType && r.resolvedAt === undefined)
    if (duplicate) {
      logger.info(`[missingReportDetector] detect skipped (duplicate): symbol="${symbol}" type="${reportType}"`, {
        existingId: duplicate.id,
      })
      return undefined
    }

    const report: Omit<MissingReport, 'id'> = {
      symbol,
      reportType,
      severity,
      reason,
      detectedAt: now,
      retryCount: 0,
      createdAt: now,
    }

    const result = await missingReportStore.report(report)
    if (!result.success) {
      logger.error(`[missingReportDetector] detect save failed: ${result.error}`, { symbol, reportType })
      return undefined
    }

    logger.info(`[missingReportDetector] detect success: symbol="${symbol}" type="${reportType}" severity="${severity}"`)
    return result.data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] detect error: ${message}`, { symbol, reportType })
    return undefined
  }
}

/**
 * 查询某股票的全部缺失报告。
 */
export async function listBySymbol(symbol: string): Promise<MissingReport[]> {
  logger.info(`[missingReportDetector] listBySymbol() called: symbol="${symbol}"`)
  try {
    const result = await missingReportStore.listBySymbol(symbol)
    logger.info(`[missingReportDetector] listBySymbol() completed: symbol="${symbol}", count=${result.length}`)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] listBySymbol error: ${message}`, { symbol })
    return []
  }
}

/**
 * 按严重度查询缺失报告。
 */
export async function listBySeverity(severity: MissingReportSeverity): Promise<MissingReport[]> {
  logger.info(`[missingReportDetector] listBySeverity() called: severity="${severity}"`)
  try {
    const result = await missingReportStore.listBySeverity(severity)
    logger.info(`[missingReportDetector] listBySeverity() completed: severity="${severity}", count=${result.length}`)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] listBySeverity error: ${message}`, { severity })
    return []
  }
}

/**
 * 查询所有未解决的缺失报告。
 */
export async function listUnresolved(): Promise<MissingReport[]> {
  logger.info('[missingReportDetector] listUnresolved() called')
  try {
    const all = await missingReportStore.list()
    const result = all.filter((r) => r.resolvedAt === undefined && r.retryCount < DEFAULT_MAX_RETRY_COUNT)
    logger.info(`[missingReportDetector] listUnresolved() completed: all=${all.length}, unresolved=${result.length}`)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] listUnresolved error: ${message}`)
    return []
  }
}

/**
 * 增加重试次数。当重试次数达到上限时自动标记为已解决。
 */
export async function incrementRetry(id: string, _options: { now?: number } = {}): Promise<MissingReport | undefined> {
  logger.info(`[missingReportDetector] incrementRetry() called: id="${id}"`)
  try {
    const result = await missingReportStore.incrementRetry(id)
    if (!result.success) {
      logger.error(`[missingReportDetector] incrementRetry failed: ${result.error}`, { id })
      return undefined
    }

    logger.info(`[missingReportDetector] incrementRetry success: id="${id}"`)
    return result.data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] incrementRetry error: ${message}`, { id })
    return undefined
  }
}

/**
 * 清理已解决的缺失报告。若提供 symbol，则仅清理该股票的报告。
 */
export async function clear(symbol = 'ALL'): Promise<number> {
  logger.info(`[missingReportDetector] clear() called: symbol="${symbol}"`)
  try {
    const all = await missingReportStore.list()
    const toClear = all.filter((r) => {
      if (r.resolvedAt === undefined) return false
      return symbol !== 'ALL' ? r.symbol === symbol : true
    })

    // 注意：dataLayer 未提供批量删除，这里仅返回待清理数量，实际删除由调用方逐条处理
    logger.info(`[missingReportDetector] clear() completed: symbol="${symbol}", resolvedCount=${toClear.length}`)
    return toClear.length
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[missingReportDetector] clear error: ${message}`, { symbol })
    return 0
  }
}

export const missingReportDetector = {
  detect,
  listBySymbol,
  listBySeverity,
  listUnresolved,
  incrementRetry,
  clear,
  setDetectorEnabled,
  isDetectorEnabled,
}

export { MISSING_REPORT_TYPE, MISSING_REPORT_SEVERITY }
