/**
 * @fileoverview AnalysisOrchestrator — Route A 核心编排服务
 *
 * 6 步管线：gatherExternal → gatherInternal → callConclusionSkill → validateAndMaybeRollback → persistResult
 *
 * 分层合规：services → core/data/config/lib（白名单），不引 store。
 * 持久化：EnvelopeFactory.create + dataBridge.forward → IndexedDB analysisResults store。
 * 反馈回路：复用 feedbackOrchestrator.checkAndTrigger，不新建回路。
 *
 * @module services/analysis/analysisOrchestrator
 * @created 2026-07-13 B1 阶段
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { feedbackOrchestrator } from '@/core/feedbackOrchestrator'
import { getNewsBySymbol } from '@/services/news/newsService'
import { skillRegistry, analysisConclusionSkill } from '@/services/skills'
import { chat as llmChat } from '@/services/llm/llmClient'
import type { AnalysisConclusionOutput } from '@/services/skills'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { Stock, V6Score, NewsArticle } from '@/data/types'
import type {
  AnalysisRequest,
  AnalysisResult,
  AnalysisRunResult,
  AnalysisConclusion,
  EvidenceChain,
  EvidenceItem,
  ExternalNewsSnapshot,
  FactorExecutionStatus,
  FeedbackLoopResult,
  InternalDataSnapshot,
  ReasonablenessGate,
} from '@/types/modules/analysisOrchestrator.types'
import { ANALYSIS_RESULT_VERSION } from '@/types/modules/analysisOrchestrator.types'

import { lightArchiveCheck } from '@/services/lifecycle/analysisResultLifecycle'

const logger = getLogger()

// Batch A: 注册分析结论 SKILL
skillRegistry.register(analysisConclusionSkill)

const DEFAULT_K = 2
const DEFAULT_COMPLETENESS_THRESHOLD = 80
const V6_LAYER_COUNT = 11

async function gatherExternal(symbol: string): Promise<ExternalNewsSnapshot> {
  const fetchedAt = Date.now()
  try {
    const result = await getNewsBySymbol(symbol)
    const articles = result.success ? result.data ?? [] : []
    const top = articles.slice(0, 5).map((a: NewsArticle) => ({
      title: a.title ?? '',
      summary: a.content.slice(0, 200) ?? a.title ?? '',
      sentiment: a.sentiment,
    }))
    return { symbol, articleCount: articles.length, topArticles: top, fetchedAt }
  } catch (err) {
    logger.warn(`[AnalysisOrchestrator] gatherExternal failed: ${symbol}`, { error: err })
    return { symbol, articleCount: 0, topArticles: [], fetchedAt }
  }
}

async function gatherInternal(
  symbol: string,
): Promise<{ snapshot: InternalDataSnapshot; v6Score: V6Score | undefined; stock: Stock | undefined }> {
  const fetchedAt = Date.now()

  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: symbol,
    source: MODULE_ID.analyzer,
  })
  const stock = stockResult.success ? stockResult.data : undefined

  const scoreResult = await dataBridge.query<V6Score>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.v6Scores,
    key: symbol,
    source: MODULE_ID.analyzer,
  })
  const v6Score = scoreResult.success ? scoreResult.data : undefined

  const snapshot: InternalDataSnapshot = {
    symbol,
    stockName: stock?.name,
    v6Score: v6Score?.score,
    v6Rating: v6Score?.rating,
    fetchedAt,
  }

  return { snapshot, v6Score, stock }
}

async function callConclusionSkill(
  external: ExternalNewsSnapshot,
  internal: InternalDataSnapshot,
): Promise<{
  conclusion: AnalysisConclusion | undefined
  rawText: string
  model: string
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  try {
    const skillResult = await skillRegistry.execute<AnalysisConclusionOutput>('analysis-conclusion', {
      symbol: internal.symbol,
      stockName: internal.stockName,
      params: {
        v6Score: internal.v6Score,
        v6Rating: internal.v6Rating,
        newsTitles: external.topArticles.map((a) => a.title),
      },
    })

    if (skillResult.status !== 'success' || !skillResult.data) {
      logger.warn(`[AnalysisOrchestrator] conclusion skill failed`, { error: skillResult.error })
      return {
        conclusion: undefined,
        rawText: skillResult.rawText ?? '',
        model: skillResult.meta.model ?? 'error',
        tokenUsage: skillResult.meta.tokenUsage,
      }
    }

    const data = skillResult.data
    const conclusion: AnalysisConclusion = {
      rating: data.rating,
      summary: data.summary,
      keyRisks: data.keyRisks,
      opportunities: data.opportunities,
      consistentWithV6: data.consistentWithV6 ?? data.rating === internal.v6Rating,
      confidence: data.confidence,
    }

    return {
      conclusion,
      rawText: skillResult.rawText ?? '',
      model: skillResult.meta.model ?? 'unknown',
      tokenUsage: skillResult.meta.tokenUsage,
    }
  } catch (err) {
    logger.error(`[AnalysisOrchestrator] callConclusionSkill failed`, { error: err })
    return { conclusion: undefined, rawText: '', model: 'error' }
  }
}

/**
 * enrichEvidenceChain —— P0-2: 为分析结论补充结构化证据链
 *
 * 基于外部资讯快照和内部数据快照，通过 LLM 为每个核心结论维度
 * （评级 / 风险 / 机会）生成结构化的证据引用，确保结论有据可查。
 *
 * 降级策略：LLM 调用失败时自动回退到基于规则的静态证据生成，
 * 不阻断主流程，仅记录 warn 日志。
 */
