/**
 * @fileoverview 交易复盘持久化实体类型
 *
 * 从服务层归位至 data/types/，供 dataLayerTradingStores 与 DataBridge 使用。
 * 完整类型定义见 src/types/modules/tradeReviewAI.types.ts。
  * @doc [V9-DOC-QA-080, V9-DOC-QA-066]
*/

import type {
  TradeReviewReport,
  PsychologicalProfile,
  TradeError,
} from '@/types/modules/tradeReviewAI.types'

/** 持久化到 trade_reviews store 的复盘摘要记录 */
export interface TradeReviewRecord {
  id: string
  generatedAt: number
  report: TradeReviewReport
  tradeErrors: TradeError[]
  disciplineScore: number
  /** 真实订单驱动的交易表现分（RealTradeReviewScoreCalculator：胜率+执行+仓位纪律）。
   *  与 disciplineScore（tradeErrorClassifier 违规扣分，纪律遵守度）语义不同，独立落库不覆盖。 */
  realDisciplineScore?: number
  skillRoadmap: string[]
  psychologicalProfile: PsychologicalProfile | null
}
