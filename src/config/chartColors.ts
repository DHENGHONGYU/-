/**
 * @module chartColors
 * @description 图表与业务配色常量。
 * 集中管理饼图调色板、轮动因子色、板块因子色等图表专用颜色，
 * 所有涉及图表/热力图/轮动图配色的模块必须从此文件读取，禁止内联 HEX。
 *
 * @remarks
 * - 与 THEME_TOKENS.color（info/success/warning/destructive/muted）互补
 * - 当颜色语义与 THEME_TOKENS 重合时（如上涨/下跌），优先引用 THEME_TOKENS.color.*Raw
 * - 此文件仅存放图表/轮动等业务特有配色
 * - 内部颜色值统一引用 COLOR_TOKENS.hex
 */

import { THEME_TOKENS, COLOR_TOKENS } from '@/constants/theme.tokens'

// ============================================================
// 通用图表调色板
// ============================================================

/** 饼图 / 多系列图表调色板 */
export const PIE_CHART_PALETTE = [
  COLOR_TOKENS.info.hex,        // #3b82f6 蓝
  COLOR_TOKENS.success.hex,     // #22c55e 绿
  COLOR_TOKENS.warning.hex,     // #f59e0b 琥珀
  COLOR_TOKENS.danger.hex,      // #ef4444 红
  COLOR_TOKENS.purple.hex,      // #8b5cf6 紫
  COLOR_TOKENS.cyan.hex,        // #06b6d4 青
  COLOR_TOKENS.pink.hex,        // #ec4899 粉
  COLOR_TOKENS.orange.hex,      // #f97316 橙
  COLOR_TOKENS.teal.hex,        // #14b8a6 蓝绿
  COLOR_TOKENS.indigo.hex,      // #6366f1 靛蓝
] as const

// ============================================================
// 板块轮动分析配色
// ============================================================

/** 五大轮动因子配色（景气/资金/估值/β/量能） */
export const ROTATION_FACTOR_COLORS = {
  /** 景气因子 - 红色（唯一趋势主导） */
  JINGQI: COLOR_TOKENS.factorJingqi.hex,
  /** 资金因子 - 琥珀色 */
  ZIJIN: COLOR_TOKENS.factorZijin.hex,
  /** 估值因子 - 蓝色 */
  GUZHI: COLOR_TOKENS.factorGuzhi.hex,
  /** β因子 - 紫色 */
  BETA: COLOR_TOKENS.factorBeta.hex,
  /** 量能因子 - 青色 */
  NENGLIANG: COLOR_TOKENS.factorNengliang.hex,
} as const

/** 市场风格配色 */
export const MARKET_STYLE_COLORS = {
  /** 成长主导期 - 蓝色 */
  GROWTH: COLOR_TOKENS.styleGrowth.hex,
  /** 价值修复期 - 翠绿色 */
  VALUE: COLOR_TOKENS.styleValue.hex,
  /** 均衡震荡期 - 紫色 */
  BALANCED: COLOR_TOKENS.styleBalanced.hex,
} as const

/** 信号分级配色 */
export const SIGNAL_GRADE_COLORS = {
  /** 强信号 */
  STRONG: COLOR_TOKENS.signalStrong.hex,
  /** 中强信号 */
  MEDIUM_STRONG: COLOR_TOKENS.signalMediumStrong.hex,
  /** 中信号 */
  MEDIUM: COLOR_TOKENS.signalMedium.hex,
  /** 弱信号 */
  WEAK: COLOR_TOKENS.signalWeak.hex,
  /** 无信号 */
  NONE: COLOR_TOKENS.signalNone.hex,
} as const

/** 得分分档配色 */
export const SCORE_BUCKET_COLORS = {
  /** 聚焦主升区 */
  HIGH: COLOR_TOKENS.signalStrong.hex,
  /** 埋伏建仓区 */
  MEDIUM: COLOR_TOKENS.signalMedium.hex,
  /** 回避区 */
  LOW: COLOR_TOKENS.signalWeak.hex,
  /** 冷落观察池 */
  COLD: COLOR_TOKENS.signalNone.hex,
} as const

/** 下跌性质配色 */
export const DECLINE_NATURE_COLORS = {
  /** 杀逻辑 - 严重 */
  KILL_LOGIC: COLOR_TOKENS.danger.hex,
  /** 杀业绩 - 中等 */
  KILL_PERFORMANCE: COLOR_TOKENS.orange.hex,
  /** 杀估值 - 轻微 */
  KILL_VALUATION: COLOR_TOKENS.warning.hex,
  /** 杀估值 - 观察 */
  KILL_VALUATION_WATCH: COLOR_TOKENS.emerald.hex,
} as const

