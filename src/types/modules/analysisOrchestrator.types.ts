/**
 * @fileoverview AnalysisOrchestrator 领域类型定义
 *
 * Route A 核心产物：AnalysisOrchestrator 编排「外部采集资讯 + 内部高质量数据 → LLM 校对分析」，
 * 产出结构化 AnalysisResult 持久化至 IndexedDB analysisResults store。
 *
 * @module types/modules/analysisOrchestrator
 * @created 2026-07-13 B1 阶段
  * @doc [V9-DOC-BACK-006, V9-DOC-PROJ-124, V9-DOC-PROJ-079, V9-DOC-PROJ-066, V9-DOC-PROJ-113]
*/

export const ANALYSIS_RESULT_VERSION = 1 as const

export interface ExternalNewsSnapshot {
  symbol: string
  articleCount: number
  topArticles: Array<{ title: string; summary: string; sentiment?: string }>
  fetchedAt: number
}

export interface InternalDataSnapshot {
  symbol: string
  stockName: string | undefined
  v6Score: number | undefined
  v6Rating: string | undefined
  fetchedAt: number
}

export interface FactorExecutionStatus {
  factorId: string
  factorName: string
  executed: boolean
  value: number | undefined
}

export interface ReasonablenessGate {
  passed: boolean
  threshold: number
  completeness: number
  missingLayers: string[]
  notes: string
}

export interface FeedbackLoopResult {
  triggered: boolean
  issueCount: number
  message: string
}

export interface AnalysisConclusion {
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  summary: string
  keyRisks: string[]
  opportunities: string[]
  consistentWithV6: boolean
  /** P2-2: LLM 置信度（0-1） */
  confidence?: number
}

/** P2-2: 报告章节（支持二十页结构扩展） */
export interface ReportSection {
  sectionId: string
  title: string
  content: string
  /** 章节附加数据（图表/表格/指标等） */
  data?: Record<string, unknown>
}

export interface AnalysisResult {
  docId: string
  symbol: string
  version: number
  createdAt: number
  external: ExternalNewsSnapshot
  internal: InternalDataSnapshot
  conclusion: AnalysisConclusion | undefined
  rawLlmText: string
  factorExecution: FactorExecutionStatus[]
  reasonableness: ReasonablenessGate
  feedbackLoop: FeedbackLoopResult
  model: string
  /** P2-2: 报告章节（二十页结构扩展，当前为骨架） */
  reportSections?: ReportSection[]
  /** P2-2: Token 消耗明细 */
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** P2-2: 数据血缘（上游数据来源追踪） */
  lineage?: {
    /** V6 引擎版本 */
    v6ScoreVersion: string
    /** 各数据源版本/时间戳 */
    dataVersions: {
      stockSnapshotAt: number
      v6ScoreSnapshotAt: number
      newsFetchedAt: number
    }
    /** 参与分析的资讯 ID 列表 */
    newsIds: string[]
  }
  /** P2-3: 归档标记 */
  archived?: boolean
  /** P2-3: 归档时间戳 */
  archivedAt?: number
  /** P2-3: 压缩标记（rawLlmText 已移除） */
  compressed?: boolean
}

export interface AnalysisRequest {
  symbol: string
  enableFeedback?: boolean
  maxReAnalysis?: number
}

export interface AnalysisRunResult {
  success: boolean
  data?: AnalysisResult
  error?: string
}

/**
 * 单只股票的资料摘要（profileIntegrationService.gatherProfileSummary 产物，
 * 供 LLM 分析上下文使用）
 *
 * 注：本类型定义于 types/ 层（零依赖约束），域/情绪等枚举以基础类型表达，
 * 实际取值见 @/data/types/types.profile 的 ProfileDomain / SentimentLabel。
 */
export interface ProfileDataSummary {
  /** 资料总数 */
  totalItems: number
  /** 各域资料数量（key 为 D1-D8 域标识） */
  domainCounts: Record<string, number>
  /** 高质量资料 Top N */
  topItems: Array<{
    /** 所属域（D1-D8） */
    domain: string
    /** 标题 */
    title: string
    /** 摘要（截断至 150 字） */
    summary: string
    /** 来源 */
    source: string
    /** 质量分（0-100） */
    qualityScore?: number
    /** 情绪标签 */
    sentiment: string
  }>
  /** 证据摘要（按评分层分组，无证据时为 undefined） */
  evidenceSummary?: Array<{
    /** 评分层 ID */
    layerId: string
    /** 该层证据数量 */
    evidenceCount: number
    /** 正面证据描述（截断至 80 字） */
    topPositive: string[]
    /** 负面证据描述（截断至 80 字） */
    topNegative: string[]
  }>
}
