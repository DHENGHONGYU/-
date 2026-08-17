/**
 * @module kimiAIService
 * @description KIMI AI 增强采集服务 — 配额管理 + API 调用 + 结果解析。
 *
 * 依托项目已有的 llmClient 与 llmConfig 基础设施，基于 KIMI 月度会员
 * 100 万 tokens/月预算，实现每日 30 次调用的智能配额调度。
 *
 * 四大场景:
 *   1. 新闻摘要 (Dim 05) — 批量新闻情感分析 + 关键事件提取
 *   2. 研报解读 (Dim 08) — 多份研报共识评级 + 论据提炼
 *   3. 异常检测 — 跨维度数据一致性校验
 *   4. 日报生成 — 每日采集数据自然语言总结
 *
 * 配额策略:
 *   - 每日 30 次调用硬上限 (localStorage 持久化)
 *   - 优先级: 新闻摘要 > 研报解读 > 异常检测 > 日报
 *   - 同维度批量合并: 5-10 条新闻合并为一次调用
 *   - 重试: 最多 2 次，指数退避 (500ms → 1000ms)
 *   - 熔断: 连续 3 次失败暂停该维度 5 分钟
 *
 * 使用方式:
 *   import { kimiAIService } from '@/services/data-collector/kimiAIService'
 *   const summary = await kimiAIService.summarizeNews('600519', '贵州茅台', newsList)
 *
 * @doc [V9-DOC-DATA-051]
 */

import { getLogger } from '@/lib/logger'
import { getDefaultLlmConfig, getLlmApiKeyAsync, getPresetById, isLlmApiKeyConfigured } from '@/config/llmConfig'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { KIMI_CONFIG, KIMI_DAILY_QUOTA, KIMI_TASK_PRIORITY } from './kimiAIStrategy'

const logger = getLogger()

// ============================================================
// 配额管理
// ============================================================

const QUOTA_STORAGE_KEY = 'kimi_daily_quota'

interface DailyQuota {
  date: string       // YYYY-MM-DD
  used: number       // 已用次数
  tasks: Record<string, number>  // 各任务已用次数
  tokensUsed: number // 已用 tokens
  lastResetAt: number
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadQuota(): DailyQuota {
  try {
    const raw = localStorage.getItem(`app:${QUOTA_STORAGE_KEY}`)
    if (!raw) return createNewQuota()
    const parsed = JSON.parse(raw) as DailyQuota
    // 日期过期则重置
    if (parsed.date !== getToday()) return createNewQuota()
    return parsed
  } catch {
    return createNewQuota()
  }
}

function createNewQuota(): DailyQuota {
  return {
    date: getToday(),
    used: 0,
    tasks: {
      newsSummary: 0,
      researchDigest: 0,
      anomalyDetection: 0,
      dailyReport: 0,
    },
    tokensUsed: 0,
    lastResetAt: Date.now(),
  }
}

function saveQuota(quota: DailyQuota): void {
  try {
    localStorage.setItem(`app:${QUOTA_STORAGE_KEY}`, JSON.stringify(quota))
  } catch { /* silent */ }
}

// ============================================================
// 熔断器
// ============================================================

interface CircuitBreaker {
  failures: number
  lastFailureAt: number
  openUntil: number
}

const circuitBreakers: Record<string, CircuitBreaker> = {}

const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000 // 5 分钟

function isCircuitOpen(taskName: string): boolean {
  const cb = circuitBreakers[taskName]
  if (!cb) return false
  if (cb.openUntil > Date.now()) return true
  // 冷却期过了，重置
  delete circuitBreakers[taskName]
  return false
}

function recordFailure(taskName: string): void {
  const cb = circuitBreakers[taskName] ?? { failures: 0, lastFailureAt: 0, openUntil: 0 }
  cb.failures++
  cb.lastFailureAt = Date.now()
  if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS
    logger.warn(`[kimiAIService] 熔断器触发: ${taskName}，冷却至 ${new Date(cb.openUntil).toLocaleTimeString()}`)
  }
  circuitBreakers[taskName] = cb
}

function recordSuccess(taskName: string): void {
  delete circuitBreakers[taskName]
}

// ============================================================
// 配额检查与消耗
// ============================================================

interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  remaining: number
}

function checkQuota(taskName: string): QuotaCheckResult {
  const quota = loadQuota()
  const remaining = KIMI_DAILY_QUOTA.total - quota.used

  if (remaining <= 0) {
    return { allowed: false, reason: '今日配额已用完 (30/30)', remaining: 0 }
  }

  if (isCircuitOpen(taskName)) {
    return { allowed: false, reason: `任务 ${taskName} 已熔断`, remaining }
  }

  return { allowed: true, remaining }
}

function consumeQuota(taskName: string, tokensUsed: number): void {
  const quota = loadQuota()
  quota.used++
  quota.tasks[taskName] = (quota.tasks[taskName] ?? 0) + 1
  quota.tokensUsed += tokensUsed
  saveQuota(quota)
}

// ============================================================
// API 调用核心
// ============================================================

/** 直接调用 KIMI API (OpenAI 兼容接口) */
async function callKimiAPI(
  messages: LlmMessage[],
  _taskName: string,
): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = await getLlmApiKeyAsync()
  const defaultConfig = getDefaultLlmConfig()

  // 使用 KIMI 预设配置
  const kimiPreset = getPresetById('kimi')
  const baseURL = kimiPreset?.baseURL ?? 'https://api.moonshot.cn'
  const model = 'kimi-k2.7-code' // 月度会员推荐模型

  const finalApiKey = apiKey || defaultConfig.apiKey
  if (!finalApiKey) {
    throw new Error('KIMI API Key 未配置，请在 AI 配置页面设置 KIMI Key')
  }

  const endpoint = `${baseURL}/v1/chat/completions`
  const body = {
    model,
    messages,
    max_tokens: KIMI_CONFIG.maxTokensPerCall,
    temperature: 0.3, // 金融分析用低温度保证一致性
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${finalApiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(KIMI_CONFIG.timeoutMs),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`KIMI API 返回 ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content ?? ''
  const tokensUsed = json.usage?.total_tokens ?? 0

  return { content, tokensUsed }
}

// ============================================================
// 重试逻辑
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  taskName: string,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= KIMI_CONFIG.maxRetries; attempt++) {
    try {
      const result = await fn()
      recordSuccess(taskName)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(`[kimiAIService] ${taskName} 第${attempt + 1}次尝试失败: ${lastError.message}`)

      if (attempt < KIMI_CONFIG.maxRetries) {
        const delay = KIMI_CONFIG.maxRetries > 0
          ? 500 * Math.pow(2, attempt)
          : 0
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }

  recordFailure(taskName)
  throw lastError
}

// ============================================================
// 场景 1: 新闻摘要 (Dim 05)
// ============================================================

export interface NewsItem {
  title: string
  summary?: string
  source: string
  publishedAt: string
}

export interface NewsSummaryResult {
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  sentimentScore: number
  keyEvents: string[]
  marketImpact: 'low' | 'medium' | 'high'
  relevanceScore: number
}

/**
 * 批量新闻摘要 + 情感分析。
 * 5-10 条新闻合并为一次 API 调用，节省 token。
 */
export async function summarizeNews(
  symbol: string,
  symbolName: string,
  newsList: NewsItem[],
): Promise<NewsSummaryResult | null> {
  const taskName = 'newsSummary'
  const check = checkQuota(taskName)
  if (!check.allowed) {
    logger.warn(`[kimiAIService] ${check.reason}`)
    return null
  }

  // 批量合并：最多 10 条新闻一次调用
  const batch = newsList.slice(0, 10)
  const newsText = batch
    .map((n, i) => `${i + 1}. [${n.publishedAt}] ${n.title} (来源: ${n.source})${n.summary ? ' — ' + n.summary : ''}`)
    .join('\n')

  const systemPrompt = `你是一个专业的金融新闻分析师。请对以下股票新闻进行摘要和情感分析。输出严格 JSON 格式。`
  const userPrompt = `股票: ${symbolName}(${symbol})\n新闻列表:\n${newsText}\n\n请输出 JSON:\n{\n  "summary": "一句话总结这些新闻的核心主题",\n  "sentiment": "positive/neutral/negative",\n  "sentimentScore": 0.0-1.0,\n  "keyEvents": ["事件1", "事件2"],\n  "marketImpact": "low/medium/high",\n  "relevanceScore": 0.0-1.0\n}`

  try {
    const { content, tokensUsed } = await withRetry(
      () => callKimiAPI(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        taskName,
      ),
      taskName,
    )

    consumeQuota(taskName, tokensUsed)

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.warn('[kimiAIService] 新闻摘要返回非 JSON 格式')
      return null
    }

    const parsed = JSON.parse(jsonMatch[0]) as NewsSummaryResult
    logger.info(`[kimiAIService] 新闻摘要完成: ${symbol} sentiment=${parsed.sentiment} tokens=${tokensUsed} remaining=${check.remaining - 1}`)
    return parsed
  } catch (err) {
    logger.error(`[kimiAIService] 新闻摘要失败: ${err}`)
    return null
  }
}

// ============================================================
// 场景 2: 研报解读 (Dim 08)
// ============================================================

export interface ResearchReport {
  title: string
  rating?: string
  targetPrice?: number
  analyst?: string
  content?: string
  date: string
}

export interface ResearchDigestResult {
  consensusRating: string
  avgTargetPrice: number | null
  keyArguments: string[]
  riskFactors: string[]
  catalystEvents: string[]
}

/**
 * 多份研报解读 — 提取共识评级、关键论据、风险因素。
 */
export async function digestResearch(
  symbol: string,
  symbolName: string,
  reports: ResearchReport[],
): Promise<ResearchDigestResult | null> {
  const taskName = 'researchDigest'
  const check = checkQuota(taskName)
  if (!check.allowed) {
    logger.warn(`[kimiAIService] ${check.reason}`)
    return null
  }

  const batch = reports.slice(0, 8)
  const reportText = batch
    .map((r, i) => `${i + 1}. [${r.date}] ${r.title} (${r.analyst ?? '未知机构'}) — 评级: ${r.rating ?? '未提及'}, 目标价: ${r.targetPrice ?? '未提及'}${r.content ? '。摘要: ' + r.content.slice(0, 200) : ''}`)
    .join('\n')

  const systemPrompt = `你是一个专业的证券分析师。请对以下研报进行摘要分析。输出严格 JSON 格式。`
  const userPrompt = `股票: ${symbolName}(${symbol})\n研报列表:\n${reportText}\n\n请输出 JSON:\n{\n  "consensusRating": "买入/增持/中性/减持/卖出",\n  "avgTargetPrice": 数字或null,\n  "keyArguments": ["论点1", "论点2"],\n  "riskFactors": ["风险1", "风险2"],\n  "catalystEvents": ["催化剂1"]\n}`

  try {
    const { content, tokensUsed } = await withRetry(
      () => callKimiAPI(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        taskName,
      ),
      taskName,
    )

    consumeQuota(taskName, tokensUsed)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as ResearchDigestResult
    logger.info(`[kimiAIService] 研报解读完成: ${symbol} consensus=${parsed.consensusRating} remaining=${check.remaining - 1}`)
    return parsed
  } catch (err) {
    logger.error(`[kimiAIService] 研报解读失败: ${err}`)
    return null
  }
}

// ============================================================
// 场景 3: 异常检测 (跨维度)
// ============================================================

export interface DataSnapshot {
  dimensionCode: string
  dimensionName: string
  values: Record<string, unknown>
}

export interface AnomalyResult {
  anomalies: Array<{
    dimension: string
    field: string
    description: string
    severity: 'high' | 'medium' | 'low'
  }>
  confidence: number
  recommendation: string
}

/**
 * 跨维度数据一致性校验。
 * 例如: 财务数据利润大幅增长但估值不变 → 异常。
 */
export async function detectAnomalies(
  symbol: string,
  symbolName: string,
  snapshots: DataSnapshot[],
): Promise<AnomalyResult | null> {
  const taskName = 'anomalyDetection'
  const check = checkQuota(taskName)
  if (!check.allowed) {
    logger.warn(`[kimiAIService] ${check.reason}`)
    return null
  }

  const snapshotText = snapshots
    .map((s) => `[${s.dimensionCode} ${s.dimensionName}] ${JSON.stringify(s.values)}`)
    .join('\n')

  const systemPrompt = `你是一个金融数据质量分析师。请检查以下跨维度数据是否存在逻辑矛盾或异常。输出严格 JSON 格式。`
  const userPrompt = `股票: ${symbolName}(${symbol})\n数据快照:\n${snapshotText}\n\n请输出 JSON:\n{\n  "anomalies": [{"dimension": "维度代码", "field": "字段名", "description": "异常描述", "severity": "high/medium/low"}],\n  "confidence": 0.0-1.0,\n  "recommendation": "重新采集/忽略/人工复核"\n}`

  try {
    const { content, tokensUsed } = await withRetry(
      () => callKimiAPI(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        taskName,
      ),
      taskName,
    )

    consumeQuota(taskName, tokensUsed)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as AnomalyResult
    if (parsed.anomalies.length > 0) {
      logger.warn(`[kimiAIService] 异常检测: ${symbol} 发现 ${parsed.anomalies.length} 处异常, confidence=${parsed.confidence}`)
    }
    return parsed
  } catch (err) {
    logger.error(`[kimiAIService] 异常检测失败: ${err}`)
    return null
  }
}

// ============================================================
// 场景 4: 日报生成
// ============================================================

export interface DailyReportInput {
  symbol: string
  symbolName: string
  date: string
  dimensions: Array<{
    code: string
    name: string
    summary: string
  }>
}

export interface DailyReportResult {
  title: string
  summary: string
  keyChanges: Array<{
    dimension: string
    change: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
  attentionPoints: string[]
  nextActions: string[]
}

/**
 * 生成每日采集数据自然语言总结报告。
 * 批量采集 14 维度后调用，生成可读报告。
 */
export async function generateDailyReport(
  input: DailyReportInput,
): Promise<DailyReportResult | null> {
  const taskName = 'dailyReport'
  const check = checkQuota(taskName)
  if (!check.allowed) {
    logger.warn(`[kimiAIService] ${check.reason}`)
    return null
  }

  const dimSummary = input.dimensions
    .map((d) => `[${d.code} ${d.name}] ${d.summary}`)
    .join('\n')

  const systemPrompt = `你是一个AI投研助手。基于以下采集数据，生成今日总结报告。输出严格 JSON 格式。`
  const userPrompt = `股票: ${input.symbolName}(${input.symbol})\n采集日期: ${input.date}\n数据摘要:\n${dimSummary}\n\n请输出 JSON:\n{\n  "title": "日报标题",\n  "summary": "2-3句话核心总结",\n  "keyChanges": [{"dimension": "维度", "change": "变化描述", "impact": "positive/negative/neutral"}],\n  "attentionPoints": ["需要关注的点"],\n  "nextActions": ["建议后续行动"]\n}`

  try {
    const { content, tokensUsed } = await withRetry(
      () => callKimiAPI(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        taskName,
      ),
      taskName,
    )

    consumeQuota(taskName, tokensUsed)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as DailyReportResult
    logger.info(`[kimiAIService] 日报生成完成: ${input.symbol} remaining=${check.remaining - 1}`)
    return parsed
  } catch (err) {
    logger.error(`[kimiAIService] 日报生成失败: ${err}`)
    return null
  }
}

// ============================================================
// 配额查询
// ============================================================

export interface QuotaStatus {
  date: string
  used: number
  total: number
  remaining: number
  tasks: Record<string, number>
  tokensUsed: number
  isConfigured: boolean
}

export function getQuotaStatus(): QuotaStatus {
  const quota = loadQuota()
  return {
    date: quota.date,
    used: quota.used,
    total: KIMI_DAILY_QUOTA.total,
    remaining: KIMI_DAILY_QUOTA.total - quota.used,
    tasks: { ...quota.tasks },
    tokensUsed: quota.tokensUsed,
    isConfigured: isLlmApiKeyConfigured(),
  }
}

// ============================================================
// 默认导出
// ============================================================

export const kimiAIService = {
  summarizeNews,
  digestResearch,
  detectAnomalies,
  generateDailyReport,
  getQuotaStatus,
  KIMI_DAILY_QUOTA,
  KIMI_TASK_PRIORITY,
}

export default kimiAIService