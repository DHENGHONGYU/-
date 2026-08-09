/**
 * @module TradeReviewAITypes
 * @description AI 交易复盘报告类型定义（运行时持久化视图）。
 *
 * 本模块从 services/trading/tradeReviewAI.types.ts 归位至类型层，
 * 供 dataLayer、store、services 共同引用，避免 data/ 层依赖 services/ 层。
 *
 * @see src/services/trading/tradeReviewAI.types.ts — 服务层兼容入口（re-export）
 * @see src/data/types/types.tradeReview.ts — 持久化实体 re-export
  * @doc [V9-DOC-QA-080, V9-DOC-QA-066]
*/

// ============================================================
// 交易错误实例（与 services/trading/tradeErrorDefinitions.ts 结构对齐）
// ============================================================

/** 检测到的交易错误实例 */
export interface DetectedError {
  /** 错误类型 */
  type: string
  /** 中文名称 */
  name: string
  /** 严重等级 */
  severity: 'critical' | 'major' | 'minor'
  /** 心理根源 */
  psychologicalRoot: string
  /** 关联的订单 ID 列表 */
  relatedOrderIds: string[]
  /** 发生次数 */
  count: number
  /** 扣分 */
  penalty: number
}

/** 交易错误实例别名（兼容 Store 层命名） */
export type TradeError = DetectedError

// ============================================================
// 六维报告类型定义
// ============================================================

/** 交易摘要 */
export interface TradeSummary {
  /** 总交易笔数 */
  totalTrades: number
  /** 盈利笔数 */
  profitableTrades: number
  /** 亏损笔数 */
  losingTrades: number
  /** 胜率 (%) */
  winRate: number
  /** 盈亏比 */
  profitLossRatio: number
  /** 平均盈利 (%) */
  avgProfit: number
  /** 平均亏损 (%) */
  avgLoss: number
  /** 总盈亏 */
  totalPnL: number
  /** 总盈亏百分比 */
  totalPnLPercent: number
  /** 纪律评分 */
  disciplineScore: number
  /** 错误总数 */
  totalErrors: number
}

/** 心理画像类型 */
export type PsychologicalProfileType =
  | 'chase_type'        // 追涨型
  | 'fear_profit_type'  // 恐盈型
  | 'hold_loss_type'    // 扛单型
  | 'emotional_type'    // 情绪化型
  | 'aggressive_type'   // 激进型
  | 'impulsive_type'    // 冲动型

/** 心理画像 */
export interface PsychologicalProfile {
  /** 画像类型 */
  primaryType: PsychologicalProfileType
  /** 画像名称 */
  name: string
  /** 特征描述 */
  characteristics: string[]
  /** 心理根源 */
  rootCause: string
  /** 改进方向 */
  improvementDirection: string
}

/** 风险画像 */
export interface RiskProfile {
  /** 风险偏好 */
  riskAppetite: 'conservative' | 'moderate' | 'aggressive'
  /** 最大回撤 */
  maxDrawdown: number
  /** 仓位集中度 */
  concentrationLevel: 'low' | 'medium' | 'high'
  /** 风险控制建议 */
  suggestions: string[]
}

/** 错误分析 */
export interface ErrorAnalysis {
  /** TOP5 错误 */
  topErrors: Array<{
    name: string
    severity: string
    count: number
    psychologicalRoot: string
  }>
  /** 错误趋势描述 */
  errorTrend: string
  /** 心理画像 */
  psychologicalProfile: PsychologicalProfile
  /** 风险画像 */
  riskProfile: RiskProfile
}

/** 纪律分析 */
export interface DisciplineAnalysis {
  /** 计划遵守率 */
  planAdherenceRate: number
  /** 止损执行率 */
  stopLossExecutionRate: number
  /** 仓位管理评分 */
  positionManagementScore: number
  /** 情绪控制评分 */
  emotionControlScore: number
  /** 综合纪律评分 */
  overallScore: number
  /** 改善建议 */
  improvements: string[]
}

