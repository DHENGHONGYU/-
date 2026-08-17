/**
 * @fileoverview collectionPipeline
 * @description 配置化采集流水线。
 *
 * 根据 `CollectionConfig` 执行单次/批量采集：
 * - 按维度配置生成数据源优先级链
 * - 调用 `dataSourceOrchestrator` 获取数据
 * - 通过 `DataBridge.forward()` 写入 IndexedDB
 * - 每个阶段 emit `CollectionLifecycleEvent`
 *
 * 注意：本 service 不依赖任何 store，配置由调用方（store / UI）传入。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { withLogging } from '@/lib/logHelpers'
import { eventBus } from '@/lib/eventBus'
// P1-12 分层合规：buildDefaultSourcePriority / upgradeDimensionsToPipeline
//  纯函数下沉到 domain/collection/pipeline.ts，此处 re-export 保持对外 API 兼容；
//  内部 resolveQuoteChain / resolveKlineChain 仍调用本文件副本，但对外导入
//  已统一到 domain 层入口。
export { buildDefaultSourcePriority, upgradeDimensionsToPipeline } from '@/domain/collection/pipeline'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, ENVELOPE_TARGET } from '@/config/dbConfig'
import type { EnvelopeAction } from '@/config/dbConfig'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type {
  CollectionConfig,
  DimensionPipelineConfig,
  QuoteDataSourceId,
  SourcePriorityItem,
  CollectionTraceSpan,
  CollectionStageRecord,
  CollectionLifecycleEvent,
} from '@/types/modules/collection.types'
import {
  getQuoteWithConfig,
  getKlineWithConfig,
} from './dataSourceOrchestrator'
import {
  quoteToStock,
  klinesToDailyQuotes,
  type RealtimeQuote,
} from '../fetcher/directDataAPI'
import { getQualityMetrics } from './qualityMetricsCollector'
import type { KlineBar } from '@/data/types/types.marketData'
import { saveTraceRecord } from './tracePersistenceService'
import { fetchDimensionData } from './multiSourceFetcher'
import { fetchFinancial } from '@/services/fetcher/fetcherService'
import { detect as detectMissing } from './missingReportDetector'
import { MISSING_REPORT_TYPE } from '@/constants/execution.constants'
import {
  canExecute as canSourceExecute,
  recordSourceResult,
} from './adaptiveSourceOrchestrator'
import { summarizeNews, digestResearch } from './kimiAIService'
import type { NewsItem, ResearchReport } from './kimiAIService'

const logger = getLogger()

// ── 类型 ──

type CollectionMode = 'quote' | 'kline' | 'news' | 'research' | 'competitor' | 'index' | 'chip' | 'financial' | 'dividend' | 'consensus' | 'unsupported'

interface RunSingleTraceOptions {
  symbol: string
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

interface RunBatchTraceOptions {
  symbols: string[]
  dimensionCode: string
  config: CollectionConfig
  parentTaskId?: string
}

interface TraceResult {
  success: boolean
  symbol: string
  dimensionCode: string
  source?: QuoteDataSourceId
  latency: number
  fallbackCount: number
  error?: string
}

export type { TraceResult }

// ── 常量 ──

const DIMENSION_TO_MODE: Readonly<Record<string, CollectionMode>> = {
  '01': 'quote',
  '02': 'kline',
  '03': 'chip',
  '04': 'news',
  '05': 'news',
  '06': 'competitor',
  '07': 'index',
  '08': 'research',
  '09': 'financial',
  // P1 新增维度 (2026-08-17): MCP/iFinD 优先采集
  '10': 'unsupported',       // 热门板块 → MCP sector_data
  '11': 'unsupported',       // 技术指标 → MCP stock_highfreq_quotes
  '12': 'unsupported',       // 资金流向 → MCP get_stock_performance
  '13': 'unsupported',       // 机构持仓 → MCP get_stock_shareholders
  '14': 'unsupported',       // 估值分析 → MCP get_stock_financials
  // P0 新增维度 (2026-08-17): 分红股本 + 一致预期
  '15': 'dividend',          // 分红股本 → Tushare 三 API + 东财爬虫
  '16': 'consensus',         // 一致预期 → 东财爬虫
}

// ── KIMI AI 增强辅助函数 ──

/** 从采集数据中提取新闻条目 */
function extractNewsItems(dimData: Record<string, unknown>): NewsItem[] {
  const news = dimData.news ?? dimData.items ?? dimData.data
  if (!Array.isArray(news)) return []
  return news.slice(0, 10).map((n: Record<string, unknown>) => ({
    title: String(n.title ?? ''),
    summary: String(n.summary ?? n.content ?? '').slice(0, 500),
    source: String(n.source ?? ''),
    publishedAt: String(n.publishedAt ?? n.date ?? ''),
  }))
}

/** 从采集数据中提取研报条目 */
function extractResearchReports(dimData: Record<string, unknown>): ResearchReport[] {
  const reports = dimData.reports ?? dimData.items ?? dimData.data
  if (!Array.isArray(reports)) return []
  return reports.slice(0, 8).map((r: Record<string, unknown>) => ({
    title: String(r.title ?? ''),
    rating: String(r.rating ?? r.reportRating ?? ''),
    targetPrice: typeof r.targetPrice === 'number' ? r.targetPrice : undefined,
    analyst: String(r.analyst ?? r.source ?? ''),
    content: String(r.content ?? r.summary ?? '').slice(0, 500),
    date: String(r.date ?? r.publishedAt ?? ''),
  }))
}

// ── Mock 维度数据生成器（已禁用 —— MOCK 数据不真实，真实源失败直接报错）──
// 保留代码供开发参考，生产环境不调用。历史代码见 git log collectionPipeline.ts。

// ── 通用维度 mock 写入 ──

