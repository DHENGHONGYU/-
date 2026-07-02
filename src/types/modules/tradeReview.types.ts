/**
 * @module TradeReviewTypes
 * @lifecycle @Route
 * @description 交易复盘模块类型定义。覆盖交易错误分类、心理画像、六维复盘报告、
 *              技能发展路径、行动清单与纪律评分等完整复盘体系。
 */

// ============================================================
// 交易错误类型（12 种）
// ============================================================

/** 交易错误类型枚举 */
export type TradeErrorType =
  | 'chasing_high'        // 追高买入
  | 'panic_selling'        // 恐慌卖出
  | 'premature_profit'     // 过早止盈
  | 'no_stop_loss'         // 不止损
  | 'overweight'           // 仓位过重
  | 'overtrading'          // 频繁交易
  | 'counter_trend'        // 逆势操作
  | 'ignore_risk'          // 忽视风险
  | 'emotional'            // 情绪化交易
  | 'no_plan'              // 缺乏计划
  | 'info_lag'             // 信息滞后
  | 'blind_follow'         // 盲目跟风

/** 交易错误类型元数据映射 */
export const TradeErrorMeta: Record<TradeErrorType, { label: string; severity: 'high' | 'medium' | 'low'; description: string }> = {
  chasing_high:      { label: '追高买入',   severity: 'high',   description: '在股价快速拉升阶段追涨买入，买入成本偏高' },
  panic_selling:     { label: '恐慌卖出',   severity: 'high',   description: '因市场恐慌情绪在低位割肉卖出' },
  premature_profit:  { label: '过早止盈',   severity: 'medium', description: '在趋势未结束时过早锁定利润，错失后续涨幅' },
  no_stop_loss:      { label: '不止损',     severity: 'high',   description: '未按计划执行止损，导致亏损扩大' },
  overweight:        { label: '仓位过重',   severity: 'high',   description: '单票或单一板块仓位超出计划上限' },
  overtrading:       { label: '频繁交易',   severity: 'medium', description: '交易频率过高，产生过多手续费和滑点损耗' },
  counter_trend:     { label: '逆势操作',   severity: 'high',   description: '在大盘或板块下行趋势中逆势做多' },
  ignore_risk:       { label: '忽视风险',   severity: 'high',   description: '未充分评估潜在风险即入场' },
  emotional:         { label: '情绪化交易', severity: 'medium', description: '受贪婪、恐惧等情绪驱动而非理性决策' },
  no_plan:           { label: '缺乏计划',   severity: 'medium', description: '交易前未制定明确的入场/出场/仓位计划' },
  info_lag:          { label: '信息滞后',   severity: 'low',    description: '基于过时或不完整信息做出交易决策' },
  blind_follow:      { label: '盲目跟风',   severity: 'medium', description: '未经独立分析，盲目跟随他人或市场热点' },
}

// ============================================================
// 心理画像（6 种）
// ============================================================

/** 交易心理画像类型 */
export type PsychProfile =
  | 'steady'        // 稳健型
  | 'aggressive'    // 激进型
  | 'conservative'  // 保守型
  | 'impulsive'     // 冲动型
  | 'hesitant'      // 犹豫型
  | 'balanced'      // 平衡型

/** 心理画像特征描述 */
export interface PsychProfileDescriptor {
  type: PsychProfile
  label: string
  strengths: string[]
  weaknesses: string[]
  /** 建议改进方向 */
  suggestions: string[]
  /** 适合的策略类型 */
  suitableStrategies: Array<'hot-sector' | 'value-pit' | 'core-scarce'>
}

