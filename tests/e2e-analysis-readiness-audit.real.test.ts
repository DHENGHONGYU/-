// @vitest-environment node
/**
 * @fileoverview E2E 专业分析就绪度校对 — 20 只样本股 × 饱和度/新鲜度/质量三维审计
 *
 * 校对基准（来自分析侧代码真相源）：
 *  - K 线饱和度：L8_CHIP_DIST_WINDOW_DAYS=250（src/config/thresholds.ts，筹码分布近一年窗口）
 *    RLES 回测最低 60 根（rlesBacktest.ts），专业级 = 250 根（约一年交易日）
 *  - 新鲜度：K 线最新日 ≤ 3 自然日（容忍周末/节假日）；新闻中位龄 ≤ 7 天；研报 90 天内有覆盖
 *  - 质量：腾讯/新浪双源价差 ≤ 1%；K 线 OHLC 自洽（high≥low, low≤close≤high, volume>0）
 *    QualityMetrics 阈值（qualityMetricsCollector.ts）：成功率≥80% / 完整率≥90% / 写入率≥95%
 *  - 饱和度阈值：研报 ≥ 3 条/只（估值与评级证据），新闻 ≥ 5 条/只，公告 ≥ 3 条/只
 *
 * 输出：就绪度评分（0-100）+ 分级（专业级 ≥85 / 基础级 ≥70 / 不足 <70）
 * 报告落盘：outputs/e2e-analysis-readiness-audit.json + .md
 *
 * @conformance AGENTS.md v1.7.4 §上线前测试禁止 MOCK 必须真数
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// ── 绝对 URL（Node 直连） ──
const TENCENT_QUOTE_URL = 'https://qt.gtimg.cn/q'
const TENCENT_KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const SINA_QUOTE_URL = 'https://hq.sinajs.cn/list'

// ── 专业分析基线常量（对齐分析侧真相源） ──
const KLINE_PROFESSIONAL_BARS = 250 // L8_CHIP_DIST_WINDOW_DAYS
const KLINE_MINIMUM_BARS = 60 // RLES 回测下限
const RESEARCH_MIN_ITEMS = 3 // 估值/评级证据下限
const NEWS_MIN_ITEMS = 5 // 舆情覆盖下限
const NOTICE_MIN_ITEMS = 3 // 公告覆盖下限
const PRICE_DIVERGENCE_TOL = 0.01 // 双源价差容忍 1%
const KLINE_FRESHNESS_DAYS = 3 // K 线新鲜度（容忍周末）
const NEWS_FRESHNESS_DAYS = 7 // 新闻中位龄上限
const RESEARCH_FRESHNESS_DAYS = 90 // 研报覆盖时效

const TIMEOUT_MS = 20_000

// ── 20 只样本股（与首轮测试一致，可对照） ──
const SAMPLE_STOCKS = [
  { symbol: 'sh600519', code: '600519', name: '贵州茅台' },
  { symbol: 'sh601318', code: '601318', name: '中国平安' },
  { symbol: 'sh600036', code: '600036', name: '招商银行' },
  { symbol: 'sh600276', code: '600276', name: '恒瑞医药' },
  { symbol: 'sh600900', code: '600900', name: '长江电力' },
  { symbol: 'sh600030', code: '600030', name: '中信证券' },
  { symbol: 'sz000001', code: '000001', name: '平安银行' },
  { symbol: 'sz000651', code: '000651', name: '格力电器' },
  { symbol: 'sz000333', code: '000333', name: '美的集团' },
  { symbol: 'sz000858', code: '000858', name: '五粮液' },
  { symbol: 'sz002594', code: '002594', name: '比亚迪' },
  { symbol: 'sz002415', code: '002415', name: '海康威视' },
  { symbol: 'sz300750', code: '300750', name: '宁德时代' },
  { symbol: 'sz300059', code: '300059', name: '东方财富' },
  { symbol: 'sz300760', code: '300760', name: '迈瑞医疗' },
  { symbol: 'sz300015', code: '300015', name: '爱尔眼科' },
  { symbol: 'sh688981', code: '688981', name: '中芯国际' },
  { symbol: 'sh688036', code: '688036', name: '传音控股' },
  { symbol: 'sh688111', code: '688111', name: '金山办公' },
  { symbol: 'sh688256', code: '688256', name: '寒武纪' },
] as const

// ── MCP 桥 mock（真实 CLI：westock 研报/公告 + tencentnews 个股检索） ──
vi.mock('@/mcp/bridge/mcpBridge', () => ({
  mcpBridge: {
    async callTool(server: string, tool: string, args: Record<string, unknown>) {
      if (server === 'marketdata:westock') {
        try {
          const mod = await import('@/mcp/servers/marketdata/WestockCliBridge')
          const { WestockCliBridge } = mod
          const b = new WestockCliBridge()
          const command = tool === 'westock_report_list' ? 'report list' : 'notice list'
          const code = String(args.code ?? '')
          const limit = args.limit != null ? Number(args.limit) : 10
          const raw = await b.invoke(command, `${code} --limit ${limit}`)
          return { content: [{ type: 'text', text: raw.raw }], isError: false }
        } catch {
          return { content: [{ type: 'text', text: '[]' }], isError: true }
        }
      }
      if (server === 'marketdata:tencentnews' && tool === 'tencentnews_search') {
        // 新鲜度增强：按股票名真实检索腾讯新闻（本地 CLI，非 Mock 数据）
        try {
          const mod = await import('@/mcp/servers/news/TencentNewsCliBridge')
          const { TencentNewsCliBridge } = mod
          const b = new TencentNewsCliBridge({ timeoutMs: 30_000 })
          const kw = String(args.keyword ?? '')
          const limit = args.limit != null ? Number(args.limit) : 10
          const text = await b.invoke('search', `${kw} --limit ${limit}`)
          return { content: [{ type: 'text', text }], isError: false }
        } catch {
          return { content: [{ type: 'text', text: '' }], isError: true }
        }
      }
      return { content: [{ type: 'text', text: '[]' }], isError: false }
    },
  },
}))

// ── 工具 ──
async function nodeFetch(url: string, headers?: Record<string, string>): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers },
    })
    if (!resp.ok) return null
    return await resp.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const DAY_MS = 86_400_000

// ── 东财资讯检索（免费公开接口，tencentnews 积分耗尽时的真实新闻增强源） ──
const EASTMONEY_SEARCH_URL = 'https://search-api-web.eastmoney.com/search/jsonp'

/** 解析日期字符串为时间戳（兼容 2026-08-21 / 2026-08-21 14:30 / 08-21 等） */
function parseDateMs(raw: unknown): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null
  let t = Date.parse(s.replace(' ', 'T'))
  if (!Number.isNaN(t)) return t
  // 无年份格式（如 "08-21 10:30"）按当年补全
  const m = s.match(/^(\d{1,2})-(\d{1,2})/)
  if (m) {
    t = Date.parse(`${new Date().getFullYear()}-${m[1]}-${m[2]}`)
    if (!Number.isNaN(t)) return t
  }
  return null
}