async function enrichEvidenceChain(
  conclusion: AnalysisConclusion | undefined,
  external: ExternalNewsSnapshot,
  internal: InternalDataSnapshot,
  v6Score: V6Score | undefined,
): Promise<EvidenceChain | undefined> {
  if (!conclusion) return undefined

  try {
    const newsContext = external.topArticles
      .map((a) => `[${a.sentiment ?? 'neutral'}] ${a.title}: ${a.summary.slice(0, 100)}`)
      .join('\n')

    const systemPrompt = `你是一个金融分析证据链生成器。请基于给定数据为投资分析结论生成结构化证据。
每个证据项需包含：维度(rating/risk/opportunity)、摘要、来源、关键数值、强度评分(1-5)。
输出严格遵循 JSON 格式，不要添加任何额外文本。`

    const userPrompt = `请为以下分析结论生成证据链：

【结论评级】${conclusion.rating} (一致性: ${conclusion.consistentWithV6 ? '与V6一致' : '与V6不一致'})
【结论摘要】${conclusion.summary}
【关键风险】${conclusion.keyRisks.map((r, i) => `${i + 1}. ${r}`).join('\n')}
【机会】${conclusion.opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n')}

【V6评分】${v6Score?.score ?? 'N/A'} (评级: ${v6Score?.rating ?? 'N/A'})
【V6因子数据】${v6Score?.factors ? JSON.stringify(v6Score.factors).slice(0, 500) : 'N/A'}
【资讯上下文】
${newsContext || '暂无资讯'}
【数据快照】${internal.symbol} ${internal.stockName ?? ''} V6评分=${internal.v6Score ?? 'N/A'}

请生成 JSON 格式的证据链，格式如下：
{
  "items": [
    {
      "dimension": "rating",
      "summary": "一句话证据摘要",
      "source": "数据来源（如V6引擎/新闻标题/财报）",
      "metricValue": "关键数值",
      "strength": 4
    }
  ]
}

要求：
1. 至少为每个维度(rating/risk/opportunity)生成1-3条证据
2. 证据强度根据数据质量和时效性评分(1-5)
3. 摘要必须具体，包含数据点，不要泛泛而谈
4. 仅输出 JSON，不要其他内容`

    const response = await llmChat<{ items: EvidenceItem[] }>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 2000 },
    )

    const parsed = response.parsed
    if (parsed?.items && parsed.items.length > 0) {
      const now = Date.now()
      const items = parsed.items.map((item): EvidenceItem => ({
        dimension: item.dimension,
        summary: item.summary,
        source: item.source,
        timestamp: now,
        metricValue: item.metricValue,
        strength: Math.max(1, Math.min(5, item.strength ?? 3)),
      }))

      const dimensionsCovered = new Set(items.map((i) => i.dimension))
      const coverage = dimensionsCovered.size / 3
      const avgStrength = items.reduce((sum, i) => sum + i.strength, 0) / items.length
      const confidence = Math.min(1, coverage * 0.5 + (avgStrength / 5) * 0.5)

      const chain: EvidenceChain = {
        items,
        coverage,
        confidence,
        generatedAt: now,
        model: response.model ?? 'unknown',
      }

      logger.info(
        `[AnalysisOrchestrator] enrichEvidenceChain: ${internal.symbol} ` +
        `items=${items.length} coverage=${coverage.toFixed(2)} confidence=${confidence.toFixed(2)}`,
      )
      return chain
    }

    logger.warn(`[AnalysisOrchestrator] enrichEvidenceChain LLM 返回空结果，降级到静态证据`)
  } catch (err) {
    logger.warn(`[AnalysisOrchestrator] enrichEvidenceChain LLM 调用失败，降级到静态证据`, { error: err })
  }

  // 降级策略：基于规则生成静态证据链
  const fallbackItems = buildFallbackEvidence(conclusion, external, v6Score)
  if (fallbackItems.length === 0) return undefined

  const now = Date.now()
  const dimensionsCovered = new Set(fallbackItems.map((i) => i.dimension))
  const chain: EvidenceChain = {
    items: fallbackItems,
    coverage: dimensionsCovered.size / 3,
    confidence: 0.4,
    generatedAt: now,
    model: 'fallback',
  }

  logger.info(
    `[AnalysisOrchestrator] enrichEvidenceChain fallback: ${internal.symbol} ` +
    `items=${fallbackItems.length}`,
  )
  return chain
}