/** 心理画像映射表 */
export const PsychProfileMeta: Record<PsychProfile, PsychProfileDescriptor> = {
  steady: {
    type: 'steady',
    label: '稳健型',
    strengths: ['纪律性强', '风险控制意识好', '长期稳定盈利'],
    weaknesses: ['过于保守可能错失机会', '进攻性不足'],
    suggestions: ['适当放宽入场条件', '在确定性高时适度提高仓位'],
    suitableStrategies: ['value-pit', 'core-scarce'],
  },
  aggressive: {
    type: 'aggressive',
    label: '激进型',
    strengths: ['敢于重仓', '捕获大行情能力强', '行动迅速'],
    weaknesses: ['回撤控制差', '容易追高', '止损执行不严格'],
    suggestions: ['严格执行止损纪律', '控制单票仓位上限', '增加复盘频率'],
    suitableStrategies: ['hot-sector'],
  },
  conservative: {
    type: 'conservative',
    label: '保守型',
    strengths: ['本金保护意识强', '回撤极小', '心态稳定'],
    weaknesses: ['收益率偏低', '过度依赖安全边际', '持仓周期过长'],
    suggestions: ['尝试小仓位参与趋势行情', '学习技术分析辅助决策'],
    suitableStrategies: ['value-pit', 'core-scarce'],
  },
  impulsive: {
    type: 'impulsive',
    label: '冲动型',
    strengths: ['执行力强', '敢于决策', '不犹豫'],
    weaknesses: ['缺乏计划性', '频繁交易', '追涨杀跌'],
    suggestions: ['建立交易前检查清单', '强制冷却期', '降低交易频率'],
    suitableStrategies: ['hot-sector'],
  },
  hesitant: {
    type: 'hesitant',
    label: '犹豫型',
    strengths: ['谨慎', '考虑周全', '不容易犯错'],
    weaknesses: ['错失最佳入场时机', '持仓信心不足', '过早止盈'],
    suggestions: ['制定明确入场规则', '使用条件单自动执行', '减少盯盘频率'],
    suitableStrategies: ['value-pit', 'core-scarce'],
  },
  balanced: {
    type: 'balanced',
    label: '平衡型',
    strengths: ['攻守兼备', '适应性强', '心态成熟'],
    weaknesses: ['无明显短板', '可能在极端行情中表现中庸'],
    suggestions: ['持续优化策略组合', '进一步细化交易系统'],
    suitableStrategies: ['hot-sector', 'value-pit', 'core-scarce'],
  },
}

// ============================================================
// 六维复盘报告
// ============================================================

/** 复盘报告单维度 */
export interface ReviewDimension {
  dimension: string
  label: string
  score: number           // 0-100
  weight: number          // 0-1
  rating: 'excellent' | 'good' | 'average' | 'poor' | 'critical'
  highlights: string[]
  issues: string[]
  suggestions: string[]
}

/** 六维复盘报告 */
export interface ReviewReport {
  /** 报告唯一标识 */
  id: string
  /** 报告周期 */
  period: {
    start: string       // ISO date
    end: string         // ISO date
  }
  /** 生成时间 */
  generatedAt: number

  // ===== 六维评分 =====
  /** 收益率维度（0-100） */
  returnRate: ReviewDimension
  /** 胜率维度（0-100） */
  winRate: ReviewDimension
  /** 盈亏比维度（0-100） */
  profitLossRatio: ReviewDimension
  /** 最大回撤维度（0-100） */
  maxDrawdown: ReviewDimension
  /** 夏普比率维度（0-100） */
  sharpeRatio: ReviewDimension
  /** 纪律执行维度（0-100） */
  discipline: ReviewDimension

  // ===== 汇总 =====
  /** 综合得分（0-100） */
  overallScore: number
  /** 综合评级 */
  overallRating: 'excellent' | 'good' | 'average' | 'poor' | 'critical'

  // ===== 统计摘要 =====
  summary: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    totalReturn: number           // 总收益率
    totalReturnAmount: number     // 总收益金额
    avgHoldingDays: number
    bestTrade: { symbol: string; return: number; date: string }
    worstTrade: { symbol: string; return: number; date: string }
  }

  // ===== 错误分析 =====
  errorBreakdown: Array<{
    errorType: TradeErrorType
    count: number
    totalLoss: number
    percentage: number
  }>

  // ===== 心理画像 =====
  psychProfile: PsychProfile
  psychProfileScore: Record<PsychProfile, number>  // 各画像匹配度 0-1

  // ===== 改进建议 =====
  topImprovements: string[]
  nextReviewDate: string
}

