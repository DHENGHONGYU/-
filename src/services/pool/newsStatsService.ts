/**
 * @fileoverview 个股资讯统计服务
 *
 * 从 newsStockMap + news 两表关联查询，计算每只股票的：
 * - 总采集条数
 * - 高质量条数（sentimentConfidence >= 0.7）
 * - 时间窗口分布（近1周/近1月/近3月）
 *
 * 使用 MODULE_ID.news 作为 source，复用 news 模块的 ACL 权限。
 *
 * @module services/pool/newsStatsService
 * @created 2026-07-19
 */

import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import type { NewsArticle, NewsStockMap } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 时间窗口标识 */
export type NewsTimeWindow = '1w' | '1m' | '3m' | 'all'

/** 单个时间窗口的统计 */
export interface NewsWindowStats {
  total: number
  highQuality: number
}

/** 个股资讯统计结果 */
export interface StockNewsStats {
  symbol: string
  /** 全部时间窗口统计 */
  all: NewsWindowStats
  /** 近 1 周统计 */
  last1w: NewsWindowStats
  /** 近 1 月统计 */
  last1m: NewsWindowStats
  /** 近 3 月统计 */
  last3m: NewsWindowStats
}

/** 高质量阈值（sentimentConfidence >= 此值视为高质量） */
const HQ_CONFIDENCE_THRESHOLD = 0.7

// ============================================================
// 时间窗口工具
// ============================================================

/** 获取各时间窗口的起始时间戳（毫秒） */
function getWindowTimestamps(now: number): Record<NewsTimeWindow, number> {
  const MS_PER_DAY = 86_400_000
  return {
    '1w': now - 7 * MS_PER_DAY,
    '1m': now - 30 * MS_PER_DAY,
    '3m': now - 90 * MS_PER_DAY,
    all: 0,
  }
}

/** 判断发布时间是否在窗口内 */
function isInWindow(publishTime: string, windowStart: number): boolean {
  if (windowStart === 0) return true
  const ts = new Date(publishTime).getTime()
  return !Number.isNaN(ts) && ts >= windowStart
}

/** 判断是否为高质量资讯 */
function isHighQuality(article: NewsArticle): boolean {
  return article.sentimentConfidence >= HQ_CONFIDENCE_THRESHOLD
}

// ============================================================
// 核心查询
// ============================================================

/**
 * 查询单只股票的资讯统计
 */
export async function getStockNewsStats(symbol: string): Promise<StockNewsStats | null> {
  try {
    const mapResult = await dataBridge.query<NewsStockMap[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.newsStockMap,
      indexName: 'by-symbol',
      indexValue: symbol,
      source: MODULE_ID.news,
    })

    if (!mapResult.success || !mapResult.data || mapResult.data.length === 0) {
      return null
    }

    const mappings = mapResult.data
    const now = Date.now()
    const windows = getWindowTimestamps(now)

    const stats: StockNewsStats = {
      symbol,
      all: { total: 0, highQuality: 0 },
      last1w: { total: 0, highQuality: 0 },
      last1m: { total: 0, highQuality: 0 },
      last3m: { total: 0, highQuality: 0 },
    }

    for (const mapping of mappings) {
      const articleResult = await dataBridge.query<NewsArticle>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.news,
        key: mapping.newsId,
        source: MODULE_ID.news,
      })

      if (!articleResult.success || !articleResult.data) continue

      const article = articleResult.data
      const hq = isHighQuality(article)

      stats.all.total++
      if (hq) stats.all.highQuality++

      if (isInWindow(article.publishTime, windows['1w'])) {
        stats.last1w.total++
        if (hq) stats.last1w.highQuality++
      }

      if (isInWindow(article.publishTime, windows['1m'])) {
        stats.last1m.total++
        if (hq) stats.last1m.highQuality++
      }

      if (isInWindow(article.publishTime, windows['3m'])) {
        stats.last3m.total++
        if (hq) stats.last3m.highQuality++
      }
    }

    logger.debug('[newsStats] 统计完成', { symbol, total: stats.all.total, hq: stats.all.highQuality })
    return stats
  } catch (err) {
    logger.error('[newsStats] 查询失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * 批量查询多只股票的资讯统计
 */
export async function getBatchStockNewsStats(symbols: string[]): Promise<Map<string, StockNewsStats>> {
  const results = new Map<string, StockNewsStats>()
  const promises = symbols.map(async (symbol) => {
    const stats = await getStockNewsStats(symbol)
    if (stats) results.set(symbol, stats)
  })
  await Promise.all(promises)
  return results
}