/** 推荐学习资源 */
export interface RecommendedResource {
  type: 'book' | 'course' | 'article' | 'video' | 'practice' | 'tool'
  title: string
  description: string
}

/** 技能等级 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'

/**
 * 技能维度编码（硬编码字面量联合，避免 as const 与枚举混用导致的类型推断问题）
 */
export type SkillDimensionCode =
  | 'stop_loss'
  | 'position_management'
  | 'plan_execution'
  | 'emotion_control'
  | 'entry_timing'
  | 'exit_timing'
  | 'trade_frequency'
  | 'decision_execution'
  | 'data_review'
  | 'setup_selection'

/** 技能发展（与 tradeReview.types.ts 设计对齐的运行时视图） */
export interface SkillDevelopment {
  /** 当前水平评估（兼容旧 UI 的展示文本） */
  currentLevel: string
  /** 优先技能排序 */
  prioritySkills: Array<{
    skill: string
    importance: 'high' | 'medium' | 'low'
    reason: string
  }>
  /** 推荐学习资源 */
  recommendedResources: RecommendedResource[]
  /** 关联用户 ID（本机运行时使用固定标识） */
  userId: string
  /** 技能维度评分（按错误检测结果推导） */
  dimensions: Array<{
    code: SkillDimensionCode
    name: string
    /** 运行时扩展字段，用于里程碑展示与提示 */
    description: string
    currentLevel: SkillLevel
    targetLevel: SkillLevel
    score: number
    gap: number
  }>
  /** 技能发展里程碑 */
  milestones: Array<{
    id: string
    title: string
    description: string
    skillDimension: SkillDimensionCode
    targetLevel: SkillLevel
    criteria: string[]
    achieved: boolean
    achievedAt?: number
    targetDate: string
  }>
  /** 学习路径节点 */
  learningPath: Array<{
    order: number
    title: string
    description: string
    resources: Array<{ type: 'book' | 'course' | 'article' | 'video'; title: string; url?: string }>
    exercises: string[]
    estimatedHours: number
    completed: boolean
  }>
  /** 总体技能等级 */
  overallLevel: SkillLevel
  /** 最近更新时间 */
  updatedAt: number
}

/** 行动计划 */
export interface ActionPlan {
  /** 立即执行 / 本周 */
  immediate: string[]
  /** 短期 / 1 个月 */
  shortTerm: string[]
  /** 长期 / 3 个月 */
  longTerm: string[]
}

/** AI 深度洞察 */
export interface AIDeepInsight {
  /** 盈亏归因 */
  pnlAttribution: string[]
  /** 数据规律 */
  dataPatterns: string[]
  /** 个性化建议 */
  personalizedAdvice: string[]
}

/** 六维复盘报告 */
export interface TradeReviewReport {
  /** 生成时间 */
  generatedAt: number
  /** 交易摘要 */
  summary: TradeSummary
  /** 错误分析 */
  errorAnalysis: ErrorAnalysis
  /** 纪律分析 */
  disciplineAnalysis: DisciplineAnalysis
  /** 技能发展 */
  skillDevelopment: SkillDevelopment
  /** 行动计划 */
  actionPlan: ActionPlan
  /** AI 深度洞察 */
  aiInsight: AIDeepInsight
  /** AI 洞察来源（仅 LLM 增强模式下存在） */
  aiInsightSource?: 'llm' | 'rule'
  /** 买卖点复盘分析（v1.1.0 新增） */
  buySellPointReview?: import('./buySellPoint.types').BuySellPointReview
}

/** 技能维度定义项 */
export interface SkillDimensionDefinition {
  readonly code: SkillDimensionCode
  readonly name: string
  readonly relatedErrors: readonly string[]
  readonly description: string
}

/** 持久化到 trade_reviews store 的复盘摘要记录 */
export interface TradeReviewRecord {
  id: string
  generatedAt: number
  report: TradeReviewReport
  tradeErrors: TradeError[]
  disciplineScore: number
  skillRoadmap: string[]
  psychologicalProfile: PsychologicalProfile | null
}
