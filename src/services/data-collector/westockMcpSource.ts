/**
 * @module services/data-collector/westockMcpSource
 * @description 维度 04/05/08 通过 MCP（marketdata:westock）调用腾讯自选股 SKILL 的适配层（技术方案 §5.4）。
 *
 * 作为 multiSourceFetcher 中 'westock' 源的具体取数实现，遵循既有
 * canExecute('westock') / recordSourceResult('westock', ...) 计分契约，失败时返回 null
 * 由上层降级到 Tushare/爬虫/代理/Mock。
 *
 * 进程约束：底层 WestockCliBridge 依赖 child_process（Node）。在纯浏览器渲染进程中 CLI 不可用
 * 时会触发 CliError → 本层捕获后 recordSourceResult(false) 并降级，不会阻塞采集主链（§5.4 优雅降级）。
 *
 * 覆盖维度：04 公告 / 05 新闻（westock_notice_list）、08 研报（westock_report_list）。
 * 维度 03/06/07 腾讯自选股 SKILL 无直接对应 Tool，保持既有源（见 §4.2 覆盖范围）。
 */

import { getLogger } from '@/lib/logger'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import { canExecute, recordSourceResult } from './adaptiveSourceOrchestrator'
import type { NewsItem, ResearchReport } from './dimensionDataTypes'

const logger = getLogger()

const SOURCE = 'westock'
const SERVER = 'marketdata:westock'

/** westock 特性开关：WESTOCK_DISABLED=1 时本层整体跳过（降级到既有源）。
 * 用于生产灰度关停，以及 E2E 前后对比测试中模拟「未接入 westock」的基线。 */
function isWestockEnabled(): boolean {
  return process.env.WESTOCK_DISABLED !== '1'
}

/** 调用 MCP Tool 并解析为 unknown（统一错误处理 + 计分） */
async function callWestockTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!isWestockEnabled()) {
    logger.debug(`[westockMcpSource] WESTOCK_DISABLED，跳过 ${SOURCE}`)
    return null
  }
  if (!canExecute(SOURCE)) {
    logger.debug(`[westockMcpSource] 源 ${SOURCE} 熔断中，跳过`)
    return null
  }
  const start = Date.now()
  try {
    const result = await mcpBridge.callTool(SERVER, toolName, args, { caller: 'system' })
    const latencyMs = Date.now() - start
    if (result.isError) {
      recordSourceResult(SOURCE, { success: false, isMock: false, latencyMs, completeness: 0 })
      logger.warn(`[westockMcpSource] ${toolName} 返回错误`, { text: result.content[0]?.text })
      return null
    }
    const text = result.content[0]?.text
    const data = text ? JSON.parse(text) : null
    recordSourceResult(SOURCE, { success: true, isMock: false, latencyMs, completeness: 1 })
    return data
  } catch (err) {
    recordSourceResult(SOURCE, { success: false, isMock: false, latencyMs: Date.now() - start, completeness: 0 })
    logger.warn(`[westockMcpSource] ${toolName} 调用异常`, { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/** 从各种 CLI 包装形态中提取扁平数组。
 * 覆盖三种真实返回结构（已用 westock-data-skillhub@1.0.5 --raw 实测）：
 *  - 单代码：顶层数组 [{...}]
 *  - 批量（逗号多代码）：{ sections: [[{...}],[{...}]] }
 *  - 其它 BatchResult：{ data: [{code, data:[...]}, ...] }
 *  - 以及通用的 items/list/results/records 包裹
 */
function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    // 批量（逗号多代码）：sections 为「数组的数组」
    if (Array.isArray(obj.sections)) {
      return (obj.sections as unknown[]).flatMap((s) => (Array.isArray(s) ? (s as unknown[]) : []))
    }
    // 其它 BatchResult：data 为「每代码结果数组」，逐条展开其内嵌 data
    if (Array.isArray(obj.data)) {
      const nested = (obj.data as unknown[]).flatMap((e) =>
        e && typeof e === 'object' && Array.isArray((e as Record<string, unknown>).data)
          ? ((e as Record<string, unknown>).data as unknown[])
          : [],
      )
      if (nested.length > 0) return nested
      return obj.data as unknown[]
    }
    for (const key of ['items', 'list', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

/** 从研报标题「【机构名】...」中提取机构；无则回退 src/org 等字段 */
function extractInstitution(title: string, fallback: string): string {
  const m = title.match(/【([^】]+)】/)
  const inst = m ? m[1] : fallback
  return inst && inst.length > 0 ? inst : fallback
}

function numOrUndef(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN)
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function validSentiment(v: unknown): NewsItem['sentiment'] | undefined {
  return v === 'positive' || v === 'negative' || v === 'neutral' ? v : undefined
}

/**
 * 维度 08：获取研报列表（腾讯自选股 westock_report_list）
 * @returns 映射后的研报数组；失败/空返回 null（交由 multiSourceFetcher 降级）
 */
export async function fetchResearchReportsViaWestock(symbol: string): Promise<ResearchReport[] | null> {
  const data = await callWestockTool('westock_report_list', { code: symbol, limit: 10 })
  if (data == null) return null
  const arr = asArray(data)
  if (arr.length === 0) return null
  const reports: ResearchReport[] = arr.map((raw, i) => {
    const item = (raw ?? {}) as Record<string, unknown>
    // 真实字段（--raw 实测）：rating→tzpj、机构嵌于 title【】、时间→time、摘要→summary
    return {
      id: str(item.id ?? item.code, `${symbol}-report-${i}`),
      title: str(item.title ?? item.name),
      author: str(item.author ?? item.analyst),
      institution: extractInstitution(str(item.title ?? ''), str(item.src ?? item.org ?? item.institution ?? item.broker)),
      rating: str(item.tzpj ?? item.rating ?? item.grade, 'N/A'),
      targetPrice: numOrUndef(item.targetPrice ?? item.price),
      date: str(item.time ?? item.date ?? item.pubDate ?? item.publishDate),
      summary: str(item.summary ?? item.content ?? item.abstract),
      _source: SOURCE,
    }
  })
  return reports.length > 0 ? reports : null
}

/**
 * 维度 04/05：获取公告/新闻列表（腾讯自选股 westock_notice_list）
 * @returns 映射后的资讯数组；失败/空返回 null（交由 multiSourceFetcher 降级）
 */
export async function fetchNewsViaWestock(
  symbol: string,
  category: 'announcement' | 'hot_news',
): Promise<NewsItem[] | null> {
  const data = await callWestockTool('westock_notice_list', { code: symbol, limit: 10 })
  if (data == null) return null
  const arr = asArray(data)
  if (arr.length === 0) return null
  const items: NewsItem[] = arr.map((raw, i) => {
    const item = (raw ?? {}) as Record<string, unknown>
    // 真实字段（--raw 实测）：时间→time、url 多为空、无正文摘要（content 取不到时留空）
    return {
      id: str(item.id ?? item.code, `${symbol}-notice-${i}`),
      title: str(item.title ?? item.name),
      content: str(item.content ?? item.summary ?? item.abstract),
      source: str(item.source ?? item.pubSource ?? item.src, '腾讯自选股'),
      date: str(item.time ?? item.date ?? item.pubDate ?? item.update_time),
      category,
      url: typeof item.url === 'string' ? item.url : undefined,
      sentiment: validSentiment(item.sentiment),
      _source: SOURCE,
    }
  })
  return items.length > 0 ? items : null
}
