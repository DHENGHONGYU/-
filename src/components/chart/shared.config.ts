/**
 * 图表共享配置
 *
 * 消除 candlestickChart.config.ts 和 multiPaneChart.config.ts 之间的重复常量。
 * 所有周期选项、复权选项、均线配置在此统一定义。
 *
 * V8: 引入 CHART_SEMANTIC_PALETTE 语义维度→颜色桥接，
 * 让图表消费者按业务维度（估值/质量/动量/波动…）选色，而非硬编码 series1-6。
 *
 * @module components/chart/shared.config
 * @created 2026-08-15
 * @updated 2026-08-17 — V8 semantic palette bridge
 */

import { CHART_PALETTE_PRO, CHART_SEMANTIC_PALETTE } from '@/constants/theme.tokens'
import type { ChartSemanticDimension } from '@/constants/theme.tokens'
import type { KlinePeriod, KlineAdjust } from '@/services/fetcher/fetcherTypes'

/** 周期选项配置 */
export const PERIOD_OPTIONS: Array<{ value: KlinePeriod; label: string; group: 'intraday' | 'daily' }> = [
  { value: '1min', label: '1分', group: 'intraday' },
  { value: '5min', label: '5分', group: 'intraday' },
  { value: '15min', label: '15分', group: 'intraday' },
  { value: '30min', label: '30分', group: 'intraday' },
  { value: '60min', label: '60分', group: 'intraday' },
  { value: 'daily', label: '日线', group: 'daily' },
  { value: 'weekly', label: '周线', group: 'daily' },
  { value: 'monthly', label: '月线', group: 'daily' },
]

/** 复权选项配置 */
export const ADJUST_OPTIONS: Array<{ value: KlineAdjust; label: string }> = [
  { value: 'qfq', label: '前复权' },
  { value: 'hfq', label: '后复权' },
  { value: '', label: '不复权' },
]

/** 均线配置（周期 / 颜色） */
export const MA_OPTIONS: Array<{ period: number; color: string }> = [
  { period: 5, color: CHART_PALETTE_PRO.series1 },
  { period: 10, color: CHART_PALETTE_PRO.series2 },
  { period: 20, color: CHART_PALETTE_PRO.series3 },
  { period: 60, color: CHART_PALETTE_PRO.series4 },
]

/** 十字光标节流间隔（ms），对应 60fps */
export const THROTTLE_MS = 16

// ============================================================
// V8: 语义维度 → 颜色桥接
// ============================================================

/** 语义维度键名 → 中文标签映射 */
export const SEMANTIC_DIMENSION_LABELS: Record<ChartSemanticDimension, string> = {
  valuation: '估值',
  quality: '质量',
  momentum: '动量',
  volatility: '波动',
  growth: '成长',
  sentiment: '情绪',
  risk: '风险',
  technical: '技术',
  benchmark: '基准',
}

/** 中文/英文维度名模糊匹配 → 语义维度键 */
const DIMENSION_NAME_MAP: Record<string, ChartSemanticDimension> = {
  // 中文
  '估值': 'valuation',
  '质量': 'quality',
  '动量': 'momentum',
  '波动': 'volatility',
  '成长': 'growth',
  '情绪': 'sentiment',
  '风险': 'risk',
  '技术': 'technical',
  '基准': 'benchmark',
  // 英文
  'valuation': 'valuation',
  'quality': 'quality',
  'momentum': 'momentum',
  'volatility': 'volatility',
  'growth': 'growth',
  'sentiment': 'sentiment',
  'risk': 'risk',
  'technical': 'technical',
  'benchmark': 'benchmark',
  // 别名
  'value': 'valuation',
  'factor': 'quality',
  'beta': 'volatility',
  '情绪面': 'sentiment',
  '技术面': 'technical',
  '基本面': 'quality',
  '资金面': 'momentum',
  '景气度': 'growth',
  '赛道': 'growth',
  '对比': 'benchmark',
}

/**
 * 根据维度名称获取语义色（primary）
 * @param dimensionName 维度名称（中文/英文/别名）
 * @returns 对应语义色的 primary 值，未匹配则返回 neutral 灰色
 */
export function getSemanticColor(dimensionName: string): string {
  const dim = DIMENSION_NAME_MAP[dimensionName]
  if (dim && dim in CHART_SEMANTIC_PALETTE) {
    return CHART_SEMANTIC_PALETTE[dim].primary
  }
  // 模糊匹配：遍历所有维度名，包含关系
  for (const [key, value] of Object.entries(DIMENSION_NAME_MAP)) {
    if (dimensionName.includes(key) || key.includes(dimensionName)) {
      if (value in CHART_SEMANTIC_PALETTE) {
        return CHART_SEMANTIC_PALETTE[value].primary
      }
    }
  }
  return CHART_SEMANTIC_PALETTE.benchmark.primary
}

/**
 * 获取语义维度的完整色阶（primary / secondary / background / dark）
 */
export function getSemanticScale(dimensionName: string): {
  readonly primary: string
  readonly secondary: string
  readonly background: string
  readonly dark: string
} {
  const dim = DIMENSION_NAME_MAP[dimensionName]
  if (dim && dim in CHART_SEMANTIC_PALETTE) {
    return CHART_SEMANTIC_PALETTE[dim]
  }
  return CHART_SEMANTIC_PALETTE.benchmark
}

/** 9 维度语义色序列（用于多系列图表的默认配色） */
export const SEMANTIC_SERIES_COLORS: string[] = [
  CHART_SEMANTIC_PALETTE.valuation.primary,
  CHART_SEMANTIC_PALETTE.quality.primary,
  CHART_SEMANTIC_PALETTE.momentum.primary,
  CHART_SEMANTIC_PALETTE.volatility.primary,
  CHART_SEMANTIC_PALETTE.growth.primary,
  CHART_SEMANTIC_PALETTE.sentiment.primary,
  CHART_SEMANTIC_PALETTE.risk.primary,
  CHART_SEMANTIC_PALETTE.technical.primary,
  CHART_SEMANTIC_PALETTE.benchmark.primary,
]