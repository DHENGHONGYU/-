/**
 * 八级筹码桥接（symbol → ChipResult）
 *
 * 复用 RLES store 已拉取的日线 K 线，经 quotesToQuoteData 转为 QuoteData，调用 v6 引擎的
 * evaluateChip 计算八级筹码结果。接入 RLES D4 风险健康度的筹码风险惩罚。
 *
 * 语义价值：八级筹码的 PAS/BIAS/PRO 可区分"吸筹"与"派发"，直接支撑对方策略中
 * "大盘巨量=派发利空"的语境判定（中小盘放量吸筹、大盘放量派发）。
 */

import { quotesToQuoteData, DEFAULT_ENGINE_CONFIG } from '@/services/scoring/v6-engine'
import { evaluateChip } from '@/services/scoring/v6-engine/calculators/l7_l8'
import type { ChipResult, StockBasicData, FinancialData } from '@/services/scoring/v6-engine/types'
import type { KlineBar } from '@/services/collect'
import type { DailyQuotes } from '@/data/types/types.marketData'

/**
 * 给定股票代码与日线历史（KlineBar[]），计算八级筹码结果。
 * K 线不足 / 构造失败返回 null（RLES 自动中性降级）。
 */
export function evaluateChipForStock(symbol: string, klineHistory: KlineBar[]): ChipResult | null {
  if (!klineHistory || klineHistory.length === 0) return null
  const latest = klineHistory[klineHistory.length - 1]
  if (!latest) return null
  const dailyQuotes: DailyQuotes = {
    symbol,
    latest,
    history: klineHistory,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
  const quotes = quotesToQuoteData(dailyQuotes)
  const stock: StockBasicData = { symbol } as StockBasicData
  const financials: FinancialData = {} as FinancialData
  return evaluateChip({ stock, financials, quotes, config: DEFAULT_ENGINE_CONFIG })
}