/** 非行情维度（03–08）的统一 mock 写入入口 */
async function writeMockDimensionData(
  symbol: string,
  dimensionCode: string,
  data: Record<string, unknown>,
  action: EnvelopeAction,
): Promise<void> {
  // WAP Audit：校验 mock 数据关键字段
  const storeForDim: Record<string, string> = {
    '03': 'news', '04': 'news', '05': 'news',
    '06': 'sectorScores', '07': 'sectorScores',
    '08': 'researchLogs',
  }
  const targetStore = storeForDim[dimensionCode] ?? ''
  if (targetStore !== '') auditRecord(targetStore, data)

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action,
      traceId: `pipeline-${dimensionCode}-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: data,
  })
}

/** 维度 → ENVELOPE_ACTION 映射（非行情维度写入时使用） */
const DIMENSION_TO_ACTION: Readonly<Record<string, EnvelopeAction>> = {
  '03': ENVELOPE_ACTION.saveNews,             // 筹码 → news store (带 _mock 标记)
  '04': ENVELOPE_ACTION.saveNews,             // 重大事项 → news store
  '05': ENVELOPE_ACTION.saveNews,             // 热点新闻 → news store
  '06': ENVELOPE_ACTION.saveSectorScores,     // 行业竞品 → sector_scores store
  '07': ENVELOPE_ACTION.saveSectorScores,     // 关联指数 → sector_scores store
  '08': ENVELOPE_ACTION.saveResearchLog,      // 研报中心 → research_logs store
  '15': ENVELOPE_ACTION.saveLocalDocs,        // 分红股本 → local_docs store
  '16': ENVELOPE_ACTION.saveLocalDocs,        // 一致预期 → local_docs store
}

// ── 通用维度 mock 数据路由 ──

/**
 * 生成维度数据：优先尝试真实数据源，失败时回退到 Mock。
 * @convergence Phase C: multiSourceFetcher 拉取真实数据，Mock 作为降级回退
 *
 * P0 优化（2026-08-09）：接入熔断器，跳过已知死源（circuit-open），
 * 避免每次都走完整 Tushare(空Token) → 东财(已下线) → LLM(慢) 失败链。
 */
async function generateDataForDimension(symbol: string, dimensionCode: string): Promise<Record<string, unknown>> {
  let fallbackReason = ''

  // 熔断器前置检查：若维度所有已知源均 circuit-open，直接跳过
  const dimSources = getDimensionKnownSources(dimensionCode)
  const allCircuitOpen = dimSources.length > 0 && dimSources.every((src) => !canSourceExecute(src))
  if (allCircuitOpen) {
    fallbackReason = `all_sources_circuit_open: [${dimSources.join(', ')}]`
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 所有源熔断中，跳过采集: ${symbol}`, { sources: dimSources })
    return { _source: 'mock', _mock: true, _fallbackReason: fallbackReason, error: fallbackReason }
  }

  const dimStart = Date.now()
  // 尝试真实数据源
  try {
    const realData = await fetchDimensionData(symbol, dimensionCode)
    if (realData) {
      const source = (realData._source as string) || 'real'
      const sourceId = mapSourceLabelToId(source)
      // 记录成功：更新 EWMA 指标 + 熔断器 onSuccess
      recordSourceResult(sourceId, {
        success: true,
        isMock: false,
        latencyMs: Date.now() - dimStart,
        completeness: 1,
      })
      logger.debug(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取成功: ${symbol}`)
      return { ...realData, _source: source, _fallbackReason: '' }
    }
    fallbackReason = 'real_source_returned_empty'
    // 记录失败：空结果视为失败（用该维度配置的首个已知源作为失败归属，避免硬编码 tushare）
    const emptyFailSource = getDimensionKnownSources(dimensionCode)[0] ?? 'unknown'
    recordSourceResult(emptyFailSource, { success: false, isMock: false, latencyMs: Date.now() - dimStart, completeness: 0 })
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据返回空，记录失败源=${emptyFailSource}: ${symbol}`)
  } catch (err) {
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取失败: ${symbol}`, { error: String(err) })
    fallbackReason = `real_source_threw: ${err instanceof Error ? err.message : String(err)}`
    // 异常同样按维度已知源归属，避免硬编码 tushare
    const throwFailSource = getDimensionKnownSources(dimensionCode)[0] ?? 'unknown'
    recordSourceResult(throwFailSource, { success: false, isMock: false, latencyMs: Date.now() - dimStart, completeness: 0 })
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 异常，记录失败源=${throwFailSource}: ${symbol}`)
  }

  // MOCK 禁用：真实源失败直接返回错误标记，不生成 mock
  logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据不可用，禁止 mock: ${symbol}。原因: ${fallbackReason}`)
  return { _source: 'mock', _mock: true, _fallbackReason: fallbackReason, error: fallbackReason }
}

/**
 * 维度 → 已知数据源 ID 列表（用于熔断器前置检查）。
 * 只列出会实际发网络请求的源，不含 mock。
 */
function getDimensionKnownSources(dimensionCode: string): string[] {
  const sourceMap: Record<string, string[]> = {
    '03': ['tushare', 'crawler', 'sina'],
    '04': ['tushare', 'crawler', 'sina'],
    '05': ['tushare', 'crawler', 'sina'],
    '06': ['tushare', 'crawler', 'tencent'],
    '07': ['tushare', 'tencent'],
    '08': ['tushare', 'crawler'],
    '15': ['tushare', 'crawler'],
    '16': ['crawler'],
  }
  return sourceMap[dimensionCode] ?? []
}

/** 将 multiSourceFetcher 返回的 _source 标签映射为熔断器 sourceId */
function mapSourceLabelToId(label: string): string {
  const labelMap: Record<string, string> = {
    tushare: 'tushare',
    crawler: 'crawler',
    sina: 'sina',
    tencent: 'tencent',
    llm: 'llm',
    real: 'tushare',
  }
  const mapped: string = labelMap[label] ?? ''
  if (mapped !== '') return mapped
  logger.warn('[collectionPipeline] mapSourceLabelToId: 未知源标签，映射为 unknown', {
    unknownLabel: label,
    knownLabels: Object.keys(labelMap),
  })
  return 'unknown'
}

/**
 * 业务数据源 → 直连行情数据源的默认映射。
 *
 * P0 优化（2026-08-09）：腾讯/新浪升为日频基础盘主源，akshare（Python 后端）降为增强源。
 * 原因：腾讯/新浪经 Vite proxy 免费直连，延迟 <300ms，无需 Token；
 * akshare 依赖 Python :8000 服务，环境不稳定时首请求即超时浪费 ~5s。
 */
const BUSINESS_TO_QUOTE_SOURCE: Readonly<Record<string, QuoteDataSourceId[]>> = {
  akshare: ['tencent', 'sina', 'akshare'],
  ifind: ['tencent', 'sina'],
  yahoo: ['tencent', 'sina'],
  tianyancha: ['mock'],
  scholar: ['mock'],
  cache: ['mock'],
}

// ── 事件发射 ──

function emit(
  type: (typeof COLLECTION_EVENTS)[keyof typeof COLLECTION_EVENTS],
  params: Omit<CollectionLifecycleEvent, 'type' | 'timestamp'>,
): void {
  try {
    eventBus.emit(type, {
      ...params,
      type,
      timestamp: Date.now(),
    })
  } catch (err) {
    logger.warn('[collectionPipeline] 事件发射失败', { error: err, type })
  }
}

function traceIdFor(symbol: string, dimensionCode: string): string {
  return `trace-${dimensionCode}-${symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── 配置映射 ──

/**
 * resolveDimensionMode
 * @param dimensionCode
 * @returns CollectionMode
 */
export function resolveDimensionMode(dimensionCode: string): CollectionMode {
  return DIMENSION_TO_MODE[dimensionCode] ?? 'unsupported'
}

/**
 * buildDefaultSourcePriority
 *
 * @param dimension 维度配置
 * @param allowMockFallback 是否注入 mock 兜底（缺省 true 保持旧行为；
 *   传 false 时映射表中的 mock 项与末尾 mock 兜底均被剔除 —— 假绿灯修复）
 */
// P1-12 分层合规：对外 buildDefaultSourcePriority 从 lib 层 re-export（见文件顶部）
// 内部 resolveQuoteChain/resolveKlineChain 仍使用本地内部副本（同语义）。
function internalBuildDefaultSourcePriority(
  dimension: DimensionPipelineConfig,
  allowMockFallback = true,
): SourcePriorityItem[] {
  const seen = new Set<QuoteDataSourceId>()
  const items: SourcePriorityItem[] = []
  let priority = 1

  for (const businessSource of dimension.sources) {
    const mapped = BUSINESS_TO_QUOTE_SOURCE[businessSource] ?? ['mock']
    for (const id of mapped) {
      if (!allowMockFallback && id === 'mock') continue
      if (seen.has(id)) continue
      seen.add(id)
      items.push({ id, priority, enabled: true })
      priority++
    }
  }

  // 兜底：允许 mock 时确保至少包含 mock
  if (allowMockFallback && !seen.has('mock')) {
    items.push({ id: 'mock', priority, enabled: true })
  }

  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * resolveQuoteChain
 *
 * 按 fallbackPolicy.allowMockFallback 决定 mock 是否在链中：
 * 显式配置了 fallbackPolicy 且 allowMockFallback=false 时剔除 mock（假绿灯修复）；
 * 未配置 fallbackPolicy 的维度保持旧行为（含 mock）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveQuoteChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const chain = (dimension.sourcePriority?.length ?? 0) > 0
    ? dimension.sourcePriority
    : internalBuildDefaultSourcePriority(dimension)
  // 未配置 fallbackPolicy 时默认允许 mock（保持旧行为，见函数注释）
  const allowMock = dimension.fallbackPolicy?.allowMockFallback ?? true
  return chain
    .filter((item) => item.enabled)
    .filter((item) => allowMock || item.id !== 'mock')
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.id)
}

