/**
 * @doc [V9-DOC-FRONT-046]
 */
import type { V6ExportShape, V9ImportShape } from '@/services/system/v6MigrationService'

export interface PreviewItem {
  key: string
  label: string
  count: number
}

/**
 * buildV6Overview
 * @param v6Export
 * @returns PreviewItem[]
 */
export function buildV6Overview(v6Export: V6ExportShape): PreviewItem[] {
  return [
    { key: 'stocks', label: '股票', count: v6Export.stocks?.length ?? 0 },
    { key: 'daily_quotes', label: '行情', count: v6Export.daily_quotes?.length ?? 0 },
    { key: 'v6_scores', label: 'V6评分', count: v6Export.v6_scores?.length ?? 0 },
    { key: 'orders', label: '订单', count: v6Export.orders?.length ?? 0 },
    { key: 'sector_scores', label: '板块评分', count: v6Export.sector_scores?.length ?? 0 },
    { key: 'rotation_scores', label: '轮动评分', count: v6Export.rotation_scores?.length ?? 0 },
    { key: 'score_docs', label: '评分文档', count: v6Export.score_docs?.length ?? 0 },
    { key: 'strategy_snapshots', label: '策略快照', count: v6Export.strategy_snapshots?.length ?? 0 },
    { key: 'local_docs', label: '本地文档', count: v6Export.local_docs?.length ?? 0 },
    { key: 'news', label: '资讯', count: v6Export.news?.length ?? 0 },
    { key: 'news_stock_map', label: '资讯关联', count: v6Export.news_stock_map?.length ?? 0 },
    { key: 'sentiment_cache', label: '情感缓存', count: v6Export.sentiment_cache?.length ?? 0 },
  ]
}

/**
 * buildV9Overview
 * @param transformed
 * @returns PreviewItem[]
 */
export function buildV9Overview(transformed: V9ImportShape): PreviewItem[] {
  return [
    { key: 'stocks', label: '股票', count: transformed.stocks.length },
    { key: 'daily_quotes', label: '聚合行情', count: transformed.dailyQuotes.length },
    { key: 'v6_scores', label: 'V6评分', count: transformed.v6Scores.length },
    { key: 'score_docs', label: '评分文档', count: transformed.scoreDocs.length + transformed.scoreDocsFromScores.length },
    { key: 'orders', label: '订单', count: transformed.orders.length },
    { key: 'sector_scores', label: '板块评分', count: transformed.sectorScores.length },
    { key: 'rotation_scores', label: '轮动评分', count: transformed.rotationScores.length },
    { key: 'strategy_snapshots', label: '策略快照', count: transformed.strategySnapshots.length },
    { key: 'local_docs', label: '本地文档', count: transformed.localDocs.length },
    { key: 'news', label: '资讯', count: transformed.news.length },
    { key: 'news_stock_map', label: '资讯关联', count: transformed.newsStockMaps.length },
    { key: 'sentiment_cache', label: '情感缓存', count: transformed.sentimentCache.length },
  ]
}