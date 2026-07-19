/**
 * @module multiSourceFetcher
 * @description 多源数据拉取器：维度 03-08 的真实数据获取入口。
 *
 * 当 westock-mcp 等 MCP 连接器可用时，优先使用 MCP 数据源；
 * 否则降级到公开行情 API（腾讯/新浪/网易代理端点）。
 * 若无任何可用数据源，返回 null（由调用方决定是否回退到 mock）。
 *
 * @convergence Phase C: 替代 collectionPipeline.ts 中的 generateMockDataForDimension
 *
 * 数据源优先级：
 * 1. MCP 连接器 (westock-mcp / westock-data) — 最丰富，建议优先
 * 2. 公开 API 代理 (/api/proxy/*) — 次优，延迟略高
 * 3. Mock 回退 — 仅开发/演示使用
 */

import { getLogger } from '@/lib/logger'
import { TENCENT_API_BASE, SINA_FINANCE_API_BASE, TENCENT_FINANCE_API_BASE } from '@/config/marketDataEndpoints'
import type { ChipData, NewsItem, CompetitorData, IndexCorrelation, ResearchReport } from './dimensionDataTypes'

export type { ChipData, NewsItem, CompetitorData, IndexCorrelation, ResearchReport } from './dimensionDataTypes'

import {
  tushareHolderNumber,
  tushareAnnouncements,
  tushareNews,
  tushareIndustry,
  tushareIndexDaily,
  tushareResearchReports,
} from './tushareProvider'
import {
  mapHolderNumberToChip,
  mapAnnouncementToNews,
  mapNewsToNewsItem,
  mapIndustryToCompetitor,
  mapReportToResearch,
} from './tushareAdapter'
import {
  fetchEastMoneyHolderNumber,
  fetchEastMoneyAnnouncements,
  fetchEastMoneyNews,
  fetchEastMoneyIndustry,
  fetchEastMoneyResearch,
} from './crawlerProvider'

const logger = getLogger()

/** Mock 服务基础 URL（开发环境） */
const MOCK_BASE = 'http://localhost:8000'

// ============================================================
// 维度 03-08 数据获取接口
// ============================================================

// 类型定义已迁移至 dimensionDataTypes.ts，本文件通过 re-export 保持兼容性。

// ============================================================
// 公开 API 代理辅助
// ============================================================

/** 安全 fetch，超时 5s */
async function safeFetch(url: string, timeoutMs = 5000): Promise<Response | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return resp.ok ? resp : null
  } catch (err) {
    logger.warn(`[multiSourceFetcher] safeFetch 网络失败: ${url}`, {
      error: err instanceof Error ? err.message : String(err),
      category: 'network',
    })
    return null
  }
}

/** 从本地 Mock 服务拉取维度数据（开发环境 fallback） */
async function fetchFromMockServer(symbol: string, dimensionCode: string): Promise<Record<string, unknown> | null> {
  const pathMap: Record<string, string> = {
    '03': '/collect/chip',
    '04': `/collect/news?category=announcement`,
    '05': `/collect/news?category=hot_news`,
    '06': '/collect/competitor',
    '07': '/collect/index',
    '08': '/collect/research',
  }
  const path = pathMap[dimensionCode]
  if (!path) return null
  const resp = await safeFetch(`${MOCK_BASE}${path}&symbol=${symbol}`.replace('&', '?'))
  if (!resp) return null
  try {
    const json = await resp.json()
    return json?.data || json
  } catch { return null }
}

/** 从腾讯行情 API 获取股票基础数据 */
async function fetchTencentQuote(symbol: string): Promise<Record<string, string> | null> {
  const url = `${TENCENT_API_BASE}?q=${symbol}`
  const resp = await safeFetch(url)
  if (!resp) return null
  const text = await resp.text()
  // Tencent returns: v_{code}="{fields}"
  const match = text.match(/v_[^=]+="([^"]+)"/)
  if (!match || !match[1]) return null
  const parts = match[1].split('~')
  return {
    name: parts[1] || '',
    code: parts[2] || symbol,
    price: parts[3] || '0',
    change: parts[4] || '0',
    changePercent: parts[5] || '0',
    volume: parts[6] || '0',
    turnover: parts[7] || '0',
    high: parts[33] || '0',
    low: parts[34] || '0',
  }
}