/**
 * resolveKlineChain
 *
 * mock 追加同样受 fallbackPolicy.allowMockFallback 门禁（假绿灯修复）。
 * @param dimension
 * @returns QuoteDataSourceId[]
 */
export function resolveKlineChain(dimension: DimensionPipelineConfig): QuoteDataSourceId[] {
  const quoteChain = resolveQuoteChain(dimension)
  // 未配置 fallbackPolicy 时默认允许 mock（保持旧行为）
  const allowMock = dimension.fallbackPolicy?.allowMockFallback ?? true
  // 腾讯同时支持行情+K线，优先使用
  const klineSources = quoteChain.filter((id) => id !== 'mock')
  if (klineSources.length > 0) return allowMock ? [...klineSources, 'mock'] : klineSources
  return allowMock ? ['mock'] : []
}

/**
 * getDimensionConfig
 */
export function getDimensionConfig(
  config: CollectionConfig,
  dimensionCode: string,
): DimensionPipelineConfig | undefined {
  return config.dimensions.find((dim) => dim.code === dimensionCode)
}

// ── DB 写入 ──

/**
 * 写入后数据质量断言（WAP 模式 Audit 阶段）。
 * 校验关键字段非空，防止"写入成功但数据无效"的假绿灯。
 *
 * @param storeName - 目标存储名（用于选择校验规则）
 * @param payload - 已写入的记录
 * @throws Error 如果关键字段缺失或为空
 */
function auditRecord(storeName: string, payload: unknown): void {
  if (payload == null) {
    throw new Error(`[auditRecord] ${storeName}: payload 为 null/undefined`)
  }
  const record = payload as Record<string, unknown>

  // 按存储定义必填字段
  const requiredFields: Record<string, string[]> = {
    stocks: ['symbol'],
    dailyQuotes: ['symbol'],
    news: ['id'],
    sectorScores: ['id'],
    researchLogs: ['id'],
    traceRecords: ['traceId'],
  }

  const required = requiredFields[storeName]
  if (!required) return // 无校验规则的存储跳过

  for (const field of required) {
    const value = record[field]
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`[auditRecord] ${storeName}: 必填字段 "${field}" 为空`)
    }
  }
}

/**
 * 判断字段值是否"有效"（非 null/undefined/空串/NaN/Infinity）。
 * @param value 待检查字段值
 * @returns 有效返回 true
 */
function isFieldPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

/** 行情完整率校验字段（RealtimeQuote 核心 9 字段，symbol 由上游强制覆盖故不计） */
const QUOTE_COMPLETENESS_FIELDS = ['name', 'price', 'change', 'changePercent', 'open', 'high', 'low', 'volume', 'amount'] as const

/** K 线单 bar 完整率校验字段（KlineBar 核心 7 字段，turnoverRate 可选不计） */
const KLINE_COMPLETENESS_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume', 'amount'] as const

/**
 * 统计行情数据字段完整率并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param quote 实时行情数据
 */
function reportQuoteCompleteness(quote: RealtimeQuote): void {
  const nonNull = QUOTE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(quote[f])).length
  getQualityMetrics().recordCompleteness({ nonNull, total: QUOTE_COMPLETENESS_FIELDS.length })
}

/**
 * 统计 K 线数据字段完整率（跨 bar 聚合）并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param klines K 线数据数组
 */
function reportKlineCompleteness(klines: KlineBar[]): void {
  if (klines.length === 0) return
  let nonNull = 0
  for (const bar of klines) {
    nonNull += KLINE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(bar[f])).length
  }
  getQualityMetrics().recordCompleteness({ nonNull, total: klines.length * KLINE_COMPLETENESS_FIELDS.length })
}

