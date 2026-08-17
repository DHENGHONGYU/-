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
  TENCENT_API_BASE,
} from '@/config/marketDataEndpoints'
import { DATA_COLLECTION_TIMEOUT_MS } from '@/config/timeouts'
import { EASTMONEY_F10_BONUS_API, EASTMONEY_F10_PROFIT_API } from '@/config/fetcherConfig'
import { safeFetch as _safeFetch } from '@/services/shared/safeFetch'
import type { ChipData, NewsItem, CompetitorData, ResearchReport, DividendRecord, ConsensusEstimate, RatingSummary } from './dimensionDataTypes'
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

// ── 15 分红股本：东财 F10 分红配股 ──

/** 东财分红配股响应中单条记录（实际 API 使用 fhyx 数组） */
interface EmBonusRecord {
  SECUCODE?: string
  SECURITY_CODE?: string
  SECURITY_NAME_ABBR?: string
  /** 公告日期 */
  NOTICE_DATE?: string
  /** 分红方案说明（如 "10派280.2423元"、"不分配不转增"） */
  IMPL_PLAN_PROFILE?: string
  /** 分配进度 */
  ASSIGN_PROGRESS?: string
  /** 股权登记日 */
  EQUITY_RECORD_DATE?: string | null
  /** 除权除息日 */
  EX_DIVIDEND_DATE?: string | null
  /** 派息日 */
  PAY_CASH_DATE?: string | null
}

/** 东财分红配股响应结构（实际 API 使用 fhyx 键名） */
interface EmBonusResponse {
  fhyx?: EmBonusRecord[]
}

/**
 * 解析东财 IMPL_PLAN_PROFILE 字段，提取每股分红/送股/转增。
 *
 * 格式示例：
 *   "10派280.2423元"        → cashDividendPerShare = 28.02423
 *   "10送3股"               → bonusShareRatio = 0.3
 *   "10转增4股"             → transferShareRatio = 0.4
 *   "10派1.5元送2股转增3股" → 混合方案
 *   "不分配不转增"          → 全部为 0
 */
function parsePlanProfile(plan: string): {
  cashDividendPerShare: number
  bonusShareRatio: number
  transferShareRatio: number
} {
  const result = { cashDividendPerShare: 0, bonusShareRatio: 0, transferShareRatio: 0 }
  if (!plan || plan.includes('不分配')) return result

  // 派息：10派X元 → 每股派X/10元
  const cashMatch = plan.match(/10派([\d.]+)元/)
  if (cashMatch) {
    result.cashDividendPerShare = Number((Number(cashMatch[1]!) / 10).toFixed(6))
  }
  // 送股：10送X股 → 每股送X/10股
  const bonusMatch = plan.match(/10送([\d.]+)股/)
  if (bonusMatch) {
    result.bonusShareRatio = Number((Number(bonusMatch[1]!) / 10).toFixed(6))
  }
  // 转增：10转增X股 → 每股转增X/10股
  const transferMatch = plan.match(/10转增?([\d.]+)股/)
  if (transferMatch) {
    result.transferShareRatio = Number((Number(transferMatch[1]!) / 10).toFixed(6))
  }

  return result
}

/**
 * 获取东财分红配股记录。
 *
 * 端点：emweb.securities.eastmoney.com/PC_HSF10/BonusFinancing/PageAjax
 */
