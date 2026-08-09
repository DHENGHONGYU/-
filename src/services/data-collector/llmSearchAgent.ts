/**
 * @module llmSearchAgent
 * @description LLM 联网搜索 Agent，封装 Qwen-Plus Chat Completions API（阿里云百炼）。
 *
 * 用途：在 Tushare → crawler 降级之后，作为额外数据源尝试获取公告/新闻/研报。
 * 无 Key 时优雅降级返回空数组，不阻塞主流程。
 *
 * 环境适配：
 * - Node 环境（typeof window === 'undefined'）：直连 https://dashscope.aliyuncs.com
 * - 浏览器环境：走 Vite 代理 /api/proxy/qwen → https://dashscope.aliyuncs.com
  * @doc [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-BACK-012, V9-DOC-AI-002, V9-DOC-AI-014]
*/

import { getLogger } from '@/lib/logger'
import type { NewsItem, ResearchReport } from './dimensionDataTypes'
import { check, get, set } from './llmSearchCache'
import { DASHSCOPE_API_URL } from '@/config/dataSourceUrls'
import { API_PROXY_QWEN_GENERATION } from '@/config/apiPaths'
import { LLM_SEARCH_TIMEOUT_MS } from '@/config/timeouts'
import { safeFetch as _safeFetch } from '@/services/shared/safeFetch'

const logger = getLogger()

// ============================================================
// API Key 读取
// ============================================================

/**
 * 获取 Qwen API Key。
 * 优先级：globalThis.__QWEN_API_KEY__ > import.meta.env.VITE_QWEN_API_KEY
 */
function getApiKey(): string | undefined {
  // Node 环境：globalThis 注入
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__QWEN_API_KEY__) {
    return (globalThis as Record<string, unknown>).__QWEN_API_KEY__ as string
  }
  // 浏览器环境：Vite 环境变量
  try {
    const envKey = import.meta.env.VITE_QWEN_API_KEY
    if (envKey && typeof envKey === 'string' && envKey.length > 0) {
      return envKey
    }
  } catch {
    // import.meta.env 在某些环境下不可用
  }
  return undefined
}

/**
 * 判断当前是否为 Node 环境。
 */
function isNodeEnv(): boolean {
  return typeof window === 'undefined'
}

// ============================================================
// LLM 调用核心
// ============================================================

/**
 * 调用 Qwen Chat Completions API。
 * @param systemPrompt - 系统提示词
 * @param userPrompt - 用户提示词
 * @returns LLM 返回的文本内容，失败返回 null
 */
async function callQwen(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    logger.info('[llmSearchAgent] Qwen API Key 未配置，跳过 LLM 搜索')
    return null
  }

  const url = isNodeEnv()
    ? DASHSCOPE_API_URL
    : API_PROXY_QWEN_GENERATION

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Node 环境需要手动添加 Authorization 头；浏览器代理由 Vite 转发
  if (isNodeEnv()) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  // DashScope 原生 API 格式（enable_search 在此格式下生效）
  const body = JSON.stringify({
    model: 'qwen-plus',
    input: {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    parameters: {
      result_format: 'message',
      temperature: 0.1,
      max_tokens: 4096,
      enable_search: true,
    },
  })

  const resp = await _safeFetch(
    url,
    {
      timeoutMs: LLM_SEARCH_TIMEOUT_MS,
      requireOk: true,
      init: { method: 'POST', headers, body },
    },
    '[llmSearchAgent]',
  )

  if (!resp) return null

  try {
    // DashScope 原生 API 响应格式：output.choices[0].message.content
    const json = await resp.json() as {
      output?: { choices?: Array<{ message?: { content?: string } }> }
    }

    const content = json.output?.choices?.[0]?.message?.content
    if (!content) {
      logger.warn('[llmSearchAgent] Qwen API 返回空内容')
      return null
    }

    return content
  } catch (err) {
    logger.warn('[llmSearchAgent] Qwen 响应解析失败', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ============================================================
// JSON 解析辅助
// ============================================================

/**
 * 从 LLM 返回文本中提取 JSON 数组。
 * 兼容 LLM 在 JSON 前后包裹 markdown 代码块的情况。
 */
function extractJsonArray<T>(text: string): T[] {
  try {
    // 先尝试直接解析
    const direct = JSON.parse(text)
    if (Array.isArray(direct)) return direct as T[]
  } catch {
    // 继续尝试提取
  }

  // 尝试匹配 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (Array.isArray(parsed)) return parsed as T[]
    } catch {
      // 继续尝试
    }
  }

  // 尝试匹配 [...] 数组
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) return parsed as T[]
    } catch {
      // 最后尝试失败
    }
  }

  logger.warn('[llmSearchAgent] 无法从 LLM 返回中解析 JSON 数组', {
    textPreview: text.slice(0, 200),
  })
  return []
}