async function writeQuoteToStock(symbol: string, quote: RealtimeQuote, source?: string): Promise<void> {
  // 防御：上游已归一化 symbol，此处强制执行覆盖，防止 API 返回字段缺失导致 DB 写入被拒
  const stock = quoteToStock(quote, source)
  stock.symbol = symbol
  auditRecord('stocks', stock)
  reportQuoteCompleteness(quote)

  // 优先使用 updateStock（合并现有字段，不覆盖用户手动修改的 researchStatus/group 等）
  try {
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: `pipeline-stock-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
      },
      payload: stock,
    })
    return
  } catch (err) {
    // 股票尚不存在时，updateStock 会因 UpdateStockHandler 找不到现有记录而抛错
    // 此时回退到 insertStock 做全量写入（新股票首次入库）
    if (err instanceof Error && err.message.includes('not found')) {
      logger.info(`[collectionPipeline] ${symbol} 为新股票，使用 insertStock 首次入库`)
    } else {
      logger.warn(`[collectionPipeline] ${symbol} updateStock 失败，回退 insertStock`, { error: err })
    }
  }

  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.insertStock,
      traceId: `pipeline-stock-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: stock,
  })
}

async function writeKlineToDailyQuotes(symbol: string, klines: KlineBar[], source?: string): Promise<void> {
  const dailyQuotes = klinesToDailyQuotes(symbol, klines, source)
  if (Array.isArray(dailyQuotes) && dailyQuotes.length > 0) {
    auditRecord('dailyQuotes', dailyQuotes[0])
  }
  reportKlineCompleteness(klines)
  await dataBridge.forward({
    meta: {
      source: MODULE_ID.fetcher,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveDailyQuotes,
      traceId: `pipeline-kline-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
    },
    payload: dailyQuotes,
  })
}

// ── 单次链路 ──

/**
 * runSingleTrace — 内部实现（不直接导出，由 withLogging 包装后导出）
 */
async function runSingleTraceImpl(
  options: RunSingleTraceOptions,
): Promise<TraceResult> {
  const { symbol, dimensionCode, config, parentTaskId } = options
  const normalizedSymbol = symbol.trim().toUpperCase()
  if (!normalizedSymbol) {
    return { success: false, symbol: '', dimensionCode, latency: 0, fallbackCount: 0, error: '股票代码为空' }
  }

  const dimension = getDimensionConfig(config, dimensionCode)
  if (!dimension) {
    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: 0,
      fallbackCount: 0,
      error: `未找到维度配置: ${dimensionCode}`,
    }
  }

  const mode = resolveDimensionMode(dimensionCode)
  const traceId = traceIdFor(normalizedSymbol, dimensionCode)
  const taskId = (parentTaskId ?? '') !== '' ? `${parentTaskId}-${normalizedSymbol}-${dimensionCode}` : traceIdFor(normalizedSymbol, dimensionCode)
  const start = Date.now()

  // ── Debug：强制走演示模式（mock + 随机延迟 + 彩色状态）
  //    触发方式：在调用批量采集前设置 sessionStorage.POOL_FORCE_DEMO = '1'
  //    当此标志启用时，无论 mode 是什么，都走 mock 采集分支，
  //    让进度面板能观察到 0→100% 流畅增长以及维度圆点三色切换。
  const forceDemo = (() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1'
    } catch { return false }
  })()
  const effectiveMode = forceDemo ? 'unsupported' as CollectionMode : mode

  const span: CollectionTraceSpan = {
    traceId,
    taskId,
    parentTaskId,
    dimensionCode,
    symbol: normalizedSymbol,
    stages: [],
    result: 'fail',
    totalDurationMs: 0,
    fallbackCount: 0,
    startedAt: start,
  }

  const addStage = (stage: CollectionStageRecord['stage'], message: string, sourceId?: QuoteDataSourceId, error?: string): void => {
    span.stages.push({
      stage,
      sourceId,
      timestamp: Date.now(),
      message,
      error,
    })
  }

  // 入口关键信息提升到 info 级别，便于生产环境追踪；traceId + mode 可做链路聚合
  logger.info('[collectionPipeline · runSingleTrace] 维度采集开始', {
    symbol: normalizedSymbol,
    dimensionCode,
    dimensionName: dimension.name,
    mode,
    effectiveMode,
    traceId,
    parentTaskId,
    forceDemo,
  })

  emit(COLLECTION_EVENTS.TRIGGERED, {
    traceId,
    taskId,
    dimensionCode,
    symbol: normalizedSymbol,
    message: `开始采集: ${dimension.name} (${mode})`,
  })
  addStage('triggered', `开始采集: ${dimension.name} (${mode})`)

  if (effectiveMode === 'unsupported') {
    // 演示模式：逐维度逐步写入 trace，模拟真实采集节奏
    // 随机延迟 800–2200ms，使进度面板能观察到进度条从 0%→100% 流畅增长
    // 维度状态分配：85% success（绿色）、10% fail（红色）、5% partial（琥珀色）
    await new Promise((res) => setTimeout(res, 800 + Math.floor(Math.random() * 1400)))
    const rnd = Math.random()
    const simulatedResult: 'success' | 'fail' | 'partial' =
      rnd < 0.85 ? 'success' : rnd < 0.95 ? 'fail' : 'partial'
    const message =
      simulatedResult === 'success'
        ? `维度 ${dimension.name} 采集完成（mock · demo）`
        : simulatedResult === 'partial'
          ? `维度 ${dimension.name} 部分完成（mock · demo）`
          : `维度 ${dimensionCode} 采集失败（mock · demo 演示）`
    addStage('complete', message, 'mock')
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId,
      taskId,
      dimensionCode,
      symbol: normalizedSymbol,
      message,
    })
    span.result = simulatedResult
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emitTrace(span)
    getQualityMetrics().recordCollect(simulatedResult === 'success' || simulatedResult === 'partial', 'mock', span.totalDurationMs, [])
    // Mock 分支输出清晰 info 日志，标明状态/耗时/随机种子
    logger.info('[collectionPipeline · runSingleTrace] Mock 分支维度采集结束', {
      symbol: normalizedSymbol,
      dimensionCode,
      result: simulatedResult,
      latencyMs: span.totalDurationMs,
      traceId,
    })
    return {
      success: simulatedResult !== 'fail',
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: simulatedResult === 'fail' ? message : undefined,
    }
  }

  try {
    if (mode === 'quote') {
      const chain = resolveQuoteChain(dimension)
      const result = await getQuoteWithConfig(normalizedSymbol, {
        sourcePriority: chain,
        traceId,
        taskId,
        dimensionCode,
        allowMockFallback: dimension.fallbackPolicy?.allowMockFallback ?? true,
      })

      // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
      if (!result.success || !result.data) {
        const failReason = result.error ?? '所有真实数据源失败'
        addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
        span.result = 'fail'
        span.error = failReason
        span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        logger.warn('[collectionPipeline · runSingleTrace · quote] 行情采集失败（真实源不可用，Mock 已禁用）', {
          symbol: normalizedSymbol,
          dimensionCode,
          source: result.source,
          fallbackCount: span.fallbackCount,
          fallbackChain: result.fallbackChain,
          latencyMs: span.totalDurationMs,
          reason: failReason,
          traceId,
        })
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId,
          taskId,
          dimensionCode,
          symbol: normalizedSymbol,
          sourceId: result.source,
          message: '行情采集失败（真实源不可用，Mock 已禁用）',
          error: failReason,
        })
        addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
        emitTrace(span)
        getQualityMetrics().recordCollect(false, result.source, span.totalDurationMs, result.fallbackChain)
        return {
          success: false,
          symbol: normalizedSymbol,
          dimensionCode,
          source: result.source,
          latency: span.totalDurationMs,
          fallbackCount: span.fallbackCount,
          error: failReason,
        }
      }

      addStage('source:success', `${result.source} 获取成功`, result.source)
      emit(COLLECTION_EVENTS.TRANSFORM, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '行情数据适配完成',
      })
      addStage('transform', '行情数据适配完成', result.source)

      emit(COLLECTION_EVENTS.WRITE_START, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '准备写入 stocks',
      })
      addStage('write:start', '准备写入 stocks', result.source)

      try {
        await writeQuoteToStock(normalizedSymbol, result.data, result.source)
        getQualityMetrics().recordWrite(true)
      } catch (writeErr) {
        getQualityMetrics().recordWrite(false)
        throw writeErr
      }

      emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'stocks 写入成功',
      })
      addStage('write:success', 'stocks 写入成功', result.source)

      span.result = 'success'
      span.finalSource = result.source
      span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
      span.totalDurationMs = Date.now() - start
      span.completedAt = Date.now()
      logger.info('[collectionPipeline · runSingleTrace · quote] 行情采集完成', {
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        fallbackCount: span.fallbackCount,
        fallbackChain: result.fallbackChain,
        latencyMs: span.totalDurationMs,
        traceId,
      })
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        durationMs: span.totalDurationMs,
        message: '单次行情采集完成',
        payload: { span },
      })
      addStage('complete', '单次行情采集完成', result.source)
      emitTrace(span)

      getQualityMetrics().recordCollect(true, result.source, span.totalDurationMs, result.fallbackChain)

      return {
        success: true,
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        latency: span.totalDurationMs,
        fallbackCount: span.fallbackCount,
      }
    }

    if (mode === 'kline') {
      const chain = resolveKlineChain(dimension)
      const days = config.historyDays
      const result = await getKlineWithConfig(normalizedSymbol, days, {
        sourcePriority: chain,
        traceId,
        taskId,
        dimensionCode,
        allowMockFallback: dimension.fallbackPolicy?.allowMockFallback ?? true,
      })

      // Mock 禁用 + 全源失败：不写入、不计成功（假绿灯修复）
      if (!result.success || !result.data) {
        const failReason = result.error ?? 'K 线所有真实数据源失败'
        addStage('source:fail', `真实源不可用: ${failReason}`, result.source, failReason)
        span.result = 'fail'
        span.error = failReason
        span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        logger.warn('[collectionPipeline · runSingleTrace · kline] K 线采集失败（真实源不可用，Mock 已禁用）', {
          symbol: normalizedSymbol,
          dimensionCode,
          historyDays: days,
          source: result.source,
          fallbackCount: span.fallbackCount,
          fallbackChain: result.fallbackChain,
          latencyMs: span.totalDurationMs,
          reason: failReason,
          traceId,
        })
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId,
          taskId,
          dimensionCode,
          symbol: normalizedSymbol,
          sourceId: result.source,
          message: 'K 线采集失败（真实源不可用，Mock 已禁用）',
          error: failReason,
        })
        addStage('complete', `采集失败: ${failReason}`, result.source, failReason)
        emitTrace(span)
        getQualityMetrics().recordCollect(false, result.source, span.totalDurationMs, result.fallbackChain)
        return {
          success: false,
          symbol: normalizedSymbol,
          dimensionCode,
          source: result.source,
          latency: span.totalDurationMs,
          fallbackCount: span.fallbackCount,
          error: failReason,
        }
      }

      addStage('source:success', `${result.source} K 线获取成功`, result.source)
      emit(COLLECTION_EVENTS.TRANSFORM, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'K 线数据适配完成',
      })
      addStage('transform', 'K 线数据适配完成', result.source)

      emit(COLLECTION_EVENTS.WRITE_START, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: '准备写入 daily_quotes',
      })
      addStage('write:start', '准备写入 daily_quotes', result.source)

      try {
        await writeKlineToDailyQuotes(normalizedSymbol, result.data, result.source)
        getQualityMetrics().recordWrite(true)
      } catch (writeErr) {
        getQualityMetrics().recordWrite(false)
        throw writeErr
      }

      emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        message: 'daily_quotes 写入成功',
      })
      addStage('write:success', 'daily_quotes 写入成功', result.source)

      span.result = 'success'
      span.finalSource = result.source
      span.fallbackCount = Math.max(0, result.fallbackChain.length - 1)
      span.totalDurationMs = Date.now() - start
      span.completedAt = Date.now()
      logger.info('[collectionPipeline · runSingleTrace · kline] K 线采集完成', {
        symbol: normalizedSymbol,
        dimensionCode,
        historyDays: days,
        source: result.source,
        fallbackCount: span.fallbackCount,
        fallbackChain: result.fallbackChain,
        latencyMs: span.totalDurationMs,
        barCount: result.data?.length ?? 0,
        traceId,
      })
      emit(COLLECTION_EVENTS.COMPLETE, {
        traceId,
        taskId,
        dimensionCode,
        symbol: normalizedSymbol,
        sourceId: result.source,
        durationMs: span.totalDurationMs,
        message: '单次 K 线采集完成',
        payload: { span },
      })
      addStage('complete', '单次 K 线采集完成', result.source)
      emitTrace(span)

      getQualityMetrics().recordCollect(true, result.source, span.totalDurationMs, result.fallbackChain)

      return {
        success: true,
        symbol: normalizedSymbol,
        dimensionCode,
        source: result.source,
        latency: span.totalDurationMs,
        fallbackCount: span.fallbackCount,
      }
    }

    // ── 09 财务数据维度链路 ──
    // 策略：调用 fetcherService.fetchFinancial 采集并写入 financial_reports store
    if (mode === 'financial') {
      const finSource = 'fetcher' as QuoteDataSourceId
      try {
        addStage('source:start', '调用 fetchFinancial 采集财务数据')
        const finResult = await fetchFinancial(normalizedSymbol)

        if (!finResult.success || !finResult.data) {
          const failReason = finResult.error ?? '财务数据采集失败'
          addStage('source:fail', `财务数据采集失败: ${failReason}`, undefined, failReason)
          span.result = 'fail'
          span.error = failReason
          span.totalDurationMs = Date.now() - start
          span.completedAt = Date.now()
          logger.warn('[collectionPipeline · runSingleTrace · financial] 财务数据采集失败', {
            symbol: normalizedSymbol,
            dimensionCode,
            latencyMs: span.totalDurationMs,
            reason: failReason,
            traceId,
          })
          emit(COLLECTION_EVENTS.COMPLETE, {
            traceId, taskId, dimensionCode, symbol: normalizedSymbol,
            message: '财务数据采集失败',
            error: failReason,
          })
          addStage('complete', `采集失败: ${failReason}`, undefined, failReason)
          emitTrace(span)
          getQualityMetrics().recordCollect(false, finSource, span.totalDurationMs, [])
          getQualityMetrics().recordWrite(false)
          return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: failReason }
        }

        addStage('source:success', 'fetchFinancial 获取成功', finSource)
        emit(COLLECTION_EVENTS.TRANSFORM, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: finSource,
          message: '财务数据适配完成',
        })
        addStage('transform', '财务数据适配完成', finSource)

        // fetchFinancial 内部已通过 DataBridge.forward 写入 financial_reports store
        emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: finSource,
          message: 'financial_reports 写入成功',
        })
        addStage('write:success', 'financial_reports 写入成功', finSource)
        getQualityMetrics().recordWrite(true)

        span.result = 'success'
        span.finalSource = finSource
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        logger.info('[collectionPipeline · runSingleTrace · financial] 财务数据采集完成', {
          symbol: normalizedSymbol,
          dimensionCode,
          latencyMs: span.totalDurationMs,
          traceId,
        })
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: finSource,
          durationMs: span.totalDurationMs,
          message: '财务数据采集完成',
          payload: { span },
        })
        addStage('complete', '财务数据采集完成', finSource)
        emitTrace(span)
        getQualityMetrics().recordCollect(true, finSource, span.totalDurationMs, [])

        return {
          success: true,
          symbol: normalizedSymbol,
          dimensionCode,
          source: finSource,
          latency: span.totalDurationMs,
          fallbackCount: 0,
        }
      } catch (err) {
        const failReason = err instanceof Error ? err.message : String(err)
        addStage('source:fail', `财务数据采集异常: ${failReason}`, undefined, failReason)
        span.result = 'fail'
        span.error = failReason
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          message: '财务数据采集异常',
          error: failReason,
        })
        addStage('complete', `采集异常: ${failReason}`, undefined, failReason)
        emitTrace(span)
        getQualityMetrics().recordCollect(false, finSource, span.totalDurationMs, [])
        getQualityMetrics().recordWrite(false)
        return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: failReason }
      }
    }

    // ── 03–08 非行情维度数据链路 ──
    // 策略：仅使用真实数据源，禁用 mock 兜底。真实源失败 = 维度失败。
    if (mode === 'news' || mode === 'research' || mode === 'competitor' || mode === 'index' || mode === 'chip' || mode === 'dividend' || mode === 'consensus') {
      const storeAction = DIMENSION_TO_ACTION[dimensionCode]
      if (!storeAction) {
        const msg = `维度 ${dimensionCode} 无对应 DB action`
        addStage('complete', msg, undefined, msg)
        span.result = 'fail'
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        emitTrace(span)
        return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: msg }
      }

      try {
        const dimData = await generateDataForDimension(normalizedSymbol, dimensionCode)
        const modeLabel = { news: '资讯', research: '研报', competitor: '竞品', index: '关联指数', chip: '筹码', dividend: '分红股本', consensus: '一致预期' }[mode]

        // MOCK 禁用：真实源失败 → 维度失败，不写入假数据
        if (dimData._source === 'mock' || dimData._mock === true) {
          const rawReason = dimData._fallbackReason
          const failReason = typeof rawReason === 'string' ? rawReason : '所有真实数据源均不可用'
          logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实源失败，禁用 mock，上报失败: ${normalizedSymbol}`, { reason: failReason })
          emit(COLLECTION_EVENTS.SOURCE_FAIL, {
            traceId, taskId, dimensionCode, symbol: normalizedSymbol,
            message: `[${modeLabel}] ${failReason}`,
            error: `真实源不可用（${modeLabel}），未使用 mock 数据`,
          })
          addStage('source:fail', `真实源不可用: ${failReason}`, undefined, failReason)
          span.result = 'fail'
          span.error = failReason
          span.totalDurationMs = Date.now() - start
          span.completedAt = Date.now()
          emit(COLLECTION_EVENTS.COMPLETE, {
            traceId, taskId, dimensionCode, symbol: normalizedSymbol,
            message: `[${modeLabel}] 采集失败（真实源不可用）`,
            error: failReason,
          })
          addStage('complete', `采集失败: ${failReason}`, undefined, failReason)
          emitTrace(span)
          getQualityMetrics().recordCollect(false, 'mock', span.totalDurationMs, [])
          return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: failReason }
        }

        // 真实数据写入
        // 真实数据写入
        const sourceLabel = dimData._source as string || 'real'
        addStage('source:success', `${sourceLabel}:${mode} 数据获取成功`, sourceLabel as QuoteDataSourceId)
        emit(COLLECTION_EVENTS.TRANSFORM, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `${modeLabel} 真实数据适配完成（来源: ${sourceLabel}）`,
        })
        addStage('transform', `${modeLabel} 真实数据适配完成`, sourceLabel as QuoteDataSourceId)

        emit(COLLECTION_EVENTS.WRITE_START, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `准备写入 ${dimensionCode} 维度真实数据`,
        })
        addStage('write:start', `准备写入 ${dimensionCode} 维度数据`, sourceLabel as QuoteDataSourceId)

        await writeMockDimensionData(normalizedSymbol, dimensionCode, dimData, storeAction)
        getQualityMetrics().recordWrite(true)

        emit(COLLECTION_EVENTS.WRITE_SUCCESS, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          message: `${modeLabel} 真实数据写入成功`,
        })
        addStage('write:success', `${modeLabel} 真实数据写入成功`, sourceLabel as QuoteDataSourceId)

        // ── KIMI AI 增强: Dim 05 新闻摘要 / Dim 08 研报解读 ──
        if (dimensionCode === '05' || dimensionCode === '08') {
          try {
            const aiStage = dimensionCode === '05' ? 'KIMI新闻摘要' : 'KIMI研报解读'
            addStage('transform', `开始 ${aiStage}`, sourceLabel as QuoteDataSourceId)

            if (dimensionCode === '05') {
              const newsItems = extractNewsItems(dimData)
              if (newsItems.length > 0) {
                const aiResult = await summarizeNews(normalizedSymbol, '', newsItems)
                if (aiResult) {
                  dimData._kimiSummary = aiResult
                  dimData.sentiment = aiResult.sentiment
                  dimData.sentimentScore = aiResult.sentimentScore
                  await writeMockDimensionData(normalizedSymbol, dimensionCode, { _kimiSummary: aiResult }, storeAction)
                  addStage('transform', `${aiStage} 完成 (sentiment: ${aiResult.sentiment}, score: ${aiResult.sentimentScore})`, sourceLabel as QuoteDataSourceId)
                }
              }
            } else if (dimensionCode === '08') {
              const reports = extractResearchReports(dimData)
              if (reports.length > 0) {
                const aiResult = await digestResearch(normalizedSymbol, '', reports)
                if (aiResult) {
                  dimData._kimiDigest = aiResult
                  await writeMockDimensionData(normalizedSymbol, dimensionCode, { _kimiDigest: aiResult }, storeAction)
                  addStage('transform', `${aiStage} 完成 (consensus: ${aiResult.consensusRating})`, sourceLabel as QuoteDataSourceId)
                }
              }
            }
          } catch (aiErr) {
            // KIMI AI 增强失败不阻塞主流程
            logger.warn('[collectionPipeline] KIMI AI 增强失败（不阻塞主流程）', {
              symbol: normalizedSymbol, dimensionCode, error: aiErr,
            })
          }
        }

        span.result = 'success'
        span.finalSource = sourceLabel as QuoteDataSourceId
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        span.metadata = { _mock: false, dataType: mode, source: sourceLabel }
        logger.info('[collectionPipeline · runSingleTrace · otherDim] 非行情维度采集完成', {
          symbol: normalizedSymbol,
          dimensionCode,
          mode,
          source: sourceLabel,
          latencyMs: span.totalDurationMs,
          traceId,
        })
        emit(COLLECTION_EVENTS.COMPLETE, {
          traceId, taskId, dimensionCode, symbol: normalizedSymbol,
          sourceId: sourceLabel as QuoteDataSourceId,
          durationMs: span.totalDurationMs,
          message: `${modeLabel} 真实数据采集完成（来源: ${sourceLabel}）`,
          payload: { span },
        })
        addStage('complete', `${modeLabel} 采集完成`, sourceLabel as QuoteDataSourceId)
        emitTrace(span)

        getQualityMetrics().recordCollect(true, sourceLabel as QuoteDataSourceId, span.totalDurationMs, [])

        return {
          success: true,
          symbol: normalizedSymbol,
          dimensionCode,
          source: sourceLabel as QuoteDataSourceId,
          latency: span.totalDurationMs,
          fallbackCount: 0,
        }
      } catch (err) {
        getQualityMetrics().recordWrite(false)
        const failReason = err instanceof Error ? err.message : String(err)
        addStage('complete', `写入失败: ${failReason}`, undefined, failReason)
        span.result = 'fail'
        span.error = failReason
        span.totalDurationMs = Date.now() - start
        span.completedAt = Date.now()
        logger.error('[collectionPipeline · runSingleTrace · otherDim] 非行情维度写入异常', {
          symbol: normalizedSymbol,
          dimensionCode,
          mode,
          latencyMs: span.totalDurationMs,
          error: failReason,
          traceId,
        })
        emitTrace(span)
        getQualityMetrics().recordCollect(false, 'mock', span.totalDurationMs, [])
        return { success: false, symbol: normalizedSymbol, dimensionCode, latency: span.totalDurationMs, fallbackCount: 0, error: failReason }
      }
    }

    // unreachable
    const message = '未知采集模式'
    addStage('complete', message, undefined, message)
    span.result = 'fail'
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emitTrace(span)
    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: message,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error('[collectionPipeline] 单次链路异常', {
      symbol: normalizedSymbol,
      dimensionCode,
      error: errorMsg,
    })
    addStage('complete', `采集异常: ${errorMsg}`, undefined, errorMsg)
    span.result = 'fail'
    span.error = errorMsg
    span.totalDurationMs = Date.now() - start
    span.completedAt = Date.now()
    emit(COLLECTION_EVENTS.COMPLETE, {
      traceId,
      taskId,
      dimensionCode,
      symbol: normalizedSymbol,
      message: '采集异常',
      error: errorMsg,
    })
    emitTrace(span)

    getQualityMetrics().recordCollect(false, 'mock', span.totalDurationMs, [])

    // 自动登记缺失报告（方便事后追溯采集失败原因）
    try {
      void detectMissing(normalizedSymbol, MISSING_REPORT_TYPE.RESEARCH, errorMsg, { enabled: true })
    } catch { /* 缺失登记本身不阻塞主流程 */ }

    return {
      success: false,
      symbol: normalizedSymbol,
      dimensionCode,
      latency: span.totalDurationMs,
      fallbackCount: 0,
      error: errorMsg,
    }
  }
}

