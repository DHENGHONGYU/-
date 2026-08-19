/**
 * @module services/data-collector/tencentNewsMcpSource
 * @description 维度 04/05 通过 MCP（marketdata:tencentnews）调用腾讯新闻 SKILL 的适配层（技术方案 §5.4）。
 *
 * 作为 multiSourceFetcher 中 'tencentnews' 源的具体取数实现，遵循既有
 * canExecute('tencentnews') / recordSourceResult('tencentnews', ...) 计分契约，失败时返回 null
 * 由上层降级到 Tushare/爬虫/代理/Mock。
 *
 * 进程约束：底层 TencentNewsCliBridge 依赖 child_process（Node）/ Electron IPC。
 * 在纯浏览器渲染进程中 CLI 不可用时会触发 CliError → 本层捕获后 recordSourceResult(false) 并降级，
 * 不会阻塞采集主链（§5.4 优雅降级）。
 *
 * 覆盖维度：04/05 泛资讯/行业新闻（tencentnews_hot / tencentnews_morning / tencentnews_search）。
 * 注：腾讯新闻为「泛资讯/行业新闻」源，无个股公告维度——announcement 类请求直接降级到既有源。
 *
 * 编码：CLI 返回可读文本（标题/摘要/来源/发布时间/链接），非 JSON；
 *      本层做文本解析（parseTencentNewsText），CLI 字节解码由 TencentNewsCliBridge 负责（UTF-8 自适应）。
 *
 * ## 质量/效率设计（2026-08-16 修复）
 * - **效率**：腾讯新闻 hot/morning 与标的无关，但 multiSourceFetcher 按标的逐个调用，
 *   不加缓存会为每个标的重复 spawn CLI。本层增加模块级 TTL 缓存（hot_news 60s / industry 5min）
 *   + in-flight 去重（并发首调共享同一次 Promise），将 N 标的聚合取数收敛为 1 次真实 CLI 调用。
 * - **质量**：早报(morning)条目缺 source/date，统一补默认值保证字段完整率；hot/morning 按标题
 *   去重；交织（实时 hot 前 7 + 早报 morning 前 3）使 multiSourceFetcher 的 slice(0,10) 仍同时
 *   覆盖实时热点与早报行业头条，避免 15 条早报被整体丢弃。
 */

import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import type { NewsItem } from './dimensionDataTypes'

const logger = getLogger()

const SOURCE = 'tencentnews'
const SERVER = 'marketdata:tencentnews'

/** 缓存 TTL（ms）：热讯/早报 60s（采集周期内复用，且不过度陈旧）；行业检索 5min（cockpit 轮询复用） */
const HOT_NEWS_TTL_MS = 60_000
const INDUSTRY_TTL_MS = 5 * 60_000

/** 腾讯新闻特性开关：TENCENTNEWS_DISABLED=1 时本层整体跳过（降级到既有源）。
 * 用于生产灰度关停，以及 E2E 前后对比测试中模拟「未接入 tencentnews」的基线。 */
function isTencentNewsEnabled(): boolean {
  return process.env.TENCENTNEWS_DISABLED !== '1'
}

/** 缓存 TTL 可被环境变量覆盖（开发/调试可调短，长任务可调长） */
function cacheTtlMs(defaultMs: number): number {
  const env = Number(process.env.TENCENTNEWS_CACHE_TTL_MS)
  return Number.isFinite(env) && env > 0 ? env : defaultMs
}

// ── 模块级缓存（TTL + in-flight 去重）──
interface CacheSlot {
  promise: Promise<unknown>
  expireAt: number
}
const _cache = new Map<string, CacheSlot>()

/**
 * 带 TTL 与 in-flight 去重的缓存包装。
 * - 命中且未过期：直接复用已解析值（或正在进行的 Promise）。
 * - 失败/返回 null：不写入缓存，下次调用重试（失败不污染缓存）。
 * - 并发首调：共享同一 Promise，避免雷鸣群（thundering herd）。
 */
async function withCache<T>(key: string, ttlMs: number, producer: () => Promise<T | null>): Promise<T | null> {
  const now = Date.now()
  const slot = _cache.get(key)
  if (slot && slot.expireAt > now) {
    return slot.promise as Promise<T | null>
  }
  const promise = producer()
    .then((v) => {
      if (v === null) _cache.delete(key) // 失败/空结果不缓存
      return v
    })
    .catch((err) => {
      _cache.delete(key) // 异常不缓存，允许快速恢复
      throw err
    })
  _cache.set(key, { promise, expireAt: now + ttlMs })
  return promise
}