// ============================================================
// Prompt 模板
// ============================================================

/** 公告搜索 System Prompt */
const ANNOUNCEMENT_SYSTEM_PROMPT = `你是一个金融数据搜索助手。你的任务是根据用户查询搜索上市公司公告信息。
你必须严格返回 JSON 数组格式，不要包含任何其他文字说明。
如果找不到相关信息，返回空数组 []。
公告信息应只从 cninfo.com.cn 或 eastmoney.com 搜索。`

/** 新闻搜索 System Prompt */
const NEWS_SYSTEM_PROMPT = `你是一个金融新闻搜索助手。你的任务是根据用户查询搜索上市公司重大新闻。
你必须严格返回 JSON 数组格式，不要包含任何其他文字说明。
如果找不到相关信息，返回空数组 []。`

/** 研报搜索 System Prompt */
const REPORTS_SYSTEM_PROMPT = `你是一个金融研报搜索助手。你的任务是根据用户查询搜索券商研报。
你必须严格返回 JSON 数组格式，不要包含任何其他文字说明。
如果找不到相关信息，返回空数组 []。`

/**
 * 构建公告搜索用户提示词。
 */
function buildAnnouncementPrompt(symbol: string, stockName: string): string {
  const code = symbol.replace(/\.(SH|SZ)$/i, '')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return `请搜索 ${stockName}(${code}) 在 ${year}年${month}月的公告。返回 JSON 数组：[{"title": "公告标题", "date": "YYYY-MM-DD", "type": "董事会/股东会/分红/其他", "url": "公告链接"}]。只从 cninfo.com.cn 或 eastmoney.com 搜索。`
}

/**
 * 构建新闻搜索用户提示词。
 */
function buildNewsPrompt(symbol: string, stockName: string): string {
  const code = symbol.replace(/\.(SH|SZ)$/i, '')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return `请搜索 ${stockName}(${code}) ${year}年${month}月重大新闻。搜索来源包括：东方财富(eastmoney.com)、同花顺(10jqka.com)、雪球(xueqiu.com)、新浪财经(finance.sina.com.cn)、证券时报(stcn.com.cn)等公开财经平台。返回 JSON 数组：[{"title": "新闻标题", "source": "新闻来源", "date": "YYYY-MM-DD", "url": "新闻链接"}]。`
}

/**
 * 构建研报搜索用户提示词。
 */
function buildReportsPrompt(symbol: string, stockName: string): string {
  const code = symbol.replace(/\.(SH|SZ)$/i, '')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return `请搜索 ${stockName}(${code}) ${year}年${month}月券商研报。从东方财富(eastmoney.com)、同花顺(10jqka.com)、新浪财经(finance.sina.com.cn)等公开平台搜索。返回 JSON 数组：[{"title": "研报标题", "institution": "券商机构", "author": "分析师", "rating": "评级(买入/增持/中性/减持/卖出)", "date": "YYYY-MM-DD", "summary": "核心摘要(100字内)"}]。`
}

// ============================================================
// 公开搜索函数
// ============================================================

/** LLM 返回的公告原始结构 */
interface RawAnnouncement {
  title: string
  date: string
  type?: string
  url?: string
}

/** LLM 返回的新闻原始结构 */
interface RawNews {
  title: string
  source?: string
  date: string
  url?: string
}

/** LLM 返回的研报原始结构 */
interface RawReport {
  title: string
  institution?: string
  author?: string
  rating?: string
  date: string
  summary?: string
}

/**
 * 通过 LLM 联网搜索公告。
 * @param symbol - 股票代码（如 000001.SZ）
 * @param stockName - 股票名称（如 平安银行）
 * @returns 公告 NewsItem 数组，失败返回空数组
 */
