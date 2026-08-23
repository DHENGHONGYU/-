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
  * @doc [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { getLogger } from '@/lib/logger'
// 配置源分工说明（TD-015 已治理）：
//   TENCENT_API_BASE 等（/api/proxy/*）→ 浏览器走 Vite 代理
//   AKSHARE_LOCAL_BASE_URL（http://localhost:8000）→ 运行时直连本地 Python 采集服务
//   本模块在浏览器环境运行，AKSHARE_LOCAL_BASE_URL 用于直连本地服务（非展示常量）。
import { TENCENT_API_BASE, SINA_FINANCE_API_BASE, TENCENT_FINANCE_API_BASE } from '@/config/marketDataEndpoints'
import { AKSHARE_LOCAL_BASE_URL } from '@/config/dataSourceUrls'
import { DEFAULT_REQUEST_TIMEOUT_MS } from '@/config/timeouts'
import { safeFetch as _safeFetch } from '@/services/shared/safeFetch'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import type { ChipData, NewsItem, CompetitorData, IndexCorrelation, ResearchReport, DividendShareSummary, ConsensusAndRating, ConsensusEstimate, RatingSummary } from './dimensionDataTypes'
import { fetchNewsViaWestock, fetchResearchReportsViaWestock } from './westockMcpSource'
import { fetchNewsViaTencentNews } from './tencentNewsMcpSource'

export type { ChipData, NewsItem, CompetitorData, IndexCorrelation, ResearchReport, DividendShareSummary, ConsensusAndRating } from './dimensionDataTypes'

import {
  tushareHolderNumber,
  tushareAnnouncements,
  tushareNews,
  tushareIndustry,
  tushareIndexDaily,
  tushareResearchReports,
  tushareDividend,
  tushareShareFloat,
  tushareFinaIndicator,
} from './tushareProvider'
import {
  mapHolderNumberToChip,
  mapAnnouncementToNews,
  mapNewsToNewsItem,
  mapIndustryToCompetitor,
  mapReportToResearch,
  mapToDividendShareSummary,
} from './tushareAdapter'
import {
  fetchEastMoneyHolderNumber,
  fetchEastMoneyAnnouncements,
  fetchEastMoneyNews,
  fetchEastMoneyIndustry,
  fetchEastMoneyResearch,
  fetchEastMoneyDividend,
  fetchShareStructureFromTencent,
  fetchEastMoneyConsensusEstimate,
  fetchEastMoneyRatingSummary,
  fetchIfindTargetPrice,
  checkDividendKeywords as _checkDividendKeywords,
  fetchFinancialSnapshot as _fetchFinancialSnapshot,
} from './crawlerProvider'

const logger = getLogger()

// ============================================================
// 维度 03-08 数据获取接口
// ============================================================

// 类型定义已迁移至 dimensionDataTypes.ts，本文件通过 re-export 保持兼容性。

// ============================================================
// 公开 API 代理辅助
// ============================================================

/** 安全 fetch — 委托至共享实现，超时取自 config，requireOk */
async function safeFetch(url: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response | null> {
  return _safeFetch(url, { timeoutMs, requireOk: true }, '[multiSourceFetcher]')
}

/** 从本地 Mock 服务拉取维度数据（开发环境 fallback）
 * @deprecated AKSHARE_LOCAL_BASE_URL 本地 Python 服务已不常用，此分支仅保留为开发环境兆底。
 * 生产环境应依赖 Tushare / 东财爬虫 / MCP 源。后续可考虑移除。 */
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
  if ((path ?? '') === '') return null
  const resp = await safeFetch(`${AKSHARE_LOCAL_BASE_URL}${path}&symbol=${symbol}`.replace('&', '?'))
  if (!resp) return null
  try {
    const json: unknown = await resp.json()
    if (json === null || json === undefined) return null
    if (typeof json !== 'object') return null
    const obj = json as Record<string, unknown>
    const data = obj.data
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : obj
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
  if (!match?.[1]) return null
  const parts = match[1].split('~')
  return {
    name: parts[1] ?? '',
    code: parts[2] ?? symbol,
    price: parts[3] ?? '0',
    change: parts[4] ?? '0',
    changePercent: parts[5] ?? '0',
    volume: parts[6] ?? '0',
    turnover: parts[7] ?? '0',
    high: parts[33] ?? '0',
    low: parts[34] ?? '0',
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
/** 从 Tushare 拉取筹码数据；无有效记录时记录失败并返回 null（守卫式） */
async function fetchChipFromTushare(symbol: string): Promise<ChipData | null> {
  const tushareStart = Date.now()
  const records = await tushareHolderNumber(symbol)
  if (records.length === 0) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    return null
  }
  const latest = records[0]
  if (!latest) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    return null
  }
  const chip = mapHolderNumberToChip(latest)
  recordSourceResult('tushare', { success: true, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 1 })
  return { ...chip, _source: 'tushare' }
}

export async function fetchChipData(symbol: string): Promise<ChipData | null> {
  // 1. Tushare（熔断器检查：circuit-open 时跳过）
  if (canExecute('tushare')) {
    try {
      const chip = await fetchChipFromTushare(symbol)
      if (chip) return chip
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 筹码失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 2. 东财爬虫补充（熔断器检查）
  if (canExecute('crawler')) {
    try {
      const chip = await fetchEastMoneyHolderNumber(symbol)
      if (chip) {
        recordSourceResult('crawler', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
        return { ...chip, _source: 'crawler' }
      }
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 东财筹码失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 3. 新浪代理（原有兜底）
  try {
    const url = `${SINA_FINANCE_API_BASE}corp/go.php/vCI_CorpHolder/stockid/${symbol.replace(/\.(SH|SZ)$/i, '')}.phtml`
    const resp = await safeFetch(url)
    if (resp) {
      const data = (await resp.json()) as Record<string, unknown> | null
      if (data) {
        const rawTrend = data['trend']
        const validTrends = ['increasing', 'decreasing', 'stable'] as const
        const trend =
          typeof rawTrend === 'string' && (validTrends as readonly string[]).includes(rawTrend)
            ? (rawTrend as (typeof validTrends)[number])
            : 'stable'
        return {
          shareholderCount: typeof data['holderNum'] === 'number' ? data['holderNum'] : undefined,
          concentration: typeof data['concentration'] === 'number' ? data['concentration'] : undefined,
          trend,
          date: new Date().toISOString().slice(0, 10),
          _source: 'sina',
        }
      }
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
 * 优先级：Tushare → 东财爬虫 → LLM 联网搜索 → 新浪代理 → []
 */
/**
 * 新闻去重：优先按标题归一化键（避免 westock 与腾讯新闻重复报道同一事件被算两条），
 * 标题缺失时退化为 url/id；保留首次出现（westock 先 push，天然优先）。
 */
function dedupeNewsItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    const titleKey = (it.title || '').replace(/\s+/g, '').toLowerCase()
    const fallbackKey = (it.url && it.url.length > 0 ? it.url : '') || (it.id ?? '')
    const key = (titleKey || fallbackKey || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

export async function fetchNews(
  symbol: string,
  category: 'announcement' | 'hot_news',
  _stockName?: string,
): Promise<NewsItem[]> {
  // 维度 04(announcement)/05(hot_news) 取数。
  // 质量策略（2026-08-16 修复）：hot_news 维度 westock(个股公告/新闻) 与
  //   腾讯新闻(泛资讯/行业舆情) 互补——**并行取数后合并去重取前 10**，
  //   既保留 westock 个股维度优先级（先 push，去重后靠前），又让新接入的腾讯新闻
  //   richer 泛资讯真正进入维度 05（避免被 westock 早返回阴影遮蔽）。
  //   腾讯新闻带 TTL 缓存(60s)，并行取数对采集效率几乎零额外成本；
  //   announcement 维度腾讯新闻无对应能力（适配层返回 null），仅 westock 贡献，语义不变。
  const collected: NewsItem[] = []

  // 0. westock（并行，维度 04/05 既有优先级 1 个股源）
  const westockTask = (async () => {
    try {
      const westockItems = await fetchNewsViaWestock(symbol, category)
      if (westockItems && westockItems.length > 0) {
        collected.push(...westockItems.map((item) => ({ ...item, _source: 'westock' as const })))
      }
    } catch (err) {
      logger.warn(`[multiSourceFetcher] westock 新闻失败: ${symbol} ${category}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()

  // 0.5 腾讯新闻（仅 hot_news 维度有意义；announcement 由适配层直接返回 null）
  const tencentTask = category === 'hot_news'
    ? (async () => {
        try {
          const tnItems = await fetchNewsViaTencentNews(symbol, category)
          if (tnItems && tnItems.length > 0) {
            collected.push(...tnItems.map((item) => ({ ...item, _source: 'tencentnews' as const })))
          }
        } catch (err) {
          logger.warn(`[multiSourceFetcher] 腾讯新闻失败: ${symbol} ${category}`, {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })()
    : Promise.resolve()

  await Promise.all([westockTask, tencentTask])

  if (collected.length > 0) {
    return dedupeNewsItems(collected).slice(0, 10)
  }

  // 1. Tushare（熔断器检查：circuit-open 时跳过）
  if (canExecute('tushare')) {
    try {
      const tushareStart = Date.now()
      const startDate = getRecentTradeDate(30)
      const records = category === 'announcement'
        ? await tushareAnnouncements(symbol, startDate)
        : await tushareNews(symbol, startDate)
      if (records.length > 0) {
        const mapper = category === 'announcement' ? mapAnnouncementToNews : mapNewsToNewsItem
        recordSourceResult('tushare', { success: true, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 1 })
        return records.slice(0, 10).map(mapper).map((item) => ({ ...item, _source: 'tushare' as const }))
      }
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 新闻失败: ${symbol} ${category}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 2. 东财爬虫补充（熔断器检查）
  if (canExecute('crawler')) {
    try {
      const items = category === 'announcement'
        ? await fetchEastMoneyAnnouncements(symbol)
        : await fetchEastMoneyNews(symbol)
      if (items.length > 0) {
        recordSourceResult('crawler', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
        return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' as const }))
      }
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 东财新闻失败: ${symbol} ${category}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // LLM 同步分支已移除（P1 优化 2026-08-09）
  // 原因：LLM 调用 2-5s 同步阻塞采集主链，违反"采集环节不依赖 LLM"原则。
  // 研报/公告摘要改为夜间异步批处理，详见 llmBatchProcessor.ts。
  // stockName 参数保留以维持接口兼容，后续可由 llmBatchProcessor 消费。

  // 3. 新浪代理（原有兜底）
  const endpoint = category === 'announcement'
    ? `${SINA_FINANCE_API_BASE}corp/go.php/vCB_AllBulletin/stockid/${symbol}.phtml`
    : `${SINA_FINANCE_API_BASE}corp/go.php/vCB_News/stockid/${symbol}.phtml`
  const resp = await safeFetch(endpoint)
  if (!resp) return []
  try {
    const data: unknown = await resp.json()
    if (Array.isArray(data)) {
      return data.slice(0, 10).map((item: Record<string, unknown>) => ({
        id: typeof item.id === 'string' ? item.id : typeof item.code === 'string' ? item.code : String(Math.random()),
        title: typeof item.title === 'string' ? item.title : '',
        content: typeof item.content === 'string' ? item.content : typeof item.summary === 'string' ? item.summary : '',
        source: typeof item.source === 'string' ? item.source : '新浪财经',
        date: typeof item.date === 'string' ? item.date : typeof item.ctime === 'string' ? item.ctime : new Date().toISOString().slice(0, 10),
        category,
        url: typeof item.url === 'string' ? item.url : undefined,
        sentiment: (item.sentiment as NewsItem['sentiment']) ?? 'neutral',
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
/** 从 Tushare 拉取行业竞品数据；无有效记录时记录失败并返回 null（守卫式） */
async function fetchCompetitorFromTushare(symbol: string): Promise<CompetitorData[] | null> {
  const tushareStart = Date.now()
  const records = await tushareIndustry(symbol)
  if (records.length === 0) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    return null
  }
  const first = records[0]
  if (!first) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    return null
  }
  recordSourceResult('tushare', { success: true, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 1 })
  return [mapIndustryToCompetitor(first)].map((item) => ({ ...item, _source: 'tushare' }))
}

export async function fetchCompetitorData(symbol: string): Promise<CompetitorData[]> {
  // 1. Tushare（熔断器检查）
  if (canExecute('tushare')) {
    try {
      const records = await fetchCompetitorFromTushare(symbol)
      if (records) return records
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 行业失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 2. 东财爬虫补充（熔断器检查）
  if (canExecute('crawler')) {
    try {
      const items = await fetchEastMoneyIndustry(symbol)
      if (items.length > 0) {
        recordSourceResult('crawler', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
        return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' }))
      }
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 东财行业失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 3. 腾讯代理（原有兜底）
  const url = `${TENCENT_FINANCE_API_BASE}ifzq/appstock/app/industry/industry?code=${symbol}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data: unknown = await resp.json()
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
/** 基于个股收盘 Map 计算单个指数与个股的相关性/Beta（守卫式） */
async function computeSingleIndexCorrelation(
  idx: { code: string; name: string },
  stockMap: Map<string, number>,
): Promise<IndexCorrelation> {
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
}

/** 尝试用 Tushare 计算真实相关性（守卫式）；样本不足或无相关时记录失败并返回 null */
async function computeTushareIndexCorrelation(
  indices: Array<{ code: string; name: string }>,
  symbol: string,
): Promise<IndexCorrelation[] | null> {
  const { tushareDaily } = await import('./tushareProvider')
  const stockRecords = await tushareDaily(symbol, getRecentTradeDate(90), getRecentTradeDate(0))
  const stockMap = new Map<string, number>()
  stockRecords.forEach((r) => {
    const date = String(r.trade_date)
    const close = Number(r.close)
    if (date && Number.isFinite(close)) stockMap.set(date, close)
  })
  if (stockMap.size <= 10) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
    return null
  }
  const results = await Promise.all(indices.map((idx) => computeSingleIndexCorrelation(idx, stockMap)))
  if (!results.some((r) => r.correlation !== 0)) {
    recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
    return null
  }
  recordSourceResult('tushare', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
  return results
}

export async function fetchIndexCorrelation(symbol: string): Promise<IndexCorrelation[]> {
  const indices = [
    { code: '000300.SH', name: '沪深300' },
    { code: '000905.SH', name: '中证500' },
    { code: '399006.SZ', name: '创业板指' },
  ]

  // 1. 尝试用 Tushare 计算真实相关性（熔断器检查）
  if (canExecute('tushare')) {
    try {
      const results = await computeTushareIndexCorrelation(indices, symbol)
      if (results) return results
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 指数相关失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
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

/** 计算 Pearson 相关系数。
 *
 * NaN 防护：如果 pairs 中包含 NaN/undefined（来自异常的 API 响应），
 * 计算结果会是 NaN 而非 0，会污染后续评分。因此过滤无效对并检查结果。
 */
export function calculatePearson(pairs: Array<[number, number]>): number {
  // 过滤掉含 NaN/undefined 的无效数据对
  const valid = pairs.filter(
    ([x, y]) => typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y),
  )
  const n = valid.length
  if (n < 2) return 0
  const sumX = valid.reduce((s, [x]) => s + x, 0)
  const sumY = valid.reduce((s, [, y]) => s + y, 0)
  const sumX2 = valid.reduce((s, [x]) => s + x * x, 0)
  const sumY2 = valid.reduce((s, [, y]) => s + y * y, 0)
  const sumXY = valid.reduce((s, [x, y]) => s + x * y, 0)
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denominator === 0 || Number.isNaN(denominator)) return 0
  const result = (n * sumXY - sumX * sumY) / denominator
  return Number.isNaN(result) ? 0 : result
}

/** 计算 Beta（标的收益相对指数收益的回归系数）。
 *
 * NaN 防护：同 calculatePearson，过滤无效数据对。
 */
export function calculateBeta(pairs: Array<[number, number]>): number {
  const returns: Array<[number, number]> = []
  for (let i = 1; i < pairs.length; i++) {
    const prev = pairs[i - 1]
    const curr = pairs[i]
    if (!prev || !curr) continue
    const [prevX, prevY] = prev
    const [x, y] = curr
    // 跳过 NaN/undefined 值
    if (
      typeof prevX !== 'number' || typeof prevY !== 'number' ||
      typeof x !== 'number' || typeof y !== 'number' ||
      Number.isNaN(prevX) || Number.isNaN(prevY) || Number.isNaN(x) || Number.isNaN(y)
    ) continue
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
  if (denominator === 0 || Number.isNaN(denominator)) return 0
  const result = (sumXY - (sumX * sumY) / returns.length) / denominator
  return Number.isNaN(result) ? 0 : result
}

/**
 * 获取研报数据（08）
 *
 * 优先级：Tushare report_rc → 东财研报 → LLM 联网搜索 → 网易（已下线）→ []
 */
export async function fetchResearchReports(symbol: string, _stockName?: string): Promise<ResearchReport[]> {
  // 0. 腾讯自选股 MCP 源（优先级 1，技术方案 §5.4）—— 直接覆盖维度 08 研报
  try {
    const westockReports = await fetchResearchReportsViaWestock(symbol)
    if (westockReports && westockReports.length > 0) {
      return westockReports.slice(0, 10).map((item) => ({ ...item, _source: 'westock' as const }))
    }
  } catch (err) {
    logger.warn(`[multiSourceFetcher] westock 研报失败，降级到既有源: ${symbol}`, {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // 1. Tushare（熔断器检查）
  if (canExecute('tushare')) {
    try {
      const tushareStart = Date.now()
      const records = await tushareResearchReports(symbol)
      if (records.length > 0) {
        recordSourceResult('tushare', { success: true, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 1 })
        return records.slice(0, 10).map(mapReportToResearch).map((item) => ({ ...item, _source: 'tushare' }))
      }
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 研报失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 2. 东财爬虫补充（熔断器检查）
  if (canExecute('crawler')) {
    try {
      const items = await fetchEastMoneyResearch(symbol)
      if (items.length > 0) {
        recordSourceResult('crawler', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
        return items.slice(0, 10).map((item) => ({ ...item, _source: 'crawler' }))
      }
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 东财研报失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // LLM 同步分支已移除（P1 优化 2026-08-09）
  // 原因：LLM 调用 2-5s 同步阻塞采集主链，违反"采集环节不依赖 LLM"原则。
  // 研报摘要改为夜间异步批处理，详见 llmBatchProcessor.ts。
  // stockName 参数保留以维持接口兼容，后续可由 llmBatchProcessor 消费。

  // 3. 网易端点已不可用（DNS 不可达），直接返回空 → 触发 Mock 回退
  logger.warn(`[multiSourceFetcher] fetchResearchReports: 网易端点已下线，暂无可用研报数据源: ${symbol}`)
  return []
}

/**
 * 统一拉取入口：按维度码获取真实数据。
 * 若所有数据源不可用，返回 null（由调用方决定 mock 回退）。
 */

/** 非新闻维度（03/06/07/10-14）MCP 采集（守卫式）；失败静默降级返回 null */
async function collectNonNewsDimensionViaMcp(
  symbol: string,
  dimensionCode: string,
): Promise<Record<string, unknown> | null> {
  if (!canExecute('ifind_mcp') && !canExecute('tencent_mcp')) return null
  try {
    const { collectDimensionViaMcp } = await import('./ifindMcpCollector')
    const mcpResult = await collectDimensionViaMcp(symbol, dimensionCode)
    if (mcpResult && mcpResult.success) {
      return {
        ...mcpResult.data,
        _source: 'ifind_mcp',
        _dimensionName: mcpResult.dimensionName,
        _successCount: mcpResult.successCount,
        _queryCount: mcpResult.queryCount,
      }
    }
  } catch {
    // MCP 失败静默降级到既有链路
  }
  return null
}

/** 新闻维度（04/05/08）iFinD MCP 补充（守卫式）；腾讯 MCP 失败后降级尝试 */
async function collectSupplementaryMcp(
  symbol: string,
  dimensionCode: string,
): Promise<Record<string, unknown> | null> {
  if (!canExecute('ifind_mcp')) return null
  try {
    const { collectDimensionViaMcp } = await import('./ifindMcpCollector')
    const mcpResult = await collectDimensionViaMcp(symbol, dimensionCode)
    if (mcpResult && mcpResult.success) {
      return { ...mcpResult.data, _source: 'ifind_mcp', _dimensionName: mcpResult.dimensionName }
    }
  } catch {
    /* 降级 */
  }
  return null
}

export async function fetchDimensionData(
  symbol: string,
  dimensionCode: string,
  stockName?: string,
): Promise<Record<string, unknown> | null> {
  // 维度策略：
  //   04/05/08 (公告/新闻/研报): 腾讯 MCP 优先 → iFinD MCP 补充 → 爬虫兜底
  //   其他维度 (03/06/07/10-14): iFinD MCP 优先 → 腾讯 MCP 补充 → 爬虫兜底
  const NEWS_DIMENSIONS = new Set(['04', '05', '08'])
  const isNewsDimension = NEWS_DIMENSIONS.has(dimensionCode)

  if (!isNewsDimension) {
    // 优先级 0: iFinD MCP 采集（覆盖维度 03/06/07/10-14 的专业金融数据）
    const mcpResult = await collectNonNewsDimensionViaMcp(symbol, dimensionCode)
    if (mcpResult) return mcpResult
  }

  // 1. 依次尝试: 腾讯 MCP（新闻维度 04/05/08 已在 fetchNews/fetchResearchReports 内优先）
  //    → 真实 API → Mock 服务 → null(由调用方回退到内联 mock)
  switch (dimensionCode) {
    case '03': {
      const chip = await fetchChipData(symbol)
      if (chip) return chip as unknown as Record<string, unknown>
      return fetchFromMockServer(symbol, '03')
    }
    case '04': {
      // 优先级 1: 腾讯 MCP（westock 公告）已内置于 fetchNews
      const news = await fetchNews(symbol, 'announcement', stockName)
      if (news.length > 0) return { items: news, symbol, count: news.length, date: new Date().toISOString(), _source: (news[0]?._source) ?? 'unknown' }
      // 优先级 2: iFinD MCP 补充（腾讯 MCP 失败后降级）
      const mcpResult = await collectSupplementaryMcp(symbol, '04')
      if (mcpResult) return mcpResult
      const mock = await fetchFromMockServer(symbol, '04')
      if (mock) return mock
      return null
    }
    case '05': {
      // 优先级 1: 腾讯 MCP（westock + tencentnews 并行）已内置于 fetchNews
      const news = await fetchNews(symbol, 'hot_news', stockName)
      if (news.length !== 0) return { items: news, symbol, count: news.length, date: new Date().toISOString(), _source: (news[0]?._source) ?? 'unknown' }
      // 优先级 2: iFinD MCP 补充
      const mcpResult = await collectSupplementaryMcp(symbol, '05')
      if (mcpResult) return mcpResult
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
      // 优先级 1: 腾讯 MCP（westock 研报）已内置于 fetchResearchReports
      const reports = await fetchResearchReports(symbol, stockName)
      if (reports.length > 0) return { items: reports, symbol, count: reports.length, date: new Date().toISOString(), _source: (reports[0]?._source) ?? 'unknown' }
      // 优先级 2: iFinD MCP 补充
      const mcpResult = await collectSupplementaryMcp(symbol, '08')
      if (mcpResult) return mcpResult
      const mock = await fetchFromMockServer(symbol, '08')
      if (mock) return mock
      return null
    }
    // 维度 10-14: 热门板块/技术指标/资金流向/机构持仓/估值分析
    // 统一走 MCP 采集（已在函数入口 collectNonNewsDimensionViaMcp 处理）。
    // 设计决策（P2-2 评估，2026-08-23）：这些维度依赖 MCP 专业金融数据源，
    // 无公开 API 替代，MCP 失败时由 collectionPipeline.generateDataForDimension
    // 记录失败 + 不生成 mock，符合「真实源失败不写假数据」原则。
    // 后续若接入新源（如 Tushare 资金流向 API），可在此处添加降级分支。
    case '10':
    case '11':
    case '12':
    case '13':
    case '14': {
      // MCP 已在入口尝试，此处兜底返回 null
      // （如果 MCP 失败，说明该维度暂无可用数据源）
      return null
    }
    case '15': {
      const data = await fetchDividendShareData(symbol)
      if (data) return data as unknown as Record<string, unknown>
      return null
    }
    case '16': {
      const data = await fetchConsensusAndRating(symbol, stockName)
      if (data) return data as unknown as Record<string, unknown>
      return null
    }
    default:
      return null
  }
}

// ============================================================
// 维度 15 分红股本
// ============================================================

/**
 * 获取分红股本数据（15）
 *
 * 优先级：Tushare（三 API 并行：dividend + fina_indicator + share_float）
 *       → 东财爬虫（并行：分红配股 + 股本结构）
 *       → null（调用方决定是否 mock）
 */

/** 从东财爬虫构造分红股本摘要；无任意续数据时返回 null（守卫式） */
async function fetchDividendFromCrawler(symbol: string): Promise<DividendShareSummary | null> {
  const [dividendRecords, shareStruct, financialSnapshots] = await Promise.all([
    fetchEastMoneyDividend(symbol),
    fetchShareStructureFromTencent(symbol),
    _fetchFinancialSnapshot(symbol),
  ])
  if (dividendRecords.length === 0) return null

  const totalShares = shareStruct?.totalShares ?? 0
  const price = shareStruct?.price ?? 0
  const totalDiv3Y = dividendRecords
    .slice(0, 3)
    .reduce((sum, d) => sum + d.cashDividendPerShare * totalShares, 0)

  // 股息率：最新有效分红 / 当前股价
  let dividendYield = 0
  const latestValid = price > 0 ? dividendRecords.find((d) => d.cashDividendPerShare > 0) : undefined
  if (latestValid) {
    dividendYield = Number(((latestValid.cashDividendPerShare / price) * 100).toFixed(2))
  }

  // 分红率：近 3 年分红总额 / 近 3 年归母净利润
  let payoutRatio3Y = 0
  const totalNP3Y = totalDiv3Y > 0
    ? financialSnapshots.slice(0, 3).reduce((sum, fs) => sum + fs.netProfit, 0)
    : 0
  if (totalNP3Y > 0) {
    payoutRatio3Y = Number(((totalDiv3Y / totalNP3Y) * 100).toFixed(2))
  }

  // 回购/配股检测
  const keywords = _checkDividendKeywords(dividendRecords)

  return {
    symbol,
    dividendYield,
    totalDividend3Y: Number(totalDiv3Y.toFixed(2)),
    payoutRatio3Y,
    history: dividendRecords,
    totalShares: shareStruct?.totalShares ?? 0,
    floatShares: shareStruct?.floatShares ?? 0,
    hasBuybackPlan: keywords.hasBuybackPlan,
    hasRightsIssue: keywords.hasRightsIssue,
    _source: 'crawler',
  }
}

export async function fetchDividendShareData(symbol: string): Promise<DividendShareSummary | null> {
  // 链 1: Tushare（三 API 并行）
  if (canExecute('tushare')) {
    try {
      const tushareStart = Date.now()
      const [dividendData, finaData, shareFloatData] = await Promise.all([
        tushareDividend(symbol),
        tushareFinaIndicator(symbol),
        tushareShareFloat(symbol),
      ])
      if (finaData.length > 0 || dividendData.length > 0) {
        const summary = mapToDividendShareSummary(symbol, finaData, dividendData, shareFloatData)
        recordSourceResult('tushare', { success: true, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 1 })
        return summary
      }
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: Date.now() - tushareStart, completeness: 0 })
    } catch (err) {
      recordSourceResult('tushare', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] Tushare 分红股本失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  // 链 2: 东财爬虫（并行：分红配股 + 股本结构 + 财务快照）
  if (canExecute('crawler')) {
    try {
      const summary = await fetchDividendFromCrawler(symbol)
      if (summary) {
        recordSourceResult('crawler', { success: true, isMock: false, latencyMs: 0, completeness: 1 })
        return summary
      }
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 东财分红股本失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return null
}

// ============================================================
// 维度 16 一致预期与评级
// ============================================================

/**
 * 获取一致预期与评级数据（16）
 *
 * 优先级：iFinD MCP（目标价）+ 东财爬虫（一致预期 EPS/营收/净利）并行
 *       → 东财爬虫（iFinD 不可用时完整降级）
 *       → null（调用方决定是否 mock）
 */
export async function fetchConsensusAndRating(symbol: string, stockName?: string): Promise<ConsensusAndRating | null> {
  // 链 0: iFinD MCP（目标价）+ 东财爬虫（一致预期）并行
  if (canExecute('ifind_mcp') || canExecute('crawler')) {
    try {
      const ifindTask = canExecute('ifind_mcp')
        ? fetchIfindTargetPrice(symbol, stockName ?? symbol)
        : Promise.resolve(null)

      const crawlerEstimatesTask = canExecute('crawler')
        ? fetchEastMoneyConsensusEstimate(symbol)
        : Promise.resolve([] as ConsensusEstimate[])

      const crawlerRatingTask = canExecute('crawler')
        ? fetchEastMoneyRatingSummary(symbol)
        : Promise.resolve(null)

      const [ifindTarget, estimates, crawlerRating] = await Promise.all([
        ifindTask,
        crawlerEstimatesTask,
        crawlerRatingTask,
      ])

      if (estimates.length > 0 || crawlerRating || ifindTarget) {
        // 构建评级：iFinD 目标价优先，东财评级补充
        const rating: RatingSummary = {
          buyCount: ifindTarget?.buyCount ?? crawlerRating?.buyCount ?? 0,
          overweightCount: ifindTarget?.overweightCount ?? crawlerRating?.overweightCount ?? 0,
          holdCount: crawlerRating?.holdCount ?? 0,
          underweightCount: crawlerRating?.underweightCount ?? 0,
          sellCount: ifindTarget?.sellCount ?? crawlerRating?.sellCount ?? 0,
          consensusRating: crawlerRating?.consensusRating ?? 0,
          consensusTargetPrice: ifindTarget?.targetPrice ?? crawlerRating?.consensusTargetPrice ?? 0,
          targetPriceHigh: ifindTarget?.targetPrice ?? 0, // iFinD 仅返回综合值，最高/最低暂不可用
          targetPriceLow: ifindTarget?.targetPrice ?? 0,
          recentTrend: crawlerRating?.recentTrend ?? 'stable',
          _source: ifindTarget ? 'ifind_mcp' : 'crawler',
        }

        const source = ifindTarget ? 'ifind_mcp+crawler' : 'crawler'
        recordSourceResult(source, { success: true, isMock: false, latencyMs: 0, completeness: ifindTarget ? 1 : 0.8 })

        return {
          symbol,
          estimates,
          rating,
          dataDate: new Date().toISOString().split('T')[0] ?? '',
          _source: source,
        }
      }
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
    } catch (err) {
      recordSourceResult('crawler', { success: false, isMock: false, latencyMs: 0, completeness: 0 })
      logger.warn(`[multiSourceFetcher] 一致预期失败: ${symbol}`, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  return null
}
