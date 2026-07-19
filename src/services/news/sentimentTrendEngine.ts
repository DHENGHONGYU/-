/**
 * @module sentimentTrendEngine
 * @description 资讯情感趋势聚合引擎（DA-008）。
 * 仅对 newsStore 已加载的 NewsArticle 做纯聚合，不触发任何网络请求或 LLM 调用，
 * 不修改输入数据，输出按日期排序的情感分布序列。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import type { NewsArticle } from '@/data/types'
import type {
  SentimentTrendDimension,
  SentimentTrendOptions,
  SentimentTrendPoint,
  SentimentTrendSeries,
  SentimentType,
} from '@/types/modules/news.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 支持的三种情感标签，顺序决定图表堆叠顺序 */
const SENTIMENT_ORDER: SentimentType[] = ['positive', 'negative', 'neutral']

/** 从一个 ISO 时间字符串提取本地日期（YYYY-MM-DD） */
function extractDate(isoTime: string): string {
  // publishTime 可能是 ISO 8601 字符串或毫秒时间戳
  const d = Number.isNaN(Number(isoTime)) ? new Date(isoTime) : new Date(Number(isoTime))
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return d.toISOString().slice(0, 10)
}

/** 判断文章是否命中给定维度 */
function matchesDimension(
  article: NewsArticle,
  dimension: SentimentTrendDimension,
  value?: string,
): boolean {
  if (dimension === 'global') return true
  if (value === undefined || value.length === 0) return true
  if (dimension === 'stock') {
    return article.relatedStocks.includes(value)
  }
  // industry 维度按 category 字段匹配（资讯分类映射为行业）
  return article.category === value
}

/** 日期是否在 [start, end] 范围内 */
function isDateInRange(date: string, start?: string, end?: string): boolean {
  if (date.length === 0) return false
  if (start !== undefined && start.length > 0 && date < start) return false
  if (end !== undefined && end.length > 0 && date > end) return false
  return true
}

/** 生成 startDate 到 endDate 之间所有日期（含） */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const curr = new Date(start)

  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10))
    curr.setDate(curr.getDate() + 1)
  }
  return dates
}

/** 按日期聚合情感计数 */
function aggregateByDate(articles: NewsArticle[]): Map<string, Record<SentimentType, number>> {
  const map = new Map<string, Record<SentimentType, number>>()

  for (const article of articles) {
    const date = extractDate(article.publishTime)
    if (date.length === 0) continue

    const bucket = map.get(date) ?? { positive: 0, negative: 0, neutral: 0 }
    if (SENTIMENT_ORDER.includes(article.sentiment)) {
      bucket[article.sentiment] += 1
    }
    map.set(date, bucket)
  }

  return map
}

/** 将聚合 Map 转换为排序后的数据点数组 */
function buildSeriesData(
  buckets: Map<string, Record<SentimentType, number>>,
  options: SentimentTrendOptions,
): SentimentTrendPoint[] {
  const dates = Array.from(buckets.keys()).sort()
  if (dates.length === 0) {
    return []
  }

  const startDate = options.startDate ?? dates[0]
  const endDate = options.endDate ?? dates[dates.length - 1]
  if (startDate === undefined || endDate === undefined) {
    return []
  }

  const targetDates =
    options.fillGaps === true && startDate.length > 0 && endDate.length > 0
      ? generateDateRange(startDate, endDate)
      : dates

  return targetDates.map((date) => {
    const bucket = buckets.get(date) ?? { positive: 0, negative: 0, neutral: 0 }
    const total = bucket.positive + bucket.negative + bucket.neutral
    return {
      date,
      positive: bucket.positive,
      negative: bucket.negative,
      neutral: bucket.neutral,
      total,
      positiveRatio: total > 0 ? bucket.positive / total : 0,
      negativeRatio: total > 0 ? bucket.negative / total : 0,
      neutralRatio: total > 0 ? bucket.neutral / total : 0,
    }
  })
}

/**
 * 聚合资讯情感趋势。
 * @param articles 资讯列表（来自 newsStore）
 * @param options 聚合维度与筛选条件
 * @returns 情感趋势序列
 */
export function aggregateSentimentTrend(
  articles: NewsArticle[],
  options: SentimentTrendOptions,
): SentimentTrendSeries {
  logger.info('[sentimentTrendEngine] aggregateSentimentTrend started', {
    dimension: options.dimension,
    value: options.value,
    articleCount: articles.length,
  })

  const filtered = articles.filter((a) => {
    const date = extractDate(a.publishTime)
    return matchesDimension(a, options.dimension, options.value) && isDateInRange(date, options.startDate, options.endDate)
  })

  const buckets = aggregateByDate(filtered)
  const data = buildSeriesData(buckets, options)

  const summary = {
    totalArticles: filtered.length,
    positiveCount: data.reduce((sum, d) => sum + d.positive, 0),
    negativeCount: data.reduce((sum, d) => sum + d.negative, 0),
    neutralCount: data.reduce((sum, d) => sum + d.neutral, 0),
    avgDailyArticles: data.length > 0 ? filtered.length / data.length : 0,
  }

  logger.info('[sentimentTrendEngine] aggregateSentimentTrend completed', {
    pointCount: data.length,
    totalArticles: summary.totalArticles,
  })

  return {
    dimension: options.dimension,
    value: options.value ?? '',
    data,
    summary,
  }
}

/** 从资讯列表中提取所有可用的股票代码（去重、排序） */
export function extractStockOptions(articles: NewsArticle[]): string[] {
  const set = new Set<string>()
  for (const article of articles) {
    for (const symbol of article.relatedStocks) {
      set.add(symbol)
    }
  }
  return Array.from(set).sort()
}

/** 从资讯列表中提取所有可用的行业/分类（去重、排序） */
export function extractIndustryOptions(articles: NewsArticle[]): string[] {
  const set = new Set<string>()
  for (const article of articles) {
    if (article.category.length > 0) {
      set.add(article.category)
    }
  }
  return Array.from(set).sort()
}