export async function searchAnnouncements(
  symbol: string,
  stockName: string,
): Promise<NewsItem[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    logger.info('[llmSearchAgent] DeepSeek API Key 未配置，跳过公告搜索')
    return []
  }

  logger.info(`[llmSearchAgent] 开始 LLM 公告搜索: ${symbol} ${stockName}`)

  const userPrompt = buildAnnouncementPrompt(symbol, stockName)
  const text = await callQwen(ANNOUNCEMENT_SYSTEM_PROMPT, userPrompt)

  if (!text) return []

  const rawItems = extractJsonArray<RawAnnouncement>(text)
  if (rawItems.length === 0) return []

  return rawItems.map((item, index) => ({
    id: `llm-ann-${symbol}-${index}`,
    title: item.title || '',
    content: `${item.type || '公告'} - ${item.title || ''}`,
    source: 'Qwen',
    date: item.date || new Date().toISOString().slice(0, 10),
    category: 'announcement' as const,
    url: item.url,
    sentiment: 'neutral' as const,
  }))
}

/**
 * 通过 LLM 联网搜索新闻。
 * @param symbol - 股票代码
 * @param stockName - 股票名称
 * @returns 新闻 NewsItem 数组，失败返回空数组
 */
export async function searchNews(
  symbol: string,
  stockName: string,
): Promise<NewsItem[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    logger.info('[llmSearchAgent] DeepSeek API Key 未配置，跳过新闻搜索')
    return []
  }

  logger.info(`[llmSearchAgent] 开始 LLM 新闻搜索: ${symbol} ${stockName}`)

  const userPrompt = buildNewsPrompt(symbol, stockName)
  const text = await callQwen(NEWS_SYSTEM_PROMPT, userPrompt)

  if (!text) return []

  const rawItems = extractJsonArray<RawNews>(text)
  if (rawItems.length === 0) return []

  return rawItems.map((item, index) => ({
    id: `llm-news-${symbol}-${index}`,
    title: item.title || '',
    content: item.title || '',
    source: item.source || 'DeepSeek-LLM',
    date: item.date || new Date().toISOString().slice(0, 10),
    category: 'hot_news' as const,
    url: item.url,
    sentiment: 'neutral' as const,
  }))
}

/**
 * 通过 LLM 联网搜索研报。
 * @param symbol - 股票代码
 * @param stockName - 股票名称
 * @returns 研报 ResearchReport 数组，失败返回空数组
 */
export async function searchReports(
  symbol: string,
  stockName: string,
): Promise<ResearchReport[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    logger.info('[llmSearchAgent] DeepSeek API Key 未配置，跳过研报搜索')
    return []
  }

  logger.info(`[llmSearchAgent] 开始 LLM 研报搜索: ${symbol} ${stockName}`)

  const userPrompt = buildReportsPrompt(symbol, stockName)
  const text = await callQwen(REPORTS_SYSTEM_PROMPT, userPrompt)

  if (!text) return []

  const rawItems = extractJsonArray<RawReport>(text)
  if (rawItems.length === 0) return []

  return rawItems.map((item, index) => ({
    id: `llm-report-${symbol}-${index}`,
    title: item.title || '',
    author: item.author || '未知',
    institution: item.institution || '未知机构',
    rating: item.rating || '无评级',
    date: item.date || new Date().toISOString().slice(0, 10),
    summary: item.summary || '',
  }))
}

// ============================================================
// 带缓存的便捷包装
// ============================================================

/**
 * 带缓存的 LLM 搜索便捷函数。
 * 自动检查缓存 → 有效则直接返回 → 无效则调用 fetcher 并缓存结果。
 *
 * @param cacheKey - 缓存键（不含日期后缀，会自动追加）
 * @param fetcher - 实际搜索函数
 * @param ttlHours - 缓存有效期（小时）
 * @returns 搜索结果数组
 */
export async function getCachedOrSearch<T>(
  cacheKey: string,
  fetcher: () => Promise<T[]>,
  ttlHours: number,
): Promise<T[]> {
  // 先查缓存
  if (check(cacheKey, ttlHours)) {
    const cached = get<T[]>(cacheKey)
    if (cached && Array.isArray(cached)) {
      logger.info(`[llmSearchAgent] 命中缓存: ${cacheKey}`)
      return cached
    }
  }

  // 缓存未命中，调用 fetcher
  const data = await fetcher()

  // 写入缓存
  if (data.length > 0) {
    set(cacheKey, data, ttlHours)
  }

  return data
}
