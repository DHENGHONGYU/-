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
import type { AnalysisConclusionOutput } from '@/services/skills'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { Stock, V6Score, NewsArticle } from '@/data/types'
import type {
  AnalysisRequest,
  AnalysisResult,
  AnalysisRunResult,
  AnalysisConclusion,
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
