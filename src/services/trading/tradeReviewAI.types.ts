/**
 * AI 交易复盘报告类型定义
 *
 * 本文件现为兼容入口：所有持久化与跨层类型已归位至
 * src/types/modules/tradeReviewAI.types.ts，此处仅 re-export 以保持现有调用方零修改。
 * 服务层专属选项类型（TradeReviewOptions / SyncReviewOptions）仍保留在本文件。
  * @doc [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-BACK-008, V9-DOC-ARCH-008, V9-DOC-BACK-005]
*/

export type {
  DetectedError,
  TradeError,
  TradeSummary,
  PsychologicalProfileType,
  PsychologicalProfile,
  RiskProfile,
  ErrorAnalysis,
  DisciplineAnalysis,
  RecommendedResource,
  SkillLevel,
  SkillDimensionCode,
  SkillDevelopment,
  ActionPlan,
  AIDeepInsight,
  TradeReviewReport,
  SkillDimensionDefinition,
  TradeReviewRecord,
} from '@/types/modules/tradeReviewAI.types'

// ============================================================
// 选项类型（服务层专属，依赖 config/llmConfig）
// ============================================================

/** 同步复盘选项（仅支持 now 时间戳注入，用于单元测试和 freshness 校验） */
export interface SyncReviewOptions {
  now?: number
}

export interface TradeReviewOptions {
  /** LLM 配置覆盖，启用 LLM 深度洞察 */
  llmConfig?: import('@/config/llmConfig').PartialLlmConfig
  /** 进度回调 */
  onProgress?: (phase: string, message: string) => void
  /** 报告生成时间戳（用于 freshness 校验与测试） */
  now?: number
}

// ============================================================
// 辅助类型
// ============================================================

export interface TradePair {
  buyId: string
  sellId: string
  profitPct: number
  holdDays: number
}
