/**
 * V6 评分引擎数据适配器
 *
 * 将 dataLayer 的原始数据结构（Stock、DailyQuotes 等）适配为
 * 引擎内部使用的标准化结构（StockBasicData、QuoteData 等）。
 *
 * 从 types.ts 迁移而来，保持类型纯净，符合"类型文件只放类型"原则。
 *
 * @module services/scoring/v6-engine/adapters
 * @doc [V9-DOC-PROJ-066, V9-DOC-PROJ-053, V9-DOC-ARCH-008]
 */

import type { Stock, DailyQuotes } from '@/data/types'
import type { StockBasicData, QuoteData } from './types'

/**
 * 将 dataLayer 的 Stock 适配为引擎 StockBasicData
 *
 * 仅提取引擎关心的基础字段；缺失字段保持 undefined，由各层计算器自行降级。
 */
export function stockToBasicData(stock: Stock): StockBasicData {
  return {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    sector: stock.industryCode,
  }
}

/**
 * 安全计算收益率，避免除以零或 undefined。
 * 将 `past !== undefined && past !== 0 && latestClose !== undefined` 收敛到单一位置。
 */
function safeReturn(past: number | undefined, latestClose: number | undefined): number | undefined {
  if (past === undefined || past === 0 || latestClose === undefined) {
    return undefined
  }
  return (latestClose - past) / past
}

/**
 * 将 dataLayer 的 DailyQuotes 适配为引擎 QuoteData
 *
 * 计算 20/60 日收益率、20 日波动率与平均换手率；历史数据不足时字段保持 undefined。
 */
export function quotesToQuoteData(quotes: DailyQuotes): QuoteData {
  const history = quotes.history
  const latestBar = history[history.length - 1]
  const latestClose = latestBar?.close

  // 20 日收益率
  let return20d: number | undefined
  if (history.length >= 21) {
    const past = history[history.length - 20 - 1]?.close
    return20d = safeReturn(past, latestClose)
  }

  // 60 日收益率
  let return60d: number | undefined
  if (history.length >= 61) {
    const past = history[history.length - 60 - 1]?.close
    return60d = safeReturn(past, latestClose)
  }

  // 20 日波动率（日收益标准差）
  let volatility20d: number | undefined
  if (history.length >= 20) {
    const returns: number[] = []
    for (let i = history.length - 20; i < history.length; i++) {
      const prev = history[i - 1]?.close
      const curr = history[i]?.close
      if (prev === undefined || prev === 0 || curr === undefined) continue
      returns.push((curr - prev) / prev)
    }
    if (returns.length > 0) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const variance =
        returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
      volatility20d = Math.sqrt(variance)
    }
  }

  // 20 日均换手率（仅当有 turnoverRate 数据时计算）
  let avgTurnover20d: number | undefined
  if (history.length >= 20) {
    const turnovers: number[] = []
    for (let i = history.length - 20; i < history.length; i++) {
      const t = history[i]?.turnoverRate
      if (typeof t === 'number' && Number.isFinite(t)) {
        turnovers.push(t)
      }
    }
    if (turnovers.length >= 10) {
      avgTurnover20d = turnovers.reduce((a, b) => a + b, 0) / turnovers.length
    }
  }

  return {
    latestClose,
    return20d,
    return60d,
    volatility20d,
    avgTurnover20d,
    history: history.map((bar) => bar.close),
    volumeHistory: history.map((bar) => bar.volume),
    // G3-B Phase 3：KlineBar.turnoverRate 是 %，直接透传（算法内部 ÷ 100 转小数）
    turnoverRateHistory: history.map((bar) => (typeof bar.turnoverRate === 'number' && Number.isFinite(bar.turnoverRate) ? bar.turnoverRate : 3)),
  }
}