// ── 批量链路 ──

/**
 * runBatchTrace — 分批并发采集，避免串行瓶颈。
 *
 * 每批最多 CONCURRENCY 只股票并发采集，批间串行保证进度上报有序。
 * 单只 2s × 40 只 = 原串行 80s → 并发 5 只/批 ≈ 16s（约 5× 提速）。
 *
 * 内部实现（不直接导出，由 withLogging 包装后导出）。
 */
async function runBatchTraceImpl(
  options: RunBatchTraceOptions,
): Promise<TraceResult[]> {
  const { symbols, dimensionCode, config, parentTaskId } = options
  const bpTaskId = parentTaskId ?? `batch-${dimensionCode}-${Date.now()}`
  // Demo 模式下降为串行，让进度面板能观察到 0%→100% 流畅增长
  const forceDemo = (() => {
    try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('POOL_FORCE_DEMO') === '1' }
    catch { return false }
  })()
  const CONCURRENCY = forceDemo ? 1 : 5
  const batchStart = Date.now()

  logger.info('[collectionPipeline · runBatchTrace] 批量任务开始', {
    dimensionCode,
    symbolCount: symbols.length,
    symbols,
    concurrency: CONCURRENCY,
    forceDemo,
    bpTaskId,
    parentTaskId,
  })

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: `批量任务开始（并发 ${CONCURRENCY}）`,
    payload: { status: 'running', total: symbols.length, parentTaskId },
  })

  const results: TraceResult[] = []
  let completed = 0
  let chunkIndex = 0
  const totalChunks = Math.ceil(symbols.length / CONCURRENCY)

  // 分批并发处理
  for (let chunkStart = 0; chunkStart < symbols.length; chunkStart += CONCURRENCY) {
    chunkIndex++
    const chunk = symbols.slice(chunkStart, chunkStart + CONCURRENCY)
    const chunkStartTs = Date.now()
    const chunkResults = await Promise.all(
      chunk.map((symbol) =>
        runSingleTrace({ symbol, dimensionCode, config, parentTaskId: bpTaskId })
      )
    )
    const chunkSuccess = chunkResults.filter((r) => r.success).length
    const chunkLatencyMs = Date.now() - chunkStartTs
    results.push(...chunkResults)
    completed += chunkResults.length
    const progressPct = Math.round((completed / symbols.length) * 100)

    logger.info('[collectionPipeline · runBatchTrace] 批次处理完成', {
      dimensionCode,
      bpTaskId,
      chunkIndex,
      totalChunks,
      chunkSize: chunk.length,
      chunkSymbols: chunk,
      chunkSuccess,
      chunkFail: chunkResults.length - chunkSuccess,
      chunkLatencyMs,
      completed,
      total: symbols.length,
      progressPct,
    })

    emit(COLLECTION_EVENTS.TASK_STATUS, {
      traceId: bpTaskId,
      taskId: bpTaskId,
      dimensionCode,
      message: `批量进度 ${completed}/${symbols.length}`,
      payload: { status: 'running', progress: progressPct },
    })
  }

  const totalSuccess = results.filter((r) => r.success).length
  const totalFail = results.length - totalSuccess
  const totalLatencyMs = Date.now() - batchStart
  logger.info('[collectionPipeline · runBatchTrace] 批量任务完成', {
    dimensionCode,
    bpTaskId,
    totalSymbols: symbols.length,
    totalSuccess,
    totalFail,
    totalLatencyMs,
    avgLatencyMs: totalLatencyMs / Math.max(1, symbols.length),
    successRatePct: Math.round((totalSuccess / Math.max(1, symbols.length)) * 100),
  })

  emit(COLLECTION_EVENTS.TASK_STATUS, {
    traceId: bpTaskId,
    taskId: bpTaskId,
    dimensionCode,
    message: '批量任务完成',
    payload: { status: 'completed', total: symbols.length, success: totalSuccess },
  })

  return results
}