/** 高景气抛售预警配色 */
export const ALERT_LEVEL_COLORS = {
  /** 常态锁仓 */
  GREEN: COLOR_TOKENS.emerald.hex,
  /** 黄色减仓 */
  YELLOW: COLOR_TOKENS.warning.hex,
  /** 橙色降仓 */
  ORANGE: COLOR_TOKENS.orange.hex,
  /** 红色清仓 */
  RED: COLOR_TOKENS.danger.hex,
} as const

/** 股票池状态颜色（活跃/温热/冷清/冷淡） */
export const STOCK_POOL_STATUS_RAW_COLORS = [
  COLOR_TOKENS.success.hex,   // 活跃 - #22c55e
  COLOR_TOKENS.info.hex,      // 温热 - #3b82f6
  COLOR_TOKENS.warning.hex,   // 冷清 - #f59e0b
  COLOR_TOKENS.neutral.hex,   // 冷淡 - #9ca3af
] as const

// ============================================================
// 板块分析因子配色（mockData 使用）
// ============================================================

/**
 * 板块分析五因子配色（景气/资金/估值/β/量能）
 * @remarks 为板块热力图/雷达图定制的低饱和专业色阶，
 * 与 ROTATION_FACTOR_COLORS（高饱和语义色）用途不同，
 * 暂保留 HEX 硬编码以保证视觉辨识度。
 */
export const SECTOR_FACTOR_COLORS = {
  /** 景气 - 深蓝（定制色，非标准 token） */
  JINGQI: '#2E5C8A',
  /** 资金 - 紫（定制色，非标准 token） */
  ZIJIN: '#6B5B8E',
  /** 估值 - 绿（定制色，非标准 token） */
  GUZHI: '#06A77D',
  /** β - 红（定制色，非标准 token） */
  BETA: '#C73E3A',
  /** 量能 - 金（定制色，非标准 token） */
  NENGLIANG: '#D4A017',
} as const

// ============================================================
// AI 中心配色
// ============================================================

/** AI 智能体标签配色 */
export const AI_AGENT_TAG_COLORS = {
  /** LLM模型 - 紫 */
  LLM: COLOR_TOKENS.purple.hex,
  /** 知识库 - 蓝 */
  KNOWLEDGE: COLOR_TOKENS.info.hex,
  /** 工具链 - 翠绿 */
  TOOL: COLOR_TOKENS.emerald.hex,
  /** 策略 - 琥珀 */
  STRATEGY: COLOR_TOKENS.warning.hex,
} as const

/** AI 中心概览卡片配色 */
export const AI_OVERVIEW_CARD_COLORS = {
  /** 智能体总数 */
  TOTAL_AGENTS: COLOR_TOKENS.info.hex,
  /** 知识库使用 */
  KNOWLEDGE_USAGE: COLOR_TOKENS.purple.hex,
  /** 任务执行 */
  TASK_EXECUTIONS: COLOR_TOKENS.warning.hex,
  /** 监控告警 */
  MONITOR_ALERTS: COLOR_TOKENS.danger.hex,
} as const

// ============================================================
// 通用辅助色
// ============================================================

/** 中性/占位默认颜色（用于 recommendtaion 默认值等） */
export const NEUTRAL_COLOR = THEME_TOKENS.color.mutedRaw

/** 评分推荐默认颜色（观望/持有等中性状态） */
export const DEFAULT_RECOMMENDATION_COLORS = {
  /** 观望 - 灰400 */
  HOLD: COLOR_TOKENS.neutral.hex,
  /** 持有 - 灰500 */
  HOLD_DARK: COLOR_TOKENS.gray500.hex,
} as const

// ============================================================
// 资讯情感趋势配色（DA-008）
// ============================================================

/** 情感趋势图三色盘：正面 / 负面 / 中性 */
export const SENTIMENT_TREND_COLORS = {
  /** 正面 - 翠绿 */
  positive: COLOR_TOKENS.emerald.hex,
  /** 负面 - 危险红 */
  negative: COLOR_TOKENS.danger.hex,
  /** 中性 - 中性灰 */
  neutral: COLOR_TOKENS.neutral.hex,
} as const
