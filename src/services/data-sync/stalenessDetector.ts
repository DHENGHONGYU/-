/**
 * @fileoverview 数据过期检测器
 *
 * 检测 IndexedDB 中已有数据是否过期，触发同步更新流程：
 * - 按 8 维度配置过期阈值
 * - 检查 lastUpdatedAt 与当前时间差
 * - 推荐触发源（自动采集 or 文件导入）
 * - 与 GlobalScheduler 联动触发重采集
 *
 * @module services/data-sync/stalenessDetector
 * @created 2026-07-14 - 双通道整改 P1-2
 */

import { getLogger } from '@/lib/logger'
import type { StaleDimension, StalenessCheckResult } from '@/types/modules/data-sync.types'

const logger = getLogger()

/** 各维度过期阈值（小时） */
const STALENESS_THRESHOLDS: Readonly<Record<string, number>> = {
  '01': 24,      // 基本信息：24 小时
  '02': 24,      // K线：24 小时
  '03': 72,      // 筹码分布：3 天
  '04': 24,      // 重大事项：24 小时
  '05': 12,      // 热点新闻：12 小时
  '06': 168,     // 行业竞品：7 天
  '07': 168,     // 关联指数：7 天
  '08': 24,      // 研报：24 小时
}

/** 可自动采集的维度（有真实数据源） */
const AUTO_COLLECTABLE_DIMENSIONS: ReadonlySet<string> = new Set(['01', '02'])

/** 严重度分档阈值 */
const VERY_STALE_MULTIPLIER = 2 // 超过阈值 2 倍为 very-stale

/**
 * 计算数据年龄（小时）
 * @param lastUpdatedAt - 最后更新时间 ISO 字符串
 * @returns 年龄（小时），无时间返回 Infinity
 */
function computeAgeHours(lastUpdatedAt: string | null): number {
  if (!lastUpdatedAt) return Infinity
  const updated = new Date(lastUpdatedAt).getTime()
  if (Number.isNaN(updated)) return Infinity
  return (Date.now() - updated) / (1000 * 60 * 60)
}

/**
 * 评估单个维度的过期严重度
 * @param ageHours - 数据年龄
 * @param thresholdHours - 过期阈值
 * @returns 严重度
 */
function assessSeverity(
  ageHours: number,
  thresholdHours: number,
): 'fresh' | 'stale' | 'very-stale' {
  if (ageHours <= thresholdHours) return 'fresh'
  if (ageHours <= thresholdHours * VERY_STALE_MULTIPLIER) return 'stale'
  return 'very-stale'
}

/**
 * 检查单个标的的所有维度过期状态
 *
 * @param symbol - 股票代码
 * @param dimensionTimestamps - 各维度最后更新时间映射（dimensionCode → ISO 时间）
 * @returns 过期检测结果
 */
export function checkStaleness(
  symbol: string,
  dimensionTimestamps: Record<string, string | null>,
): StalenessCheckResult {
  const staleDimensions: StaleDimension[] = []

  // 仅检查提供了时间戳的维度
  for (const dimensionCode of Object.keys(dimensionTimestamps)) {
    const threshold = STALENESS_THRESHOLDS[dimensionCode]
    if (threshold === undefined) continue

    const lastUpdatedAt = dimensionTimestamps[dimensionCode] ?? null
    const ageHours = computeAgeHours(lastUpdatedAt)
    const severity = assessSeverity(ageHours, threshold)

    if (severity !== 'fresh') {
      staleDimensions.push({
        symbol,
        dimensionCode,
        lastUpdatedAt,
        ageHours: ageHours === Infinity ? -1 : Math.round(ageHours),
        thresholdHours: threshold,
        severity,
      })
    }
  }

  const isStale = staleDimensions.length > 0

  // 推荐触发源
  let recommendedAction: StalenessCheckResult['recommendedAction'] = 'skip'
  if (isStale) {
    const hasAutoCollectable = staleDimensions.some(d =>
      AUTO_COLLECTABLE_DIMENSIONS.has(d.dimensionCode),
    )
    const hasFileImportOnly = staleDimensions.some(d =>
      !AUTO_COLLECTABLE_DIMENSIONS.has(d.dimensionCode),
    )

    if (hasAutoCollectable && !hasFileImportOnly) {
      recommendedAction = 'auto-collect'
    } else if (hasFileImportOnly && !hasAutoCollectable) {
      recommendedAction = 'file-import'
    } else {
      // 混合：有可自动采集的也有需文件导入的
      recommendedAction = 'auto-collect' // 优先自动采集，剩余的提示文件导入
    }
  }

  logger.info('[checkStaleness] 过期检测完成', {
    symbol,
    staleCount: staleDimensions.length,
    recommendedAction,
    staleDimensions: staleDimensions.map(d => `${d.dimensionCode}:${d.severity}`),
  })

  return { isStale, staleDimensions, recommendedAction }
}

/**
 * 批量检查多个标的的过期状态
 *
 * @param symbols - 标的列表
 * @param getTimestamps - 获取标的维度时间戳的函数
 * @returns 所有标的的过期检测结果
 */
export function checkStalenessBatch(
  symbols: readonly string[],
  getTimestamps: (symbol: string) => Record<string, string | null>,
): ReadonlyArray<{ symbol: string; result: StalenessCheckResult }> {
  const results = symbols.map(symbol => ({
    symbol,
    result: checkStaleness(symbol, getTimestamps(symbol)),
  }))

  const staleCount = results.filter(r => r.result.isStale).length
  logger.info('[checkStalenessBatch] 批量过期检测完成', {
    total: symbols.length,
    stale: staleCount,
    fresh: symbols.length - staleCount,
  })

  return results
}

/**
 * 获取过期阈值配置
 * @returns 维度→阈值小时数映射
 */
export function getStalenessThresholds(): Readonly<Record<string, number>> {
  return STALENESS_THRESHOLDS
}

/**
 * 判断维度是否可自动采集
 * @param dimensionCode - 维度代码
 * @returns 是否可自动采集
 */
export function isAutoCollectable(dimensionCode: string): boolean {
  return AUTO_COLLECTABLE_DIMENSIONS.has(dimensionCode)
}