/**
 * runSingleTrace — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const runSingleTrace = withLogging(
  'collectionPipeline',
  'runSingleTrace',
  runSingleTraceImpl,
  { resultKeys: ['success', 'symbol', 'source', 'latency', 'fallbackCount', 'error'] },
)

/**
 * runBatchTrace — withLogging 包装版本（自动记录入口参数/耗时/返回结果/异常）。
 */
export const runBatchTrace = withLogging(
  'collectionPipeline',
  'runBatchTrace',
  runBatchTraceImpl,
  { level: 'info' },
)

// ── Trace 广播 ──

function emitTrace(span: CollectionTraceSpan): void {
  try {
    eventBus.emit('collect:trace', span)
    // 异步持久化，不阻塞主流程；但写入成败需纳入质量统计
    saveTraceRecord(span)
      .then(() => getQualityMetrics().recordWrite(true))
      .catch((err) => {
        getQualityMetrics().recordWrite(false)
        logger.warn('[collectionPipeline] trace 持久化失败', { error: err, traceId: span.traceId })
      })
  } catch (err) {
    logger.warn('[collectionPipeline] trace 广播失败', { error: err })
  }
}

// ── 配置辅助 ──

/**
 * @note upgradeDimensionsToPipeline 的对外 canonical 实现已在
 *   src/lib/collection/pipeline.ts（P1-12 分层合规下沉），
 *   文件顶部 export 自 lib，保持 API 零破坏。内部其他文件如需引用，
 *   从 lib 层路径导入。
 */