function ageDays(ts: number): number {
  return Math.max(0, (Date.now() - ts) / DAY_MS)
}

// ── K 线深度拉取（含 OHLCV 自洽校验） ──
interface KlineAudit {
  ok: boolean
  barCount: number
  latestDateMs: number | null
  latestClose: number | null
  fieldCompleteness: number // 0-1
  ohlcConsistency: number // 0-1（自洽根占比）
  error?: string
}

async function auditKline(symbol: string, bars: number): Promise<KlineAudit> {
  const url = `${TENCENT_KLINE_URL}?_var=kline_dayqfq&param=${symbol},day,,,${bars},qfq`
  const text = await nodeFetch(url)
  if (!text) return { ok: false, barCount: 0, latestDateMs: null, latestClose: null, fieldCompleteness: 0, ohlcConsistency: 0, error: '网络失败' }

  const jsonMatch = text.match(/=\s*(\{.*\})/s)
  if (!jsonMatch?.[1]) return { ok: false, barCount: 0, latestDateMs: null, latestClose: null, fieldCompleteness: 0, ohlcConsistency: 0, error: '解析失败' }

  try {
    const json = JSON.parse(jsonMatch[1])
    const data = json?.data?.[symbol]
    const qfqDay: unknown[] = data?.qfqday ?? data?.day ?? []
    if (!Array.isArray(qfqDay) || qfqDay.length === 0) {
      return { ok: false, barCount: 0, latestDateMs: null, latestClose: null, fieldCompleteness: 0, ohlcConsistency: 0, error: '无 K 线' }
    }

    let fieldOk = 0
    let ohlcOk = 0
    for (const bar of qfqDay) {
      if (!Array.isArray(bar) || bar.length < 6) continue
      const open = Number(bar[1])
      const close = Number(bar[2])
      const high = Number(bar[3])
      const low = Number(bar[4])
      const volume = Number(bar[5])
      // 字段完整：五个量均为有限数
      if ([open, close, high, low, volume].every((v) => Number.isFinite(v))) fieldOk++
      // OHLC 自洽：high≥max(open,close)、low≤min(open,close)、volume>0
      if (high >= Math.max(open, close) && low <= Math.min(open, close) && volume > 0) ohlcOk++
    }

    const last = qfqDay[qfqDay.length - 1]
    const latestDateMs = Array.isArray(last) ? parseDateMs(last[0]) : null
    const latestClose = Array.isArray(last) && Number.isFinite(Number(last[2])) ? Number(last[2]) : null

    return {
      ok: true,
      barCount: qfqDay.length,
      latestDateMs,
      latestClose,
      fieldCompleteness: fieldOk / qfqDay.length,
      ohlcConsistency: ohlcOk / qfqDay.length,
    }
  } catch {
    return { ok: false, barCount: 0, latestDateMs: null, latestClose: null, fieldCompleteness: 0, ohlcConsistency: 0, error: 'JSON parse error' }
  }
}

