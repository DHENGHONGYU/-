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
 */

import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import type { NewsItem } from './dimensionDataTypes'

const logger = getLogger()

const SOURCE = 'tencentnews'
const SERVER = 'marketdata:tencentnews'

/** 腾讯新闻特性开关：TENCENTNEWS_DISABLED=1 时本层整体跳过（降级到既有源）。
 * 用于生产灰度关停，以及 E2E 前后对比测试中模拟「未接入 tencentnews」的基线。 */
function isTencentNewsEnabled(): boolean {
  return process.env.TENCENTNEWS_DISABLED !== '1'
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
  if (!text || !text.trim()) return []
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
 */
export async function fetchNewsViaTencentNews(
  _symbol: string,
  category: 'announcement' | 'hot_news',
): Promise<NewsItem[] | null> {
  if (category === 'announcement') {
    // 腾讯新闻无个股公告维度，降级到既有源（Tushare/东财/新浪）
    return null
  }
  const [hotText, morningText] = await Promise.all([
    callTencentNewsTool('tencentnews_hot', {}),
    callTencentNewsTool('tencentnews_morning', {}),
  ])
  const raw = [
    ...(hotText ? parseTencentNewsText(hotText) : []),
    ...(morningText ? parseTencentNewsText(morningText) : []),
  ]
  if (raw.length === 0) return null
  return raw.map((r, i) => toNewsItem(r, i, 'hot_news'))
}

/**
 * 维度 04/05 行业舆情：按关键词检索行业资讯（腾讯新闻 tencentnews_search）。
 * 供 cockpit 行业资讯/舆情 widget 直接调用，作为投研复盘的增量情报源。
 * @returns 映射后的资讯数组；失败/空返回 null
 */
export async function fetchIndustryNewsViaTencentNews(keywords: string[]): Promise<NewsItem[] | null> {
  if (!Array.isArray(keywords) || keywords.length === 0) return null
  const texts = await Promise.all(
    keywords.map((kw) => callTencentNewsTool('tencentnews_search', { keyword: kw, limit: 10 })),
  )
  const raw = texts.filter((t): t is string => typeof t === 'string').flatMap((t) => parseTencentNewsText(t))
  if (raw.length === 0) return null
  return raw.map((r, i) => toNewsItem(r, i, 'hot_news'))
}