/**
 * 基于规则的静态证据生成（LLM 降级方案）
 */
function buildFallbackEvidence(
  conclusion: AnalysisConclusion,
  external: ExternalNewsSnapshot,
  v6Score: V6Score | undefined,
): EvidenceItem[] {
  const items: EvidenceItem[] = []

  if (v6Score) {
    items.push({
      dimension: 'rating',
      summary: `V6引擎评分 ${v6Score.score}，评级 ${v6Score.rating ?? 'N/A'}`,
      source: 'V6引擎',
      timestamp: v6Score.calculatedAt ?? Date.now(),
      metricValue: String(v6Score.score),
      strength: 4,
    })
  }

  if (conclusion.keyRisks.length > 0) {
    const topNews = external.topArticles.find((a) => a.sentiment === 'negative')
    const title = topNews?.title ?? ''
    const firstRisk = conclusion.keyRisks[0]!
    items.push({
      dimension: 'risk',
      summary: firstRisk,
      source: topNews ? `资讯: ${title.slice(0, 30)}` : '分析结论',
      timestamp: external.fetchedAt,
      strength: topNews ? 3 : 2,
    })
  }

  if (conclusion.opportunities.length > 0) {
    const topNews = external.topArticles.find((a) => a.sentiment === 'positive')
    const title = topNews?.title ?? ''
    const firstOpp = conclusion.opportunities[0]!
    items.push({
      dimension: 'opportunity',
      summary: firstOpp,
      source: topNews ? `资讯: ${title.slice(0, 30)}` : '分析结论',
      timestamp: external.fetchedAt,
      strength: topNews ? 3 : 2,
    })
  }

  return items
}

async function validateAndMaybeRollback(
  symbol: string,
  v6Score: V6Score | undefined,
  conclusion: AnalysisConclusion | undefined,
  enableFeedback: boolean,
): Promise<{ reasonableness: ReasonablenessGate; feedbackLoop: FeedbackLoopResult }> {
  const factorCount = v6Score?.factors ? Object.keys(v6Score.factors).length : 0
  const completeness = factorCount > 0 ? Math.min(100, Math.round((factorCount / V6_LAYER_COUNT) * 100)) : 0
  const missingLayers = completeness < 100 ? [`缺失因子: ${V6_LAYER_COUNT - factorCount}/${V6_LAYER_COUNT}`] : []

  let feedbackLoop: FeedbackLoopResult = {
    triggered: false,
    issueCount: 0,
    message: '反馈循环未启用',
  }

  if (enableFeedback) {
    try {
      const feedbackResult = await feedbackOrchestrator.checkAndTrigger(symbol)
      feedbackLoop = {
        triggered: true,
        issueCount: feedbackResult.issues.length,
        message: feedbackResult.message,
      }
      // 反馈可能触发重采集/重评分，清除读缓存以确保下次 gatherInternal 读到新数据
      dataBridge.invalidateCache(STORE_NAME.v6Scores)
    } catch (err) {
      logger.warn(`[AnalysisOrchestrator] feedbackOrchestrator.checkAndTrigger 异常，已跳过`, { error: err })
      feedbackLoop = {
        triggered: false,
        issueCount: 0,
        message: '反馈检查异常，已跳过',
      }
    }
  }

  const reasonableness: ReasonablenessGate = {
    passed: (conclusion?.consistentWithV6 === true) && feedbackLoop.issueCount === 0,
    threshold: DEFAULT_COMPLETENESS_THRESHOLD,
    completeness,
    missingLayers,
    notes: feedbackLoop.message,
  }

  return { reasonableness, feedbackLoop }
}

function buildFactorExecution(v6Score: V6Score | undefined): FactorExecutionStatus[] {
  if (!v6Score?.factors) return []
  return Object.entries(v6Score.factors).map(([factorId, value]) => ({
    factorId,
    factorName: factorId,
    executed: true,
    value,
  }))
}

