/**
 * @fileoverview Tushare 响应 → 业务类型适配器
 *
 * 职责：
 * - 将 Tushare 返回的 snake_case 原始记录转换为项目业务类型
 * - 字段命名统一转换为 camelCase
 * - 缺失字段填充安全默认值
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import type { RealtimeQuote } from './directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'
import type { ChipData, NewsItem, CompetitorData, IndexCorrelation, ResearchReport } from './dimensionDataTypes'
import { fromTushareCode } from './tushareProvider'

/** 将 20250401 格式转换为 2025-04-01 */
function formatTradeDate(date: unknown): string {
  if (typeof date !== 'string') return ''
  if (date.length === 8) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  }
  return date
}

/** 安全取数字 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** 安全取字符串 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

// ── 01 基本信息 ──

/**
 * 将 Tushare stock_basic 记录转换为 RealtimeQuote（基本信息）。
 * 价格字段使用 0 占位，实际价格应由 daily 接口补充。
 */
export function mapStockBasicToQuote(record: Record<string, unknown>): RealtimeQuote {
  const tsCode = toString(record.ts_code)
  return {
    symbol: fromTushareCode(tsCode),
    name: toString(record.name),
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: 0,
    amount: 0,
    timestamp: Date.now(),
  }
}

/**
 * 用 Tushare daily 最新一条记录补充 RealtimeQuote 价格字段。
 */
export function mapDailyToQuote(record: Record<string, unknown>): RealtimeQuote {
  const tsCode = toString(record.ts_code)
  const close = toNumber(record.close) ?? 0
  const preClose = toNumber(record.pre_close) ?? close
  const change = toNumber(record.change) ?? (close - preClose)
  const pctChange = toNumber(record.pct_change) ?? (preClose ? (change / preClose) * 100 : 0)

  return {
    symbol: fromTushareCode(tsCode),
    name: '',
    price: close,
    change: Number(change.toFixed(2)),
    changePercent: Number(pctChange.toFixed(2)),
    open: toNumber(record.open) ?? 0,
    high: toNumber(record.high) ?? 0,
    low: toNumber(record.low) ?? 0,
    volume: toNumber(record.vol) ?? 0,
    amount: toNumber(record.amount) ?? 0,
    timestamp: Date.now(),
  }
}

// ── 02 K 线 ──

/** 将 Tushare daily 记录数组转换为 KlineBar[] */
export function mapDailyToKlines(records: Record<string, unknown>[]): KlineBar[] {
  return records
    .map((record) => {
      const date = formatTradeDate(record.trade_date)
      if (!date) return null
      return {
        date,
        open: toNumber(record.open) ?? 0,
        high: toNumber(record.high) ?? 0,
        low: toNumber(record.low) ?? 0,
        close: toNumber(record.close) ?? 0,
        volume: toNumber(record.vol) ?? 0,
        amount: toNumber(record.amount) ?? 0,
      } as KlineBar
    })
    .filter((b): b is KlineBar => b !== null)
}

// ── 03 筹码 ──

/** 将 Tushare stk_holdernumber 最新记录转换为 ChipData */
export function mapHolderNumberToChip(record: Record<string, unknown>): ChipData {
  const holderNum = toNumber(record.holder_num)
  const avgShares = holderNum ? toNumber(record.avg_share) ?? undefined : undefined

  return {
    shareholderCount: holderNum,
    avgSharesPerHolder: avgShares,
    date: formatTradeDate(record.end_date) || formatTradeDate(record.ann_date) || new Date().toISOString().slice(0, 10),
  }
}

// ── 04/05 新闻/公告 ──

/** 将 Tushare 公告/新闻记录转换为 NewsItem（兼容 anns 与 news 接口字段） */
export function mapAnnouncementToNews(record: Record<string, unknown>): NewsItem {
  const dateTime = toString(record.date_time)
  const date = dateTime.length >= 8 ? dateTime.slice(0, 10) : formatTradeDate(record.ann_date)
  return {
    id: `${toString(record.ts_code)}-${date}-${toString(record.title).slice(0, 16)}`,
    title: toString(record.title),
    content: toString(record.content),
    source: 'Tushare公告',
    date,
    category: 'announcement',
    url: toString(record.url) || '',
  }
}

/** 将 Tushare major_news 记录转换为 NewsItem */
export function mapNewsToNewsItem(record: Record<string, unknown>): NewsItem {
  const dateTime = toString(record.date_time)
  const date = dateTime.length >= 8 ? dateTime.slice(0, 10) : formatTradeDate(record.date)
  return {
    id: `${toString(record.ts_code)}-${dateTime || Date.now()}-${toString(record.title).slice(0, 16)}`,
    title: toString(record.title),
    content: toString(record.content),
    source: toString(record.src) || 'Tushare新闻',
    date,
    category: 'hot_news',
  }
}

// ── 06 行业竞品 ──

/** 将 Tushare stock_basic 行业记录转换为 CompetitorData */
export function mapIndustryToCompetitor(record: Record<string, unknown>): CompetitorData {
  return {
    symbol: fromTushareCode(toString(record.ts_code)),
    name: toString(record.name),
  }
}

// ── 07 关联指数 ──

/** 将原始指数日线记录转换为 IndexCorrelation 计算输入（correlation 需后续计算） */
export function mapIndexDailyToCorrelation(
  indexCode: string,
  indexName: string,
  _records: Record<string, unknown>[],
): IndexCorrelation {
  return {
    indexCode,
    indexName,
    correlation: 0,
  }
}

// ── 08 研报 ──

/** 将 Tushare report_rc 记录转换为 ResearchReport */
export function mapReportToResearch(record: Record<string, unknown>): ResearchReport {
  return {
    id: `${toString(record.ts_code)}-${toString(record.pub_date)}-${toString(record.title).slice(0, 16)}`,
    title: toString(record.title),
    author: toString(record.author),
    institution: toString(record.org_name),
    rating: toString(record.rating_name) || '中性',
    date: formatTradeDate(record.pub_date) || formatTradeDate(record.report_date) || new Date().toISOString().slice(0, 10),
    summary: '',
  }
}