/** 清空缓存（测试隔离 / 强制刷新用） */
export function clearTencentNewsCache(): void {
  _cache.clear()
}

/** 调用 MCP Tool 并解析为文本（统一错误处理 + 计分） */
async function callTencentNewsTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  if (!isTencentNewsEnabled()) {
    logger.debug(`[tencentNewsMcpSource] TENCENTNEWS_DISABLED，跳过 ${SOURCE}`)
    return null
  }
  if (!canExecute(SOURCE)) {
    logger.debug(`[tencentNewsMcpSource] 源 ${SOURCE} 熔断中，跳过`)
    return null
  }
  const start = Date.now()
  try {
    const result = await mcpBridge.callTool(SERVER, toolName, args, { caller: 'system' })
    const latencyMs = Date.now() - start
    if (result.isError) {
      recordSourceResult(SOURCE, { success: false, isMock: false, latencyMs, completeness: 0 })
      logger.warn(`[tencentNewsMcpSource] ${toolName} 返回错误`, { text: result.content[0]?.text })
      return null
    }
    const text = result.content[0]?.text
    recordSourceResult(SOURCE, { success: true, isMock: false, latencyMs, completeness: 1 })
    return typeof text === 'string' ? text : null
  } catch (err) {
    recordSourceResult(SOURCE, { success: false, isMock: false, latencyMs: Date.now() - start, completeness: 0 })
    logger.warn(`[tencentNewsMcpSource] ${toolName} 调用异常`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/** 腾讯新闻 CLI 文本的单条结构 */
interface RawNewsItem {
  title: string
  content: string
  source: string
  date: string
  url: string
}

/** 标题归一化（去空白 + 小写），用于去重 */
function normalizeTitle(t: string): string {
  return (t || '').replace(/\s+/g, '').toLowerCase()
}

/** 标题去重：保留首次出现，去除 hot/morning 间的重复报道 */
function dedupeByTitle(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>()
  const out: RawNewsItem[] = []
  for (const it of items) {
    const k = normalizeTitle(it.title)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

/**
 * 交织 hot 与 morning：保实时 hot 前 hotCap 条，补早报 morning 前 morningCap 条，
 * 使最终 top10 同时覆盖实时热点与早报行业头条（避免早报被 slice(0,10) 整体丢弃）。
 */
function interleaveHotMorning(hot: RawNewsItem[], morning: RawNewsItem[], cap = 10): RawNewsItem[] {
  const hotCap = Math.min(hot.length, 7)
  const morningCap = Math.min(morning.length, cap - hotCap)
  const merged: RawNewsItem[] = []
  let hi = 0
  let mi = 0
  while (merged.length < cap && (hi < hotCap || mi < morningCap)) {
    const useMorning = mi < morningCap && (merged.length % 2 === 1 || hi >= hotCap)
    if (useMorning) {
      const m = morning[mi]
      if (m) {
        merged.push(m)
        mi++
      } else {
        mi++
      }
    } else {
      const h = hot[hi]
      if (h) {
        merged.push(h)
        hi++
      } else {
        hi++
      }
    }
  }
  return merged
}

/**
 * 解析腾讯新闻 CLI 的可读文本为结构化条目。
 * 兼容半角/全角冒号（hot/search 用半角，morning 用全角），兼容无 来源/发布时间 的早报格式。
 * 条目格式：
 *   N. 标题：<标题>
 *      摘要: <摘要>
 *      来源: <来源>
 *      发布时间: <时间>
 *      链接: <url>
 */
export function parseTencentNewsText(text: string): RawNewsItem[] {
  if (!text?.trim()) return []
  const blocks = text.split(/\n(?=\d+\.\s*标题[：:])/)
  const items: RawNewsItem[] = []
  for (const b of blocks) {
    const tm = b.match(/标题[：:]([\s\S]*?)(?=\s*摘要[：:])/)
    if (!tm) continue
    const grab = (pat: RegExp): string => {
      const m = b.match(pat)
      return m ? m[1]!.replace(/\s+/g, ' ').trim() : ''
    }
    const title = tm[1]!.replace(/\s+/g, ' ').trim()
    if (!title) continue
    const content = grab(/摘要[：:]\s*([\s\S]*?)(?=\s*(?:来源[：:]|链接[：:]))/)
    const source = grab(/来源[：:]\s*([\s\S]*?)(?=\s*发布时间[：:])/)
    const date = grab(/发布时间[：:]\s*([\s\S]*?)(?=\s*链接[：:])/)
    const url = grab(/链接[：:]\s*(\S+)/)
    items.push({ title, content, source, date, url })
  }
  return items
}

function toNewsItem(raw: RawNewsItem, i: number, category: NewsItem['category']): NewsItem {
  return {
    id: raw.url && raw.url.length > 0 ? raw.url : `${SOURCE}-${i}`,
    title: raw.title,
    content: raw.content,
    source: raw.source && raw.source.length > 0 ? raw.source : '腾讯新闻',
    date: raw.date,
    category,
    url: raw.url && raw.url.length > 0 ? raw.url : undefined,
    _source: SOURCE,
  }
}

/**
 * 维度 04/05：获取泛资讯/行业新闻（腾讯新闻 tencentnews_hot + tencentnews_morning）
 * @returns 映射后的资讯数组；失败/空返回 null（交由 multiSourceFetcher 降级）
 *
 * 说明：腾讯新闻为泛资讯源，无个股公告维度；announcement 类请求直接返回 null 降级。
 * 结果经 TTL 缓存（hot_news）：同一采集周期内多次按标调用只真实 spawn 一次 CLI。
 */
export async function fetchNewsViaTencentNews(
  _symbol: string,
  category: 'announcement' | 'hot_news',
): Promise<NewsItem[] | null> {
  if (category === 'announcement') {
    // 腾讯新闻无个股公告维度，降级到既有源（Tushare/东财/新浪）
    return null
  }
  // 守卫在缓存之外：禁用/熔断时直接降级，绝不返回缓存中的旧数据（避免 DISABLED 失效/熔断穿透）
  if (!isTencentNewsEnabled() || !canExecute(SOURCE)) {
    logger.debug(`[tencentNewsMcpSource] 源 ${SOURCE} 禁用/熔断，跳过 hot_news`)
    return null
  }
  const cacheKey = `hot_news`
  return withCache<NewsItem[]>(cacheKey, cacheTtlMs(HOT_NEWS_TTL_MS), async () => {
    const [hotText, morningText] = await Promise.all([
      callTencentNewsTool('tencentnews_hot', {}),
      callTencentNewsTool('tencentnews_morning', {}),
    ])
    const hot = hotText ? parseTencentNewsText(hotText) : []
    const today = new Date().toISOString().slice(0, 10)
    // 早报缺 source/date：补默认值，保证字段完整率
    const morning = (morningText ? parseTencentNewsText(morningText) : []).map((m) => ({
      ...m,
      source: m.source && m.source.length > 0 ? m.source : '腾讯新闻·早报',
      date: m.date && m.date.length > 0 ? m.date : today,
    }))
    if (hot.length === 0 && morning.length === 0) return null
    const interleaved = dedupeByTitle(interleaveHotMorning(hot, morning, 10))
    if (interleaved.length === 0) return null
    return interleaved.map((r, i) => toNewsItem(r, i, 'hot_news'))
  })
}

/**
 * 维度 04/05 行业舆情：按关键词检索行业资讯（腾讯新闻 tencentnews_search）。
 * 供 cockpit 行业资讯/舆情 widget 直接调用，作为投研复盘的增量情报源。
 * @returns 映射后的资讯数组；失败/空返回 null
 * 结果经 TTL 缓存（按 keywords）：cockpit 轮询复用，避免重复 CLI 调用。
 */
export async function fetchIndustryNewsViaTencentNews(keywords: string[]): Promise<NewsItem[] | null> {
  if (!Array.isArray(keywords) || keywords.length === 0) return null
  // 守卫在缓存之外：禁用/熔断时直接降级，绝不通透缓存旧数据
  if (!isTencentNewsEnabled() || !canExecute(SOURCE)) {
    logger.debug(`[tencentNewsMcpSource] 源 ${SOURCE} 禁用/熔断，跳过 industry`)
    return null
  }
  const cacheKey = `industry:${keywords.join('|')}`
  return withCache<NewsItem[]>(cacheKey, cacheTtlMs(INDUSTRY_TTL_MS), async () => {
    const texts = await Promise.all(
      keywords.map((kw) => callTencentNewsTool('tencentnews_search', { keyword: kw, limit: 10 })),
    )
    const raw = dedupeByTitle(
      texts.filter((t): t is string => typeof t === 'string').flatMap((t) => parseTencentNewsText(t)),
    )
    if (raw.length === 0) return null
    return raw.map((r, i) => toNewsItem(r, i, 'hot_news'))
  })
}