// ── 双源行情 ──
async function fetchTencentPrice(symbol: string): Promise<number | null> {
  const text = await nodeFetch(`${TENCENT_QUOTE_URL}=${symbol}`)
  if (!text) return null
  const match = text.match(/v_[^=]+="([^"]+)"/)
  if (!match?.[1]) return null
  const price = parseFloat(match[1].split('~')[3]!)
  return Number.isFinite(price) && price > 0 ? price : null
}

async function fetchSinaPrice(symbol: string): Promise<number | null> {
  const text = await nodeFetch(`${SINA_QUOTE_URL}=${symbol}`, { Referer: 'https://finance.sina.com.cn' })
  if (!text) return null
  const match = text.match(/="([^"]+)"/)
  if (!match?.[1]) return null
  const price = parseFloat(match[1].split(',')[3]!)
  return Number.isFinite(price) && price > 0 ? price : null
}

// ── 资讯维度（04/05/08）审计：条数 + 日期新鲜度 ──
interface NewsAudit {
  ok: boolean
  count: number
  datedCount: number // 有可解析日期的条数
  agesDays: number[] // 各条龄（天）
  medianAge: number | null
  error?: string
}

async function auditDimension(symbol: string, dim: string, limit: number): Promise<NewsAudit> {
  try {
    const { fetchDimensionData } = await import('@/services/data-collector/multiSourceFetcher')
    const result = await fetchDimensionData(symbol, dim)
    if (!result) return { ok: false, count: 0, datedCount: 0, agesDays: [], medianAge: null, error: 'null' }
    const items = Array.isArray((result as Record<string, unknown>).items)
      ? ((result as Record<string, unknown>).items as Array<Record<string, unknown>>)
      : []
    if (items.length === 0) return { ok: false, count: 0, datedCount: 0, agesDays: [], medianAge: null, error: '空' }

    // 请求 limit 条（westock CLI 上限 10），这里用饱和探测
    const ages: number[] = []
    let dated = 0
    for (const it of items.slice(0, limit)) {
      const t = parseDateMs(it.date ?? it.publishedAt ?? it.time)
      if (t != null) {
        dated++
        ages.push(ageDays(t))
      }
    }
    ages.sort((a, b) => a - b)
    const medianAge = ages.length > 0 ? ages[Math.floor(ages.length / 2)]! : null
    return { ok: true, count: items.length, datedCount: dated, agesDays: ages, medianAge }
  } catch (err) {
    return { ok: false, count: 0, datedCount: 0, agesDays: [], medianAge: null, error: String(err) }
  }
}

// ── 新闻新鲜度增强：westock 基础流 + tencentnews 检索 + 东财实时检索兜底 ──
async function fetchEastmoneyNews(stockName: string, limit = 10): Promise<Array<{ title: string; date: string; url?: string }>> {
  const param = encodeURIComponent(JSON.stringify({
    uid: '',
    keyword: stockName,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientVersion: 'curr',
    clientType: 'web',
    param: { cmsArticleWebOld: { searchScope: 'default', sort: 'default', pageIndex: 1, pageSize: limit } },
  }))
  const text = await nodeFetch(`${EASTMONEY_SEARCH_URL}?cb=cb&param=${param}`)
  if (!text) return []
  const m = text.match(/^cb\((.*)\)\s*;?\s*$/s)
  if (!m?.[1]) return []
  try {
    const json = JSON.parse(m[1]) as { result?: { cmsArticleWebOld?: Array<{ date?: string; title?: string; url?: string }> } }
    const arts = json.result?.cmsArticleWebOld ?? []
    return arts
      .filter((a) => a && a.title && a.date)
      .map((a) => ({ title: String(a.title).replace(/<[^>]+>/g, ''), date: String(a.date), url: a.url }))
  } catch {
    return []
  }
}