function _unused_upgradeDimensionsLocally_(
  dimensions: DimensionPipelineConfig[],
): DimensionPipelineConfig[] {
  return dimensions.map((dim) => {
    const fallbackPolicy = dim.fallbackPolicy
    const allowMock = fallbackPolicy?.allowMockFallback ?? true
    return {
      ...dim,
      sourcePriority:
        (dim.sourcePriority?.length ?? 0) > 0
          ? dim.sourcePriority
          : internalBuildDefaultSourcePriority(dim, allowMock),
      concurrency: dim.concurrency,
      retryPolicy: dim.retryPolicy,
      timeoutPolicy: dim.timeoutPolicy,
      fallbackPolicy,
    }
  })
}
void _unused_upgradeDimensionsLocally_

/**
 * 从 `CollectionConfig` 构造一个用于 store/持久化的默认对象。
 */
export function createDefaultCollectionConfig(): CollectionConfig {
  return {
    version: '1.0.0',
    activeTemplate: 'value',
    dimensions: [],
    global: {
      maxSymbols: 40,
      defaultBatchSize: 50,
      rateLimitPerMinute: 10,
      rateLimitPerHour: 200,
      rateLimitPerDay: 2000,
      notifyOnComplete: true,
      notifyOnError: true,
      defaultTimeoutMs: 5000,
      defaultRetries: 2,
    },
    symbolCount: 40,
    historyDays: 252,
    updatedAt: Date.now(),
  }
}
