/**
 * @module ScoreCompletenessConfig
 * @description 评分因子完整性检查配置（P0 修复 R04：因子缺失默认 0 分）
 *
 * 定义每个评分因子对应的数据来源、必填字段和完整性判定规则。
 * 评分计算前需先检查各因子数据完整性，>30% 因子缺失直接跳过评分。
 *
 * @doc V9-DOC-QUALITY-004
 */

import { STORE_NAME } from '@/config/dbConfig'

/** 因子数据来源配置 */
export interface FactorSource {
  /** IndexedDB store 名称 */
  store: string
  /** 必填字段列表 */
  fields: string[]
  /** 最少需要的字段数 */
  minRequired: number
  /** 因子描述 */
  description: string
}

/** 因子完整性状态 */
export type FactorCompletenessStatus = 'complete' | 'partial' | 'insufficient'

/** 因子完整性检查结果 */
export interface FactorCompleteness {
  /** 因子名称 */
  factorName: string
  /** 需要的最少字段数 */
  required: number
  /** 实际可用字段数 */
  available: number
  /** 完整度百分比 (0-100) */
  completeness: number
  /** 完整性状态 */
  status: FactorCompletenessStatus
}

/** 评分完整性总体状态 */
export type ScoreCompletenessStatus = 'complete' | 'partial_data' | 'data_insufficient'

/** 评分完整性结果 */
export interface ScoreCompletenessResult {
  /** 总体状态 */
  status: ScoreCompletenessStatus
  /** 各因子完整性 */
  factors: FactorCompleteness[]
  /** 缺失因子数量 */
  insufficientCount: number
  /** 缺失因子比例 */
  insufficientRatio: number
  /** 是否应该计算评分 */
  shouldCalculate: boolean
  /** 状态消息 */
  message: string
}

/**
 * 因子 → 数据来源映射表
 *
 * V6 引擎 11 层 → 9 因子映射关系：
 * - 估值: L3v (价值层)
 * - 成长: L7 (成长层) + L5 (盈利层)
 * - 盈利: L3f (财务健康层)
 * - 质量: L1 (行业层) + L3f (财务健康层)
 * - 动量: L8 (技术筹码层)
 * - 波动: L8 (技术筹码层)
 * - 流动性: L8 (技术筹码层)
 * - 行业: L-1 (行业评分) + L0 (宏观层) + L2 (行业竞争层)
 * - 情绪: L6 (情绪层) + L4 (资金层)
 */
export const FACTOR_DATA_SOURCE: Record<string, FactorSource> = {
  '估值': {
    store: STORE_NAME.stocks,
    fields: ['pe', 'pb', 'ps', 'price'],
    minRequired: 2,
    description: '基本面估值指标',
  },
  '成长': {
    store: STORE_NAME.stocks,
    fields: ['revenueYoY', 'profitYoY', 'roe'],
    minRequired: 1,
    description: '营收/利润增长率',
  },
  '盈利': {
    store: STORE_NAME.stocks,
    fields: ['roe', 'netProfitMargin', 'grossMargin'],
    minRequired: 2,
    description: '盈利能力指标',
  },
  '质量': {
    store: STORE_NAME.stocks,
    fields: ['debtRatio', 'currentRatio', 'roe'],
    minRequired: 1,
    description: '财务质量指标',
  },
  '动量': {
    store: STORE_NAME.dailyQuotes,
    fields: ['close', 'changePct', 'volume'],
    minRequired: 2,
    description: '价格动量指标',
  },
  '波动': {
    store: STORE_NAME.dailyQuotes,
    fields: ['high', 'low', 'close'],
    minRequired: 2,
    description: '价格波动指标',
  },
  '流动性': {
    store: STORE_NAME.dailyQuotes,
    fields: ['volume', 'amount', 'turnoverRate'],
    minRequired: 1,
    description: '流动性指标',
  },
  '行业': {
    store: STORE_NAME.stocks,
    fields: ['industryCode', 'sector', 'marketCap'],
    minRequired: 1,
    description: '行业分类和竞争力指标',
  },
  '情绪': {
    store: STORE_NAME.stocks,
    fields: ['sentimentScore', 'changePct', 'volume'],
    minRequired: 1,
    description: '市场情绪指标',
  },
}

/** 因子缺失比例阈值：超过此值直接跳过评分 */
export const INSUFFICIENT_THRESHOLD = 0.3

/** 因子缺失比例阈值：低于此值正常评分，但标注 */
export const PARTIAL_THRESHOLD = 0.1

/**
 * 根据股票数据检查因子完整性
 *
 * @param stockData - 股票基础数据
 * @param quotesData - 行情数据（可选）
 * @returns 各因子完整性检查结果
 */
export function checkFactorCompleteness(
  stockData: Record<string, unknown> | null | undefined,
  quotesData?: Record<string, unknown> | null,
): FactorCompleteness[] {
  const results: FactorCompleteness[] = []

  for (const [factorName, source] of Object.entries(FACTOR_DATA_SOURCE)) {
    let record: Record<string, unknown> | null | undefined

    if (source.store === STORE_NAME.stocks) {
      record = stockData
    } else if (source.store === STORE_NAME.dailyQuotes) {
      record = quotesData
    }

    if (!record) {
      results.push({
        factorName,
        required: source.minRequired,
        available: 0,
        completeness: 0,
        status: 'insufficient',
      })
      continue
    }

    const available = source.fields.filter((f) => {
      const val = record?.[f]
      return val !== null && val !== undefined && val !== ''
    }).length

    const completeness = source.fields.length > 0
      ? available / source.fields.length
      : 0

    const status: FactorCompletenessStatus =
      available >= source.minRequired
        ? 'complete'
        : available > 0
          ? 'partial'
          : 'insufficient'

    results.push({
      factorName,
      required: source.minRequired,
      available,
      completeness: Math.round(completeness * 100),
      status,
    })
  }

  return results
}

/**
 * 根据因子完整性结果决定是否计算评分
 *
 * @param factors - 因子完整性检查结果
 * @returns 评分完整性总体结果
 */
export function evaluateCompleteness(factors: FactorCompleteness[]): ScoreCompletenessResult {
  const totalFactors = factors.length
  const insufficientFactors = factors.filter((f) => f.status === 'insufficient')
  const insufficientCount = insufficientFactors.length
  const insufficientRatio = totalFactors > 0 ? insufficientCount / totalFactors : 0

  let status: ScoreCompletenessStatus
  let shouldCalculate: boolean
  let message: string

  if (insufficientRatio > INSUFFICIENT_THRESHOLD) {
    status = 'data_insufficient'
    shouldCalculate = false
    message = `数据不足：${insufficientCount}/${totalFactors} 个因子无数据（${(insufficientRatio * 100).toFixed(0)}%），无法生成可信评分`
  } else if (insufficientRatio > PARTIAL_THRESHOLD) {
    status = 'partial_data'
    shouldCalculate = true
    message = `注意：${insufficientCount} 个因子数据不完整（${insufficientFactors.map((f) => f.factorName).join('、')}），评分仅供参考`
  } else {
    status = 'complete'
    shouldCalculate = true
    message = insufficientCount > 0
      ? `数据基本完整（${insufficientCount} 个因子数据部分缺失）`
      : '所有因子数据完整'
  }

  return {
    status,
    factors,
    insufficientCount,
    insufficientRatio,
    shouldCalculate,
    message,
  }
}