// ============================================================
// 维度拉取函数（逐个维度实现）
// ============================================================

/**
 * 获取筹码分析数据（03）
 *
 * 优先级：Tushare stk_holdernumber → 东财股东户数 → 新浪代理 → null
 */
export async function fetchChipData(symbol: string): Promise<ChipData | null> {
  // 1. Tushare
  try {
    const records = await tushareHolderNumber(symbol)
    if (records.length > 0) {
      // Tushare stk_holdernumber 返回记录为「最新在前」，取首条即最新一期股东户数
      const latest = records[0]
      if (latest) {
        const chip = mapHolderNumberToChip(latest)
        return { ...chip, _source: 'tushare' }
      }
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] Tushare 筹码失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. 东财爬虫补充
  try {
    const chip = await fetchEastMoneyHolderNumber(symbol)
    if (chip) return { ...chip, _source: 'crawler' }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] 东财筹码失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 3. 新浪代理（原有兜底）
  try {
    const url = `${SINA_FINANCE_API_BASE}corp/go.php/vCI_CorpHolder/stockid/${symbol.replace(/\.(SH|SZ)$/i, '')}.phtml`
    const resp = await safeFetch(url)
    if (resp) {
      const data = await resp.json()
      return {
        shareholderCount: data?.holderNum,
        concentration: data?.concentration,
        trend: data?.trend || 'stable',
        date: new Date().toISOString().slice(0, 10),
        _source: 'sina',
      } as unknown as ChipData
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] fetchChipData 失败: ${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
      category: 'chip',
    })
  }
  return null
}

/**
 * 获取新闻/重大事项（04/05）
 *
 * 优先级：Tushare → 东财爬虫 → 新浪代理 → []
 */
