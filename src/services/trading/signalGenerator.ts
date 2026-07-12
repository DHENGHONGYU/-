import { getEffectiveTradingConfig } from '@/config/tradingConfig'
import type { SignalDirection } from '@/config/tradingConfig'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type { DailyQuotes, KlineBar, Signal, SignalSnapshot, Stock } from '@/data/types'
import { generateId } from '@/data/db'
import { SIGNAL_GENERATOR_THRESHOLDS } from '@/config/thresholds'

export type TradingSignal = Signal

function computeMA(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI14(closes: number[]): number | undefined {
  if (closes.length < SIGNAL_GENERATOR_THRESHOLDS.RSI_MIN_CLOSES) return undefined
  const window = closes.slice(-(SIGNAL_GENERATOR_THRESHOLDS.RSI_MIN_CLOSES + 1))
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function computeVolumeRatio(history: KlineBar[]): number | undefined {
  if (history.length < SIGNAL_GENERATOR_THRESHOLDS.VOLUME_RATIO_MIN_BARS) return undefined
  const recent = history[history.length - 1]!.volume
  const avg = history.slice(-(SIGNAL_GENERATOR_THRESHOLDS.VOLUME_RATIO_MIN_BARS), -1).reduce((sum, bar) => sum + bar.volume, 0) / (SIGNAL_GENERATOR_THRESHOLDS.VOLUME_RATIO_MIN_BARS - 1)
  if (avg === 0) return undefined
  return recent / avg
}

function computeMACDDirection(closes: number[]): 'red' | 'green' | 'neutral' {
  if (closes.length < SIGNAL_GENERATOR_THRESHOLDS.MACD_MIN_CLOSES) return 'neutral'
  const ema = (values: number[], period: number): number => {
    const k = 2 / (period + 1)
    let result: number = values[0]!
    for (let i = 1; i < values.length; i++) {
      result = values[i]! * k + result * (1 - k)
    }
    return result
  }
  const ema12 = ema(closes.slice(-12), 12)
  const ema26 = ema(closes.slice(-26), 26)
  const diff = ema12 - ema26
  // 简化：只用当前 DIF 正负判断方向
  return diff > 0 ? 'red' : diff < 0 ? 'green' : 'neutral'
}

function buildSnapshot(stock: Stock, quotes: DailyQuotes): SignalSnapshot {
  const closes = quotes.history.map((bar) => bar.close)
  const ma20 = computeMA(closes, 20)
  const ma60 = computeMA(closes, 60)
  const latest = quotes.latest.close
  return {
    // 估值安全边际：使用 PE/PB 绝对值作为代理指标
    // PE < peMax 且 PB < pbMax 视为估值安全
    // 注：如需真实百分位，需在数据采集层补充历史 PE/PB 序列并计算分布
    pePercentile: stock.pe,
    pbPercentile: stock.pb,
    priceToMA20: ma20 !== undefined && ma20 !== 0 ? (latest - ma20) / ma20 : undefined,
    priceToMA60: ma60 !== undefined && ma60 !== 0 ? (latest - ma60) / ma60 : undefined,
    volumeRatio: computeVolumeRatio(quotes.history),
    rsi14: computeRSI14(closes),
    macdDirection: computeMACDDirection(closes),
  }
}

function generateBuySignals(snapshot: SignalSnapshot): TradingSignal[] {
  const signals: TradingSignal[] = []
  const config = getEffectiveTradingConfig().signalThresholds

  // buy_dip：价格低于 MA20 8% 且 RSI < 30
  if (
    snapshot.priceToMA20 !== undefined &&
    snapshot.priceToMA20 < -config.dipToMA20Pct / 100 &&
    snapshot.rsi14 !== undefined &&
    snapshot.rsi14 < config.dipRsi14Max
  ) {
    signals.push({
      id: '',
      symbol: '',
      direction: 'buy',
      type: 'buy_dip',
      strategy: 'signal',
      confidence: 0.55,
      rationale: `价格低于 MA20 ${(snapshot.priceToMA20 * 100).toFixed(1)}%，RSI14 ${snapshot.rsi14.toFixed(1)} 处于超卖区间`,
      snapshot,
      createdAt: 0,
    })
  }

  // buy_pivot：突破 MA20 + 放量 + MACD 红柱
  if (
    snapshot.priceToMA20 !== undefined &&
    snapshot.priceToMA20 > 0 &&
    snapshot.volumeRatio !== undefined &&
    snapshot.volumeRatio > config.pivotVolumeRatioMin &&
    snapshot.macdDirection === 'red'
  ) {
    signals.push({
      id: '',
      symbol: '',
      direction: 'buy',
      type: 'buy_pivot',
      strategy: 'signal',
      confidence: 0.65,
      rationale: `价格站上 MA20，量比 ${snapshot.volumeRatio.toFixed(2)}，MACD 红柱`,
      snapshot,
      createdAt: 0,
    })
  }

  // buy_safety_margin：估值安全边际（PE/PB 绝对值低于配置阈值）
  if (
    snapshot.pePercentile !== undefined &&
    snapshot.pePercentile > 0 &&
    snapshot.pePercentile < config.peMax &&
    snapshot.pbPercentile !== undefined &&
    snapshot.pbPercentile > 0 &&
    snapshot.pbPercentile < config.pbMax
  ) {
    signals.push({
      id: '',
      symbol: '',
      direction: 'buy',
      type: 'buy_safety_margin',
      strategy: 'signal',
      confidence: 0.5,
      rationale: `估值安全边际：PE ${snapshot.pePercentile.toFixed(1)} < ${config.peMax}，PB ${snapshot.pbPercentile.toFixed(2)} < ${config.pbMax}`,
      snapshot,
      createdAt: 0,
    })
  }

  return signals
}

function generateSellSignals(
  snapshot: SignalSnapshot,
  history: KlineBar[],
): TradingSignal[] {
  const signals: TradingSignal[] = []
  const config = getEffectiveTradingConfig().signalThresholds
  const latest = history[history.length - 1]!.close

  // sell_profit_taking：价格高于 MA20 15% 且 RSI > 70
  if (
    snapshot.priceToMA20 !== undefined &&
    snapshot.priceToMA20 > config.profitTakingToMA20Pct / 100 &&
    snapshot.rsi14 !== undefined &&
    snapshot.rsi14 > config.profitTakingRsi14Min
  ) {
    signals.push({
      id: '',
      symbol: '',
      direction: 'sell',
      type: 'sell_profit_taking',
      strategy: 'signal',
      confidence: 0.55,
      rationale: `价格高于 MA20 ${(snapshot.priceToMA20 * 100).toFixed(1)}%，RSI14 ${snapshot.rsi14.toFixed(1)} 处于超买区间`,
      snapshot,
      createdAt: 0,
    })
  }

  // sell_trailing_stop：从近期最高点回撤 10%
  const recentHistory = history.slice(-60)
  if (recentHistory.length === 0) {
    return signals
  }
  const highest = Math.max(...recentHistory.map((bar) => bar.high))
  if (highest > 0 && (highest - latest) / highest > config.trailingStopDrawdownPct / 100) {
    signals.push({
      id: '',
      symbol: '',
      direction: 'sell',
      type: 'sell_trailing_stop',
      strategy: 'signal',
      confidence: 0.7,
      rationale: `从近期高点 ${highest.toFixed(2)} 回撤 ${(((highest - latest) / highest) * 100).toFixed(1)}%`,
      snapshot,
      createdAt: 0,
    })
  }

  return signals
}

/**
 * 为单只股票生成交易信号
 */
export async function generateSignalsForSymbol(
  symbol: string,
): Promise<TradingSignal[]> {
  const normalized = symbol.trim().toUpperCase()
  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.trading,
  })
  const quotesResult = await dataBridge.query<DailyQuotes>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.dailyQuotes,
    key: normalized,
    source: MODULE_ID.trading,
  })
  const stock = stockResult.success && stockResult.data ? stockResult.data : undefined
  const quotes = quotesResult.success && quotesResult.data ? quotesResult.data : undefined

  if (!stock) {
    return []
  }

  if (!quotes || quotes.history.length < 20) {
    return [
      {
        id: generateId(),
        symbol: normalized,
        direction: 'watch',
        type: 'watch',
        strategy: 'signal',
        confidence: 0.1,
        rationale: '行情数据不足，保持观察',
        snapshot: {},
        createdAt: Date.now(),
      },
    ]
  }

  const snapshot = buildSnapshot(stock, quotes)
  const buySignals = generateBuySignals(snapshot)
  const sellSignals = generateSellSignals(snapshot, quotes.history)
  const rawSignals = [...buySignals, ...sellSignals]

  const now = Date.now()
  const signals: TradingSignal[] = rawSignals.map((s) => ({
    ...s,
    id: generateId(),
    symbol: normalized,
    createdAt: now,
  }))

  // 综合共振：同方向多个独立信号时生成 composite
  const buyCount = signals.filter((s) => s.direction === 'buy').length
  const sellCount = signals.filter((s) => s.direction === 'sell').length

  if (buyCount >= 2) {
    const baseConfidence = Math.max(...signals.filter((s) => s.direction === 'buy').map((s) => s.confidence))
    signals.push({
      id: generateId(),
      symbol: normalized,
      direction: 'buy',
      type: 'composite_buy',
      strategy: 'signal',
      confidence: Math.min(1, baseConfidence + 0.2 * (buyCount - 1)),
      rationale: `共振：同时触发 ${buyCount} 个买入信号`,
      snapshot,
      createdAt: now,
    })
  }

  if (sellCount >= 2) {
    const baseConfidence = Math.max(...signals.filter((s) => s.direction === 'sell').map((s) => s.confidence))
    signals.push({
      id: generateId(),
      symbol: normalized,
      direction: 'sell',
      type: 'composite_sell',
      strategy: 'signal',
      confidence: Math.min(1, baseConfidence + 0.2 * (sellCount - 1)),
      rationale: `共振：同时触发 ${sellCount} 个卖出信号`,
      snapshot,
      createdAt: now,
    })
  }

  if (signals.length === 0) {
    signals.push({
      id: generateId(),
      symbol: normalized,
      direction: 'hold',
      type: 'hold',
      strategy: 'signal',
      confidence: 0.15,
      rationale: '无明确信号，建议持有/观望',
      snapshot,
      createdAt: now,
    })
  }

  return signals
}

/**
 * 从一组信号中挑选最强信号（买入优先于卖出，再按置信度）
 */
export function pickStrongestSignal(signals: TradingSignal[]): TradingSignal | undefined {
  if (signals.length === 0) return undefined
  const priority: Record<SignalDirection, number> = { buy: 3, sell: 2, watch: 1, hold: 0 }
  return signals.slice().sort((a, b) => {
    const pa = priority[a.direction] ?? 0
    const pb = priority[b.direction] ?? 0
    if (pa !== pb) return pb - pa
    return b.confidence - a.confidence
  })[0]
}