export async function fetchEastMoneyDividend(symbol: string): Promise<DividendRecord[]> {
  const f10Code = toEastMoneyF10Code(symbol)
  const url = `${EASTMONEY_F10_BONUS_API}?code=${f10Code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as EmBonusResponse
    const records = data?.fhyx ?? []
    return records.map((r) => {
      const parsed = parsePlanProfile(r.IMPL_PLAN_PROFILE ?? '')
      return {
        exDividendDate: (r.EX_DIVIDEND_DATE ?? '').slice(0, 10),
        cashDividendPerShare: parsed.cashDividendPerShare,
        bonusShareRatio: parsed.bonusShareRatio,
        transferShareRatio: parsed.transferShareRatio,
        recordDate: (r.EQUITY_RECORD_DATE ?? '').slice(0, 10),
        announceDate: (r.NOTICE_DATE ?? '').slice(0, 10),
        planExplanation: r.IMPL_PLAN_PROFILE ?? '',
        _source: 'crawler' as const,
      }
    })
  } catch (err) {
    logger.warn('[crawlerProvider] 东财分红配股解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

// ── 15 分红股本：腾讯行情推算股本结构 ──

/**
 * 通过腾讯实时行情 API 推算总股本和流通股本。
 *
 * 腾讯行情返回总市值和流通市值，配合当前价可推算股本。
 * 端点：qt.gtimg.cn/q=sh600519
 * 字段：part[3]=当前价, part[44]=总市值(亿元), part[45]=流通市值(亿元)
 */
/** 腾讯行情股本推算结果 */
export interface TencentShareStruct {
  totalShares: number
  floatShares: number
  /** 当前股价（元），用于股息率计算 */
  price: number
}

export async function fetchShareStructureFromTencent(symbol: string): Promise<TencentShareStruct | null> {
  const upper = symbol.toUpperCase()
  // 腾讯行情格式：sh600519 / sz000001
  const prefix = upper.endsWith('.SH') ? 'sh' : 'sz'
  const code = extractSixDigitCode(symbol)
  const q = `${prefix}${code}`
  const url = `${TENCENT_API_BASE}?q=${q}`
  const resp = await safeFetch(url)
  if (!resp) return null
  try {
    const text = await resp.text()
    // 腾讯行情返回格式：v_sh600519="1~贵州茅台~600519~price~..."
    const match = text.match(/v_[^=]+="([^"]+)"/)
    if (!match?.[1]) return null
    const parts = match[1].split('~')
    const price = parseFloat(parts[3] ?? '0')
    const totalMcap = parseFloat(parts[44] ?? '0') // 总市值（亿元）
    const floatMcap = parseFloat(parts[45] ?? '0') // 流通市值（亿元）
    if (price <= 0) return null
    return {
      totalShares: Number((totalMcap / price).toFixed(2)),
      floatShares: Number((floatMcap / price).toFixed(2)),
      price: Number(price.toFixed(2)),
    }
  } catch (err) {
    logger.warn('[crawlerProvider] 腾讯行情股本推算失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ── 16 一致预期与评级：东财 F10 盈利预测 ──

/** 东财盈利预测-机构预测记录 */
interface EmProfitForecastRecord {
  SECUCODE?: string
  SECURITY_CODE?: string
  SECURITY_NAME_ABBR?: string
  PUBLISH_DATE?: string
  ORG_CODE?: string
  ORG_NAME_ABBR?: string
  YEAR1?: number
  YEAR_MARK1?: string
  EPS1?: number
  PE1?: number
  YEAR2?: number
  YEAR_MARK2?: string
  EPS2?: number
  PE2?: number
  YEAR3?: number
  YEAR_MARK3?: string
  EPS3?: number
  PE3?: number
  YEAR4?: number
  YEAR_MARK4?: string
  EPS4?: number
  PE4?: number
}

/** 东财盈利预测-评级统计记录 */
interface EmRatingStatRecord {
  SECUCODE?: string
  SECURITY_NAME_ABBR?: string
  DATE_TYPE?: string
  COMPRE_RATING_NUM?: number
  COMPRE_RATING?: string
  /** 评级机构数（注意：字段名是 RATING_ORG_NUM，非 RATING_ORGANIZATION_NUM） */
  RATING_ORG_NUM?: number
  RATING_BUY_NUM?: number
  RATING_ADD_NUM?: number
  RATING_NEUTRAL_NUM?: number
  RATING_REDUCE_NUM?: number
  RATING_SALE_NUM?: number
}

/** 东财盈利预测-预测统计图表记录（含营收/净利） */
interface EmYctjChartRecord {
  YEAR?: number
  YEAR_MARK?: string
  EPS?: number
  ROE?: number
  PARENT_NETPROFIT?: number
  TOTAL_OPERATE_INCOME?: number
}

/** 东财盈利预测响应结构 */
interface EmProfitForecastResponse {
  jgyc?: EmProfitForecastRecord[]
  pjtj?: EmRatingStatRecord[]
  yctj_chart?: EmYctjChartRecord[]
}

/**
 * 获取东财分析师一致预期数据（通过 F10 盈利预测 API）。
 *
 * 端点：emweb.securities.eastmoney.com/PC_HSF10/ProfitForecast/PageAjax
 * 使用 jgyc 中 ORG_NAME_ABBR="近六月平均" 的共识数据。
 */
export async function fetchEastMoneyConsensusEstimate(symbol: string): Promise<ConsensusEstimate[]> {
  const f10Code = toEastMoneyF10Code(symbol)
  const url = `${EASTMONEY_F10_PROFIT_API}?code=${f10Code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as EmProfitForecastResponse
    const jgyc = data?.jgyc ?? []
    const yctjChart = data?.yctj_chart ?? []
    // 取"近六月平均"作为一致预期 EPS/PE
    const consensus = jgyc.find((r) => r.ORG_NAME_ABBR === '近六月平均')
    if (!consensus) return []
    // 构建 yctj_chart 年份→营收/净利 映射
    const chartMap = new Map<number, EmYctjChartRecord>()
    for (const c of yctjChart) {
      if (c.YEAR != null) chartMap.set(c.YEAR, c)
    }

    // 从 jgyc 中提取各财年的独立分析师预测（排除"近六月平均"），计算 epsHigh/epsLow 和 analystCount
    const individualRecords = jgyc.filter((r) => r.ORG_NAME_ABBR !== '近六月平均')
    const epsRangeMap = new Map<number, { high: number; low: number; orgCodes: Set<string> }>()
    for (const rec of individualRecords) {
      const years = [
        { y: rec.YEAR1, eps: rec.EPS1 },
        { y: rec.YEAR2, eps: rec.EPS2 },
        { y: rec.YEAR3, eps: rec.EPS3 },
        { y: rec.YEAR4, eps: rec.EPS4 },
      ]
      for (const yr of years) {
        if (yr.y == null || yr.eps == null) continue
        const existing = epsRangeMap.get(yr.y)
        if (existing) {
          existing.high = Math.max(existing.high, yr.eps)
          existing.low = Math.min(existing.low, yr.eps)
          if (rec.ORG_CODE) existing.orgCodes.add(rec.ORG_CODE)
        } else {
          epsRangeMap.set(yr.y, {
            high: yr.eps,
            low: yr.eps,
            orgCodes: new Set(rec.ORG_CODE ? [rec.ORG_CODE] : []),
          })
        }
      }
    }

    const estimates: ConsensusEstimate[] = []
    const years = [
      { y: consensus.YEAR1, m: consensus.YEAR_MARK1, eps: consensus.EPS1, pe: consensus.PE1 },
      { y: consensus.YEAR2, m: consensus.YEAR_MARK2, eps: consensus.EPS2, pe: consensus.PE2 },
      { y: consensus.YEAR3, m: consensus.YEAR_MARK3, eps: consensus.EPS3, pe: consensus.PE3 },
      { y: consensus.YEAR4, m: consensus.YEAR_MARK4, eps: consensus.EPS4, pe: consensus.PE4 },
    ]
    for (const yr of years) {
      if (yr.y == null) continue
      const chart = chartMap.get(yr.y)
      const epsRange = epsRangeMap.get(yr.y)
      estimates.push({
        fiscalYear: Number(yr.y),
        revenueEstimate: Number(((chart?.TOTAL_OPERATE_INCOME ?? 0) / 1e8).toFixed(2)),
        netProfitEstimate: Number(((chart?.PARENT_NETPROFIT ?? 0) / 1e8).toFixed(2)),
        epsEstimate: Number((yr.eps ?? 0).toFixed(4)),
        analystCount: epsRange?.orgCodes.size ?? 0,
        epsHigh: Number((epsRange?.high ?? 0).toFixed(4)),
        epsLow: Number((epsRange?.low ?? 0).toFixed(4)),
        _source: 'crawler' as const,
      })
    }
    return estimates
  } catch (err) {
    logger.warn('[crawlerProvider] 东财一致预期解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

/**
 * 获取东财个股评级汇总（通过 F10 盈利预测 API）。
 *
 * 端点：emweb.securities.eastmoney.com/PC_HSF10/ProfitForecast/PageAjax
 * 使用 pjtj 中 DATE_TYPE="6月内" 的评级统计。
 */
export async function fetchEastMoneyRatingSummary(symbol: string): Promise<RatingSummary | null> {
  const f10Code = toEastMoneyF10Code(symbol)
  const url = `${EASTMONEY_F10_PROFIT_API}?code=${f10Code}`
  const resp = await safeFetch(url)
  if (!resp) return null
  try {
    const data = (await resp.json()) as EmProfitForecastResponse
    const pjtj = data?.pjtj ?? []
    // 取"6月内"作为最全面的评级统计
    const rating = pjtj.find((r) => r.DATE_TYPE === '6月内') ?? pjtj[0]
    if (!rating) return null

    // 评级趋势：比较不同 DATE_TYPE 的 COMPRE_RATING_NUM
    let recentTrend: 'upgrade' | 'downgrade' | 'stable' = 'stable'
    const rating3m = pjtj.find((r) => r.DATE_TYPE === '3月内')
    const rating1m = pjtj.find((r) => r.DATE_TYPE === '1月内')
    if (rating1m && rating3m) {
      const diff1m3m = (rating1m.COMPRE_RATING_NUM ?? 0) - (rating3m.COMPRE_RATING_NUM ?? 0)
      if (diff1m3m > 0.05) recentTrend = 'upgrade'
      else if (diff1m3m < -0.05) recentTrend = 'downgrade'
    } else if (rating3m) {
      const diff3m6m = (rating3m.COMPRE_RATING_NUM ?? 0) - (rating.COMPRE_RATING_NUM ?? 0)
      if (diff3m6m > 0.05) recentTrend = 'upgrade'
      else if (diff3m6m < -0.05) recentTrend = 'downgrade'
    }

    return {
      buyCount: Number(rating.RATING_BUY_NUM ?? 0),
      overweightCount: Number(rating.RATING_ADD_NUM ?? 0),
      holdCount: Number(rating.RATING_NEUTRAL_NUM ?? 0),
      underweightCount: Number(rating.RATING_REDUCE_NUM ?? 0),
      sellCount: Number(rating.RATING_SALE_NUM ?? 0),
      consensusRating: Number((rating.COMPRE_RATING_NUM ?? 0).toFixed(2)),
      consensusTargetPrice: 0, // 目标价需额外数据源，暂不可用
      targetPriceHigh: 0,
      targetPriceLow: 0,
      recentTrend,
      _source: 'crawler' as const,
    }
  } catch (err) {
    logger.warn('[crawlerProvider] 东财评级汇总解析失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

// ── 降级辅助：回购/配股关键词检测 ──

/**
 * 从分红记录的计划说明中检测回购/配股关键词。
 *
 * 遍历 BonusFinancing 返回的 fhyx 记录，在 IMPL_PLAN_PROFILE 字段中
 * 搜索"回购"和"增发/配股"关键词。
 */
export function checkDividendKeywords(records: DividendRecord[]): { hasBuybackPlan: boolean; hasRightsIssue: boolean } {
  let hasBuybackPlan = false
  let hasRightsIssue = false
  const buybackKeywords = ['回购', 'buyback', 'repurchase']
  const rightsIssueKeywords = ['增发', '配股', 'rights issue', 'SEO', 'seasoned equity']
  for (const rec of records) {
    const plan = (rec.planExplanation ?? '').toLowerCase()
    if (!hasBuybackPlan && buybackKeywords.some((kw) => plan.includes(kw.toLowerCase()))) {
      hasBuybackPlan = true
    }
    if (!hasRightsIssue && rightsIssueKeywords.some((kw) => plan.includes(kw.toLowerCase()))) {
      hasRightsIssue = true
    }
    if (hasBuybackPlan && hasRightsIssue) break
  }
  return { hasBuybackPlan, hasRightsIssue }
}

// ── 降级辅助：财务快照（用于分红率计算） ──

/** 财务快照（从 yctj_chart 提取） */
export interface FinancialSnapshot {
  fiscalYear: number
  netProfit: number // 归母净利润（亿元）
  revenue: number   // 营业总收入（亿元）
}

/**
 * 获取个股近 3 年财务快照（净利润/营收）。
 *
 * 复用 F10 ProfitForecast API 的 yctj_chart 数据，
 * 用于 D15 分红率（payoutRatio3Y）计算。
 */
export async function fetchFinancialSnapshot(symbol: string): Promise<FinancialSnapshot[]> {
  const f10Code = toEastMoneyF10Code(symbol)
  const url = `${EASTMONEY_F10_PROFIT_API}?code=${f10Code}`
  const resp = await safeFetch(url)
  if (!resp) return []
  try {
    const data = (await resp.json()) as EmProfitForecastResponse
    const yctjChart = data?.yctj_chart ?? []
    return yctjChart
      .filter((c) => c.YEAR != null)
      .map((c) => ({
        fiscalYear: Number(c.YEAR),
        netProfit: Number(((c.PARENT_NETPROFIT ?? 0) / 1e8).toFixed(2)),
        revenue: Number(((c.TOTAL_OPERATE_INCOME ?? 0) / 1e8).toFixed(2)),
      }))
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
  } catch (err) {
    logger.warn('[crawlerProvider] 财务快照获取失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    return []
  }
}
