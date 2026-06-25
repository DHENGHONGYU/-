/**
 * V6 → V9 NewsPage 迁移适配类型
 * 处理 sentiment 字段从 number 到 string enum 的转换
 */

import type { NewsArticle as V9NewsArticle } from '@/data/types'

/** V6 风格的情感值（-1 ~ 1） */
export type V6Sentiment = number

/** V6 风格的新闻文章（兼容 V6 UI 组件） */
export interface V6NewsArticle {
  id: string
  title: string
  content: string
  url: string
  source: string
  category: string
  publishTime: string
  fetchTime: string
  sentiment: V6Sentiment
  sentimentConfidence: number
  relatedStocks: string[]
  keywords: string[]
  hash: string
}

/** 将 V9 NewsArticle 转换为 V6 风格（sentiment: string → number） */
export function adaptV9ToV6(article: V9NewsArticle): V6NewsArticle {
  return {
    ...article,
    sentiment: sentimentV9ToV6(article.sentiment, article.sentimentConfidence),
  }
}

/** 将 V6 风格转换为 V9 NewsArticle（sentiment: number → string） */
export function adaptV6ToV9(article: V6NewsArticle): Omit<V9NewsArticle, 'sentiment'> & { sentiment: V9NewsArticle['sentiment'] } {
  return {
    ...article,
    sentiment: sentimentV6ToV9(article.sentiment),
  }
}

/** V9 sentiment string → V6 sentiment number */
export function sentimentV9ToV6(
  sentiment: V9NewsArticle['sentiment'],
  confidence: number,
): V6Sentiment {
  const base = sentiment === 'positive' ? 0.6 : sentiment === 'negative' ? -0.6 : 0
  // 根据置信度微调，保持在 (-1, 1) 范围内
  const variance = (confidence - 0.5) * 0.4
  return sentiment === 'positive'
    ? Math.min(0.99, base + variance)
    : sentiment === 'negative'
      ? Math.max(-0.99, base - variance)
      : 0
}

/** V6 sentiment number → V9 sentiment string */
export function sentimentV6ToV9(sentiment: V6Sentiment): V9NewsArticle['sentiment'] {
  if (sentiment > 0.3) return 'positive'
  if (sentiment < -0.3) return 'negative'
  return 'neutral'
}

/** 批量转换 */
export function adaptV9ListToV6(articles: V9NewsArticle[]): V6NewsArticle[] {
  return articles.map(adaptV9ToV6)
}