async function persistResult(result: AnalysisResult): Promise<void> {
  try {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveAnalysisResult,
        traceId: result.docId,
      },
      result,
    )
    await dataBridge.forward(envelope)
    logger.info(`[AnalysisOrchestrator] persistResult: ${result.symbol} → ${result.docId}`)

    // P2-3: 轻量级归档检查（不阻塞主流程）
    lightArchiveCheck(20).catch((err) => {
      logger.warn('[AnalysisOrchestrator] lightArchiveCheck 异常，已跳过', { error: err })
    })
  } catch (err) {
    logger.error(`[AnalysisOrchestrator] persistResult failed: ${result.symbol}`, { error: err })
  }
}

/**
 * runAnalysis
 * @param req
 * @returns Promise<AnalysisRunResult>
 */
export async function runAnalysis(req: AnalysisRequest): Promise<AnalysisRunResult> {
  const symbol = req.symbol
  const maxReAnalysis = req.maxReAnalysis ?? DEFAULT_K
  const enableFeedback = req.enableFeedback ?? true

  logger.info(`[AnalysisOrchestrator] runAnalysis: ${symbol} (K=${maxReAnalysis})`)

  const external = await gatherExternal(symbol)

  let lastConclusion: AnalysisConclusion | undefined
  let lastRawText = ''
  let lastModel = ''
  let lastV6Score: V6Score | undefined
  let lastInternal: InternalDataSnapshot | undefined
  let lastReasonableness: ReasonablenessGate | undefined
  let lastFeedbackLoop: FeedbackLoopResult | undefined

  let lastTokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

  for (let attempt = 0; attempt <= maxReAnalysis; attempt++) {
    const internalResult = await gatherInternal(symbol)
    lastInternal = internalResult.snapshot
    lastV6Score = internalResult.v6Score

    const llmResult = await callConclusionSkill(external, lastInternal)
    lastConclusion = llmResult.conclusion
    lastRawText = llmResult.rawText
    lastModel = llmResult.model
    if (llmResult.tokenUsage) {
      lastTokenUsage = llmResult.tokenUsage
    }

    // P0-2: 证据链增强 —— 在结论生成后、校验前补充结构化依据
    if (lastConclusion) {
      const evidenceChain = await enrichEvidenceChain(
        lastConclusion,
        external,
        lastInternal,
        lastV6Score,
      )
      if (evidenceChain) {
        lastConclusion.evidenceChain = evidenceChain
        logger.info(
          `[AnalysisOrchestrator] ${symbol} attempt ${attempt}: evidence chain attached ` +
          `(items=${evidenceChain.items.length}, confidence=${evidenceChain.confidence.toFixed(2)})`,
        )
      }
    }

    const validation = await validateAndMaybeRollback(symbol, lastV6Score, lastConclusion, enableFeedback)
    lastReasonableness = validation.reasonableness
    lastFeedbackLoop = validation.feedbackLoop

    if (lastReasonableness.passed) {
      logger.info(`[AnalysisOrchestrator] ${symbol} attempt ${attempt}: PASSED`)
      break
    }

    logger.warn(`[AnalysisOrchestrator] ${symbol} attempt ${attempt}: NOT PASSED, retrying...`)
  }

  const result: AnalysisResult = {
    docId: `analysis-${symbol}-${Date.now()}`,
    symbol,
    version: ANALYSIS_RESULT_VERSION,
    createdAt: Date.now(),
    external,
    internal: lastInternal!,
    conclusion: lastConclusion,
    rawLlmText: lastRawText,
    factorExecution: buildFactorExecution(lastV6Score),
    reasonableness: lastReasonableness!,
    feedbackLoop: lastFeedbackLoop!,
    model: lastModel,
    tokenUsage: lastTokenUsage,
    lineage: {
      v6ScoreVersion: lastV6Score?.algorithmVersion ?? 'unknown',
      dataVersions: {
        stockSnapshotAt: lastInternal?.fetchedAt ?? Date.now(),
        v6ScoreSnapshotAt: lastV6Score?.calculatedAt ?? Date.now(),
        newsFetchedAt: external.fetchedAt,
      },
      newsIds: external.topArticles.map((a) => a.title).filter(Boolean),
    },
  }

  await persistResult(result)

  return { success: true, data: result }
}

/**
 * runAnalysisBatch
 */
export async function runAnalysisBatch(
  symbols: string[],
  options?: Pick<AnalysisRequest, 'enableFeedback' | 'maxReAnalysis'>,
): Promise<Record<string, AnalysisRunResult>> {
  const entries = await Promise.allSettled(
    symbols.map((s) => runAnalysis({ symbol: s, ...options })),
  )

  const results: Record<string, AnalysisRunResult> = {}
  entries.forEach((entry, i) => {
    const symbol = symbols[i]
    if (!symbol) return
    if (entry.status === 'fulfilled') {
      results[symbol] = entry.value
    } else {
      results[symbol] = { success: false, error: String(entry.reason) }
    }
  })

  return results
}
