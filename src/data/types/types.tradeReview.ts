/**
 * @fileoverview 交易复盘持久化实体类型
 *
 * 从服务层归位至 data/types/，供 dataLayerTradingStores 与 DataBridge 使用。
 * 完整类型定义见 src/types/modules/tradeReviewAI.types.ts。
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
  skillRoadmap: string[]
  psychologicalProfile: PsychologicalProfile | null
}
