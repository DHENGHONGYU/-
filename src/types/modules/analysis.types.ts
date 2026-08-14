/**
 * @module analysis.types
 * @description 分析舱调用输入舱数据的接口契约类型。
 *
 * 定义「分析舱」消费「输入舱」意向候选池数据的只读契约：
 * - AnalysisScope：分析作用域（意向候选池 / 全量标的）
 * - AnalysisCandidate：分析候选标的（意向池条目 + 来源溯源 + 已有评分）
 * - AnalysisCandidateQuery：拉取参数（来源 / 分组过滤）
 *
 * @see @/services/input/intentionPoolService.ts - 数据提供方服务
 * @see @/store/analysisStore.ts - 分析舱消费方
 */

import type { ScreenSource, StockDataQuality } from '@/data/types/types.stock'

/** 分析作用域 */
export type AnalysisScope = 'intention' | 'all'

/** 分析候选标的 —— 分析舱消费输入舱数据的契约 */
export interface AnalysisCandidate {
  symbol: string
  name: string
  /** 录入来源：hot-sector=来源一（热门板块核心标的）/ manual=来源二（自定义检索） */
  screenSource?: ScreenSource
  /** 意向池分组 */
  group?: string
  /** 采集完成度 */
  dataQuality?: StockDataQuality
  /** 最新价（采集后填充） */
  price?: number
  /** 市盈率 */
  pe?: number
  /** 市净率 */
  pb?: number
  /** 已存在 V6 综合评分（join v6Scores，可选展示） */
  v6Score?: number
  /** 入库时间戳（用于倒序排序） */
  ingestedAt?: number
}

/** 拉取参数 */
export interface AnalysisCandidateQuery {
  scope: AnalysisScope
  /** 仅来源一（hot-sector）/ 来源二（manual） */
  screenSource?: ScreenSource
  /** 分组过滤 */
  group?: string
}