async function fetchEnhancedNews(symbol: string, stockName: string): Promise<NewsAudit> {
  try {
    const { fetchDimensionData } = await import('@/services/data-collector/multiSourceFetcher')
    const { parseTencentNewsText } = await import('@/services/data-collector/tencentNewsMcpSource')
    const { mcpBridge } = await import('@/mcp/bridge/mcpBridge')

    // 基础流（维度 05，westock 主源）
    const baseAges: number[] = []
    const seen = new Set<string>()
    let baseCount = 0
    try {
      const result = await fetchDimensionData(symbol, '05')
      const items = Array.isArray((result as Record<string, unknown> | null)?.items)
        ? ((result as Record<string, unknown>).items as Array<Record<string, unknown>>)
        : []
      baseCount = items.length
      for (const it of items.slice(0, 10)) {
        const title = String(it.title ?? '').replace(/\s+/g, '').toLowerCase()
        if (title) seen.add(title)
        const t = parseDateMs(it.date ?? it.publishedAt ?? it.time)
        if (t != null) baseAges.push(ageDays(t))
      }
    } catch {
      // 基础流失败不阻断，继续走检索增强
    }

    // 增强流：腾讯新闻按股票名检索（近期舆情，提升新鲜度）
    let searchCount = 0
    const searchAges: number[] = []
    try {
      const resp = await mcpBridge.callTool('marketdata:tencentnews', 'tencentnews_search', { keyword: stockName, limit: 10 }, { caller: 'system' })
      const text = resp?.content?.[0]?.text
      if (!resp?.isError && typeof text === 'string' && text.trim()) {
        for (const raw of parseTencentNewsText(text)) {
          searchCount++
          const title = raw.title.replace(/\s+/g, '').toLowerCase()
          if (title && seen.has(title)) continue // 与基础流去重后不计龄，但仍计条数
          const t = parseDateMs(raw.date)
          if (t != null) searchAges.push(ageDays(t))
        }
      }
    } catch {
      // CLI 不可用时静默降级（继续走东财兜底）
    }

    // 兜底流：东财实时资讯检索（免费公开接口；tencentnews 积分耗尽时的真实新闻源）
    let emCount = 0
    try {
      for (const raw of await fetchEastmoneyNews(stockName, 20)) {
        emCount++
        const title = raw.title.replace(/\s+/g, '').toLowerCase()
        if (title && seen.has(title)) continue
        seen.add(title)
        const t = parseDateMs(raw.date)
        if (t != null) searchAges.push(ageDays(t))
      }
    } catch {
      // 东财不可用时静默降级（仅用已采集到的流）
    }

    const ages = [...baseAges, ...searchAges].sort((a, b) => a - b)
    const count = baseCount + searchCount + emCount
    if (count === 0) return { ok: false, count: 0, datedCount: 0, agesDays: [], medianAge: null, error: '空' }
    const medianAge = ages.length > 0 ? ages[Math.floor(ages.length / 2)]! : null
    return { ok: true, count, datedCount: ages.length, agesDays: ages, medianAge }
  } catch (err) {
    return { ok: false, count: 0, datedCount: 0, agesDays: [], medianAge: null, error: String(err) }
  }
}