export async function fetchNews(symbol: string, category: 'announcement' | 'hot_news'): Promise<NewsItem[]> {
  // 1. Tushare
  try {
    const startDate = getRecentTradeDate(30)
    const records = category === 'announcement'
      ? await tushareAnnouncements(symbol, startDate)
      : await tushareNews(symbol, startDate)
    if (records.length > 0) {
      const mapper = category === 'announcement' ? mapAnnouncementToNews : mapNewsToNewsItem
      return records.slice(0, 10).map(mapper).map((item) => ({ ...item, _source: 'tushare' as const }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] Tushare 新闻失败: ${symbol} ${category}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. 东财爬虫补充
  try {
    const items = category === 'announcement'
      ? await fetchEastMoneyAnnouncements(symbol)
      : await fetchEastMoneyNews(symbol)
    if (items.length > 0) {
      return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' as const }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] 东财新闻失败: ${symbol} ${category}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 3. 新浪代理（原有兜底）
  const endpoint = category === 'announcement'
    ? `${SINA_FINANCE_API_BASE}corp/go.php/vCB_AllBulletin/stockid/${symbol}.phtml`
    : `${SINA_FINANCE_API_BASE}corp/go.php/vCB_News/stockid/${symbol}.phtml`
  const resp = await safeFetch(endpoint)
  if (!resp) return []
  try {
    const data = await resp.json()
    if (Array.isArray(data)) {
      return data.slice(0, 10).map((item: Record<string, unknown>) => ({
        id: typeof item.id === 'string' ? item.id : typeof item.code === 'string' ? item.code : String(Math.random()),
        title: typeof item.title === 'string' ? item.title : '',
        content: typeof item.content === 'string' ? item.content : typeof item.summary === 'string' ? item.summary : '',
        source: typeof item.source === 'string' ? item.source : '新浪财经',
        date: typeof item.date === 'string' ? item.date : typeof item.ctime === 'string' ? item.ctime : new Date().toISOString().slice(0, 10),
        category,
        url: typeof item.url === 'string' ? item.url : undefined,
        sentiment: (item.sentiment as NewsItem['sentiment']) || 'neutral',
      }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] fetchNews 解析失败: ${symbol} ${category}`, {
      error: err instanceof Error ? err.message : String(err),
      category: 'news',
    })
  }
  return []
}

/** 获取最近 N 个自然日前的交易日字符串（YYYYMMDD，简化版） */
function getRecentTradeDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * 获取行业竞品数据（06）
 *
 * 优先级：Tushare stock_basic → 东财行业 → 腾讯代理 → []
 */
export async function fetchCompetitorData(symbol: string): Promise<CompetitorData[]> {
  // 1. Tushare
  try {
    const records = await tushareIndustry(symbol)
    if (records.length > 0) {
      const first = records[0]
      if (first) return [mapIndustryToCompetitor(first)].map((item) => ({ ...item, _source: 'tushare' }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] Tushare 行业失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. 东财爬虫补充
  try {
    const items = await fetchEastMoneyIndustry(symbol)
    if (items.length > 0) {
      return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] 东财行业失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 3. 腾讯代理（原有兜底）
  const url = `${TENCENT_FINANCE_API_BASE}ifzq/appstock/app/industry/industry?code=${symbol}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = await resp.json()
    if (Array.isArray(data)) {
      return data.slice(0, 10).map((item: Record<string, unknown>) => ({
        symbol: typeof item.code === 'string' ? item.code : '',
        name: typeof item.name === 'string' ? item.name : '',
        pe: item.pe != null ? Number(item.pe) : undefined,
        pb: item.pb != null ? Number(item.pb) : undefined,
        revenueGrowth: item.revenueGrowth != null ? Number(item.revenueGrowth) : undefined,
        profitGrowth: item.profitGrowth != null ? Number(item.profitGrowth) : undefined,
        rank: item.rank != null ? Number(item.rank) : undefined,
        _source: 'tencent',
      }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] fetchCompetitorData 解析失败: ${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
      category: 'competitor',
    })
  }
  return []
}

/**
 * 获取关联指数分析（07）
 *
 * 优先级：Tushare 指数日线 + 标的 K线 计算 Pearson → 原有兜底
 */
export async function fetchIndexCorrelation(symbol: string): Promise<IndexCorrelation[]> {
  const indices = [
    { code: '000300.SH', name: '沪深300' },
    { code: '000905.SH', name: '中证500' },
    { code: '399006.SZ', name: '创业板指' },
  ]

  // 1. 尝试用 Tushare 计算真实相关性
  try {
    const { tushareDaily } = await import('./tushareProvider')
    const stockRecords = await tushareDaily(symbol, getRecentTradeDate(90), getRecentTradeDate(0))
    const stockMap = new Map<string, number>()
    stockRecords.forEach((r) => {
      const date = String(r.trade_date)
      const close = Number(r.close)
      if (date && Number.isFinite(close)) stockMap.set(date, close)
    })

    if (stockMap.size > 10) {
      const results = await Promise.all(
        indices.map(async (idx) => {
          const indexRecords = await tushareIndexDaily(idx.code, getRecentTradeDate(90), getRecentTradeDate(0))
          const pairs: Array<[number, number]> = []
          indexRecords.forEach((r) => {
            const date = String(r.trade_date)
            const close = Number(r.close)
            if (stockMap.has(date)) pairs.push([stockMap.get(date)!, close])
          })
          const correlation = pairs.length > 5 ? calculatePearson(pairs) : 0
          return {
            indexCode: idx.code,
            indexName: idx.name,
            correlation: Number(correlation.toFixed(4)),
            beta: pairs.length > 5 ? calculateBeta(pairs) : undefined,
            _source: 'tushare',
          }
        }),
      )
      if (results.some((r) => r.correlation !== 0)) return results
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] Tushare 指数相关失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. 原有兜底
  const results: IndexCorrelation[] = []
  for (const idx of indices) {
    const quote = await fetchTencentQuote(idx.code)
    if (quote) {
      results.push({
        indexCode: idx.code,
        indexName: idx.name,
        correlation: 0,
        beta: undefined,
        contribution: undefined,
      })
    }
  }
  return results.length > 0 ? results : indices.map((idx) => ({
    indexCode: idx.code,
    indexName: idx.name,
    correlation: 0,
  }))
}

/** 计算 Pearson 相关系数 */
function calculatePearson(pairs: Array<[number, number]>): number {
  const n = pairs.length
  if (n < 2) return 0
  const sumX = pairs.reduce((s, [x]) => s + x, 0)
  const sumY = pairs.reduce((s, [, y]) => s + y, 0)
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0)
  const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0)
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0)
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denominator === 0) return 0
  return (n * sumXY - sumX * sumY) / denominator
}

/** 计算 Beta（标的收益相对指数收益的回归系数） */
function calculateBeta(pairs: Array<[number, number]>): number {
  const returns: Array<[number, number]> = []
  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]
    const curr = pairs[i]
    if (!prev || !curr) continue
    const [prevX, prevY] = prev
    const [x, y] = curr
    if (prevX !== 0 && prevY !== 0) {
      returns.push([(x - prevX) / prevX, (y - prevY) / prevY])
    }
  }
  if (returns.length < 2) return 0
  const sumX = returns.reduce((s, [x]) => s + x, 0)
  const sumY = returns.reduce((s, [, y]) => s + y, 0)
  const sumXY = returns.reduce((s, [x, y]) => s + x * y, 0)
  const sumX2 = returns.reduce((s, [x]) => s + x * x, 0)
  const denominator = sumX2 - (sumX * sumX) / returns.length
  if (denominator === 0) return 0
  return (sumXY - (sumX * sumY) / returns.length) / denominator
}

/**
 * 获取研报数据（08）
 *
 * 优先级：Tushare report_rc → 东财研报 → 网易（已下线）→ []
 */
export async function fetchResearchReports(symbol: string): Promise<ResearchReport[]> {
  // 1. Tushare
  try {
    const records = await tushareResearchReports(symbol)
    if (records.length > 0) {
      return records.slice(0, 10).map(mapReportToResearch).map((item) => ({ ...item, _source: 'tushare' }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] Tushare 研报失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 2. 东财爬虫补充
  try {
    const items = await fetchEastMoneyResearch(symbol)
    if (items.length > 0) {
      return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] 东财研报失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
  }

  // 3. 网易端点已不可用（DNS 不可达），直接返回空 → 触发 Mock 回退
  logger.warn(`[multiSourceFetcher] fetchResearchReports: 网易端点已下线，暂无可用研报数据源: ${symbol}`)
  return []
}

/**
 * 统一拉取入口：按维度码获取真实数据。
 * 若所有数据源不可用，返回 null（由调用方决定 mock 回退）。
 */
export async function fetchDimensionData(
  symbol: string,
  dimensionCode: string,
): Promise<Record<string, unknown> | null> {
  // 1. 依次尝试: 真实 API → Mock 服务 → null(由调用方回退到内联 mock)
  switch (dimensionCode) {
    case '03': {
      const chip = await fetchChipData(symbol)
      if (chip) return chip as unknown as Record<string, unknown>
      return fetchFromMockServer(symbol, '03')
    }
    case '04': {
      const news = await fetchNews(symbol, 'announcement')
      if (news.length > 0) return { items: news, symbol, count: news.length, date: new Date().toISOString() }
      const mock = await fetchFromMockServer(symbol, '04')
      if (mock) return mock
      return null
    }
    case '05': {
      const news = await fetchNews(symbol, 'hot_news')
      if (news.length !== 0) return { items: news, symbol, count: news.length, date: new Date().toISOString() }
      const mock = await fetchFromMockServer(symbol, '05')
      if (mock) return mock
      return null
    }
    case '06': {
      const competitors = await fetchCompetitorData(symbol)
      if (competitors.length > 0) return { items: competitors, symbol, count: competitors.length, date: new Date().toISOString() }
      const mock = await fetchFromMockServer(symbol, '06')
      if (mock) return mock
      return null
    }
    case '07': {
      const indices = await fetchIndexCorrelation(symbol)
      if (indices.length > 0) return { items: indices, symbol, count: indices.length, date: new Date().toISOString() }
      const mock = await fetchFromMockServer(symbol, '07')
      if (mock) return mock
      return null
    }
    case '08': {
      const reports = await fetchResearchReports(symbol)
      if (reports.length > 0) return { items: reports, symbol, count: reports.length, date: new Date().toISOString() }
      const mock = await fetchFromMockServer(symbol, '08')
      if (mock) return mock
      return null
    }
    default:
      return null
  }
}