// ============================================================
// 技能发展路径
// ============================================================

/** 技能等级 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'

/** 技能维度 */
export interface SkillDimension {
  code: string
  name: string
  currentLevel: SkillLevel
  targetLevel: SkillLevel
  /** 当前该维度的评分（0-100） */
  score: number
  /** 距离目标还需提升的分数 */
  gap: number
}

/** 技能发展里程碑 */
export interface SkillMilestone {
  id: string
  title: string
  description: string
  skillDimension: string
  targetLevel: SkillLevel
  criteria: string[]
  /** 达成状态 */
  achieved: boolean
  achievedAt?: number
  /** 预计达成日期 */
  targetDate: string
}

/** 学习路径节点 */
export interface LearningPathNode {
  order: number
  title: string
  description: string
  /** 学习资源 */
  resources: Array<{ type: 'book' | 'course' | 'article' | 'video'; title: string; url?: string }>
  /** 练习任务 */
  exercises: string[]
  /** 预计耗时（小时） */
  estimatedHours: number
  /** 完成状态 */
  completed: boolean
}

/** 技能发展路径 */
export interface SkillDevelopment {
  /** 关联用户 */
  userId: string
  /** 技能维度评分 */
  dimensions: SkillDimension[]
  /** 里程碑列表 */
  milestones: SkillMilestone[]
  /** 学习路径 */
  learningPath: LearningPathNode[]
  /** 总体技能等级 */
  overallLevel: SkillLevel
  /** 最近更新时间 */
  updatedAt: number
}

// ============================================================
// 行动清单
// ============================================================

/** 行动优先级 */
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'

/** 行动状态 */
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

/** 单条行动项 */
export interface ActionItem {
  id: string
  title: string
  description: string
  priority: ActionPriority
  status: ActionStatus
  /** 关联的错误类型 */
  relatedErrors: TradeErrorType[]
  /** 关联的技能维度 */
  relatedSkill?: string
  /** 截止日期 */
  deadline?: string
  /** 完成日期 */
  completedAt?: number
  /** 验证标准 */
  successCriteria: string[]
  /** 进度备注 */
  notes?: string
}

/** 行动清单 */
export interface ActionPlan {
  /** 关联的复盘报告 ID */
  reviewReportId: string
  /** 生成时间 */
  createdAt: number
  /** 行动项列表 */
  items: ActionItem[]
  /** 统计 */
  stats: {
    total: number
    completed: number
    critical: number
    overdue: number
  }
  /** 下次检查日期 */
  nextCheckDate: string
}

// ============================================================
// 纪律评分
// ============================================================

/** 纪律评分维度 */
export interface DisciplineDimension {
  code: string
  name: string
  score: number           // 0-100
  weight: number          // 0-1
  /** 扣分项 */
  deductions: Array<{
    reason: string
    points: number         // 扣分分值
    tradeId?: string
    date: string
  }>
  /** 改进建议 */
  suggestion: string
}

/** 纪律评分 */
export interface DisciplineScore {
  /** 评分 ID */
  id: string
  /** 评分周期 */
  period: {
    start: string
    end: string
  }
  /** 评分时间 */
  scoredAt: number

  // ===== 六维纪律评分 =====
  /** 计划执行率 */
  planExecution: DisciplineDimension
  /** 止损纪律 */
  stopLoss: DisciplineDimension
  /** 仓位管理 */
  positionManagement: DisciplineDimension
  /** 交易频率 */
  tradeFrequency: DisciplineDimension
  /** 情绪控制 */
  emotionControl: DisciplineDimension
  /** 复盘质量 */
  reviewQuality: DisciplineDimension

  // ===== 汇总 =====
  /** 综合纪律分（0-100） */
  overallScore: number
  /** 评级 */
  rating: 'S' | 'A' | 'B' | 'C' | 'D'
  /** 较上期变化 */
  changeFromPrev?: number

  // ===== 扣分汇总 =====
  totalDeductions: number
  worstDimension: string
  bestDimension: string

  // ===== 建议 =====
  topRecommendations: string[]
}