// ── 就绪度评分（每只股票） ──
interface ReadinessScore {
  saturation: number // 0-100（K 线深度 50% + 研报 20% + 新闻 15% + 公告 15%）
  freshness: number // 0-100（K 线新鲜 50% + 新闻中位龄 30% + 研报时效 20%）
  quality: number // 0-100（双源一致 40% + 字段完整 30% + OHLC 自洽 30%）
  composite: number
  grade: '专业级' | '基础级' | '不足'
  gaps: string[]
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function scoreStock(
  kline: KlineAudit,
  dualOk: boolean,
  research: NewsAudit,
  news: NewsAudit,
  notice: NewsAudit,
): ReadinessScore {
  const gaps: string[] = []

  // ── 饱和度 ──
  const klineSat = clamp01(kline.barCount / KLINE_PROFESSIONAL_BARS)
  const researchSat = clamp01(research.count / RESEARCH_MIN_ITEMS)
  const newsSat = clamp01(news.count / NEWS_MIN_ITEMS)
  const noticeSat = clamp01(notice.count / NOTICE_MIN_ITEMS)
  const saturation = (klineSat * 0.5 + researchSat * 0.2 + newsSat * 0.15 + noticeSat * 0.15) * 100
  if (kline.barCount < KLINE_PROFESSIONAL_BARS) gaps.push(`K线仅 ${kline.barCount} 根 < 专业级 ${KLINE_PROFESSIONAL_BARS} 根（筹码年度窗口）`)
  if (kline.barCount < KLINE_MINIMUM_BARS) gaps.push(`K线低于 RLES 回测下限 ${KLINE_MINIMUM_BARS} 根`)
  if (research.count < RESEARCH_MIN_ITEMS) gaps.push(`研报 ${research.count} 条 < ${RESEARCH_MIN_ITEMS} 条`)
  if (news.count < NEWS_MIN_ITEMS) gaps.push(`新闻 ${news.count} 条 < ${NEWS_MIN_ITEMS} 条`)

  // ── 新鲜度 ──
  const klineAge = kline.latestDateMs != null ? ageDays(kline.latestDateMs) : Infinity
  const klineFresh = klineAge <= KLINE_FRESHNESS_DAYS ? 1 : clamp01(1 - (klineAge - KLINE_FRESHNESS_DAYS) / 10)
  const newsFresh = news.medianAge != null ? clamp01(1 - news.medianAge / NEWS_FRESHNESS_DAYS) : 0
  const researchFresh = research.agesDays.some((a) => a <= RESEARCH_FRESHNESS_DAYS) ? 1 : 0
  const freshness = (klineFresh * 0.5 + newsFresh * 0.3 + researchFresh * 0.2) * 100
  if (klineAge > KLINE_FRESHNESS_DAYS) gaps.push(`K线最新日距今 ${klineAge.toFixed(1)} 天 > ${KLINE_FRESHNESS_DAYS} 天`)
  if (news.medianAge != null && news.medianAge > NEWS_FRESHNESS_DAYS) gaps.push(`新闻中位龄 ${news.medianAge.toFixed(1)} 天 > ${NEWS_FRESHNESS_DAYS} 天`)
  if (researchFresh === 0) gaps.push(`研报无 ${RESEARCH_FRESHNESS_DAYS} 天内覆盖`)

  // ── 质量 ──
  const dualQ = dualOk ? 1 : 0
  const quality = (dualQ * 0.4 + kline.fieldCompleteness * 0.3 + kline.ohlcConsistency * 0.3) * 100
  if (!dualOk) gaps.push('双源价格不一致或取数失败')
  if (kline.fieldCompleteness < 0.9) gaps.push(`K线字段完整率 ${(kline.fieldCompleteness * 100).toFixed(0)}% < 90%`)
  if (kline.ohlcConsistency < 0.95) gaps.push(`K线 OHLC 自洽率 ${(kline.ohlcConsistency * 100).toFixed(0)}% < 95%`)

  const composite = saturation * 0.4 + freshness * 0.3 + quality * 0.3
  const grade = composite >= 85 ? '专业级' : composite >= 70 ? '基础级' : '不足'

  return { saturation, freshness, quality, composite, grade, gaps }
}

describe('E2E 专业分析就绪度校对 · 20 只样本股 × 饱和度/新鲜度/质量', () => {
  const audit: Array<{
    code: string
    name: string
    kline: KlineAudit
    tencentPrice: number | null
    sinaPrice: number | null
    divergence: number | null
    research: NewsAudit
    news: NewsAudit
    newsBase: NewsAudit // 整改前基线（仅维度 05 基础流）
    notice: NewsAudit
    score: ReadinessScore | null
  }> = []

  beforeAll(() => {
    console.log(`[审计] 基线：K线专业级=${KLINE_PROFESSIONAL_BARS}根 研报≥${RESEARCH_MIN_ITEMS} 新闻≥${NEWS_MIN_ITEMS} 双源容忍=${PRICE_DIVERGENCE_TOL * 100}%`)
  })

  it(
    '饱和度 + 新鲜度 + 质量：K 线 250 根深度 + 双源一致 + 三维资讯审计',
    async () => {
      for (const stock of SAMPLE_STOCKS) {
        // 1. K 线深度（一次拉 260，校验 ≥250 可得性）
        const kline = await auditKline(stock.symbol, 260)

        // 2. 双源行情一致性（并行）
        const [tencentPrice, sinaPrice] = await Promise.all([
          fetchTencentPrice(stock.symbol),
          fetchSinaPrice(stock.symbol),
        ])
        const divergence = tencentPrice != null && sinaPrice != null
          ? Math.abs(tencentPrice - sinaPrice) / tencentPrice
          : null
        // dualOk 在汇总阶段由 row.divergence 重算（见 scoreStock 调用点），此处不再局部声明

        // 3. 资讯三维（04 公告 / 05 新闻 / 08 研报），饱和探测 10 条；新闻走检索增强流并保留基线对照
        const notice = await auditDimension(stock.symbol, '04', 10)
        const newsBase = await auditDimension(stock.symbol, '05', 10)
        const news = await fetchEnhancedNews(stock.symbol, stock.name)
        const research = await auditDimension(stock.symbol, '08', 10)

        audit.push({
          code: stock.code,
          name: stock.name,
          kline,
          tencentPrice,
          sinaPrice,
          divergence,
          research,
          news,
          newsBase,
          notice,
          score: null,
        })

        console.log(
          `[审计] ${stock.code} ${stock.name} | K线:${kline.barCount}根 最新:${kline.latestDateMs != null ? new Date(kline.latestDateMs).toISOString().slice(0, 10) : '?'} ` +
          `| 双源差:${divergence != null ? (divergence * 100).toFixed(3) + '%' : 'N/A'} ` +
          `| 研报:${research.count}(中位龄${research.medianAge?.toFixed(0) ?? '?'}d) 新闻:${news.count}(中位龄${news.medianAge?.toFixed(0) ?? '?'}d ←基线${newsBase.medianAge?.toFixed(0) ?? '?'}d) 公告:${notice.count}`,
        )
      }

      expect(audit.length).toBe(20)
    },
    { timeout: 600_000 },
  )

  it(
    '就绪度评分与分级 + 报告落盘',
    () => {
      for (const row of audit) {
        row.score = scoreStock(row.kline, row.divergence != null && row.divergence <= PRICE_DIVERGENCE_TOL, row.research, row.news, row.notice)
      }

      // ── 聚合 ──
      const n = audit.length
      const avg = (fn: (r: (typeof audit)[number]) => number) => audit.reduce((s, r) => s + fn(r), 0) / n
      const agg = {
        saturation: avg((r) => r.score!.saturation),
        freshness: avg((r) => r.score!.freshness),
        quality: avg((r) => r.score!.quality),
        composite: avg((r) => r.score!.composite),
      }
      const gradeCount = { 专业级: 0, 基础级: 0, 不足: 0 }
      for (const r of audit) gradeCount[r.score!.grade]++

      // 关键基线达成率
      const kline250Ok = audit.filter((r) => r.kline.barCount >= KLINE_PROFESSIONAL_BARS).length
      const kline60Ok = audit.filter((r) => r.kline.barCount >= KLINE_MINIMUM_BARS).length
      const dualOkCount = audit.filter((r) => r.divergence != null && r.divergence <= PRICE_DIVERGENCE_TOL).length
      const researchOk = audit.filter((r) => r.research.count >= RESEARCH_MIN_ITEMS).length
      const newsOk = audit.filter((r) => r.news.count >= NEWS_MIN_ITEMS).length
      const klineFreshOk = audit.filter((r) => r.kline.latestDateMs != null && ageDays(r.kline.latestDateMs) <= KLINE_FRESHNESS_DAYS).length

      console.log('\n════════ 就绪度汇总 ════════')
      console.log(`饱和度均值: ${agg.saturation.toFixed(1)} | 新鲜度均值: ${agg.freshness.toFixed(1)} | 质量均值: ${agg.quality.toFixed(1)} | 综合: ${agg.composite.toFixed(1)}`)
      console.log(`分级: 专业级 ${gradeCount['专业级']} / 基础级 ${gradeCount['基础级']} / 不足 ${gradeCount['不足']}`)
      console.log(`K线≥250根: ${kline250Ok}/20 | K线≥60根: ${kline60Ok}/20 | 双源一致: ${dualOkCount}/20`)
      console.log(`研报≥3条: ${researchOk}/20 | 新闻≥5条: ${newsOk}/20 | K线新鲜: ${klineFreshOk}/20`)

      // ── 报告落盘 ──
      const outDir = resolve(process.cwd(), 'outputs')
      mkdirSync(outDir, { recursive: true })

      const jsonReport = {
        generatedAt: new Date().toISOString(),
        baselines: {
          klineProfessionalBars: KLINE_PROFESSIONAL_BARS,
          klineMinimumBars: KLINE_MINIMUM_BARS,
          researchMinItems: RESEARCH_MIN_ITEMS,
          newsMinItems: NEWS_MIN_ITEMS,
          noticeMinItems: NOTICE_MIN_ITEMS,
          priceDivergenceTol: PRICE_DIVERGENCE_TOL,
          klineFreshnessDays: KLINE_FRESHNESS_DAYS,
          newsFreshnessDays: NEWS_FRESHNESS_DAYS,
          researchFreshnessDays: RESEARCH_FRESHNESS_DAYS,
        },
        aggregate: agg,
        gradeCount,
        baselineAchievement: { kline250Ok, kline60Ok, dualOkCount, researchOk, newsOk, klineFreshOk, total: n },
        stocks: audit.map((r) => ({
          code: r.code,
          name: r.name,
          klineBars: r.kline.barCount,
          klineLatest: r.kline.latestDateMs != null ? new Date(r.kline.latestDateMs).toISOString().slice(0, 10) : null,
          fieldCompleteness: Math.round(r.kline.fieldCompleteness * 1000) / 1000,
          ohlcConsistency: Math.round(r.kline.ohlcConsistency * 1000) / 1000,
          divergence: r.divergence != null ? Math.round(r.divergence * 100000) / 100000 : null,
          research: r.research.count,
          researchMedianAgeDays: r.research.medianAge != null ? Math.round(r.research.medianAge * 10) / 10 : null,
          news: r.news.count,
          newsMedianAgeDays: r.news.medianAge != null ? Math.round(r.news.medianAge * 10) / 10 : null,
          newsBaseMedianAgeDays: r.newsBase.medianAge != null ? Math.round(r.newsBase.medianAge * 10) / 10 : null,
          notice: r.notice.count,
          saturation: Math.round(r.score!.saturation * 10) / 10,
          freshness: Math.round(r.score!.freshness * 10) / 10,
          quality: Math.round(r.score!.quality * 10) / 10,
          composite: Math.round(r.score!.composite * 10) / 10,
          grade: r.score!.grade,
          gaps: r.score!.gaps,
        })),
      }
      writeFileSync(resolve(outDir, 'e2e-analysis-readiness-audit.json'), JSON.stringify(jsonReport, null, 2), 'utf-8')
      writeFileSync(resolve(outDir, 'e2e-analysis-readiness-audit.md'), buildMd(jsonReport), 'utf-8')
      console.log(`[报告] 已写入 ${outDir}/e2e-analysis-readiness-audit.{json,md}`)

      // 底线断言：质量与新鲜度应高（行情管线已验证稳定），饱和度以报告形式呈现
      expect(agg.quality, `质量均值 ${agg.quality.toFixed(1)} < 80`).toBeGreaterThan(80)
      expect(agg.freshness, `新鲜度均值 ${agg.freshness.toFixed(1)} < 60`).toBeGreaterThan(60)
      expect(kline60Ok, `K线≥60 根仅 ${kline60Ok}/20，低于 RLES 回测下限`).toBe(n)
    },
    { timeout: 60_000 },
  )
})

// ── Markdown 报告 ──
function buildMd(report: {
  generatedAt: string
  baselines: Record<string, number>
  aggregate: { saturation: number; freshness: number; quality: number; composite: number }
  gradeCount: Record<string, number>
  baselineAchievement: Record<string, number>
  stocks: Array<{
    code: string; name: string; klineBars: number; klineLatest: string | null
    fieldCompleteness: number; ohlcConsistency: number; divergence: number | null
    research: number; researchMedianAgeDays: number | null; news: number; newsMedianAgeDays: number | null
    newsBaseMedianAgeDays: number | null
    notice: number; saturation: number; freshness: number; quality: number; composite: number
    grade: string; gaps: string[]
  }>
}): string {
  const { aggregate, gradeCount, baselineAchievement, stocks } = report
  const n = report.baselineAchievement.total

  const verdict = aggregate.composite >= 85
    ? '✅ **达到专业分析基线**：三维综合分 ≥ 85，可支撑 V6 全层（含筹码年度窗口）评分'
    : aggregate.composite >= 70
      ? '⚠️ **达到基础分析基线但存在饱和度缺口**：综合分 70-85，部分维度（见缺口列）不满足专业级要求'
      : '❌ **未达专业分析基线**：综合分 < 70，需补采'

  return `# E2E 专业分析就绪度校对报告

> 生成时间：${report.generatedAt}
> 样本：20 只跨板 A 股 | 真实数据，禁止 Mock
> 基线来源：V6 引擎 thresholds（L8_CHIP_DIST_WINDOW_DAYS=250）、rlesBacktest（≥60 根）、qualityMetricsCollector（成功率≥80/完整率≥90）

## 1. 就绪度结论

${verdict}

| 维度 | 均值（0-100） | 判定标准 |
|------|------|------|
| 饱和度 | ${aggregate.saturation.toFixed(1)} | K线深度 50% + 研报 20% + 新闻 15% + 公告 15% |
| 新鲜度 | ${aggregate.freshness.toFixed(1)} | K线时效 50% + 新闻中位龄 30% + 研报时效 20% |
| 质量 | ${aggregate.quality.toFixed(1)} | 双源一致 40% + 字段完整 30% + OHLC 自洽 30% |
| **综合** | **${aggregate.composite.toFixed(1)}** | 饱和 40% + 新鲜 30% + 质量 30% |

分级分布：专业级(≥85) ${gradeCount['专业级']} 只 | 基础级(≥70) ${gradeCount['基础级']} 只 | 不足(<70) ${gradeCount['不足']} 只

## 2. 关键基线达成率

| 基线 | 达成 | 说明 |
|------|------|------|
| K 线 ≥ ${report.baselines.klineProfessionalBars} 根（筹码年度窗口） | ${baselineAchievement.kline250Ok}/${n} | V6 L8 筹码分布专业级 |
| K 线 ≥ ${report.baselines.klineMinimumBars} 根（RLES 回测下限） | ${baselineAchievement.kline60Ok}/${n} | 二波检测/回测最低门槛 |
| 双源价差 ≤ 1% | ${baselineAchievement.dualOkCount}/${n} | 腾讯 vs 新浪行情互验 |
| 研报 ≥ ${report.baselines.researchMinItems} 条/只 | ${baselineAchievement.researchOk}/${n} | 估值/评级证据链 |
| 新闻 ≥ ${report.baselines.newsMinItems} 条/只 | ${baselineAchievement.newsOk}/${n} | 舆情覆盖 |
| K 线 ≤ ${report.baselines.klineFreshnessDays} 天 | ${baselineAchievement.klineFreshOk}/${n} | 最新交易日覆盖 |

## 3. 逐股审计明细

| 代码 | 名称 | K线根数 | 最新日 | 字段完整 | OHLC自洽 | 双源差 | 研报(中位龄) | 新闻(中位龄) | 公告 | 饱和 | 新鲜 | 质量 | 综合 | 分级 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
${stocks
    .map(
      (s) =>
        `| ${s.code} | ${s.name} | ${s.klineBars} | ${s.klineLatest ?? '-'} | ${(s.fieldCompleteness * 100).toFixed(1)}% | ${(s.ohlcConsistency * 100).toFixed(1)}% | ${s.divergence != null ? (s.divergence * 100).toFixed(3) + '%' : '-'} | ${s.research}${s.researchMedianAgeDays != null ? ` (${s.researchMedianAgeDays}d)` : ''} | ${s.news}${s.newsMedianAgeDays != null ? ` (${s.newsMedianAgeDays}d)` : ''} | ${s.notice} | ${s.saturation} | ${s.freshness} | ${s.quality} | **${s.composite}** | ${s.grade} |`,
    )
    .join('\n')}

## 4. 新闻新鲜度整改对照（tencentnews 检索 + 东财实时检索增强；tencentnews 积分耗尽时自动兜底东财）

| 代码 | 名称 | 基线中位龄 | 增强后中位龄 | 改善 |
|------|------|------|------|------|
${stocks
    .map(
      (s) =>
        `| ${s.code} | ${s.name} | ${s.newsBaseMedianAgeDays != null ? s.newsBaseMedianAgeDays + 'd' : '-'} | ${s.newsMedianAgeDays != null ? s.newsMedianAgeDays + 'd' : '-'} | ${s.newsBaseMedianAgeDays != null && s.newsMedianAgeDays != null ? (s.newsBaseMedianAgeDays - s.newsMedianAgeDays >= 0 ? '↓' : '↑') + Math.abs(s.newsBaseMedianAgeDays - s.newsMedianAgeDays).toFixed(1) + 'd' : '-'} |`,
    )
    .join('\n')}

## 5. 缺口清单（按股）

${stocks
    .filter((s) => s.gaps.length > 0)
    .map((s) => `- **${s.code} ${s.name}**：${s.gaps.join('；')}`)
    .join('\n') || '- 无缺口'}

## 6. 解读与建议

- **饱和度**：K 线深度是专业级分析的主要变量——筹码分布（CYQ 近一年视角）要求 250 根；研报/新闻条数反映证据链厚度。
- **新鲜度**：行情与 K 线应覆盖最新交易日；新闻中位龄 ≤ 7 天保证舆情时效；研报 90 天窗口对齐券商覆盖周期。
- **质量**：双源价差 ≤ 1% 交叉验证行情准确性；OHLC 自洽防止坏数据污染技术面评分。
`
}
