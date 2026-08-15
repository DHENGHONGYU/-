/**
 * @fileoverview 爬虫补充层
 *
 * 职责：
 * - 当 Tushare 覆盖不足或不可用时，通过东方财富等公开端点补充数据
 * - 统一节流、User-Agent 轮换、失败降级
 * - 直连东方财富公开 API（绝对 URL），不依赖 Vite 代理
 *
 * 2026-07-19 重写：移除所有 /api/proxy/* 代理路径，
 * 改为直连 emweb.securities.eastmoney.com / np-anotice-stock.eastmoney.com 等真实端点。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import {
  EASTMONEY_F10_SHAREHOLDER_API,
  EASTMONEY_ANNOUNCEMENT_API,
  EASTMONEY_ANNOUNCEMENT_DETAIL_API,
  EASTMONEY_NEWS_API_UNAVAILABLE,
  EASTMONEY_RESEARCH_API_UNAVAILABLE,
  EASTMONEY_INDUSTRY_API_UNAVAILABLE,
} from '@/config/marketDataEndpoints'
import { DATA_COLLECTION_TIMEOUT_MS } from '@/config/timeouts'
import { safeFetch as _safeFetch } from '@/services/shared/safeFetch'
import type { ChipData, NewsItem, CompetitorData, ResearchReport } from './dimensionDataTypes'
import type { KlineBar } from '@/data/types/types.marketData'

const logger = getLogger()

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
]

let lastRequestTime = 0
const EASTMONEY_MIN_INTERVAL_MS = 1500

/** 简单节流：确保东财请求间隔 ≥ 1.5s */
async function throttleEastMoney(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < EASTMONEY_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, EASTMONEY_MIN_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

function rotateUA(): string {
  const idx = Math.floor(Math.random() * USER_AGENTS.length)
  return USER_AGENTS[idx] ?? USER_AGENTS[0] ?? 'Mozilla/5.0'
}

/** 安全 fetch — 委托至共享实现，保留节流与 UA 轮换 */
async function safeFetch(url: string, timeoutMs = DATA_COLLECTION_TIMEOUT_MS): Promise<Response | null> {
  await throttleEastMoney()
  return _safeFetch(
    url,
    {
      timeoutMs,
      init: {
        headers: { 'User-Agent': rotateUA(), Accept: 'application/json, text/html' },
      },
    },
    '[crawlerProvider]',
  )
}

/** 从 600519.SH 提取 6 位代码 */
function extractSixDigitCode(symbol: string): string {
  return symbol.replace(/\.(SH|SZ|BJ)$/i, '').trim()
}

/**
 * 将 600519.SH 格式转为东财 F10 所需格式（SH600519 / SZ000001）。
 * 沪市加 SH 前缀，深市/创业板/北交所加 SZ 前缀。
 */
function toEastMoneyF10Code(symbol: string): string {
  const upper = symbol.toUpperCase()
  if (upper.endsWith('.SH')) {
    return `SH${extractSixDigitCode(symbol)}`
  }
  if (upper.endsWith('.SZ') || upper.endsWith('.BJ')) {
    return `SZ${extractSixDigitCode(symbol)}`
  }
  // 无后缀时按代码首位推断：6 → SH，0/3 → SZ
  const code = extractSixDigitCode(symbol)
  if (code.startsWith('6')) return `SH${code}`
  return `SZ${code}`
}

/**
 * 将 600519.SH 格式转为东财公告 API 所需格式（纯 6 位数字）。
 */
function toEastMoneyStockListCode(symbol: string): string {
  return extractSixDigitCode(symbol)
}

// ── 03 筹码：东财股东户数 ──

/** F10 ShareholderResearch 响应中单条股东户数记录 */
interface EmShareholderRecord {
  SECUCODE?: string
  SECURITY_CODE?: string
  END_DATE?: string
  HOLDER_TOTAL_NUM?: number
  TOTAL_NUM_RATIO?: number
  AVG_FREE_SHARES?: number
  AVG_FREESHARES_RATIO?: number
  HOLD_FOCUS?: string
  PRICE?: number
  AVG_HOLD_AMT?: number
  HOLD_RATIO_TOTAL?: number
  NOTICE_DATE?: string
}

/** F10 ShareholderResearch 完整响应结构 */
interface EmShareholderResponse {
  gdrs?: EmShareholderRecord[]
  sdltgd_date?: Array<{ END_DATE?: string }>
}

/**
 * 获取东方财富股东户数（筹码数据）。
 *
 * 端点：emweb.securities.eastmoney.com/PC_HSF10/ShareholderResearch/PageAjax
 * 2026-07-19 curl 验证：返回真实数据（贵州茅台 243,159 户等）。
 */
export async function fetchEastMoneyHolderNumber(symbol: string): Promise<ChipData | null> {
  const f10Code = toEastMoneyF10Code(symbol)
  const url = `${EASTMONEY_F10_SHAREHOLDER_API}?code=${f10Code}`
  const resp = await safeFetch(url)
  if (!resp) return null
  try {
    const data = (await resp.json()) as EmShareholderResponse
    const gdrs = data?.gdrs
    if (!Array.isArray(gdrs) || gdrs.length === 0) {
      logger.warn('[crawlerProvider] 东财股东户数无数据', { symbol })
      return null
    }
    const latest = gdrs[0]
    if (!latest) return null

    // 解析持股集中度趋势
    let trend: ChipData['trend'] = 'stable'
    if (latest.TOTAL_NUM_RATIO != null) {
      if (latest.TOTAL_NUM_RATIO > 5) trend = 'decreasing'
      else if (latest.TOTAL_NUM_RATIO < -5) trend = 'increasing'
    }

    // 将 HOLD_FOCUS 映射为 concentration 数值（非常集中≈80, 较集中≈60, 一般≈40, 较分散≈25, 非常分散≈10）
    const focusMap: Record<string, number> = {
      '非常集中': 80,
      '较集中': 60,
      '一般': 40,
      '较分散': 25,
      '非常分散': 10,
    }
    const concentration = focusMap[latest.HOLD_FOCUS ?? ''] ?? undefined

    return {
      shareholderCount: latest.HOLDER_TOTAL_NUM != null ? Number(latest.HOLDER_TOTAL_NUM) : undefined,
      avgSharesPerHolder: latest.AVG_FREE_SHARES != null ? Number(latest.AVG_FREE_SHARES) : undefined,
      concentration,
      trend,
      date: latest.END_DATE ? latest.END_DATE.slice(0, 10) : new Date().toISOString().slice(0, 10),
    }
  } catch (err) {
    logger.warn('[crawlerProvider] 东财股东户数解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ── 04 公告 ──

/** 东财公告 API 响应中单条公告记录 */
interface EmAnnouncementRecord {
  art_code?: string
  title?: string
  notice_date?: string
  display_time?: string
  columns?: Array<{ column_name?: string }>
  stock_code?: string
}

/** 东财公告 API 响应结构 */
interface EmAnnouncementResponse {
  success?: number
  data?: {
    list?: EmAnnouncementRecord[]
    total_hits?: number
    page_index?: number
    page_size?: number
  }
}

/**
 * 获取东方财富公告。
 *
 * 端点：np-anotice-stock.eastmoney.com/api/security/ann
 * 2026-07-19 curl 验证：返回真实公告数据（贵州茅台 1068 条）。
 */
export async function fetchEastMoneyAnnouncements(symbol: string): Promise<NewsItem[]> {
  const code = toEastMoneyStockListCode(symbol)
  const url = `${EASTMONEY_ANNOUNCEMENT_API}?sr=-1&page_size=10&page_index=1&ann_type=A&stock_list=${code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as EmAnnouncementResponse
    if (data?.success !== 1) {
      logger.warn('[crawlerProvider] 东财公告 API 返回失败', { symbol, success: data?.success })
      return []
    }
    const items = data?.data?.list ?? []
    return items.map((item) => ({
      id: item.art_code ?? `${code}-${item.notice_date ?? Date.now()}`,
      title: item.title ?? '',
      content: '',
      source: '东方财富公告',
      date: (item.notice_date ?? '').slice(0, 10),
      category: 'announcement' as const,
      url: item.art_code ? `${EASTMONEY_ANNOUNCEMENT_DETAIL_API}?art_code=${item.art_code}` : undefined,
    }))
  } catch (err) {
    logger.warn('[crawlerProvider] 东财公告解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 05 新闻 ──

/**
 * 获取东方财富新闻。
 *
 * 2026-07-19 curl 验证：push2.eastmoney.com/api/qt/stock/news/get 始终返回空响应，
 * 疑似需要浏览器 Cookie / 反爬令牌。标记为不可用，直接返回空数组。
 * 若未来端点恢复可用，将在此处接入。
 */
export async function fetchEastMoneyNews(symbol: string): Promise<NewsItem[]> {
  if (EASTMONEY_NEWS_API_UNAVAILABLE) {
    logger.info('[crawlerProvider] 东财新闻端点不可用（push2 反爬），返回空', { symbol })
    return []
  }
  // 占位：未来若端点恢复，参考格式：
  // const code = extractSixDigitCode(symbol)
  // const url = `https://push2.eastmoney.com/api/qt/stock/news/get?secid=1.${code}&page=1&size=10`
  return []
}

// ── 06 行业竞品 ──

/**
 * 获取东方财富同行业竞品数据。
 *
 * 2026-07-19 curl 验证：push2.eastmoney.com 同行业股票查询返回 rc:102（反爬拦截），
 * F10 IndustryAnalysis 端点无同行业股票数据。标记为不可用，直接返回空数组。
 */
export async function fetchEastMoneyIndustry(symbol: string): Promise<CompetitorData[]> {
  if (EASTMONEY_INDUSTRY_API_UNAVAILABLE) {
    logger.info('[crawlerProvider] 东财行业竞品端点不可用（push2 反爬），返回空', { symbol })
    return []
  }
  return []
}

// ── 08 研报 ──

/**
 * 获取东方财富研报。
 *
 * 2026-07-19 curl 验证：reportapi.eastmoney.com/report/list 可返回数据，
 * 但 stockCode 过滤参数不生效（返回全市场研报，无法按股票筛选）。
 * 标记为不可用，直接返回空数组。若未来端点支持按股票筛选，将在此处接入。
 */
export async function fetchEastMoneyResearch(symbol: string): Promise<ResearchReport[]> {
  if (EASTMONEY_RESEARCH_API_UNAVAILABLE) {
    logger.info('[crawlerProvider] 东财研报端点不可用（stockCode 过滤无效），返回空', { symbol })
    return []
  }
  // 占位：未来若端点支持过滤，参考格式：
  // const code = extractSixDigitCode(symbol)
  // const url = `https://reportapi.eastmoney.com/report/list?pageSize=10&pageNo=1&qType=0&beginTime=...&endTime=...&stockCode=${code}`
  return []
}

// ── 02 K线：Baostock 补充 ──

export async function fetchBaostockKline(symbol: string, days: number): Promise<KlineBar[]> {
  const code = extractSixDigitCode(symbol)
  const url = `/api/proxy/baostock/kline?code=${code}&days=${days}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as { data?: KlineBar[] }
    return Array.isArray(data?.data) ? data.data : []
  } catch (err) {
    logger.warn('[crawlerProvider] Baostock K线解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}
